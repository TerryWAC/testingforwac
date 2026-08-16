/* The pitch. Canvas-rendered so the ball, net and particles can all move
   on a single delta-timed loop, independent of DOM layout. */

var Scene = (function () {

  var canvas, ctx;
  var W = 0, H = 0, dpr = 1;
  var time = 0;

  var MAX_BALLS = 44;
  var balls = [];

  var geo = {};            // recomputed on resize
  var crowd = [];
  var keeper = { x: 0, target: 0, dive: 0, diveDir: 1 };
  var netFlash = 0;        // white bloom on the net after a goal
  var wave = -1;           // crowd wave position, -1 when idle
  var autoTimer = 0;

  /* ---------- setup ---------- */

  function init(el) {
    canvas = el;
    ctx = canvas.getContext('2d');
    resize();

    for (var i = 0; i < MAX_BALLS; i++) {
      balls.push({ live: false, t: 0, dur: 1, sx: 0, sy: 0, tx: 0, ty: 0,
                   arc: 0, rot: 0, spin: 0, auto: false, value: 0, trail: [] });
    }
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2.5);  // cap: 3x costs more than it shows
    var r = canvas.getBoundingClientRect();

    W = r.width;
    H = r.height;
    canvas.width  = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    layout();
    buildCrowd();
  }

  function layout() {
    var gw = W * 0.68, gh = H * 0.26;
    var gx = (W - gw) / 2, gy = H * 0.15;

    // The back of the net sits higher and narrower, which is all the
    // perspective this view needs to read as three-dimensional.
    var bw = gw * 0.80, bh = gh * 0.84;

    geo = {
      horizon: H * 0.30,
      front: { x: gx, y: gy, w: gw, h: gh },
      back:  { x: (W - bw) / 2, y: gy - gh * 0.09, w: bw, h: bh },
      postW: Math.max(3, W * 0.013),
      ballR: W * 0.040,
      origin: { x: W * 0.5, y: H * 0.965 }
    };

    keeper.x = keeper.target = geo.front.x + geo.front.w / 2;
  }

  function buildCrowd() {
    crowd.length = 0;
    var cols = Math.round(W / 11);
    var rows = Math.max(4, Math.round(geo.horizon / 13));

    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        crowd.push({
          x: (c + (r % 2) * 0.5) * (W / cols) + 3,
          y: 6 + r * (geo.horizon / rows) * 0.92,
          hue: Math.random() * 360,
          phase: Math.random() * Math.PI * 2,
          base: 0.10 + Math.random() * 0.16
        });
      }
    }
  }

  /* ---------- shooting ---------- */

  function freeBall() {
    for (var i = 0; i < balls.length; i++) if (!balls[i].live) return balls[i];
    return null;
  }

  function shoot(value, auto) {
    var b = freeBall();
    if (!b) return;                       // at capacity; the goal still counts

    var bk = geo.back;
    var m = bk.w * 0.16;
    var tx = bk.x + m + Math.random() * (bk.w - m * 2);
    var ty = bk.y + bk.h * 0.22 + Math.random() * (bk.h * 0.60);

    b.live = true;
    b.t = 0;
    b.dur = auto ? 0.62 + Math.random() * 0.12 : 0.50;
    b.sx = auto ? W * (0.18 + Math.random() * 0.64) : geo.origin.x;
    b.sy = geo.origin.y;
    b.tx = tx;
    b.ty = ty;
    b.arc = (auto ? 0.10 : 0.15) * H * (0.75 + Math.random() * 0.5);
    b.rot = 0;
    b.spin = (Math.random() - 0.5) * 22;
    b.auto = !!auto;
    b.value = value;
    b.trail.length = 0;

    if (!auto) {
      // Keeper commits early and commits wrong. It is more fun that way.
      keeper.diveDir = tx < geo.front.x + geo.front.w / 2 ? 1 : -1;
      keeper.dive = 1;
    }
  }

  function onArrive(b) {
    var big = !b.auto;

    FX.ripple(b.tx, b.ty, big ? 11 : 5);
    FX.burst(b.tx, b.ty, big ? 20 : 5, { gold: big, speed: big ? 230 : 130 });
    FX.popup(b.tx, b.ty - 12, '+' + Fmt.num(b.value), {
      gold: big, size: big ? 17 : 13, life: big ? 1.1 : 0.85
    });

    netFlash = Math.min(1, netFlash + (big ? 0.55 : 0.16));
    if (big) { FX.kick(5); wave = 0; }
  }

  /* Celebration hook for milestones and prestige. */
  function celebrate(text) {
    FX.confetti(W, 70);
    FX.popup(W / 2, H * 0.52, text, { gold: true, size: 24, life: 1.8, speed: 34 });
    FX.kick(9);
    wave = 0;
  }

  /* ---------- update ---------- */

  function update(dt) {
    time += dt;

    // Auto-goals spawn visibly, but the spawn rate grows logarithmically
    // so a huge squad reads as "busy" rather than as a solid wall of balls.
    var gps = State.goalsPerSec();
    if (gps > 0) {
      var perSec = Fmt.clamp(0.8 + Math.log10(1 + gps) * 2.2, 0.8, 14);
      var interval = 1 / perSec;

      autoTimer += dt;
      var guard = 0;
      while (autoTimer >= interval && guard++ < 6) {
        autoTimer -= interval;
        shoot(gps * interval, true);
      }
      if (autoTimer > interval * 6) autoTimer = 0;   // returning from a stall
    }

    for (var i = 0; i < balls.length; i++) {
      var b = balls[i];
      if (!b.live) continue;

      b.t += dt / b.dur;
      b.rot += b.spin * dt;

      if (b.t >= 1) { b.live = false; onArrive(b); continue; }

      var p = ballPos(b);
      b.trail.push(p.x, p.y, p.s);
      if (b.trail.length > 24) b.trail.splice(0, 3);
    }

    // Keeper drifts along its line, then throws itself the wrong way.
    if (keeper.dive > 0) {
      keeper.dive = Math.max(0, keeper.dive - dt * 2.1);
    } else {
      keeper.target = geo.front.x + geo.front.w / 2
                    + Math.sin(time * 0.7) * geo.front.w * 0.16;
    }
    keeper.x = Fmt.approach(keeper.x, keeper.target, 5, dt);

    netFlash = Math.max(0, netFlash - dt * 2.2);
    if (wave >= 0) { wave += dt * 1.5; if (wave > 1.6) wave = -1; }
  }

  /* Quadratic-ish flight with an eased time curve; scale shrinks with
     distance so the ball appears to travel away from the camera. */
  function ballPos(b) {
    var e = Fmt.ease.outQuint(b.t) * 0.55 + b.t * 0.45;  // fast off the boot
    var x = Fmt.lerp(b.sx, b.tx, e);
    var y = Fmt.lerp(b.sy, b.ty, e) - Math.sin(e * Math.PI) * b.arc;
    var s = Fmt.lerp(1, 0.42, e) * (b.auto ? 0.62 : 1);
    return { x: x, y: y, s: s };
  }

  /* ---------- draw ---------- */

  function draw() {
    var sh = FX.shakeOffset();

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.translate(sh.x, sh.y);

    drawStand();
    drawGrass();
    drawNet();
    drawStruts();
    drawKeeper();
    drawBalls();
    drawFrame();

    FX.drawParticles(ctx);
    FX.drawPopups(ctx);

    ctx.restore();
  }

  function drawStand() {
    var g = ctx.createLinearGradient(0, 0, 0, geo.horizon);
    g.addColorStop(0, '#050d09');
    g.addColorStop(1, '#0d2016');
    ctx.fillStyle = g;
    ctx.fillRect(-20, -20, W + 40, geo.horizon + 20);

    for (var i = 0; i < crowd.length; i++) {
      var c = crowd[i];
      var a = c.base + Math.sin(time * 1.6 + c.phase) * 0.05;

      // A goal sends a wave of light across the stand, left to right.
      if (wave >= 0) {
        var d = Math.abs(c.x / W - wave);
        if (d < 0.16) a += (1 - d / 0.16) * 0.55;
      }

      ctx.globalAlpha = Fmt.clamp(a, 0, 1);
      ctx.fillStyle = 'hsl(' + c.hue + ',45%,62%)';
      ctx.fillRect(c.x, c.y, 3, 3);
    }
    ctx.globalAlpha = 1;

    // Floodlight bloom over the goalmouth.
    var f = geo.front;
    var lg = ctx.createRadialGradient(W / 2, f.y, 0, W / 2, f.y, W * 0.7);
    lg.addColorStop(0, 'rgba(190,255,215,' + (0.05 + netFlash * 0.12).toFixed(3) + ')');
    lg.addColorStop(1, 'rgba(190,255,215,0)');
    ctx.fillStyle = lg;
    ctx.fillRect(0, 0, W, H * 0.7);
  }

  function drawGrass() {
    var g = ctx.createLinearGradient(0, geo.horizon, 0, H);
    g.addColorStop(0, '#16603a');
    g.addColorStop(0.55, '#1c7a45');
    g.addColorStop(1, '#239854');
    ctx.fillStyle = g;
    ctx.fillRect(-20, geo.horizon, W + 40, H - geo.horizon + 20);

    // Mower stripes: bands get taller toward the viewer, which fakes depth.
    ctx.fillStyle = 'rgba(255,255,255,.035)';
    var y = geo.horizon, band = (H - geo.horizon) * 0.06, i = 0;
    while (y < H) {
      if (i % 2 === 0) ctx.fillRect(-20, y, W + 40, band);
      y += band;
      band *= 1.22;
      i++;
    }

    // Penalty arc, for a bit of pitch furniture.
    ctx.strokeStyle = 'rgba(255,255,255,.16)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(W / 2, H * 0.60, W * 0.30, H * 0.075, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  function drawNet() {
    var b = geo.back;

    ctx.fillStyle = 'rgba(6,16,11,.72)';
    ctx.fillRect(b.x, b.y, b.w, b.h);

    var cols = 11, rows = 8;
    var alpha = 0.22 + netFlash * 0.5;
    ctx.strokeStyle = 'rgba(226,255,238,' + alpha.toFixed(3) + ')';
    ctx.lineWidth = 1;

    var c, r, x, y;

    // Vertical strands. Each vertex is displaced by the live ripple field,
    // so an impact ripples through the whole mesh instead of denting one spot.
    for (c = 0; c <= cols; c++) {
      ctx.beginPath();
      for (r = 0; r <= rows; r++) {
        x = b.x + (b.w * c) / cols;
        y = b.y + (b.h * r) / rows;
        var d = FX.netOffset(x, y);
        if (r === 0) ctx.moveTo(x + d * 0.35, y + d);
        else ctx.lineTo(x + d * 0.35, y + d);
      }
      ctx.stroke();
    }

    for (r = 0; r <= rows; r++) {
      ctx.beginPath();
      for (c = 0; c <= cols; c++) {
        x = b.x + (b.w * c) / cols;
        y = b.y + (b.h * r) / rows;
        var d2 = FX.netOffset(x, y);
        if (c === 0) ctx.moveTo(x + d2 * 0.35, y + d2);
        else ctx.lineTo(x + d2 * 0.35, y + d2);
      }
      ctx.stroke();
    }
  }

  function drawStruts() {
    var f = geo.front, b = geo.back;
    ctx.strokeStyle = 'rgba(226,255,238,.18)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(f.x, f.y);                 ctx.lineTo(b.x, b.y);
    ctx.moveTo(f.x + f.w, f.y);           ctx.lineTo(b.x + b.w, b.y);
    ctx.moveTo(f.x, f.y + f.h);           ctx.lineTo(b.x, b.y + b.h);
    ctx.moveTo(f.x + f.w, f.y + f.h);     ctx.lineTo(b.x + b.w, b.y + b.h);
    ctx.stroke();
  }

  function drawKeeper() {
    var f = geo.front;

    // Dive out and recover: 0 at rest, full stretch mid-flight, back to 0.
    // Easing the progress makes the launch quick and the landing soft.
    var progress = Fmt.ease.outCubic(1 - keeper.dive);
    var lean = keeper.dive > 0 ? Math.sin(progress * Math.PI) * keeper.diveDir : 0;

    var kw = f.w * 0.085, kh = f.h * 0.36;
    var x = keeper.x + lean * f.w * 0.30;
    var y = f.y + f.h - kh * 1.02;

    ctx.save();
    ctx.translate(x, y + kh / 2);
    ctx.rotate(lean * 0.85);                 // committed, airborne, beaten

    ctx.fillStyle = '#f4d35e';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(-kw / 2, -kh / 2, kw, kh, kw * 0.35);
    else ctx.rect(-kw / 2, -kh / 2, kw, kh);
    ctx.fill();

    ctx.fillStyle = '#e8c39e';
    ctx.beginPath();
    ctx.arc(0, -kh / 2 - kw * 0.34, kw * 0.32, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function drawBalls() {
    for (var i = 0; i < balls.length; i++) {
      var b = balls[i];
      if (!b.live) continue;

      var p = ballPos(b);
      var r = geo.ballR * p.s;

      // Trail: older samples are smaller and fainter.
      var n = b.trail.length / 3;
      for (var j = 0; j < n; j++) {
        var t = j / n;
        ctx.globalAlpha = t * t * (b.auto ? 0.16 : 0.30);
        ctx.fillStyle = '#dff7e6';
        ctx.beginPath();
        ctx.arc(b.trail[j * 3], b.trail[j * 3 + 1],
                geo.ballR * b.trail[j * 3 + 2] * t * 0.8, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(b.rot);

      ctx.fillStyle = b.auto ? '#cfe8d8' : '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();

      // Panel marks, so the spin is actually visible.
      ctx.fillStyle = 'rgba(18,34,24,.85)';
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.30, 0, Math.PI * 2);
      ctx.fill();
      for (var k = 0; k < 3; k++) {
        var a = (k / 3) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * r * 0.62, Math.sin(a) * r * 0.62, r * 0.17, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  function drawFrame() {
    var f = geo.front, p = geo.postW;

    ctx.fillStyle = '#f2fbf5';
    ctx.shadowColor = 'rgba(0,0,0,.45)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 2;

    ctx.fillRect(f.x - p / 2, f.y, p, f.h);              // left post
    ctx.fillRect(f.x + f.w - p / 2, f.y, p, f.h);        // right post
    ctx.fillRect(f.x - p / 2, f.y - p / 2, f.w + p, p);  // crossbar

    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
  }

  /* Converts a pointer event into canvas space — used only to check the
     tap landed on the pitch, since shots always come off the same spot. */
  function isOnPitch(clientY) {
    var r = canvas.getBoundingClientRect();
    return clientY >= r.top && clientY <= r.bottom;
  }

  function reset() {
    for (var i = 0; i < balls.length; i++) balls[i].live = false;
    autoTimer = 0;
    netFlash = 0;
    wave = -1;
    FX.clear();
  }

  return {
    init: init, resize: resize, update: update, draw: draw,
    shoot: shoot, celebrate: celebrate, isOnPitch: isOnPitch, reset: reset
  };
})();
