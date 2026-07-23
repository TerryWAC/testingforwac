# 🎯 Deadlock Match Ping

Get a **phone push, desktop notification, and loud beep** the moment your Deadlock match pops — so you can alt-tab, watch YouTube, or leave the room during a long queue without missing the accept (and eating a low-priority penalty).

Works for just you, and optionally your friends: anyone who subscribes to your ping channel on their phone gets the push too. No server, no accounts, nothing to sign up for.

## Quick start

**Windows:** install [Node.js](https://nodejs.org) if you don't have it (`winget install OpenJS.NodeJS.LTS`), then just **double-click `Start-Deadlock-Match-Ping.bat`**.

**Mac/Linux:** `node watch.js`

The first run walks you through everything:

1. **Finds Deadlock's log file** — you add one launch option in Steam (right-click Deadlock → Properties → Launch Options → `-condebug`) so the game writes a `console.log` it can watch.
2. **Sets up phone pings** — it generates a private channel name for you, points you at the free [ntfy](https://ntfy.sh) app (Android/iPhone, no account), you subscribe to your channel, and it sends a **test ping to your phone** on the spot.
3. **Friends (optional)** — share your channel name; anyone subscribed to it in ntfy gets the same push when your match pops.

Then queue up and walk away. When the match is found: phone buzzes, Windows toast pops over whatever you're doing, speakers beep.

Run `node watch.js --test` any time to fire a fake alert and confirm everything works. Run `node watch.js --setup` to change settings.

## Customising the ping

By default the alert names your selected hero: **"🎯 Haze — MATCH FOUND"**. The watcher tracks which hero you have picked from the game's own log (menu selection and server load-in); if the hero isn't known when the queue pops, you get a follow-up ping ("🎮 Playing Haze") as the match loads. Set your own text in the wizard or in `config.json` — `{hero}` is replaced with the hero's name:

```json
"alertTitle": "🎯 {hero} — MATCH FOUND",
"alertMessage": "Queue popped. Move.",
"pcSound": "soft"
```

`pcSound` controls the PC beeping — `"loud"`, `"soft"` (default: a couple of gentle beeps; the toast and phone do the shouting), or `"off"`. The phone push and desktop toast always fire regardless. `node watch.js --test` previews everything.

## Using it with friends

The ping channel **is** the squad — no lobby needed:

- Everyone installs ntfy on their phone and subscribes to the same topic (e.g. `deadlock-a1b2c3d4`).
- When the match pops on your PC, **everyone's phone gets pinged** at once.
- If a friend also runs the watcher, they set the same `ntfyTopic` in their `config.json` — then whoever's game pops first pings the whole squad.

The topic name is the only secret, so pick/keep something unguessable.

## Testing

`npm test` runs an automated suite (~40s) that spawns the real watcher against simulated logs using Deadlock's genuine line formats: a full queue→pop→connect match, the practice range (must NOT ping), a cancelled queue (must NOT ping), backup detection when the primary line is missing, two matches in one session, a game restart truncating the log, config migration, and the `--find`/`--test` modes.

## How detection works

Deadlock prints `Lobby <id> for Match <id> created` to its console log at the exact moment the queue pops — that's the line the watcher alerts on. As a safety net, `CL: Connected to` (the game joining a server) also triggers the alert, but **only while a queue is active** — otherwise entering the practice range or a custom lobby would false-ping. The watcher tracks queue state from the matchmaking start/stop messages, so while you're searching it prints `✓ Queue started — watching for the pop...` — if you see that, you know detection is live end-to-end.

## If the alert doesn't fire (or fires at the wrong time)

A game patch can reword the log lines. Two tools to find the new line **your** build prints:

**Right after a match popped without an alert** (the evidence is already in the log):

```bash
node watch.js --find
```

This scans your existing `console.log` and lists every matchmaking-looking line with how often it appeared. The match-found line is usually one that appeared exactly **once** and mentions match/lobby/server assignment. Copy a distinctive part of it into `"patterns"` in `config.json`.

**To pinpoint it by timing** (during your next queue):

```bash
node watch.js --learn
```

Queue up normally; the moment the match pops, press **Enter** in the terminal. It prints every log line from the last 20 seconds — the one that appeared at the pop is your line.

Both modes also warn you if the log file looks stale — which means the watcher is looking at the wrong file, or `-condebug` isn't set in Steam.

`cooldownSeconds` (default 60) stops one pop from triggering repeated alerts.

## How it works

Single file, zero npm dependencies. `watch.js` polls `console.log` every 500 ms (handles the game truncating/recreating it on restart), matches new lines against the configured regexes, and fires the alert — PowerShell toast + `[console]::beep` on Windows, `osascript`/`afplay` on macOS, `notify-send`/`paplay` on Linux, plus an HTTPS POST to `ntfy.sh/<your-topic>` for the phone pushes. `config.example.json` shows all settings.
