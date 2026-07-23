# 🎯 Deadlock Match Ping

**Never miss a Deadlock queue pop again.** Get a phone push, desktop notification, and a beep the moment your match is found — alt-tab, watch YouTube, or leave the room during long queues without eating a low-priority penalty.

> "🎯 Haze — MATCH FOUND · YOU HAVE A GAME — GO GO GO! You queued 4m 32s."
> "🎮 Playing Haze — Street Brawl · Match is loading — get ready!"

- 📱 **Phone pushes** via the free [ntfy](https://ntfy.sh) app — no account, no signup
- 🖥️ **Desktop toasts** that pop over whatever you're doing (Windows / macOS / Linux)
- 🦸 **Names your hero, the game mode** (Normal / Street Brawl) **and how long you queued**
- 👥 **Squad mode** — friends subscribe to your channel and get pinged too
- 🎮 **Links with Steam** — starts itself, invisibly, whenever you launch Deadlock
- 🪶 **Zero dependencies** — one small Node.js script, no installer, no telemetry, MIT-licensed

*Community tool. Not affiliated with or endorsed by Valve. It only reads the game's own log file — no memory reading, no injection, nothing that touches the game process.*

## Install (Windows, ~2 minutes — nothing else to install)

1. **Download this folder** anywhere — Downloads, `C:\DeadlockPing`, even inside the Deadlock folder itself. It finds the game wherever it is: it reads Steam's own library index, so any drive and any Steam library works. The folder includes **`DeadlockMatchPing.exe`** — a standalone build, so you do **not** need Node.js or anything else. (Windows SmartScreen may warn on first run because the exe is unsigned — choose "More info → Run anyway"; the code is open in this repo. Prefer auditable? Delete the exe, install Node.js, and every script uses `watch.js` instead automatically.)
2. **Double-click `Setup.bat`.** It walks you through everything:
   - finds Deadlock's log (you add the `-condebug` launch option in Steam when prompted),
   - sets up phone pings and **sends a test ping to your phone** on the spot,
   - lets you customise the alert text and beep volume,
   - offers a desktop shortcut (with the app's icon),
   - copies the **Steam link line** to your clipboard — paste it into Deadlock's Launch Options and the watcher starts itself, hidden, every time you launch the game.

That's the whole setup. Queue, walk away, get pinged.

**Mac/Linux:** `node watch.js` — same wizard, minus the Windows helpers.

## Everyday use

If you linked it with Steam: **nothing**. Launch Deadlock like always; a notification confirms the watcher is on. Otherwise double-click `Start-Deadlock-Match-Ping.bat` (or the desktop shortcut) before you queue.

While searching, the console (if visible) shows `✓ Queue started — watching for the pop...` — the live proof detection is working. Useful commands, run from the app folder:

| Command | What it does |
|---|---|
| `DeadlockMatchPing.exe --test` | Fire a fake alert — checks sound, toast, and phone |
| `DeadlockMatchPing.exe --stats` | Your report card: pops, queue times, match lengths, heroes, modes |
| `DeadlockMatchPing.exe --setup` | Re-run the wizard (change text, volume, channel) |
| `DeadlockMatchPing.exe --find` | Scan the log for the match-found line after a game patch |
| `DeadlockMatchPing.exe --learn` | Pinpoint the match-found line live, by timing |
| `npm test` | Run the automated test suite (44 checks; needs Node) |

(No exe? Use `node watch.js --test` etc. — identical.)

## Sharing with friends — one file

Send a friend **just `DeadlockMatchPing.exe`** and your channel code. They double-click it, follow the built-in wizard (it explains the `-condebug` launch option, the phone app, and puts the Steam auto-start line on their clipboard), type your code into ntfy — done. No Node, no README, no other files, no accounts, no server. The exe alone is the whole product; the Steam auto-start uses its built-in `--steam` mode (`"...\DeadlockMatchPing.exe" --steam %command% -condebug`). Every push of this repo runs the 44-check test suite and rebuilds the exe via GitHub Actions.

## Phone pings & squad mode

Setup generates a short private code (e.g. `dl-k4mq7x` — 9 characters, easy to type). Install **ntfy** ([Android](https://play.google.com/store/apps/details?id=io.heckel.ntfy) / [iPhone](https://apps.apple.com/us/app/ntfy/id1625396347)), subscribe to your channel, done.

**Squad mode is just sharing that channel name.** Everyone who subscribes gets the ping when your match pops; friends who run the watcher too can set the same `ntfyTopic` in their `config.json`, so whoever pops first pings everyone. The channel name is the only secret — keep it unguessable.

## Customising the ping

`config.json` (created by setup) — the useful knobs:

```json
"alertTitle":   "🎯 {hero} — MATCH FOUND",
"alertMessage": "YOU HAVE A GAME — GO GO GO!",
"pcSound":      "soft"
```

`{hero}` becomes your selected hero, `{mode}` the game mode, `{queue}` your queue time (appended automatically if not placed). At load-in you get a follow-up ping naming hero and mode ("🎮 Playing Haze — Street Brawl") when they were not known at the pop. `pcSound` is `"loud"`, `"soft"`, or `"off"` — phone and toast always fire regardless. Queue history (last 50 pops, with heroes **and match durations** — the watcher times each match from pop to end) lives in `queue-stats.json`; your recent queue average shows at startup and after each pop, and `--stats` prints the full report card. `cooldownSeconds` (default 60) stops one pop from double-pinging.

## How it works

Deadlock, launched with `-condebug`, writes its console to `game/citadel/console.log`. The watcher (one file, `watch.js`, zero npm dependencies, polling every 500 ms) tails that file and reacts to the game's own messages:

- `Lobby <id> for Match <id> created` → **the queue popped** → alert
- matchmaking start/stop messages → queue tracking (`✓ Queue started`)
- server connect while queued → backup alert if a patch renames the lobby line
- match end, local (`loopback`) connections, stale buffered lines, and a post-match quiet window → **never** alert — extensively tested against false pings
- hero select & load-in lines → hero name in your ping; map lines → game mode (Normal / Street Brawl)

Alerts go out as a PowerShell toast + beeps on Windows (`osascript`/`notify-send` on macOS/Linux) and an HTTPS POST to `ntfy.sh/<your-topic>` for phones. `config.example.json` documents every setting.

**Patch insurance:** if you join a game server without the watcher ever seeing a queue — the signature of Valve rewording the log — it warns you on phone, toast, and console (at most hourly) and points you at `--find`.

## Troubleshooting

- **"Could not find Deadlock's console.log"** — add `-condebug` to Deadlock's Steam Launch Options and launch the game once. Still stuck? `node watch.js --log "X:\path\to\console.log"`.
- **No phone ping, but `--test` works on the PC** — the ntfy topic on your phone must match `ntfyTopic` in `config.json` exactly. On Android, enable ntfy's instant delivery and exempt it from battery optimization.
- **Windows console says "Select" in the title** — clicking inside the window pauses console output (a Windows quirk). Press `Esc` in it. Phone pushes fire first regardless, and the Steam-linked hidden mode has no window to click.
- **Alert at a weird moment / no alert on a pop** — a game patch probably changed the log wording. Run `node watch.js --find` right after it happens (it lists candidate lines from your log, rarest first — the match line usually appears exactly once) and add the line it identifies to `patterns` in `config.json`. `--learn` pinpoints it live by timing instead: press Enter the moment the pop happens and it prints the last 20 seconds of log. Both warn if the log file looks stale (wrong path or missing `-condebug`).

## Files

| File | Purpose |
|---|---|
| `DeadlockMatchPing.exe` | Standalone Windows build — no Node.js needed |
| `watch.js` | The whole app (source; the exe is this file compiled in) |
| `Setup.bat` | One-stop setup: wizard + shortcut + Steam link |
| `Start-Deadlock-Match-Ping.bat` | Run with a visible console |
| `Link-With-Steam.bat` / `steam-launch.bat` / `run-hidden.vbs` | Steam auto-start, hidden |
| `Create-Desktop-Shortcut.bat` | Desktop shortcut with the app icon |
| `assets/icon.ico` | Original Deadlock-styled icon (`tools/gen-icon.js` regenerates it) |
| `config.example.json` | Every setting, documented by example |
| `test.js` | Automated end-to-end suite (`npm test`) |

MIT licensed — see `LICENSE`.
