# ⏳ Deadlock Match Ping

Pings your whole party the moment your Deadlock match pops — so nobody misses the accept because they were alt-tabbed during a long queue.

## The problem

You party up in Deadlock, hit search, and the queue drags on. People tab out to YouTube, Discord, whatever. The match finally pops… and someone misses the accept, the match is cancelled, and you're back to the end of the queue.

## How it works

1. One person opens the app and creates a party (leave the code blank to generate one).
2. They share the 4-letter party code; everyone in the Deadlock party joins with it.
3. Everyone hits **"I'm ready"**. When the whole party is ready, everyone gets a soft ping: *start searching in Deadlock*.
4. Queue away — alt-tab freely. Whoever notices the match pop hits **"🎯 Match found — ping everyone"**.
5. **Everybody gets blasted at once**: a full-screen MATCH FOUND banner, an alert sound, a browser notification (works with the tab in the background), and vibration on phones. Tab in, accept, play.

## Running it

No dependencies — just Node.js 18+.

```bash
npm start
# → http://localhost:3000
```

Set `PORT` to change the port: `PORT=8080 npm start`.

To use it with your party, deploy it anywhere that runs Node (Railway, Render, Fly.io, a VPS…) or expose your local server with a tunnel like `ngrok http 3000`.

## Tech

- **Server**: single-file Node.js (`server.js`), zero npm dependencies. In-memory parties, REST endpoints for join / ready / match-found / leave.
- **Realtime**: Server-Sent Events (SSE) push party state, queue-start, and match-found pings to every connected player.
- **Client**: single HTML page (`public/index.html`) styled after Deadlock's art-deco brass-and-green look. Notifications via the Notification API, sound via the Web Audio API (no audio files), vibration via the Vibration API.

## Notes

- Detecting the match pop automatically isn't possible — Valve doesn't expose a live matchmaking API for Deadlock — so the "match found" button is pressed by whoever sees the queue pop. Everyone else gets pinged instantly.
- Parties live in memory and are cleaned up after ~6 hours of everyone being offline. No database needed.
- Allow notifications when prompted so pings reach you while you're in another tab or app.
