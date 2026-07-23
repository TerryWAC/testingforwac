// Deadlock match ping server — zero dependencies, Node.js stdlib only.
// The party joins a lobby by code and readies up. When everyone is ready the
// party is "in queue"; when the match pops, anyone hits "Match found" and the
// server pings the whole party so nobody misses the accept.

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;

// lobbies: code -> { players: Map<playerId, {id, name, ready, streams: Set<res>}>, createdAt }
const lobbies = new Map();

const LOBBY_TTL_MS = 1000 * 60 * 60 * 6; // clean up lobbies older than 6h

function getLobby(code) {
  let lobby = lobbies.get(code);
  if (!lobby) {
    lobby = { players: new Map(), createdAt: Date.now() };
    lobbies.set(code, lobby);
  }
  return lobby;
}

function lobbyState(code) {
  const lobby = lobbies.get(code);
  if (!lobby) return { code, players: [], allReady: false };
  const players = [...lobby.players.values()].map(p => ({
    id: p.id,
    name: p.name,
    ready: p.ready,
    online: p.streams.size > 0,
  }));
  const allReady = players.length > 0 && players.every(p => p.ready);
  return { code, players, allReady };
}

function broadcast(code, event, data) {
  const lobby = lobbies.get(code);
  if (!lobby) return;
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const player of lobby.players.values()) {
    for (const res of player.streams) {
      res.write(payload);
    }
  }
}

function broadcastState(code) {
  broadcast(code, 'state', lobbyState(code));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 10_000) req.destroy();
    });
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch { reject(new Error('bad json')); }
    });
    req.on('error', reject);
  });
}

function json(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
}

function normCode(raw) {
  return String(raw || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
}

setInterval(() => {
  const now = Date.now();
  for (const [code, lobby] of lobbies) {
    const anyOnline = [...lobby.players.values()].some(p => p.streams.size > 0);
    if (!anyOnline && now - lobby.createdAt > LOBBY_TTL_MS) lobbies.delete(code);
  }
}, 1000 * 60 * 10).unref();

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  // --- static page ---
  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
    fs.readFile(path.join(__dirname, 'public', 'index.html'), (err, data) => {
      if (err) { res.writeHead(500); return res.end('missing index.html'); }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(data);
    });
    return;
  }

  // --- join a lobby ---
  if (req.method === 'POST' && url.pathname === '/api/join') {
    let body;
    try { body = await readBody(req); } catch { return json(res, 400, { error: 'bad request' }); }
    const code = normCode(body.code) || crypto.randomBytes(2).toString('hex').toUpperCase();
    const name = String(body.name || '').trim().slice(0, 24) || 'Player';
    const lobby = getLobby(code);
    if (lobby.players.size >= 20) return json(res, 400, { error: 'lobby full' });
    const id = crypto.randomBytes(8).toString('hex');
    lobby.players.set(id, { id, name, ready: false, streams: new Set() });
    broadcastState(code);
    return json(res, 200, { playerId: id, code, state: lobbyState(code) });
  }

  // --- toggle ready ---
  if (req.method === 'POST' && url.pathname === '/api/ready') {
    let body;
    try { body = await readBody(req); } catch { return json(res, 400, { error: 'bad request' }); }
    const code = normCode(body.code);
    const lobby = lobbies.get(code);
    const player = lobby && lobby.players.get(body.playerId);
    if (!player) return json(res, 404, { error: 'not in lobby' });
    player.ready = Boolean(body.ready);
    const state = lobbyState(code);
    broadcastState(code);
    if (state.allReady) {
      // Whole party readied up — time to start searching in-game.
      broadcast(code, 'queue-start', { code, at: Date.now() });
    }
    return json(res, 200, { state });
  }

  // --- leave lobby ---
  if (req.method === 'POST' && url.pathname === '/api/leave') {
    let body;
    try { body = await readBody(req); } catch { return json(res, 400, { error: 'bad request' }); }
    const code = normCode(body.code);
    const lobby = lobbies.get(code);
    if (lobby && lobby.players.delete(body.playerId)) {
      if (lobby.players.size === 0) lobbies.delete(code);
      else broadcastState(code);
    }
    return json(res, 200, { ok: true });
  }

  // --- match found: the queue popped, ping the whole party to accept ---
  if (req.method === 'POST' && url.pathname === '/api/match-found') {
    let body;
    try { body = await readBody(req); } catch { return json(res, 400, { error: 'bad request' }); }
    const code = normCode(body.code);
    const lobby = lobbies.get(code);
    const player = lobby && lobby.players.get(body.playerId);
    if (!player) return json(res, 404, { error: 'not in lobby' });
    broadcast(code, 'match-found', { code, at: Date.now(), from: player.name });
    return json(res, 200, { ok: true });
  }

  // --- SSE stream of lobby events ---
  if (req.method === 'GET' && url.pathname === '/api/events') {
    const code = normCode(url.searchParams.get('code'));
    const playerId = url.searchParams.get('playerId');
    const lobby = lobbies.get(code);
    const player = lobby && lobby.players.get(playerId);
    if (!player) { res.writeHead(404); return res.end(); }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.write(`event: state\ndata: ${JSON.stringify(lobbyState(code))}\n\n`);
    player.streams.add(res);
    broadcastState(code); // others see this player come online

    const keepAlive = setInterval(() => res.write(': ping\n\n'), 25_000);
    req.on('close', () => {
      clearInterval(keepAlive);
      player.streams.delete(res);
      broadcastState(code); // others see this player go offline
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('not found');
});

server.listen(PORT, () => {
  console.log(`Deadlock match ping server running at http://localhost:${PORT}`);
});
