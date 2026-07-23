#!/usr/bin/env node
// Automated end-to-end tests for the Deadlock Match Ping watcher.
// Run with: npm test   (zero dependencies, ~40 seconds)
//
// Each scenario spawns the real watcher against a temp log file and feeds it
// genuine Deadlock console.log line formats, then asserts on what it did.

const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const WATCH = path.join(__dirname, 'watch.js');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'dmp-test-'));

const LINES = {
  queueStart: '[GCClient] Send msg 9010 (k_EMsgClientToGCStartMatchmaking)',
  queueStop: '[GCClient] Send msg 9012 (k_EMsgClientToGCStopMatchmaking)',
  lobbyCreated: 'Lobby 34817593 for Match 29471852 created',
  serverConnect: "[Client] CL:  Connected to '=[A:1:2039411713:29811]'",
  lobbyDestroyed: 'Lobby 34817593 for Match 29471852 destroyed',
  serverDisconnect: '[Client] Disconnecting from server: completed',
  noise: '[Client] Heartbeat sent to coordinator',
};

let passed = 0, failed = 0;

function assert(cond, name, detail) {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`); }
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

function makeEnv(name, configOverrides = {}) {
  const log = path.join(TMP, `${name}.log`);
  const config = path.join(TMP, `${name}-config.json`);
  fs.writeFileSync(log, '');
  fs.writeFileSync(config, JSON.stringify({
    cooldownSeconds: 2, ntfyTopic: null, ...configOverrides,
  }));
  return { log, config };
}

function startWatcher(env, extraArgs = ['--log', null], extraEnv = {}) {
  const args = extraArgs[0] === '--log' && extraArgs[1] === null
    ? ['--log', env.log] : extraArgs;
  const child = spawn(process.execPath, [WATCH, ...args, '--config', env.config],
    { env: { ...process.env, ...extraEnv } });
  const out = { text: '' };
  child.stdout.on('data', d => { out.text += d; });
  child.stderr.on('data', d => { out.text += d; });
  return { child, out };
}

const append = (env, line) => fs.appendFileSync(env.log, line + '\n');
const alerts = out => (out.text.match(/MATCH FOUND/g) || []).length;

async function waitFor(out, pred, ms = 4000) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    if (pred(out.text)) return true;
    await sleep(100);
  }
  return pred(out.text);
}

async function scenario(name, fn, configOverrides) {
  console.log(`\n${name}`);
  const env = makeEnv(name.replace(/\W+/g, '-'), configOverrides);
  const { child, out } = startWatcher(env);
  await sleep(800); // let the watcher open the log
  try { await fn(env, out); }
  finally { child.kill(); }
}

async function main() {
  await scenario('1. Real match: queue → pop → connect fires exactly one alert', async (env, out) => {
    append(env, LINES.noise);
    append(env, LINES.queueStart);
    assert(await waitFor(out, t => t.includes('Queue started')), 'queue start detected');
    append(env, LINES.lobbyCreated);
    assert(await waitFor(out, t => alerts({ text: t }) >= 1), 'alert fired on lobby-created line');
    append(env, LINES.serverConnect);
    await sleep(1200);
    assert(alerts(out) === 1, 'connect line did not double-ping (cooldown)', `got ${alerts(out)}`);
  });

  await scenario('2. Practice range: connect with NO queue → no alert', async (env, out) => {
    append(env, LINES.serverConnect);
    await sleep(1500);
    assert(alerts(out) === 0, 'no false ping on ungated connect', `got ${alerts(out)}`);
  });

  await scenario('3. Backup: queue → connect (no lobby line) still alerts', async (env, out) => {
    append(env, LINES.queueStart);
    await waitFor(out, t => t.includes('Queue started'));
    append(env, LINES.serverConnect);
    assert(await waitFor(out, t => alerts({ text: t }) === 1), 'backup pattern fired while in queue');
  });

  await scenario('4. Cancelled queue: start → stop → connect → no alert', async (env, out) => {
    append(env, LINES.queueStart);
    await waitFor(out, t => t.includes('Queue started'));
    append(env, LINES.queueStop);
    assert(await waitFor(out, t => t.includes('Queue stopped')), 'queue stop detected');
    append(env, LINES.serverConnect);
    await sleep(1500);
    assert(alerts(out) === 0, 'no ping after cancelling queue', `got ${alerts(out)}`);
  });

  await scenario('5. Two matches in one session both alert (after cooldown)', async (env, out) => {
    append(env, LINES.queueStart);
    append(env, LINES.lobbyCreated);
    await waitFor(out, t => alerts({ text: t }) === 1);
    await sleep(2200); // outlast the 2s test cooldown
    append(env, LINES.queueStart);
    append(env, 'Lobby 99999999 for Match 88888888 created');
    assert(await waitFor(out, t => alerts({ text: t }) === 2), 'second match alerted too',
      `got ${alerts(out)}`);
  });

  await scenario('6. Game restart truncates the log; next match still alerts', async (env, out) => {
    append(env, LINES.noise);
    await sleep(700);
    fs.truncateSync(env.log, 0);
    await sleep(700);
    append(env, LINES.queueStart);
    append(env, LINES.lobbyCreated);
    assert(await waitFor(out, t => alerts({ text: t }) === 1), 'alert after truncation');
  });

  await scenario('10. Match END does not ping (disconnect + hideout reconnect)', async (env, out) => {
    // Full lifecycle: queue → pop (1 alert) → play → match ends, client
    // disconnects and reconnects to the hideout. No second ping.
    append(env, LINES.queueStart);
    append(env, LINES.lobbyCreated);
    await waitFor(out, t => alerts({ text: t }) === 1);
    await sleep(2500); // outlast the 2s test cooldown, like a real match would
    append(env, LINES.lobbyDestroyed);
    append(env, LINES.serverDisconnect);
    append(env, LINES.serverConnect); // back to the hideout server
    await sleep(1500);
    assert(alerts(out) === 1, 'no ping at match end', `got ${alerts(out)}`);
  });

  await scenario('11. Custom alert text is used', async (env, out) => {
    append(env, LINES.queueStart);
    append(env, LINES.lobbyCreated);
    assert(await waitFor(out, t => t.includes('YO TERRY GAME TIME')), 'custom title in alert');
  }, { alertTitle: 'YO TERRY GAME TIME', alertMessage: 'move it' });

  await scenario('12. Local connections never ping (menu/practice/bot server)', async (env, out) => {
    append(env, LINES.queueStart);
    await waitFor(out, t => t.includes('Queue started'));
    append(env, "[Client] CL:  Connected to 'loopback:1'");
    append(env, "[Client] CL:  Connected to '127.0.0.1:27015'");
    await sleep(1500);
    assert(alerts(out) === 0, 'no ping on loopback/127.0.0.1', `got ${alerts(out)}`);
    append(env, LINES.serverConnect); // real remote server, still in queue
    assert(await waitFor(out, t => alerts({ text: t }) === 1), 'remote server still pings');
  });

  await scenario('13. Stale buffered log lines never ping', async (env, out) => {
    const stamp = d => {
      const p = n => String(n).padStart(2, '0');
      return `${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
    };
    const old = new Date(Date.now() - 25 * 60 * 1000); // flushed 25 min late
    append(env, `${stamp(old)} ${LINES.queueStart}`);
    append(env, `${stamp(old)} ${LINES.lobbyCreated}`);
    await sleep(1500);
    assert(alerts(out) === 0, 'no ping on 25-min-old lines', `got ${alerts(out)}`);
    append(env, `${stamp(new Date())} Lobby 55555 for Match 44444 created`);
    assert(await waitFor(out, t => alerts({ text: t }) === 1), 'fresh-stamped line pings');
  });

  await scenario('14. Menu-hover hero never leaks into the pop ping (3-pick assignment)', async (env, out) => {
    append(env, 'VMDL Camera Pose Success! loading models/heroes/atlas/atlas_body.vmdl');
    assert(await waitFor(out, t => t.includes('Hero: Abrams')), 'hover logged to console');
    append(env, LINES.queueStart);
    append(env, LINES.lobbyCreated);
    await waitFor(out, t => alerts({ text: t }) === 1);
    assert(!out.text.includes('Abrams — MATCH FOUND'),
      'pop ping does not claim the hovered hero', out.text.split('MATCH FOUND')[0].slice(-80));
    append(env, '[Server] Loaded hero 3/hero_gigawatt'); // game assigned Seven, not Abrams
    assert(await waitFor(out, t => t.includes('You got Seven')), 'assignment reveal names the real hero');
  });

  await scenario('15. Assigned hero announced at load-in and recorded in stats', async (env, out) => {
    append(env, LINES.queueStart);
    append(env, LINES.lobbyCreated);
    await waitFor(out, t => alerts({ text: t }) === 1);
    append(env, '[Server] Loaded hero 3/hero_gigawatt');
    assert(await waitFor(out, t => t.includes('You got Seven')), 'follow-up names assigned hero');
    await sleep(300);
    const stats = JSON.parse(fs.readFileSync(env.config.replace(/\.json$/, '') + '.stats.json', 'utf8'));
    assert(stats[stats.length - 1].hero === 'Seven', 'assigned hero saved to stats',
      JSON.stringify(stats[stats.length - 1]));
  });

  await scenario('16. Post-match quiet window: end-of-game noise never pings', async (env, out) => {
    append(env, LINES.queueStart);
    append(env, LINES.lobbyCreated);
    await waitFor(out, t => alerts({ text: t }) === 1);
    await sleep(2500); // outlast the test cooldown so the window is doing the work
    append(env, LINES.lobbyDestroyed);
    // Buffered end-of-game flush replays an UNSTAMPED lobby-created line —
    // the stale check can't catch it; the quiet window must.
    append(env, LINES.lobbyCreated);
    append(env, LINES.serverConnect);
    await sleep(1500);
    assert(alerts(out) === 1, 'end-of-game replay stayed silent', `got ${alerts(out)}`);
    append(env, LINES.queueStart); // fresh queue re-arms
    append(env, 'Lobby 77777 for Match 66666 created');
    assert(await waitFor(out, t => alerts({ text: t }) === 2), 'fresh queue pings again');
  });

  await scenario('17. Ping says how long you queued, stats recorded', async (env, out) => {
    append(env, LINES.queueStart);
    await waitFor(out, t => t.includes('Queue started'));
    await sleep(2000); // "queue" for a couple of seconds
    append(env, LINES.lobbyCreated);
    assert(await waitFor(out, t => /You queued \d+s/.test(t)), 'queue duration in ping');
    assert(await waitFor(out, t => t.includes('Queue time:')), 'queue time on console');
    const stats = JSON.parse(fs.readFileSync(env.config.replace(/\.json$/, '') + '.stats.json', 'utf8'));
    assert(Array.isArray(stats) && stats.length === 1 && stats[0].seconds >= 1,
      'stats file recorded the pop', JSON.stringify(stats));
  });

  await scenario('18. Patch insurance: unexplained server join warns loudly', async (env, out) => {
    append(env, LINES.serverConnect); // no queue, no pop, remote server
    assert(await waitFor(out, t => t.includes('possible missed match')), 'warning shown');
    await sleep(500);
    assert(alerts(out) === 0, 'warning is not a match ping', `got ${alerts(out)}`);
  });

  console.log('\n19. Second instance on the same config exits by itself');
  {
    const env = makeEnv('single-instance');
    const first = startWatcher(env);
    await sleep(800);
    const second = startWatcher(env);
    await sleep(800);
    assert(await waitFor(second.out, t => t.includes('Already running')),
      'second copy detected the first and exited');
    append(env, LINES.queueStart);
    append(env, LINES.lobbyCreated);
    assert(await waitFor(first.out, t => alerts({ text: t }) === 1), 'first copy still alerts');
    first.child.kill(); second.child.kill();
  }

  console.log('\n20. Finds the game via Steam\'s library index (any drive)');
  {
    // Fake Steam root whose libraryfolders.vdf points at a second library
    // where "Deadlock" is installed.
    const steamRoot = path.join(TMP, 'FakeSteam');
    const lib2 = path.join(TMP, 'OtherDrive', 'SteamLibrary');
    const gameDir = path.join(lib2, 'steamapps', 'common', 'Deadlock', 'game', 'citadel');
    fs.mkdirSync(path.join(steamRoot, 'steamapps'), { recursive: true });
    fs.mkdirSync(gameDir, { recursive: true });
    fs.writeFileSync(path.join(gameDir, 'console.log'), '');
    fs.writeFileSync(path.join(steamRoot, 'steamapps', 'libraryfolders.vdf'),
      `"libraryfolders"\n{\n\t"0"\n\t{\n\t\t"path"\t\t"${lib2.replace(/\\/g, '\\\\')}"\n\t}\n}\n`);
    const env = makeEnv('vdf-detect');
    const { child, out } = startWatcher(env, [], { DMP_STEAM_ROOT: steamRoot });
    await sleep(1200);
    child.kill();
    assert(out.text.includes(path.join('Deadlock', 'game', 'citadel', 'console.log')),
      'located console.log through libraryfolders.vdf', out.text.split('\n')[0]);
  }

  await scenario('21. Match duration is tracked when the match ends', async (env, out) => {
    append(env, LINES.queueStart);
    append(env, LINES.lobbyCreated);
    await waitFor(out, t => alerts({ text: t }) === 1);
    await sleep(3500); // "play" the match
    append(env, LINES.lobbyDestroyed);
    assert(await waitFor(out, t => t.includes('Match over after')), 'match end logged');
    const stats = JSON.parse(fs.readFileSync(env.config.replace(/\.json$/, '') + '.stats.json', 'utf8'));
    assert(stats[stats.length - 1].matchSeconds >= 3, 'duration recorded in stats',
      JSON.stringify(stats[stats.length - 1]));
  });

  console.log('\n22. --stats prints the report card');
  {
    const env = makeEnv('stats-report');
    fs.writeFileSync(env.config.replace(/\.json$/, '') + '.stats.json', JSON.stringify([
      { at: new Date().toISOString(), seconds: 120, hero: 'Haze', matchSeconds: 1800 },
      { at: new Date().toISOString(), seconds: 300, hero: 'Haze', matchSeconds: 2400 },
      { at: new Date().toISOString(), seconds: 60, hero: 'Abrams' },
    ]));
    const outText = await new Promise(resolve => {
      const c = spawn(process.execPath, [WATCH, '--stats', '--config', env.config]);
      let t = '';
      c.stdout.on('data', d => { t += d; });
      c.on('close', () => resolve(t));
    });
    assert(outText.includes('Queues popped:  3'), 'pop count', outText);
    assert(outText.includes('Haze ×2'), 'hero leaderboard');
    assert(outText.includes('Average match'), 'match length average');
  }

  await scenario('23. Street Brawl is named in the load-in ping and stats', async (env, out) => {
    append(env, LINES.queueStart);
    append(env, LINES.lobbyCreated);
    await waitFor(out, t => alerts({ text: t }) === 1);
    append(env, '[HostStateManager] Host activate: GameLoop (dl_brawl_night)');
    append(env, '[Server] Loaded hero 3/hero_gigawatt');
    assert(await waitFor(out, t => t.includes('You got Seven — Street Brawl')),
      'follow-up names hero and mode');
    const stats = JSON.parse(fs.readFileSync(env.config.replace(/\.json$/, '') + '.stats.json', 'utf8'));
    assert(stats[stats.length - 1].mode === 'Street Brawl', 'mode recorded in stats',
      JSON.stringify(stats[stats.length - 1]));
  });

  await scenario('24. Normal mode detected from the map line', async (env, out) => {
    append(env, LINES.queueStart);
    append(env, LINES.lobbyCreated);
    await waitFor(out, t => alerts({ text: t }) === 1);
    append(env, '[Client] Map: "street_test"');
    assert(await waitFor(out, t => t.includes('Mode: Normal')), 'Normal mode spotted');
    const stats = JSON.parse(fs.readFileSync(env.config.replace(/\.json$/, '') + '.stats.json', 'utf8'));
    assert(stats[stats.length - 1].mode === 'Normal', 'Normal recorded in stats');
  });

  console.log('\n25. --steam wrapper: starts hidden watcher, runs the game, exits with it');
  {
    const env = makeEnv('steam-wrap');
    const code = await new Promise(resolve => {
      spawn(process.execPath, [WATCH, '--config', env.config, '--log', env.log,
        '--steam', process.execPath, '-e', 'setTimeout(()=>{}, 800)'])
        .on('close', resolve);
    });
    assert(code === 0, 'wrapper exited cleanly with the game', `got ${code}`);
    await sleep(800); // hidden watcher should be up and holding the lock
    let pid = 0;
    try { pid = parseInt(fs.readFileSync(env.config + '.lock', 'utf8'), 10); } catch {}
    let alive = false;
    try { process.kill(pid, 0); alive = true; } catch {}
    assert(alive, 'hidden watcher is running after the wrapper exits', `pid ${pid}`);
    try { process.kill(pid); } catch {}
  }

  await scenario('27. Unrecorded pop cannot smudge an old stats entry', async (env, out) => {
    // Old entry from "yesterday"; watcher starts mid-queue (no queue-start
    // seen), so this pop records nothing — the hero assignment that follows
    // must not be written onto the old entry.
    const statsPath = env.config.replace(/\.json$/, '') + '.stats.json';
    const old = { at: new Date(Date.now() - 24 * 3600 * 1000).toISOString(), seconds: 240, hero: 'Haze' };
    fs.writeFileSync(statsPath, JSON.stringify([old]));
    append(env, LINES.lobbyCreated); // pop with no queue-start
    await waitFor(out, t => alerts({ text: t }) === 1);
    append(env, '[Server] Loaded hero 3/hero_gigawatt');
    await waitFor(out, t => t.includes('You got Seven'));
    await sleep(300);
    const stats = JSON.parse(fs.readFileSync(statsPath, 'utf8'));
    assert(stats.length === 1 && stats[0].hero === 'Haze' && !('mode' in stats[0]),
      'old entry untouched', JSON.stringify(stats));
  });

  console.log('\n26. Discord webhook receives the Game Tracker ping');
  {
    const http = require('http');
    const received = [];
    const server = http.createServer((req, res) => {
      let b = '';
      req.on('data', d => { b += d; });
      req.on('end', () => { received.push(JSON.parse(b)); res.writeHead(204); res.end(); });
    });
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    const port = server.address().port;
    const env = makeEnv('discord', {
      discordWebhook: `http://127.0.0.1:${port}/api/webhooks/test/token`,
    });
    const { child, out } = startWatcher(env);
    await sleep(800);
    append(env, LINES.queueStart);
    append(env, LINES.lobbyCreated);
    await waitFor(out, t => alerts({ text: t }) === 1);
    await sleep(600);
    child.kill();
    server.close();
    assert(received.length === 1, 'exactly one Discord message', `got ${received.length}`);
    const msg = received[0] || {};
    assert(msg.username === 'Game Tracker', 'sent as Game Tracker bot', JSON.stringify(msg));
    assert((msg.content || '').includes('@everyone') && msg.content.includes('MATCH FOUND'),
      'mentions everyone with the match alert', msg.content);
  }

  // 7. Legacy config migration (no watcher needed)
  console.log('\n7. Legacy config auto-upgrades, keeping the ntfy topic');
  {
    const config = path.join(TMP, 'legacy-config.json');
    fs.writeFileSync(config, JSON.stringify({
      patterns: [
        'match\\s*(ready|found|made)', 'party_?match',
        'matchmaking.*(ready|found|complete)', 'lobby.*(ready|found)',
        'Connect(ing)? to .*server', 'CCitadelLobby.*match',
      ],
      cooldownSeconds: 60,
      ntfyTopic: 'deadlock-keepme',
    }));
    const log = path.join(TMP, 'legacy.log');
    fs.writeFileSync(log, '');
    const child = spawn(process.execPath, [WATCH, '--log', log, '--config', config]);
    await sleep(1200);
    child.kill();
    const migrated = JSON.parse(fs.readFileSync(config, 'utf8'));
    assert(migrated.patterns.some(p => p.includes('Lobby')), 'patterns upgraded');
    assert(migrated.ntfyTopic === 'deadlock-keepme', 'ntfy topic preserved');
  }

  // 8. --find surfaces the match line as a low-count candidate
  console.log('\n8. --find lists the match-found line among candidates');
  {
    const env = makeEnv('find');
    fs.writeFileSync(env.log, [
      ...Array(20).fill(LINES.noise + ' match'), // noisy line containing a keyword
      LINES.queueStart, LINES.lobbyCreated, LINES.serverConnect,
    ].join('\n') + '\n');
    const out = await new Promise(resolve => {
      const c = spawn(process.execPath, [WATCH, '--find', '--log', env.log, '--config', env.config]);
      let t = '';
      c.stdout.on('data', d => { t += d; });
      c.on('close', () => resolve(t));
    });
    assert(out.includes('Lobby 34817593 for Match 29471852 created'), 'lobby line listed');
    assert(out.indexOf('Lobby 34817593') < out.indexOf('Heartbeat'),
      'one-off lines sorted above noise');
  }

  // 9. --test exits cleanly
  console.log('\n9. --test fires and exits 0');
  {
    const env = makeEnv('selftest');
    const code = await new Promise(resolve => {
      spawn(process.execPath, [WATCH, '--test', '--config', env.config])
        .on('close', resolve);
    });
    assert(code === 0, '--test exit code 0', `got ${code}`);
  }

  console.log(`\n${'='.repeat(40)}\n${passed} passed, ${failed} failed`);
  fs.rmSync(TMP, { recursive: true, force: true });
  process.exit(failed ? 1 : 0);
}

main();
