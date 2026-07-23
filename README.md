# 🎮 Game Ready Ping

Pings everyone in your squad the moment the game is ready to play — no more spamming "game's up!" in chat while people are alt-tabbed.

## How it works

1. One person opens the app and joins a lobby (leave the code blank to create one).
2. They share the 4-letter lobby code with the squad; everyone joins with it.
3. Everyone hits **"I'm ready"** when they're set.
4. The instant the last person readies up, **everybody gets pinged**: a full-screen banner, a sound, a browser notification (works with the tab in the background), and vibration on phones.

There's also a **"📣 Ping everyone now"** button for when the match pops and you just need to yell at everyone immediately.

## Running it

No dependencies — just Node.js 18+.

```bash
npm start
# → http://localhost:3000
```

Set `PORT` to change the port: `PORT=8080 npm start`.

To play with friends, deploy it anywhere that runs Node (Railway, Render, Fly.io, a VPS...) or expose your local server with a tunnel like `ngrok http 3000`.

## Tech

- **Server**: single-file Node.js (`server.js`), zero npm dependencies. In-memory lobbies, REST endpoints for join/ready/ping/leave.
- **Realtime**: Server-Sent Events (SSE) push lobby state and game-ready pings to every connected player.
- **Client**: single HTML page (`public/index.html`). Notifications via the Notification API, sound via the Web Audio API (no audio files), vibration via the Vibration API.

## Notes

- Lobbies live in memory and are cleaned up after ~6 hours of everyone being offline. No database needed.
- Allow notifications when prompted so pings reach you while you're in another tab or app.
