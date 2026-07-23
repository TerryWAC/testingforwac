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

function startWatcher(env) {
  const child = spawn(process.execPath, [WATCH, '--log', env.log, '--config', env.config]);
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
