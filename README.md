# 🎯 Deadlock Match Ping

Pings **you** the moment your Deadlock match pops — so you can alt-tab, watch YouTube, or walk away during a long queue without missing the accept (and eating a low-priority penalty).

Just you, no lobby, no server, no accounts. A tiny watcher runs on your PC, tails Deadlock's own console log, and the instant it sees the match-found line it:

- 🔊 plays a loud beep burst
- 🖥️ fires a desktop notification (Windows toast / macOS / Linux notify-send)
- 📱 optionally pushes to your **phone** via [ntfy.sh](https://ntfy.sh) — free, no signup

## Setup (2 minutes)

1. **Turn on Deadlock's log file.** In Steam: right-click Deadlock → **Properties** → **Launch Options** → add:

   ```
   -condebug
   ```

   This makes the game write everything to `.../Steam/steamapps/common/Deadlock/game/citadel/console.log`.

2. **Run the watcher** (needs Node.js 18+, nothing to install):

   ```bash
   node watch.js
   ```

   It auto-detects `console.log` in the usual Steam locations. If yours is elsewhere:

   ```bash
   node watch.js --log "D:\SteamLibrary\steamapps\common\Deadlock\game\citadel\console.log"
   ```

3. **Check the alert works** before trusting it with a queue:

   ```bash
   node watch.js --test
   ```

4. Queue up in Deadlock, alt-tab, live your life. When the match pops, you'll know.

## Phone pings (optional, recommended)

If you wander away from the PC entirely:

1. Install the **ntfy** app ([Android](https://play.google.com/store/apps/details?id=io.heckel.ntfy) / [iOS](https://apps.apple.com/us/app/ntfy/id1625396347)).
2. In the app, subscribe to a topic with a hard-to-guess name, e.g. `terry-deadlock-x7k2p`. (The topic name is the only secret — anyone who knows it can see the pings.)
3. Copy `config.example.json` to `config.json` and set:

   ```json
   { "ntfyTopic": "terry-deadlock-x7k2p" }
   ```

Now the match-found ping hits your phone too.

## If the alert doesn't fire (or fires at the wrong time)

Valve doesn't document Deadlock's log format and it can change between patches, so the watcher ships with a set of best-guess patterns for the match-found line. To nail down the exact line **your** build prints:

```bash
node watch.js --learn
```

Queue up normally; the moment the match pops, press **Enter** in the terminal. It prints every log line from the last 20 seconds — find the one that appeared at the pop, then add a matching regex to `"patterns"` in `config.json`. From then on detection is exact.

`cooldownSeconds` (default 60) stops one pop from triggering repeated alerts.

## How it works

Single file, zero npm dependencies. `watch.js` polls `console.log` every 500 ms (handles the game truncating/recreating it on restart), matches new lines against the configured regexes, and fires the alert — PowerShell toast + `[console]::beep` on Windows, `osascript`/`afplay` on macOS, `notify-send`/`paplay` on Linux, plus an HTTP POST to ntfy.sh if configured.
