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
const { execFile } = require('child_process');
const readline = require('readline');

// Don't die if stdout goes away (e.g. output piped to a closed pager).
process.stdout.on('error', () => {});

// ---------------------------------------------------------------- config ---

const argv = process.argv.slice(2);
const argConfig = argv.indexOf('--config');
const CONFIG_PATH = argConfig !== -1 && argv[argConfig + 1]
  ? path.resolve(argv[argConfig + 1])
  : path.join(__dirname, 'config.json');
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
  queueStartPatterns: ['k_EMsgClientToGCStartMatchmaking'],
  queueStopPatterns: ['k_EMsgClientToGCStopMatchmaking'],
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
  // Seconds to ignore further matches after an alert (one pop = one ping).
  cooldownSeconds: 60,
  // What the ping says — shows up in the phone push, the desktop toast, and
  // the console. {hero} becomes your selected hero's name ("🎯 Haze — MATCH
  // FOUND"); if no hero is known yet it's cleanly dropped.
  alertTitle: '🎯 {hero} — MATCH FOUND',
  alertMessage: 'Queue popped — tab in and accept!',
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
};

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

function recordQueue(seconds, hero) {
  const stats = loadStats();
  stats.push({ at: new Date().toISOString(), seconds, hero: hero || null });
  while (stats.length > 50) stats.shift();
  try { fs.writeFileSync(STATS_PATH, JSON.stringify(stats, null, 2) + '\n'); } catch {}
  return stats;
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
      console.error(`Could not parse ${CONFIG_PATH}: ${e.message}`);
      process.exit(1);
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

function candidateLogPaths() {
  const home = os.homedir();
  const rel = ['steamapps', 'common', 'Deadlock', 'game', 'citadel', 'console.log'];
  const roots = [];
  if (process.platform === 'win32') {
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
  return roots.map(r => path.join(r, ...rel));
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
      [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('Deadlock Match Ping').Show([Windows.UI.Notifications.ToastNotification]::new($x));
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

// Fill {hero} into a template; with no hero known, drop the placeholder and
// any dangling separator so "🎯 {hero} — MATCH FOUND" → "🎯 MATCH FOUND".
function formatWithHero(tpl, hero) {
  if (!tpl.includes('{hero}')) return { text: tpl, usedHero: false };
  if (hero) return { text: tpl.split('{hero}').join(hero), usedHero: true };
  const text = tpl.replace(/\s*\{hero\}\s*[—–:-]*\s*/g, ' ').replace(/\s+/g, ' ').trim();
  return { text, usedHero: true };
}

function fireAlert(config, line, hero, queueSeconds) {
  const t = formatWithHero(config.alertTitle || DEFAULTS.alertTitle, hero);
  const b = formatWithHero(config.alertMessage || DEFAULTS.alertMessage, hero);
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
  // Phone + toast go FIRST: a Windows console stuck in selection mode blocks
  // stdout writes, and the pings must not wait behind a frozen console.
  const push = phonePush(config.ntfyTopic, title, body);
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

// Deadlock log lines start with "MM/DD HH:MM:SS". Returns the line's own
// timestamp as epoch ms, or null if the line carries none.
function parseLogTime(line, now = new Date()) {
  const m = /^(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2}):(\d{2})\b/.exec(line);
  if (!m) return null;
  let t = new Date(now.getFullYear(), m[1] - 1, m[2], m[3], m[4], m[5]).getTime();
  if (t > now.getTime() + 24 * 3600 * 1000) t -= 365.25 * 24 * 3600 * 1000; // Dec→Jan
  return t;
}

// ------------------------------------------------------------------- tail ---

function tailFile(logPath, onLine) {
  // Start at end-of-file; survive the file being truncated/recreated on
  // game restart (size shrink = start over from 0). Reads are serialized —
  // a tick is skipped while the previous read is still in flight, so lines
  // from a burst of log output can't interleave out of order.
  let pos = fs.existsSync(logPath) ? fs.statSync(logPath).size : 0;
  let buf = '';
  let reading = false;
  setInterval(() => {
    if (reading) return;
    let stat;
    try { stat = fs.statSync(logPath); } catch { return; }
    if (stat.size < pos) { pos = 0; buf = ''; }
    if (stat.size === pos) return;
    reading = true;
    const stream = fs.createReadStream(logPath, { start: pos, end: stat.size - 1 });
    pos = stat.size;
    stream.on('data', chunk => {
      buf += chunk.toString('utf8');
      const lines = buf.split('\n');
      buf = lines.pop();
      lines.forEach(onLine);
    });
    stream.on('close', () => { reading = false; });
    stream.on('error', () => { reading = false; });
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
  console.log('\nStep 1 of 4 — Deadlock\'s log file');
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

  // Step 2: phone pushes
  console.log('\nStep 2 of 4 — Phone pings (via the free ntfy app, no account needed)');
  if (!config.ntfyTopic) {
    config.ntfyTopic = 'deadlock-' + crypto.randomBytes(4).toString('hex');
  }
  console.log(`  Your private channel:  ${config.ntfyTopic}`);
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

  // Step 3: make the ping yours
  console.log('\nStep 3 of 4 — Make the ping yours (optional)');
  console.log(`  Current alert:  "${config.alertTitle}"`);
  console.log('  {hero} becomes your selected hero — e.g. "🎯 Haze — MATCH FOUND".');
  const custom = await ask(rl, '  Custom alert title, {hero} allowed (Enter to keep it): ');
  if (custom) {
    config.alertTitle = custom;
    console.log(`  ✓ Alert is now: "${config.alertTitle}"`);
  }
  const vol = await ask(rl, '  PC beep volume — loud / soft / off (Enter = soft): ');
  if (['loud', 'soft', 'off'].includes(vol.toLowerCase())) config.pcSound = vol.toLowerCase();

  // Step 4: friends
  console.log('\nStep 4 of 4 — Ping your friends too (optional)');
  console.log(`  Anyone who subscribes to "${config.ntfyTopic}" in their ntfy app gets`);
  console.log('  the same phone ping when your match pops. Just share the topic name.');
  console.log('  (If they queue too, they can run this watcher with the same topic —');
  console.log('  whoever\'s match pops first pings the whole squad.)');

  saveConfig(config);
  console.log(`\n  ✓ Saved to ${CONFIG_PATH}. Run "node watch.js --setup" to change anything.\n`);
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

  const diagnosticMode = args.includes('--learn') || args.includes('--find');
  if (args.includes('--setup') || (firstRun && !diagnosticMode)) {
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
  const patterns = config.patterns.map(p => new RegExp(p, 'i'));
  let lastAlert = 0;
  console.log(`Deadlock Match Ping — watching ${logPath}`);
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
  const matchEnd = (config.matchEndPatterns || DEFAULTS.matchEndPatterns).map(p => new RegExp(p, 'i'));
  const staleMs = (config.staleSeconds ?? DEFAULTS.staleSeconds) * 1000;
  const quietMs = (config.postMatchQuietSeconds ?? DEFAULTS.postMatchQuietSeconds) * 1000;
  let inQueue = false;
  let lastHero = null;
  let heroAnnounced = false;
  let lastMatchEnd = 0;
  let queueStartedAt = 0;
  let lastMissWarn = 0;
  {
    const stats = loadStats();
    const avg = avgSeconds(stats);
    if (avg != null) {
      console.log(`Queue stats: ${stats.length} pops recorded, recent average ${fmtDuration(avg)}.\n`);
    }
  }
  tailFile(logPath, line => {
    for (const re of heroRes) {
      const m = re.exec(line);
      if (m && m[1]) {
        const name = heroDisplayName(m[1]);
        if (name !== lastHero) {
          lastHero = name;
          console.log(`  · Hero: ${name}`);
        }
        // Pop already pinged without a hero? Send one follow-up as the game
        // loads you in, so the phone still says who you're playing.
        if (!heroAnnounced && lastAlert && Date.now() - lastAlert < 180_000 && /Loaded hero/i.test(line)) {
          heroAnnounced = true;
          phonePush(config.ntfyTopic, `🎮 Playing ${name}`, 'Match is loading — get ready!');
          desktopNotify(`🎮 Playing ${name}`, 'Match is loading — get ready!');
          console.log(`  🎮 Playing ${name} — match is loading.`);
        }
        return;
      }
    }
    if (queueStart.some(re => re.test(line))) {
      inQueue = true;
      queueStartedAt = Date.now();
      console.log(`  ✓ Queue started (${new Date().toLocaleTimeString()}) — watching for the pop...`);
      return;
    }
    if (queueStop.some(re => re.test(line))) {
      inQueue = false;
      console.log(`  · Queue stopped (${new Date().toLocaleTimeString()}).`);
      return;
    }
    if (matchEnd.some(re => re.test(line))) {
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
    if (Date.now() - lastAlert < config.cooldownSeconds * 1000) return;
    lastAlert = Date.now();
    inQueue = false; // this queue is resolved; next connect needs a new queue
    heroAnnounced = Boolean(lastHero); // hero in this ping = no follow-up needed
    let queueSeconds = null;
    if (queueStartedAt) {
      queueSeconds = (Date.now() - queueStartedAt) / 1000;
      queueStartedAt = 0;
      const stats = recordQueue(queueSeconds, lastHero);
      const avg = avgSeconds(stats);
      fireAlert(config, line, lastHero, queueSeconds);
      console.log(`    Queue time: ${fmtDuration(queueSeconds)}` +
        (avg != null && stats.length > 1 ? ` (recent average ${fmtDuration(avg)})` : ''));
    } else {
      fireAlert(config, line, lastHero, null);
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
