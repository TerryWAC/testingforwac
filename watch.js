#!/usr/bin/env node
// Deadlock Match Ping — single-player queue-pop watcher. Zero dependencies.
//
// Tails Deadlock's console.log (enable with the -condebug launch option) and
// the moment a line matches a "match found" pattern it pings YOU: loud beeps,
// a desktop notification, and (optionally) a push to your phone via ntfy.sh.
//
// Usage:
//   node watch.js                 start watching (auto-detects console.log)
//   node watch.js --log <path>    watch a specific console.log
//   node watch.js --test          fire the alert right now to check sound/notify
//   node watch.js --learn        capture log lines while you queue, so you can
//                                 identify the exact match-found line on a patch
//
// Config lives in config.json next to this file.

const fs = require('fs');
const os = require('os');
const path = require('path');
const https = require('https');
const { execFile } = require('child_process');
const readline = require('readline');

// Don't die if stdout goes away (e.g. output piped to a closed pager).
process.stdout.on('error', () => {});

// ---------------------------------------------------------------- config ---

const CONFIG_PATH = path.join(__dirname, 'config.json');
const DEFAULTS = {
  // Path to Deadlock's console.log. null = try the common Steam locations.
  logPath: null,
  // Case-insensitive regexes. If ANY matches a new log line, the alert fires.
  // Valve changes log text between patches — use `--learn` to find the line
  // your build prints when the queue pops, then add/adjust patterns here.
  patterns: [
    'match\\s*(ready|found|made)',
    'party_?match',
    'matchmaking.*(ready|found|complete)',
    'lobby.*(ready|found)',
    'Connect(ing)? to .*server',
    'CCitadelLobby.*match',
  ],
  // Seconds to ignore further matches after an alert (one pop = one ping).
  cooldownSeconds: 60,
  // Optional: phone pings via https://ntfy.sh — install the ntfy app on your
  // phone, subscribe to a topic (pick something unguessable, it's the only
  // secret), and put the topic name here. null = disabled.
  ntfyTopic: null,
};

function loadConfig() {
  let user = {};
  try { user = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')); }
  catch (e) {
    if (e.code !== 'ENOENT') {
      console.error(`Could not parse ${CONFIG_PATH}: ${e.message}`);
      process.exit(1);
    }
  }
  return { ...DEFAULTS, ...user };
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
      ...'DEFGH'.split('').map(d => path.join(`${d}:`, 'SteamLibrary')),
      ...'DEFGH'.split('').map(d => path.join(`${d}:`, 'Steam')),
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

function phoneNotify(topic, title, body) {
  if (!topic) return;
  const req = https.request({
    hostname: 'ntfy.sh',
    path: `/${encodeURIComponent(topic)}`,
    method: 'POST',
    headers: { Title: title, Priority: 'urgent', Tags: 'dart' },
  }, res => res.resume());
  req.on('error', err => console.error(`  (ntfy push failed: ${err.message})`));
  req.end(body);
}

function fireAlert(config, line) {
  const title = '🎯 DEADLOCK MATCH FOUND';
  const body = 'Tab back in and accept!';
  console.log(`\n=== ${title} — ${new Date().toLocaleTimeString()} ===`);
  if (line) console.log(`    matched line: ${line.trim()}`);
  beepLoop(8);
  desktopNotify(title, body);
  phoneNotify(config.ntfyTopic, title, body);
}

// ------------------------------------------------------------------- tail ---

function tailFile(logPath, onLine) {
  // Start at end-of-file; survive the file being truncated/recreated on
  // game restart (size shrink = start over from 0).
  let pos = fs.existsSync(logPath) ? fs.statSync(logPath).size : 0;
  let buf = '';
  setInterval(() => {
    let stat;
    try { stat = fs.statSync(logPath); } catch { return; }
    if (stat.size < pos) { pos = 0; buf = ''; }
    if (stat.size === pos) return;
    const stream = fs.createReadStream(logPath, { start: pos, end: stat.size - 1 });
    pos = stat.size;
    stream.on('data', chunk => {
      buf += chunk.toString('utf8');
      const lines = buf.split('\n');
      buf = lines.pop();
      lines.forEach(onLine);
    });
  }, 500);
}

// ------------------------------------------------------------------ modes ---

const args = process.argv.slice(2);
const config = loadConfig();
const argLog = args.indexOf('--log');
if (argLog !== -1 && args[argLog + 1]) config.logPath = args[argLog + 1];

if (args.includes('--test')) {
  console.log('Firing a test alert (sound + desktop notification' +
    (config.ntfyTopic ? ' + phone push' : '') + ')...');
  fireAlert(config, null);
  setTimeout(() => process.exit(0), 4000);
} else if (args.includes('--learn')) {
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
} else {
  const logPath = findLogPath(config);
  if (!logPath) { console.error(noLogHelp()); process.exit(1); }
  const patterns = config.patterns.map(p => new RegExp(p, 'i'));
  let lastAlert = 0;
  console.log(`Deadlock Match Ping — watching ${logPath}`);
  console.log(`Patterns: ${config.patterns.join('  |  ')}`);
  console.log(config.ntfyTopic
    ? `Phone pings: ON (ntfy.sh/${config.ntfyTopic})`
    : 'Phone pings: off (set "ntfyTopic" in config.json to enable)');
  console.log('Queue up and alt-tab away — I will yell when the match pops.\n');
  tailFile(logPath, line => {
    if (!patterns.some(re => re.test(line))) return;
    if (Date.now() - lastAlert < config.cooldownSeconds * 1000) return;
    lastAlert = Date.now();
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
