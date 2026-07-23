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
  // Seconds to ignore further matches after an alert (one pop = one ping).
  cooldownSeconds: 60,
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
  if (LEGACY_PATTERN_SETS.includes(JSON.stringify(user.patterns))) {
    delete user.patterns;
    delete user.backupPatterns;
    saveConfig({ ...DEFAULTS, ...user });
    console.log('(Updated config.json to the verified match-found patterns.)');
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

function desktopNotify(title, body) {
  const opts = { windowsHide: true };
  if (process.platform === 'win32') {
    // Toast via PowerShell (no modules needed), plus a system sound.
    const ps = `
      [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null;
      $x = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02);
      $x.GetElementsByTagName('text').Item(0).InnerText = '${title.replace(/'/g, "''")}';
      $x.GetElementsByTagName('text').Item(1).InnerText = '${body.replace(/'/g, "''")}';
      [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('Deadlock Match Ping').Show([Windows.UI.Notifications.ToastNotification]::new($x));
      1..6 | ForEach-Object { [console]::beep(1100, 200); Start-Sleep -Milliseconds 80 }
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

function fireAlert(config, line) {
  const title = '🎯 DEADLOCK MATCH FOUND';
  const body = 'Tab back in and accept!';
  console.log(`\n=== ${title} — ${new Date().toLocaleTimeString()} ===`);
  if (line) console.log(`    matched line: ${line.trim()}`);
  beepLoop(8);
  desktopNotify(title, body);
  return phonePush(config.ntfyTopic, title, body);
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
  console.log('\nStep 1 of 3 — Deadlock\'s log file');
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
  console.log('\nStep 2 of 3 — Phone pings (via the free ntfy app, no account needed)');
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

  // Step 3: friends
  console.log('\nStep 3 of 3 — Ping your friends too (optional)');
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
  console.log('Queue up and alt-tab away — I will yell when the match pops.\n');
  const backupPatterns = (config.backupPatterns || []).map(p => new RegExp(p, 'i'));
  const queueStart = (config.queueStartPatterns || []).map(p => new RegExp(p, 'i'));
  const queueStop = (config.queueStopPatterns || []).map(p => new RegExp(p, 'i'));
  let inQueue = false;
  tailFile(logPath, line => {
    if (queueStart.some(re => re.test(line))) {
      inQueue = true;
      console.log(`  ✓ Queue started (${new Date().toLocaleTimeString()}) — watching for the pop...`);
      return;
    }
    if (queueStop.some(re => re.test(line))) {
      inQueue = false;
      console.log(`  · Queue stopped (${new Date().toLocaleTimeString()}).`);
      return;
    }
    const hit = patterns.some(re => re.test(line)) ||
      (inQueue && backupPatterns.some(re => re.test(line)));
    if (!hit) return;
    if (Date.now() - lastAlert < config.cooldownSeconds * 1000) return;
    lastAlert = Date.now();
    inQueue = false; // this queue is resolved; next connect needs a new queue
    fireAlert(config, line);
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
