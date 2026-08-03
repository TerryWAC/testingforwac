#!/usr/bin/env node
// Deadlock Match Ping — queue-pop watcher with phone pushes. Zero dependencies.
//
// Tails Deadlock's console.log (enabled with the -condebug launch option) and
// the moment a line matches a "match found" pattern it pings you: loud beeps,
// a desktop notification, and a push to your phone via ntfy.sh. Friends who
// subscribe to your topic get the phone push too.
//
// Usage:
//   node watch.js                 first run: guided setup, then start watching
//   node watch.js --setup         re-run the guided setup
//   node watch.js --log <path>    watch a specific console.log
//   node watch.js --test          fire the alert right now to check everything
//   node watch.js --find          scan the existing console.log for likely
//                                 match-found lines (run right after a match
//                                 popped without an alert)
//   node watch.js --learn        capture log lines live while you queue, to
//                                 pinpoint the match-found line by timing

const fs = require('fs');
const os = require('os');
const path = require('path');
const https = require('https');
const crypto = require('crypto');
const { execFile, spawn } = require('child_process');
const readline = require('readline');

// Don't die if stdout goes away (e.g. output piped to a closed pager).
process.stdout.on('error', () => {});

const APP_VERSION = '3.0';

// ---------------------------------------------------------------- config ---

// When running as a compiled .exe (Node SEA), "next to the app" means next
// to the executable, not inside the bundled snapshot.
let IS_SEA = false;
try { IS_SEA = require('node:sea').isSea(); } catch {}
const APP_DIR = (!IS_SEA && typeof __dirname !== 'undefined')
  ? __dirname
  : path.dirname(process.execPath);

const argv = process.argv.slice(2);
const argConfig = argv.indexOf('--config');
const CONFIG_PATH = argConfig !== -1 && argv[argConfig + 1]
  ? path.resolve(argv[argConfig + 1])
  : path.join(APP_DIR, 'config.json');
const DEFAULTS = {
  // Path to Deadlock's console.log. null = try the common Steam locations.
  logPath: null,
  // Case-insensitive regexes. If ANY matches a new log line, the alert fires.
  // "Lobby N for Match N created" is the line Deadlock prints the moment the
  // queue pops. If a patch changes the wording, use `--find` or `--learn`.
  patterns: [
    'Lobby\\s+\\d+\\s+for\\s+Match\\s+\\d+\\s+created',
  ],
  // Backup patterns fire ONLY while a queue is active (between the queue
  // start and stop messages below). "CL: Connected to" appears when the game
  // joins any server — including the practice range and custom lobbies — so
  // ungated it would false-ping; gated, it catches a match even if a patch
  // renames the lobby line. The cooldown stops it double-pinging after the
  // primary pattern already fired.
  backupPatterns: [
    "\\[Client\\] CL:\\s+Connected to",
  ],
  // Lines that mark entering/leaving the matchmaking queue — used only for
  // console status so you can see the watcher is really tracking your queue.
  // Anchored to the Send-msg shape so GC *response* lines can't double-fire;
  // the \w* wildcards catch mode variants (Ranked/Standard) the matchmaking
  // update may use, e.g. k_EMsgClientToGCStartRankedMatchmaking.
  queueStartPatterns: ['Send msg \\d+ \\(k_EMsgClientToGCStart\\w*Matchmaking\\w*\\)'],
  queueStopPatterns: ['Send msg \\d+ \\(k_EMsgClientToGCStop\\w*Matchmaking\\w*\\)'],
  // Never alert on these: connections to the game's own machine (menu,
  // practice range, local/bot servers) are not real match servers.
  ignorePatterns: ['loopback', '127\\.0\\.0\\.1', 'localhost'],
  // Lines that mark a match ending — they open the post-match quiet window.
  matchEndPatterns: [
    'Lobby\\s+\\d+\\s+for\\s+Match\\s+\\d+\\s+destroyed',
    'Disconnecting from server',
    'Server shutting down',
  ],
  // Deadlock buffers its log and can flush minutes-old lines in one burst
  // (e.g. when the game opens or closes). Lines whose own timestamp is older
  // than this many seconds never alert.
  staleSeconds: 120,
  // Lines that reveal which hero you have selected / are loading. First
  // capture group = the hero's internal name; the ping includes it.
  heroPatterns: [
    '\\[Server\\] Loaded hero \\d+/(hero_\\w+)',
    'VMDL Camera Pose Success!.*models/heroes(?:_wip|_staging)?/(\\w+)/',
  ],
  // Lines that reveal the map/mode you loaded into (first capture group).
  // Translated to a friendly name (Normal / Street Brawl) when recognised.
  modePatterns: [
    '\\[HostStateManager\\] Host activate:.*\\(([^)]+)\\)',
    '\\[Client\\] Map:\\s+"([^"]+)"',
  ],
  // Seconds to ignore further matches after an alert (one pop = one ping).
  cooldownSeconds: 60,
  // What the ping says — shows up in the phone push, the desktop toast, and
  // the console. {hero} becomes your selected hero's name ("🎯 Haze — MATCH
  // FOUND"); if no hero is known yet it's cleanly dropped. {mode} works the
  // same way (Normal / Street Brawl), {queue} is your queue time.
  alertTitle: '🎯 {hero} — MATCH FOUND',
  alertMessage: 'YOU HAVE A GAME — GO GO GO!',
  // PC speaker noise when the match pops: 'loud' (beep storm), 'soft'
  // (a couple of gentle beeps — the toast + phone do the shouting), or 'off'.
  pcSound: 'soft',
  // After a match ends, stay quiet for this long unless a NEW queue starts —
  // kills any leftover end-of-game log noise for good.
  postMatchQuietSeconds: 120,
  // Phone pings via https://ntfy.sh — the setup wizard fills this in.
  // Everyone subscribed to this topic gets the push (that's how you ping
  // friends too). The topic name is the only secret.
  ntfyTopic: null,
  // Discord pings: a channel webhook URL. Messages arrive from a bot named
  // "Game Tracker" — friends in the server need zero installs.
  discordWebhook: null,
  // Prepended to the Discord match-found message so people actually get
  // notified. Set to "" for a silent message, or e.g. "<@&ROLE_ID>".
  discordMention: '@everyone',
  // Any webhook→notification service (e.g. Hark on iOS: hark.ryan.ceo).
  // The body template is POSTed as JSON with {title}/{message}/{image}/{link}
  // filled in — adjust the field names to whatever your service expects.
  customWebhookUrl: null,
  customWebhookBody: '{"title":"{title}","body":"{message}","image":"{image}","url":"{link}"}',
  customWebhookImage: 'https://github.com/TerryWAC/testingforwac/raw/main/assets/game-tracker-avatar.png',
  customWebhookLink: 'steam://run/1422450',
  // Download link used in the generated share-with-friends message.
  shareDownloadUrl: 'https://github.com/TerryWAC/testingforwac/releases/latest/download/DeadlockMatchPing.exe',
  // Self-healing: at startup the watcher fetches this small file from the
  // repo. When a Deadlock patch rewords the log, the repo file is updated
  // and every copy heals itself on next launch — no re-downloads. It also
  // carries the latest app version for the update notice. Set to null (or
  // patternUpdates: false) to disable.
  patternUpdates: true,
  patternsUrl: 'https://raw.githubusercontent.com/TerryWAC/testingforwac/main/patterns.json',
  // AFK escalation: if the pop pinged but no sign of you loading into the
  // match appears within this many seconds, a second, angrier ping fires on
  // every channel. 0 disables.
  afkSeconds: 45,
};

// Pattern-shaped keys a fetched patterns.json may override (nothing else —
// remote data must never touch webhooks, topics, or alert text).
const OTA_KEYS = ['patterns', 'backupPatterns', 'queueStartPatterns', 'queueStopPatterns',
  'matchEndPatterns', 'ignorePatterns', 'modePatterns', 'heroPatterns'];

function httpGetJson(url, timeoutMs = 4000, redirects = 2) {
  return new Promise(resolve => {
    let u;
    try { u = new URL(url); } catch { return resolve(null); }
    const mod = u.protocol === 'http:' ? require('http') : https; // http only ever used by tests
    const req = mod.get(u, { timeout: timeoutMs }, res => {
      if (res.statusCode >= 301 && res.statusCode <= 308 && res.headers.location && redirects > 0) {
        res.resume();
        return resolve(httpGetJson(res.headers.location, timeoutMs, redirects - 1));
      }
      if (res.statusCode !== 200) { res.resume(); return resolve(null); }
      let body = '';
      res.on('data', d => { body += d; });
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

function verNewer(remote, local) {
  const a = String(remote).split('.').map(Number);
  const b = String(local).split('.').map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] || 0, y = b[i] || 0;
    if (x !== y) return x > y;
  }
  return false;
}

// Fetch remote patterns (falling back to the last cached copy when offline),
// apply them over the config, and surface an update notice if a newer app
// version exists. Returns quietly on any failure — built-ins always work.
async function applyRemotePatterns(config) {
  if (config.patternUpdates === false || !config.patternsUrl) return;
  const cachePath = path.basename(CONFIG_PATH) === 'config.json'
    ? path.join(path.dirname(CONFIG_PATH), 'patterns-cache.json')
    : CONFIG_PATH.replace(/\.json$/, '') + '.pcache.json';
  let remote = await httpGetJson(config.patternsUrl);
  if (remote) {
    try { fs.writeFileSync(cachePath, JSON.stringify(remote, null, 2) + '\n'); } catch {}
  } else {
    try { remote = JSON.parse(fs.readFileSync(cachePath, 'utf8')); } catch {}
  }
  if (!remote || typeof remote !== 'object') return;
  let applied = 0;
  for (const key of OTA_KEYS) {
    if (Array.isArray(remote[key]) && remote[key].every(p => typeof p === 'string')) {
      try {
        remote[key].forEach(p => new RegExp(p)); // reject broken regexes whole
        config[key] = remote[key];
        applied++;
      } catch {}
    }
  }
  if (applied) {
    console.log(`· Detection patterns: up to date (v${remote.version ?? '?'} from the repo).`);
  }
  if (remote.latestVersion && verNewer(remote.latestVersion, APP_VERSION)) {
    const note = remote.updateNote ? ` ${remote.updateNote}` : '';
    console.log(`· Update available: v${remote.latestVersion} (you have v${APP_VERSION}).${note}`);
    console.log(`  Re-download: ${config.shareDownloadUrl || DEFAULTS.shareDownloadUrl}`);
    desktopNotify(`Deadlock Match Ping v${remote.latestVersion} available`,
      'Re-download the exe from your usual link — settings survive.', 'off');
  }
}

function buildShareMessage(config) {
  const lines = [
    'Yo — get this. It pings your phone the SECOND your Deadlock match pops, so you can alt-tab in queue without ever missing a game. Takes 2 minutes:',
    '',
    `1. Download on your PC: ${config.shareDownloadUrl || DEFAULTS.shareDownloadUrl}`,
    '   (Windows warns once because it\'s unsigned — click "More info" then "Run anyway".)',
    '2. Double-click it and follow the steps on screen — it sets everything up',
    '   and gives you your own code for the free ntfy phone app.',
    '',
    'It says which hero you got, the mode, your queue time — and yells louder if you don\'t tab back in.',
  ];
  if (config.discordWebhook) {
    lines.push('(My pings also land in our Discord channel if you just want those.)');
  }
  lines.push('', "That's it. Never miss a queue pop again.");
  return lines.join('\n');
}

// Pattern lists shipped by earlier versions — configs still carrying one of
// these verbatim are auto-upgraded to the current verified defaults.
const LEGACY_PATTERN_SETS = [
  JSON.stringify([
    'match\\s*(ready|found|made)',
    'party_?match',
    'matchmaking.*(ready|found|complete)',
    'lobby.*(ready|found)',
    'Connect(ing)? to .*server',
    'CCitadelLobby.*match',
  ]),
  JSON.stringify([
    'Lobby\\s+\\d+\\s+for\\s+Match\\s+\\d+\\s+created',
    "\\[Client\\] CL:\\s+Connected to",
  ]),
];

// Queue history lives next to the config (last 50 pops: when, how long, hero).
const STATS_PATH = path.basename(CONFIG_PATH) === 'config.json'
  ? path.join(path.dirname(CONFIG_PATH), 'queue-stats.json')
  : CONFIG_PATH.replace(/\.json$/, '') + '.stats.json';

function loadStats() {
  try { return JSON.parse(fs.readFileSync(STATS_PATH, 'utf8')); }
  catch { return []; }
}

function recordQueue(seconds, hero, mode) {
  const stats = loadStats();
  stats.push({ at: new Date().toISOString(), seconds, hero: hero || null, ...(mode ? { mode } : {}) });
  while (stats.length > 50) stats.shift();
  try { fs.writeFileSync(STATS_PATH, JSON.stringify(stats, null, 2) + '\n'); } catch {}
  return stats;
}

function updateLastStat(fields) {
  const stats = loadStats();
  if (!stats.length) return;
  const last = stats[stats.length - 1];
  // Only enrich a FRESH entry. If this pop wasn't recorded (e.g. the watcher
  // started mid-queue), the hero/mode/duration must not smudge a previous
  // session's match.
  if (Date.now() - new Date(last.at).getTime() > 3 * 3600 * 1000) return;
  Object.assign(last, fields);
  try { fs.writeFileSync(STATS_PATH, JSON.stringify(stats, null, 2) + '\n'); } catch {}
}

function printStats() {
  const stats = loadStats();
  if (!stats.length) {
    console.log('No queues recorded yet — stats appear after your first match pop.');
    return;
  }
  const queues = stats.map(s => s.seconds);
  const matches = stats.filter(s => s.matchSeconds != null);
  const heroes = {};
  for (const s of stats) if (s.hero) heroes[s.hero] = (heroes[s.hero] || 0) + 1;
  const top = Object.entries(heroes).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
  const thisWeek = stats.filter(s => new Date(s.at).getTime() > weekAgo).length;
  console.log('Deadlock Match Ping — your stats');
  console.log(`  Queues popped:  ${stats.length}`);
  console.log(`  Average queue:  ${fmtDuration(queues.reduce((a, b) => a + b, 0) / queues.length)}` +
    `   Longest: ${fmtDuration(Math.max(...queues))}`);
  if (matches.length) {
    console.log(`  Average match:  ${fmtDuration(matches.reduce((a, s) => a + s.matchSeconds, 0) / matches.length)}` +
      ` (${matches.length} tracked)`);
  }
  if (top.length) {
    console.log(`  Most played:    ${top.map(([h, n]) => `${h} ×${n}`).join(', ')}`);
  }
  const modes = {};
  for (const s of stats) if (s.mode) modes[s.mode] = (modes[s.mode] || 0) + 1;
  if (Object.keys(modes).length) {
    console.log(`  Modes:          ${Object.entries(modes).map(([m, n]) => `${m} ×${n}`).join(', ')}`);
  }
  console.log(`  Last 7 days:    ${thisWeek} matches`);
}

function avgSeconds(stats, lastN = 20) {
  const recent = stats.slice(-lastN);
  if (!recent.length) return null;
  return recent.reduce((a, s) => a + s.seconds, 0) / recent.length;
}

function fmtDuration(seconds) {
  const m = Math.floor(seconds / 60), s = Math.round(seconds % 60);
  return m ? `${m}m ${s}s` : `${s}s`;
}

function loadConfig() {
  let user = {};
  try { user = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')); }
  catch (e) {
    if (e.code !== 'ENOENT') {
      // Never hard-exit here: in --steam mode that would stop the GAME from
      // launching. Move the corrupt file aside and start fresh instead.
      console.error(`Warning: ${CONFIG_PATH} is unreadable (${e.message}) — ` +
        'moving it to config.json.bad and starting fresh.');
      try { fs.renameSync(CONFIG_PATH, CONFIG_PATH + '.bad'); } catch {}
    }
    return null; // no config yet — triggers the setup wizard
  }
  let migrated = false;
  if (LEGACY_PATTERN_SETS.includes(JSON.stringify(user.patterns))) {
    delete user.patterns;
    delete user.backupPatterns;
    migrated = true;
  }
  // Wizard-generated "name" alerts ("🎯 TERRY — MATCH FOUND") move to the
  // hero-based default; hand-typed custom titles are left alone.
  if (/^🎯 .+ — MATCH FOUND$/.test(user.alertTitle || '') &&
      /^.+, the queue popped — tab in and accept!$/.test(user.alertMessage || '')) {
    delete user.alertTitle;
    delete user.alertMessage;
    migrated = true;
  }
  if (user.alertMessage === 'Queue popped — tab in and accept!') {
    delete user.alertMessage; // previous default → current default
    migrated = true;
  }
  for (const [key, legacy] of [
    ['queueStartPatterns', ['["k_EMsgClientToGCStartMatchmaking"]',
      '["Send msg \\\\d+ \\\\(k_EMsgClientToGCStartMatchmaking\\\\)"]']],
    ['queueStopPatterns', ['["k_EMsgClientToGCStopMatchmaking"]',
      '["Send msg \\\\d+ \\\\(k_EMsgClientToGCStopMatchmaking\\\\)"]']],
  ]) {
    if (legacy.includes(JSON.stringify(user[key]))) {
      delete user[key]; // older shapes → current ranked-aware default
      migrated = true;
    }
  }
  if (migrated) {
    saveConfig({ ...DEFAULTS, ...user });
    console.log('(Updated config.json to the latest defaults.)');
  }
  return { ...DEFAULTS, ...user };
}

function saveConfig(config) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n');
}

// ------------------------------------------------------- find console.log ---

const GAME_REL = ['game', 'citadel', 'console.log'];

// Steam install roots: env override, the Windows registry (Steam's real
// install path), then well-known locations.
function steamRoots() {
  const home = os.homedir();
  const roots = [];
  if (process.env.DMP_STEAM_ROOT) roots.push(process.env.DMP_STEAM_ROOT);
  if (process.platform === 'win32') {
    for (const args of [
      ['query', 'HKCU\\Software\\Valve\\Steam', '/v', 'SteamPath'],
      ['query', 'HKLM\\SOFTWARE\\WOW6432Node\\Valve\\Steam', '/v', 'InstallPath'],
    ]) {
      try {
        const out = require('child_process').execFileSync('reg', args,
          { encoding: 'utf8', windowsHide: true });
        const m = /REG_SZ\s+(.+)/.exec(out);
        if (m) roots.push(m[1].trim());
      } catch {}
    }
    roots.push(
      path.join('C:', 'Program Files (x86)', 'Steam'),
      path.join('C:', 'Program Files', 'Steam'),
      ...'CDEFGH'.split('').map(d => path.join(`${d}:`, 'SteamLibrary')),
      ...'DEFGH'.split('').map(d => path.join(`${d}:`, 'Steam')),
      ...'DEFGH'.split('').map(d => path.join(`${d}:`, 'Games', 'Steam')),
    );
  } else if (process.platform === 'darwin') {
    roots.push(path.join(home, 'Library', 'Application Support', 'Steam'));
  } else {
    roots.push(
      path.join(home, '.steam', 'steam'),
      path.join(home, '.local', 'share', 'Steam'),
    );
  }
  return [...new Set(roots)];
}

// Steam keeps an index of every game library (any drive) — read it so the
// game is found no matter where it's installed.
function steamLibraries(root) {
  const libs = [root];
  try {
    const vdf = fs.readFileSync(path.join(root, 'steamapps', 'libraryfolders.vdf'), 'utf8');
    for (const m of vdf.matchAll(/"path"\s+"([^"]+)"/g)) {
      libs.push(m[1].replace(/\\\\/g, '\\'));
    }
  } catch {}
  return libs;
}

function candidateLogPaths() {
  const candidates = [];
  // The app folder may have been dropped inside the Deadlock folder itself —
  // walk up from here looking for game/citadel/console.log.
  let dir = APP_DIR;
  for (let i = 0; i < 6; i++) {
    candidates.push(path.join(dir, ...GAME_REL));
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  // Every Steam library on every drive.
  for (const root of steamRoots()) {
    for (const lib of steamLibraries(root)) {
      candidates.push(path.join(lib, 'steamapps', 'common', 'Deadlock', ...GAME_REL));
    }
  }
  return candidates;
}

function findLogPath(config) {
  if (config.logPath) return config.logPath;
  for (const p of candidateLogPaths()) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

// ----------------------------------------------------------------- alerts ---

function beepLoop(times) {
  if (times <= 0) return;
  // Terminal bell burst — audible in most terminals even in the background.
  let i = 0;
  const t = setInterval(() => {
    process.stdout.write('\x07');
    if (++i >= times) clearInterval(t);
  }, 350);
}

function desktopNotify(title, body, pcSound = 'soft') {
  const opts = { windowsHide: true };
  if (process.platform === 'win32') {
    const beeps = { loud: 6, soft: 2, off: 0 }[pcSound] ?? 2;
    const beepPs = beeps
      ? `1..${beeps} | ForEach-Object { [console]::beep(880, 150); Start-Sleep -Milliseconds 120 };`
      : '';
    // Toast via PowerShell (no modules needed), plus a system sound.
    const ps = `
      [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null;
      $x = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02);
      $x.GetElementsByTagName('text').Item(0).InnerText = '${title.replace(/'/g, "''")}';
      $x.GetElementsByTagName('text').Item(1).InnerText = '${body.replace(/'/g, "''")}';
      $aumid = '{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\\WindowsPowerShell\\v1.0\\powershell.exe';
      [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier($aumid).Show([Windows.UI.Notifications.ToastNotification]::new($x));
      ${beepPs}
    `;
    execFile('powershell', ['-NoProfile', '-Command', ps], opts, () => {});
  } else if (process.platform === 'darwin') {
    execFile('osascript', ['-e',
      `display notification ${JSON.stringify(body)} with title ${JSON.stringify(title)} sound name "Glass"`], opts, () => {});
    execFile('afplay', ['/System/Library/Sounds/Glass.aiff'], opts, () => {});
  } else {
    execFile('notify-send', ['-u', 'critical', title, body], opts, () => {});
    execFile('paplay', ['/usr/share/sounds/freedesktop/stereo/complete.oga'], opts, () => {});
  }
}

function phonePush(topic, title, body) {
  return new Promise(resolve => {
    if (!topic) return resolve(false);
    // JSON publish format — headers must be ASCII, but the JSON body may
    // contain full UTF-8 (emoji in the title).
    const payload = JSON.stringify({
      topic, title, message: body, priority: 5, tags: ['dart'],
    });
    const req = https.request({
      hostname: 'ntfy.sh',
      path: '/',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      timeout: 10_000,
    }, res => { res.resume(); resolve(res.statusCode === 200); });
    req.on('error', err => {
      console.error(`  (phone push failed: ${err.message})`);
      resolve(false);
    });
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.end(payload);
  });
}

// Fill {hero}/{mode} into a template; unknown values drop cleanly along with
// any dangling separator so "🎯 {hero} — MATCH FOUND" → "🎯 MATCH FOUND".
function fillToken(tpl, token, value) {
  const ph = `{${token}}`;
  if (!tpl.includes(ph)) return { text: tpl, used: false };
  if (value) return { text: tpl.split(ph).join(value), used: true };
  const re = new RegExp(`\\s*\\{${token}\\}\\s*[—–:-]*\\s*`, 'g');
  return { text: tpl.replace(re, ' ').replace(/\s+/g, ' ').trim(), used: true };
}

function formatWithHero(tpl, hero, mode) {
  const h = fillToken(tpl, 'hero', hero);
  const m = fillToken(h.text, 'mode', mode);
  return { text: m.text, usedHero: h.used };
}

function discordPush(webhook, content) {
  return new Promise(resolve => {
    if (!webhook) return resolve(false);
    let u;
    try { u = new URL(webhook); } catch { return resolve(false); }
    const mod = u.protocol === 'http:' ? require('http') : https; // http only ever used by tests
    const payload = JSON.stringify({ username: 'Game Tracker', content });
    const req = mod.request({
      hostname: u.hostname,
      port: u.port || undefined,
      path: u.pathname + u.search,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      timeout: 10_000,
    }, res => { res.resume(); resolve(res.statusCode >= 200 && res.statusCode < 300); });
    req.on('error', err => {
      console.error(`  (Discord ping failed: ${err.message})`);
      resolve(false);
    });
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.end(payload);
  });
}

function customPush(config, title, message) {
  return new Promise(resolve => {
    const url = config.customWebhookUrl;
    if (!url) return resolve(false);
    let u;
    try { u = new URL(url); } catch { return resolve(false); }
    const esc = s => JSON.stringify(String(s)).slice(1, -1); // JSON-safe fill
    const payload = (config.customWebhookBody || DEFAULTS.customWebhookBody)
      .split('{title}').join(esc(title))
      .split('{message}').join(esc(message))
      .split('{image}').join(esc(config.customWebhookImage ?? DEFAULTS.customWebhookImage))
      .split('{link}').join(esc(config.customWebhookLink ?? DEFAULTS.customWebhookLink));
    const mod = u.protocol === 'http:' ? require('http') : https; // http only ever used by tests
    const req = mod.request({
      hostname: u.hostname,
      port: u.port || undefined,
      path: u.pathname + u.search,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      timeout: 10_000,
    }, res => { res.resume(); resolve(res.statusCode >= 200 && res.statusCode < 300); });
    req.on('error', err => {
      console.error(`  (custom webhook failed: ${err.message})`);
      resolve(false);
    });
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.end(payload);
  });
}

function fireAlert(config, line, hero, queueSeconds, mode) {
  const t = formatWithHero(config.alertTitle || DEFAULTS.alertTitle, hero, mode);
  const b = formatWithHero(config.alertMessage || DEFAULTS.alertMessage, hero, mode);
  const title = t.text;
  let body = b.text;
  // Custom templates without {hero} still get the hero mentioned somewhere.
  if (hero && !t.usedHero && !b.usedHero) body += ` Hero: ${hero}.`;
  if (queueSeconds != null) {
    const dur = fmtDuration(queueSeconds);
    if (body.includes('{queue}')) body = body.split('{queue}').join(dur);
    else body += ` You queued ${dur}.`;
  }
  const pcSound = config.pcSound || DEFAULTS.pcSound;
  // Phone/Discord/toast go FIRST: a Windows console stuck in selection mode
  // blocks stdout writes, and the pings must not wait behind a frozen console.
  const push = phonePush(config.ntfyTopic, title, body);
  const mention = config.discordMention ?? DEFAULTS.discordMention;
  discordPush(config.discordWebhook, `${mention ? mention + ' ' : ''}${title} — ${body}`);
  customPush(config, title, body);
  desktopNotify(title, body, pcSound);
  console.log(`\n=== ${title} — ${new Date().toLocaleTimeString()} ===`);
  console.log(`    ${body}`);
  if (line) console.log(`    matched line: ${line.trim()}`);
  beepLoop({ loud: 8, soft: 2, off: 0 }[pcSound] ?? 2);
  return push;
}

// Deadlock's internal hero codenames → in-game names (community-documented).
// Unknown codenames fall back to a cleaned-up version of the codename.
const HERO_NAMES = {
  atlas: 'Abrams', bebop: 'Bebop', nano: 'Calico', dynamo: 'Dynamo',
  orion: 'Grey Talon', haze: 'Haze', astro: 'Holliday', inferno: 'Infernus',
  tengu: 'Ivy', kelvin: 'Kelvin', ghost: 'Lady Geist', lash: 'Lash',
  forge: 'McGinnis', mirage: 'Mirage', krill: 'Mo & Krill', chrono: 'Paradox',
  synth: 'Pocket', gigawatt: 'Seven', shiv: 'Shiv', hornet: 'Vindicta',
  viscous: 'Viscous', wraith: 'Wraith', warden: 'Warden', yamato: 'Yamato',
  magician: 'Sinclair', slork: 'Fathom', vampirebat: 'Mina',
};

function heroDisplayName(codename) {
  const key = codename.toLowerCase().replace(/^hero_/, '');
  if (HERO_NAMES[key]) return HERO_NAMES[key];
  return key.charAt(0).toUpperCase() + key.slice(1);
}

// Map/mode codename → friendly mode name. Returns null for maps that are not
// real matches (hideout, sandbox, tutorial) or that we don't recognise —
// better to say nothing than to guess wrong.
function modeDisplayName(raw) {
  const k = String(raw).toLowerCase();
  if (k.includes('hideout') || k.includes('sandbox') || k.includes('tutorial') || k.includes('demo')) return null;
  if (k.includes('brawl')) return 'Street Brawl';
  if (k.includes('ranked')) return 'Ranked';
  if (k.includes('unranked') || k.includes('standard')) return 'Standard';
  if (k.includes('street_test') || k === 'dl_streets') return 'Normal';
  return null;
}

// Ranked and Standard play on the same map, so the map name alone can't tell
// them apart — but the queue-start GC message can (e.g. ...StartRanked
// Matchmaking). Returns the mode implied by a queue-start line, or null.
function queueModeFromLine(line) {
  if (/rank/i.test(line) && !/unranked/i.test(line)) return 'Ranked';
  if (/unranked|standard/i.test(line)) return 'Standard';
  return null;
}

// Deadlock log lines start with "MM/DD HH:MM:SS". Returns the line's own
// timestamp as epoch ms, or null if the line carries none.
function parseLogTime(line, now = new Date()) {
  const m = /^(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2}):(\d{2})\b/.exec(line);
  if (!m) return null;
  let t = new Date(now.getFullYear(), m[1] - 1, m[2], m[3], m[4], m[5]).getTime();
  // A Dec 31 line read on Jan 1 first parses as ~a year in the future —
  // rebuild it with last year (calendar-correct, unlike subtracting days).
  if (t > now.getTime() + 24 * 3600 * 1000) {
    t = new Date(now.getFullYear() - 1, m[1] - 1, m[2], m[3], m[4], m[5]).getTime();
  }
  return t;
}

// ------------------------------------------------------------------- tail ---

function tailFile(logPath, onLine) {
  // Start at end-of-file; survive the file being truncated/recreated on
  // game restart (size shrink = start over from 0). Reads are serialized —
  // a tick is skipped while the previous read is still in flight, so lines
  // from a burst of log output can't interleave out of order.
  const { StringDecoder } = require('string_decoder');
  let pos = fs.existsSync(logPath) ? fs.statSync(logPath).size : 0;
  let buf = '';
  let decoder = new StringDecoder('utf8'); // multi-byte chars can straddle chunks
  let reading = false;
  setInterval(() => {
    if (reading) return;
    let stat;
    try { stat = fs.statSync(logPath); } catch { return; }
    if (stat.size < pos) { pos = 0; buf = ''; decoder = new StringDecoder('utf8'); }
    if (stat.size === pos) return;
    reading = true;
    const startPos = pos;
    const stream = fs.createReadStream(logPath, { start: pos, end: stat.size - 1 });
    pos = stat.size;
    stream.on('data', chunk => {
      buf += decoder.write(chunk);
      const lines = buf.split('\n');
      buf = lines.pop();
      lines.forEach(onLine);
    });
    stream.on('close', () => { reading = false; });
    stream.on('error', () => {
      // Re-read this window next tick rather than silently skipping it — a
      // duplicate line is harmless (dedup guards), a dropped pop is not.
      pos = startPos; buf = ''; decoder = new StringDecoder('utf8'); reading = false;
    });
  }, 500);
}

// ----------------------------------------------------------- setup wizard ---

function ask(rl, q) {
  // Resolve with '' if stdin closes (piped input ran out) so setup still
  // completes and saves instead of silently exiting.
  return new Promise(resolve => {
    if (rl.closed) return resolve('');
    const onClose = () => resolve('');
    rl.once('close', onClose);
    try {
      rl.question(q, a => {
        rl.removeListener('close', onClose);
        resolve(a.trim());
      });
    } catch { resolve(''); }
  });
}

async function setupWizard(existing) {
  const config = { ...DEFAULTS, ...(existing || {}) };
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  console.log('');
  console.log('  ╔═══════════════════════════════════════╗');
  console.log('  ║   🎯  DEADLOCK MATCH PING — SETUP     ║');
  console.log('  ╚═══════════════════════════════════════╝');

  // Step 1: the game log
  console.log('\nStep 1 of 7 — Deadlock\'s log file');
  let logPath = findLogPath(config);
  if (logPath) {
    console.log(`  ✓ Found it: ${logPath}`);
  } else {
    console.log('  Deadlock needs one launch option so it writes a log file:');
    console.log('    Steam → right-click Deadlock → Properties → Launch Options → add:  -condebug');
    console.log('  Then launch Deadlock once. (You can finish this setup first.)');
    const p = await ask(rl, '  Path to console.log if you know it (Enter to auto-detect later): ');
    if (p) config.logPath = p;
  }

  // Step 2: phone pushes — your choice
  console.log('\nStep 2 of 7 — Phone pings (via the free ntfy app, no account needed)');
  if (config.ntfyTopic) {
    const keep = await ask(rl, `  Phone pings are ON (code: ${config.ntfyTopic}). Keep them? (Y/n): `);
    if (keep.toLowerCase().startsWith('n')) {
      config.ntfyTopic = null;
      console.log('  Phone pings turned off.');
    }
  } else {
    const wantPhone = await ask(rl, '  Would you like pings on your phone? (Y/n): ');
    if (wantPhone.toLowerCase().startsWith('n')) {
      console.log('  Skipped — add them any time with --setup.');
    } else {
      // Short but unguessable-enough: "dl-" + 6 chars from an alphabet with
      // no confusable characters (no 0/o, 1/l/i) — easy to type.
      const alpha = 'abcdefghjkmnpqrstuvwxyz23456789';
      let code = '';
      for (const byte of crypto.randomBytes(6)) code += alpha[byte % alpha.length];
      config.ntfyTopic = 'dl-' + code;
      console.log(`  Your personal code:  ${config.ntfyTopic}`);
      console.log('  1. Install "ntfy" on your phone:');
      console.log('       Android: https://play.google.com/store/apps/details?id=io.heckel.ntfy');
      console.log('       iPhone:  https://apps.apple.com/us/app/ntfy/id1625396347');
      console.log(`  2. In the app: + Subscribe to topic → type:  ${config.ntfyTopic}`);
      const send = await ask(rl, '  Press Enter to send a test ping to check it (or type "skip"): ');
      if (send.toLowerCase() !== 'skip') {
        const ok = await phonePush(config.ntfyTopic, '🎯 Deadlock Match Ping',
          'Test ping — you are all set!');
        console.log(ok ? '  ✓ Test ping sent — check your phone!'
                       : '  ✗ Could not reach ntfy.sh — check your internet, or run --test later.');
      }
    }
  }

  // Step 3: Discord — pings arrive from a "Game Tracker" bot, zero installs
  console.log('\nStep 3 of 7 — Discord pings (bot named "Game Tracker")');
  if (config.discordWebhook) {
    const keep = await ask(rl, '  Discord pings are ON. Keep them? (Y/n): ');
    if (keep.toLowerCase().startsWith('n')) {
      config.discordWebhook = null;
      console.log('  Discord pings turned off.');
    }
  } else {
    const wantDiscord = await ask(rl,
      '  Would you like pings on Discord too (or instead)? Friends in the server\n  need to install NOTHING. (y/N): ');
    if (wantDiscord.toLowerCase().startsWith('y')) {
      console.log('  In Discord: your channel → ⚙ Edit Channel → Integrations → Webhooks →');
      console.log('  New Webhook → name it Game Tracker → Copy Webhook URL.');
      const hook = await ask(rl, '  Paste the webhook URL (Enter to skip): ');
      if (hook && /^https:\/\/(\w+\.)?discord(app)?\.com\/api\/webhooks\//.test(hook)) {
        config.discordWebhook = hook;
        const ok = await discordPush(hook, '🎯 Game Tracker is connected — test ping!');
        console.log(ok ? '  ✓ Test message sent — check the channel!'
                       : '  ✗ Discord did not accept it — double-check the URL, or re-run --setup later.');
      } else if (hook) {
        console.log('  ✗ That does not look like a Discord webhook URL — skipped (re-run --setup to retry).');
      }
    }
  }
  // Step 4: branded iOS pings via a webhook-notification app (e.g. Hark)
  console.log('\nStep 4 of 7 — Branded iPhone pings via Hark (optional)');
  if (config.customWebhookUrl) {
    const keep = await ask(rl, '  Custom webhook pings are ON. Keep them? (Y/n): ');
    if (keep.toLowerCase().startsWith('n')) {
      config.customWebhookUrl = null;
      console.log('  Custom webhook pings turned off.');
    }
  } else {
    console.log('  Hark (hark.ryan.ceo) turns a webhook into a fully branded iPhone');
    console.log('  notification — Game Tracker icon, tap to launch Deadlock.');
    console.log('  On your iPhone: open hark.ryan.ceo, follow its steps, copy the');
    console.log('  webhook URL it gives you.');
    const hark = await ask(rl, '  Paste that webhook URL (Enter to skip): ');
    if (hark && /^https?:\/\//.test(hark)) {
      config.customWebhookUrl = hark;
      const ok = await customPush(config, '🎯 Game Tracker connected', 'Test ping — you are all set!');
      console.log(ok ? '  ✓ Test sent — check your iPhone! (If it arrived blank, the service'
                     : '  ✗ The service did not accept it — check the URL, or re-run --setup.');
      if (ok) console.log('  may want different field names — see customWebhookBody in config.json.)');
    } else if (hark) {
      console.log('  ✗ That does not look like a URL — skipped (re-run --setup to retry).');
    }
  }

  if (!config.ntfyTopic && !config.discordWebhook && !config.customWebhookUrl) {
    console.log('  Note: no phone/Discord/webhook pings — desktop toasts and beeps only.');
  }

  // Step 5: make the ping yours
  console.log('\nStep 5 of 7 — Make the ping yours (optional)');
  console.log(`  Current alert:  "${config.alertTitle}"`);
  console.log('  Deadlock assigns one of your 3 hero picks when the match is made, so');
  console.log('  the pop ping fires instantly and a follow-up seconds later reveals it:');
  console.log('  "🎮 You got Haze — Street Brawl". ({hero} in a custom title is filled');
  console.log('  when known and dropped cleanly when not.)');
  const custom = await ask(rl, '  Custom alert title, {hero} allowed (Enter to keep it): ');
  if (custom) {
    config.alertTitle = custom;
    console.log(`  ✓ Alert is now: "${config.alertTitle}"`);
  }
  const vol = await ask(rl, '  PC beep volume — loud / soft / off (Enter = soft): ');
  if (['loud', 'soft', 'off'].includes(vol.toLowerCase())) config.pcSound = vol.toLowerCase();

  // Step 6: friends
  console.log('\nStep 6 of 7 — Your friends (optional)');
  console.log('  Send them the download link (printed at the end) — each of them gets');
  console.log('  their own pings for their own games, zero coordination needed.');
  if (config.ntfyTopic) {
    console.log(`  Bonus: anyone who also subscribes to YOUR code (${config.ntfyTopic}) in`);
    console.log('  their ntfy app hears when YOUR matches pop — nice for party queues.');
  }

  // Step 5: link with Steam so the watcher starts itself with the game
  if (process.platform === 'win32') {
    const steamLine = IS_SEA
      ? `"${process.execPath}" --steam %command% -condebug`
      : `"${path.join(APP_DIR, 'steam-launch.bat')}" %command% -condebug`;
    console.log('\nStep 7 of 7 — Auto-start with Deadlock (recommended)');
    try {
      const clip = spawn('clip', [], { windowsHide: true });
      clip.on('error', () => {});         // async spawn failures must not kill
      clip.stdin.on('error', () => {});   // the wizard before config is saved
      clip.stdin.end(steamLine);
      console.log('  This line is COPIED TO YOUR CLIPBOARD:');
    } catch {
      console.log('  Copy this line:');
    }
    console.log(`\n    ${steamLine}\n`);
    console.log('  Steam → right-click Deadlock → Properties → Launch Options:');
    console.log('  delete what\'s there and paste (Ctrl+V). From then on the watcher');
    console.log('  starts itself, hidden, every time you launch Deadlock.');
  }

  saveConfig(config);
  console.log(`\n  ✓ Saved to ${CONFIG_PATH}. Run "node watch.js --setup" to change anything.`);

  // Ready-to-forward invite — zero thinking required to share.
  {
    const msg = buildShareMessage(config);
    const sharePath = path.join(path.dirname(CONFIG_PATH), 'share-with-friends.txt');
    try { fs.writeFileSync(sharePath, msg + '\n'); } catch {}
    console.log('\n  ───── COPY-PASTE THIS TO YOUR FRIENDS ─────');
    console.log(msg.split('\n').map(l => '  ' + l).join('\n'));
    console.log('  ───────────────────────────────────────────');
    console.log(`  (Also saved to ${sharePath} — reprint any time with --share.)\n`);
  }
  rl.close();
  return config;
}

// ------------------------------------------------------------------ modes ---

async function main() {
  const args = process.argv.slice(2);
  let config = loadConfig();
  const firstRun = config === null;
  if (firstRun) config = { ...DEFAULTS };
  const argLog = args.indexOf('--log');
  if (argLog !== -1 && args[argLog + 1]) config.logPath = args[argLog + 1];

  if (args.includes('--test')) {
    console.log('Firing a test alert (sound + desktop notification' +
      (config.ntfyTopic ? ' + phone push' : '') + ')...');
    await fireAlert(config, null);
    setTimeout(() => process.exit(0), 3500);
    return;
  }

  // Steam wrapper mode: Steam runs `"...exe" --steam %command% -condebug`.
  // We relaunch ourselves hidden as the watcher, then run the game command
  // and stay alive until the game exits (so Steam tracks it correctly).
  if (args.includes('--steam')) {
    const i = args.indexOf('--steam');
    const gameCmd = args.slice(i + 1);
    const selfArgs = [];
    if (!IS_SEA && typeof __filename !== 'undefined') selfArgs.push(__filename);
    selfArgs.push('--announce', '--config', CONFIG_PATH);
    if (argLog !== -1 && args[argLog + 1]) selfArgs.push('--log', args[argLog + 1]);
    spawn(process.execPath, selfArgs,
      { detached: true, stdio: 'ignore', windowsHide: true }).unref();
    if (!gameCmd.length) return;
    const game = spawn(gameCmd[0], gameCmd.slice(1), { stdio: 'inherit' });
    game.on('close', code => process.exit(code ?? 0));
    game.on('error', err => { console.error(`Could not launch the game: ${err.message}`); process.exit(1); });
    return;
  }

  if (args.includes('--stats')) { printStats(); return; }

  if (args.includes('--share')) {
    console.log(buildShareMessage(config));
    return;
  }

  const diagnosticMode = args.includes('--learn') || args.includes('--find');
  if (firstRun && args.includes('--announce')) {
    // Hidden launch (Steam) with no config: the interactive wizard would hang
    // invisibly. Run on defaults and point at setup via a toast instead.
    desktopNotify('Deadlock Match Ping: setup needed',
      'Running with defaults (no phone pings). Double-click Start-Deadlock-Match-Ping.bat once to set up.', 'off');
  } else if (args.includes('--setup') || (firstRun && !diagnosticMode)) {
    config = await setupWizard(firstRun ? null : config);
    if (argLog !== -1 && args[argLog + 1]) config.logPath = args[argLog + 1];
  }

  if (args.includes('--find')) {
    const logPath = findLogPath(config);
    if (!logPath) { console.error(noLogHelp()); process.exit(1); }
    const stat = fs.statSync(logPath);
    const ageMin = Math.round((Date.now() - stat.mtimeMs) / 60_000);
    console.log(`Scanning: ${logPath}`);
    console.log(`  size ${(stat.size / 1024 / 1024).toFixed(1)} MB, last updated ${ageMin} min ago`);
    if (ageMin > 120) {
      console.log('  ⚠ This file looks stale. If you played more recently than that,');
      console.log('    the watcher is looking at the wrong file, or -condebug is not set.');
    }
    // Read the last 2 MB — more than enough to cover a session.
    const start = Math.max(0, stat.size - 2 * 1024 * 1024);
    const fd = fs.openSync(logPath, 'r');
    const buf = Buffer.alloc(stat.size - start);
    fs.readSync(fd, buf, 0, buf.length, start);
    fs.closeSync(fd);
    const interesting = /match|lobby|queue|party|connect|server.*(join|assign)|ready|accept/i;
    // Collapse numbers/ids so repeats of the same message dedupe into one
    // template with a count.
    const seen = new Map();
    for (const line of buf.toString('utf8').split('\n')) {
      if (!interesting.test(line)) continue;
      const template = line.replace(/\d+/g, '#').replace(/\[[0-9a-f:.#\-]+\]/gi, '[#]').trim();
      if (!template) continue;
      const entry = seen.get(template) || { count: 0, sample: line.trim() };
      entry.count++;
      seen.set(template, entry);
    }
    if (!seen.size) {
      console.log('\nNo matchmaking-looking lines found at all. That usually means the');
      console.log('game is not writing matchmaking info to this log. Double-check that');
      console.log('-condebug is in the Steam launch options and this is the right file.');
      return;
    }
    console.log(`\n${seen.size} distinct candidate lines (count × sample):\n`);
    const rows = [...seen.values()].sort((a, b) => a.count - b.count).slice(0, 60);
    for (const r of rows) {
      console.log(`  ${String(r.count).padStart(4)} ×  ${r.sample.slice(0, 160)}`);
    }
    console.log('\nHow to read this: the match-found line usually appears exactly ONCE');
    console.log('per match (low count) and mentions match/lobby/server assignment.');
    console.log('Frequent lines (high counts) are background noise — ignore them.');
    console.log('\nNext: copy a distinctive part of the right line into "patterns" in');
    console.log(`${CONFIG_PATH}, e.g. if the line says "EventMatchMade", add:  "EventMatchMade"`);
    console.log('Not sure which one? Run "node watch.js --learn", queue again, and press');
    console.log('Enter the moment the match pops — that narrows it to a 20-second window.');
    return;
  }

  if (args.includes('--learn')) {
    const logPath = findLogPath(config);
    if (!logPath) { console.error(noLogHelp()); process.exit(1); }
    console.log(`Learn mode — watching ${logPath}`);
    console.log('Queue up in Deadlock. The moment the match pops, press ENTER here.');
    console.log('I will print the log lines from the last 20 seconds so you can spot');
    console.log('the match-found line, then add it to "patterns" in config.json.\n');
    const recent = [];
    tailFile(logPath, line => {
      recent.push({ at: Date.now(), line });
      while (recent.length && Date.now() - recent[0].at > 20_000) recent.shift();
    });
    readline.createInterface({ input: process.stdin }).on('line', () => {
      console.log('\n--- log lines from the last 20 seconds ---');
      if (!recent.length) console.log('(nothing — is -condebug set and the game running?)');
      for (const r of recent) console.log(r.line);
      console.log('--- end ---\n');
      console.log('Pick the line that appeared when the match popped and add a matching');
      console.log(`regex to "patterns" in ${CONFIG_PATH}. Ctrl+C to quit.`);
    });
    return;
  }

  const logPath = findLogPath(config);
  if (!logPath) { console.error(noLogHelp()); process.exit(1); }

  // Single instance per config: Steam launching the game repeatedly must not
  // stack duplicate watchers (each would ping separately).
  const LOCK_PATH = CONFIG_PATH + '.lock';
  try {
    const pid = parseInt(fs.readFileSync(LOCK_PATH, 'utf8'), 10);
    // A live watcher touches its lock every minute, so a stale mtime means
    // the holder died (crash/reboot) even if Windows recycled its PID for an
    // unrelated process — BOTH checks must pass to treat it as running.
    const fresh = Date.now() - fs.statSync(LOCK_PATH).mtimeMs < 5 * 60_000;
    if (pid && pid !== process.pid && fresh) {
      try {
        process.kill(pid, 0); // throws if that process is gone
        console.log(`Already running (pid ${pid}) — this copy will exit.`);
        return;
      } catch {} // stale lock from a crash — take over
    }
  } catch {}
  fs.writeFileSync(LOCK_PATH, String(process.pid));
  setInterval(() => {
    try { fs.utimesSync(LOCK_PATH, new Date(), new Date()); } catch {}
  }, 60_000).unref();
  const releaseLock = () => {
    try {
      if (parseInt(fs.readFileSync(LOCK_PATH, 'utf8'), 10) === process.pid) fs.unlinkSync(LOCK_PATH);
    } catch {}
  };
  process.on('exit', releaseLock);
  process.on('SIGINT', () => process.exit(0));
  process.on('SIGTERM', () => process.exit(0));

  await applyRemotePatterns(config); // self-heal detection before compiling
  const patterns = config.patterns.map(p => new RegExp(p, 'i'));
  let lastAlert = 0;
  console.log(`Deadlock Match Ping v${APP_VERSION} — watching ${logPath}`);
  if (args.includes('--announce')) {
    // Launched hidden (e.g. by Steam) — say hello via a toast since there is
    // no console to look at.
    desktopNotify('🎯 Deadlock Match Ping is on', 'Watching for your match. Queue away.', 'off');
  }
  try {
    const ageMin = Math.round((Date.now() - fs.statSync(logPath).mtimeMs) / 60_000);
    if (ageMin > 120) {
      console.log(`  ⚠ Note: this log was last updated ${ageMin} min ago. If Deadlock is`);
      console.log('    running right now, -condebug may be missing or this is the wrong file.');
    }
  } catch {}
  console.log(config.ntfyTopic
    ? `Phone pings: ON — topic "${config.ntfyTopic}" (share it so friends get pinged too)`
    : 'Phone pings: off — run "node watch.js --setup" to enable');
  console.log('Queue up and alt-tab away — I will yell when the match pops.');
  if (process.platform === 'win32') {
    console.log('Tip: don\'t click inside this window — if the title bar says "Select",');
    console.log('Windows has PAUSED the app; press Esc in the window to resume.');
  }
  console.log('');
  const backupPatterns = (config.backupPatterns || []).map(p => new RegExp(p, 'i'));
  const queueStart = (config.queueStartPatterns || []).map(p => new RegExp(p, 'i'));
  const queueStop = (config.queueStopPatterns || []).map(p => new RegExp(p, 'i'));
  const ignore = (config.ignorePatterns || []).map(p => new RegExp(p, 'i'));
  const heroRes = (config.heroPatterns || DEFAULTS.heroPatterns).map(p => new RegExp(p, 'i'));
  const modeRes = (config.modePatterns || DEFAULTS.modePatterns).map(p => new RegExp(p, 'i'));
  const matchEnd = (config.matchEndPatterns || DEFAULTS.matchEndPatterns).map(p => new RegExp(p, 'i'));
  const staleMs = (config.staleSeconds ?? DEFAULTS.staleSeconds) * 1000;
  const quietMs = (config.postMatchQuietSeconds ?? DEFAULTS.postMatchQuietSeconds) * 1000;
  let inQueue = false;
  let lastMatchId = null;
  let lastHero = null;
  let heroAnnounced = false;
  let lastMatchEnd = 0;
  let currentMode = null;
  let queueStartedAt = 0;
  let lastMissWarn = 0;
  let escalateTimer = null;
  const clearEscalation = () => {
    if (escalateTimer) { clearTimeout(escalateTimer); escalateTimer = null; }
  };
  const armEscalation = () => {
    clearEscalation();
    const secs = config.afkSeconds ?? DEFAULTS.afkSeconds;
    if (!secs) return;
    escalateTimer = setTimeout(() => {
      escalateTimer = null;
      const title = '⚠ YOU ARE MISSING THE MATCH';
      const body = 'The game found your match and you are still not in — GET IN NOW!';
      phonePush(config.ntfyTopic, title, body);
      discordPush(config.discordWebhook,
        `${config.discordMention ?? DEFAULTS.discordMention} ${title} — ${body}`.trim());
      customPush(config, title, body);
      desktopNotify(title, body, 'loud');
      console.log(`\n  ${title} — ${body}`);
      beepLoop(8);
    }, secs * 1000);
  };
  {
    const stats = loadStats();
    const avg = avgSeconds(stats);
    if (avg != null) {
      console.log(`Queue stats: ${stats.length} pops recorded, recent average ${fmtDuration(avg)}.\n`);
    }
  }
  tailFile(logPath, line => {
    // Any sign of life after a pop — joining a server (even a local one),
    // hero/mode loading, a new queue — means you made it: stand down.
    if (escalateTimer && (backupPatterns.some(re => re.test(line)) ||
        heroRes.some(re => re.test(line)) || modeRes.some(re => re.test(line)) ||
        queueStart.some(re => re.test(line)) || matchEnd.some(re => re.test(line)))) {
      clearEscalation();
      console.log('  ✓ You made it in — escalation cancelled.');
    }
    for (const re of modeRes) {
      const m = re.exec(line);
      if (m && m[1]) {
        const mode = modeDisplayName(m[1]);
        // The generic map ('Normal') must not overwrite a queue-derived
        // Ranked/Standard — they share that map. Specific modes still win.
        if (mode === 'Normal' && currentMode && currentMode !== 'Normal') break;
        if (mode && mode !== currentMode) {
          currentMode = mode;
          console.log(`  · Mode: ${mode}`);
          // Loading into a match after a pop — remember which mode it was.
          if (lastAlert && Date.now() - lastAlert < 180_000) updateLastStat({ mode });
        }
        break; // a mode line is never also a hero/alert line
      }
    }
    for (const re of heroRes) {
      const m = re.exec(line);
      if (m && m[1]) {
        const name = heroDisplayName(m[1]);
        if (name !== lastHero) {
          lastHero = name;
          console.log(`  · Hero: ${name}`);
        }
        // The game just assigned one of your selected heroes — announce it.
        // (The pop ping can't know which of your 3 picks you'll get, so this
        // follow-up at load-in is the hero reveal.)
        if (!heroAnnounced && lastAlert && Date.now() - lastAlert < 180_000) {
          heroAnnounced = true;
          updateLastStat({ hero: name });
          const what = `🎮 You got ${name}${currentMode ? ` — ${currentMode}` : ''}`;
          phonePush(config.ntfyTopic, what, 'Match is loading — get ready!');
          discordPush(config.discordWebhook, `${what} — match is loading!`);
          customPush(config, what, 'Match is loading — get ready!');
          desktopNotify(what, 'Match is loading — get ready!');
          console.log(`  ${what} — match is loading.`);
        }
        return;
      }
    }
    if (queueStart.some(re => re.test(line))) {
      // A stale flushed queue-start (buffered tail of an old session) must
      // not arm the backup pattern — it would false-ping on the next
      // non-match server join.
      const ts = parseLogTime(line);
      if (ts !== null && Date.now() - ts > staleMs) return;
      inQueue = true;
      queueStartedAt = Date.now();
      // Ranked/Standard can be read off the queue message itself; the map
      // name later can't tell them apart. Otherwise mode waits for load-in.
      currentMode = queueModeFromLine(line);
      if (currentMode) console.log(`  · Mode: ${currentMode}`);
      // Deadlock assigns you ONE of your (up to 3) selected heroes when the
      // match is made — so at queue time the hero is unknowable. Forget any
      // menu-hover sightings; the real assignment is announced at load-in.
      lastHero = null;
      heroAnnounced = false;
      console.log(`  ✓ Queue started (${new Date().toLocaleTimeString()}) — watching for the pop...`);
      return;
    }
    if (queueStop.some(re => re.test(line))) {
      const ts = parseLogTime(line);
      if (ts !== null && Date.now() - ts > staleMs) return;
      inQueue = false;
      queueStartedAt = 0; // an abandoned start must not pollute queue timing
      console.log(`  · Queue stopped (${new Date().toLocaleTimeString()}).`);
      return;
    }
    if (matchEnd.some(re => re.test(line))) {
      // While QUEUED, a disconnect just means leaving the practice range or
      // hideout — wiping the queue here would swallow the upcoming pop.
      if (inQueue) return;
      const ts = parseLogTime(line);
      if (ts !== null && Date.now() - ts > staleMs) return;
      // First end-line after a pop: record how long the match ran (pop → end;
      // anything under a few seconds was a failed start, not a match).
      if (lastAlert > lastMatchEnd && Date.now() - lastAlert > 3000) {
        const secs = (Date.now() - lastAlert) / 1000;
        updateLastStat({ matchSeconds: Math.round(secs) });
        console.log(`  · Match over after ${fmtDuration(secs)} (${new Date().toLocaleTimeString()}).`);
      }
      // Match over — go quiet. Only a fresh queue start re-arms alerts, so
      // whatever the game logs while wrapping up can't ping.
      inQueue = false;
      lastMatchEnd = Date.now();
      return;
    }
    const hit = patterns.some(re => re.test(line)) ||
      (inQueue && backupPatterns.some(re => re.test(line)));
    if (!hit) {
      // Patch insurance: joining a remote server with no queue seen, no
      // recent pop, and no match just ended means detection may be deaf —
      // a game patch likely reworded the queue/match log lines.
      if (backupPatterns.some(re => re.test(line)) &&
          !ignore.some(re => re.test(line))) {
        const ts = parseLogTime(line);
        const fresh = ts === null || Date.now() - ts <= staleMs;
        const inQuiet = lastMatchEnd && Date.now() - lastMatchEnd < quietMs;
        if (fresh && !inQuiet &&
            Date.now() - lastAlert > 10 * 60_000 &&
            Date.now() - lastMissWarn > 60 * 60_000) {
          lastMissWarn = Date.now();
          const warnTitle = '⚠ Deadlock Match Ping: possible missed match';
          const warnBody = 'You joined a server but I never saw a queue or match pop. ' +
            'If you did just queue into a match, a game patch may have changed the ' +
            'log format — run "node watch.js --find" after this game.';
          phonePush(config.ntfyTopic, warnTitle, warnBody);
          desktopNotify(warnTitle, warnBody, 'off');
          console.log(`\n  ${warnTitle}\n  ${warnBody}\n`);
        }
      }
      return;
    }
    // Post-match quiet window: after a match ends, ignore alert lines unless
    // a new queue has started since.
    if (!inQueue && lastMatchEnd && Date.now() - lastMatchEnd < quietMs) return;
    // Local self-connections (menu, practice range, bot servers) never alert.
    if (ignore.some(re => re.test(line))) return;
    // Lines the game flushed late (their own timestamp is old) never alert —
    // Deadlock buffers log output and can dump minutes-old lines at once.
    const stamped = parseLogTime(line);
    if (stamped !== null && Date.now() - stamped > staleMs) {
      inQueue = false; // that old queue is history, don't let it arm a backup
      return;
    }
    // Dedup by match ID when the line carries one: repeats of the SAME match
    // stay suppressed, but a genuinely NEW match (failed form → instant
    // re-pop) pings even inside the time cooldown.
    const idm = /Lobby\s+\d+\s+for\s+Match\s+(\d+)/i.exec(line);
    const matchId = idm ? idm[1] : null;
    if (Date.now() - lastAlert < config.cooldownSeconds * 1000 &&
        (!matchId || matchId === lastMatchId)) return;
    if (matchId) lastMatchId = matchId;
    lastAlert = Date.now();
    inQueue = false; // this queue is resolved; next connect needs a new queue
    heroAnnounced = false; // the assigned hero is revealed at load-in
    armEscalation(); // second, angrier ping unless you show up in the match
    let queueSeconds = null;
    // Sanity-cap: an hours-old orphaned start would make the ping claim a
    // ridiculous queue time and pollute the stats.
    if (queueStartedAt && Date.now() - queueStartedAt > 2 * 3600 * 1000) queueStartedAt = 0;
    if (queueStartedAt) {
      queueSeconds = (Date.now() - queueStartedAt) / 1000;
      queueStartedAt = 0;
      const stats = recordQueue(queueSeconds, null, currentMode); // hero assigned at load-in
      const avg = avgSeconds(stats);
      fireAlert(config, line, null, queueSeconds, currentMode);
      console.log(`    Queue time: ${fmtDuration(queueSeconds)}` +
        (avg != null && stats.length > 1 ? ` (recent average ${fmtDuration(avg)})` : ''));
    } else {
      fireAlert(config, line, null, null, currentMode);
    }
  });
}

function noLogHelp() {
  return [
    'Could not find Deadlock\'s console.log. To fix:',
    '',
    '  1. In Steam: right-click Deadlock → Properties → Launch Options → add:  -condebug',
    '  2. Launch Deadlock once (this creates the log file).',
    '  3. If it is still not found, pass the path yourself:',
    '       node watch.js --log "C:\\...\\Steam\\steamapps\\common\\Deadlock\\game\\citadel\\console.log"',
    '     or set "logPath" in config.json.',
  ].join('\n');
}

main();
