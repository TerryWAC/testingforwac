# Striker Idle

A football idle game for mobile browsers. Tap to shoot, sign a squad that
scores for you, and bank trophies at the end of each season.

No build step, no dependencies. Open `index.html` and it runs.

```
cd game
python3 -m http.server 8099
# then visit http://localhost:8099 — or just open index.html directly
```

Serving it is only needed if you want the save to persist under a stable
origin; the game itself works fine from `file://`.

## Layout

```
game/
├── index.html
├── css/style.css
└── js/
    ├── format.js   number/time formatting, easing helpers
    ├── data.js     squad + upgrade tables, all balance constants
    ├── state.js    economy simulation, purchases, save/load
    ├── fx.js       particles, floating numbers, net ripples, screen shake
    ├── scene.js    canvas pitch — goal, net, keeper, balls
    ├── ui.js       DOM binding for the panels
    └── main.js     boot, input, the single game loop
```

`state.js` has no idea the game is drawn, and `scene.js` never mutates the
economy. Tuning the curve means editing `data.js` and nothing else.

## How the idle loop works

- **Tap** the pitch to score directly, worth `tapPower()`.
- **Squad** members each add a fixed rate. Every 10 of one unit multiplies
  that unit's output by 1.5.
- **Training** has three endless tracks: tap power, a global multiplier, and
  offline performance.
- **Season** resets the squad for trophies, worth +5% to everything forever.
  Trophies scale with the square root of the season's total, so a season
  worth ending is always a while away but never out of reach.
- **Offline** progress pays at 50% (up to 90% with physio upgrades), capped
  at 4h base and +2h per physio level.

Saves go to `localStorage` under `striker-idle-v1`, written every 15s and on
`pagehide`/`visibilitychange`.

## Notes on the animation

The brief was "smooth", so a few things are deliberate:

- **One loop, delta-timed.** Everything advances on `requestAnimationFrame`
  with `dt` capped at 50ms, so a hitch slows the frame instead of teleporting
  the ball. Long absences go through the offline path instead.
- **Exponential smoothing, not lerp-by-constant.** `Fmt.approach` uses
  `exp(-speed * dt)`, which looks identical at 30fps and 120fps. This is what
  gives the header its odometer feel as idle income ticks in.
- **Pooled effects.** Particles, popups and ripples are fixed-capacity and
  pre-allocated. Allocating mid-play causes GC pauses, and a pause reads as
  jank no matter how good the easing is.
- **The net is a mesh, not a sprite.** Each vertex is displaced by a decaying
  travelling wave per impact (`FX.netOffset`), so a shot ripples across the
  whole net rather than denting one spot.
- **CSS moves transforms and opacity only**, keeping DOM animation on the
  compositor and off the layout path.
- **Rows are built once** and mutated in place. Rebuilding `innerHTML` every
  frame is the usual cause of scroll jank in idle games.
- `prefers-reduced-motion` collapses every CSS animation.

## Tested

Chromium at 390×844 (iPhone-ish), DPR 2: 62fps with a full pitch, no console
errors, save/reload round-trips, milestone and prestige maths verified.
