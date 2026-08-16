/* Effects layer: particles, floating numbers, net ripples, screen shake.
   Everything is pooled and fixed-capacity — allocation during play is what
   causes GC hitches, and a hitch is the one thing that reads as "janky"
   no matter how good the easing is. */

var FX = (function () {

  var MAX_PARTICLES = 220;
  var MAX_POPUPS    = 28;
  var MAX_RIPPLES   = 10;

  var particles = [];
  var popups    = [];
  var ripples   = [];

  var shake = { mag: 0, decay: 9 };

  (function prefill() {
    var i;
    for (i = 0; i < MAX_PARTICLES; i++) {
      particles.push({ live: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1,
                       size: 2, hue: 120, sat: 60, spin: 0, rot: 0, conf: false });
    }
    for (i = 0; i < MAX_POPUPS; i++) {
      popups.push({ live: false, x: 0, y: 0, vy: 0, drift: 0, life: 0, max: 1,
                    text: '', size: 14, gold: false });
    }
    for (i = 0; i < MAX_RIPPLES; i++) {
      ripples.push({ live: false, x: 0, y: 0, age: 0, amp: 0, radius: 40 });
    }
  })();

  function freeOf(pool) {
    for (var i = 0; i < pool.length; i++) if (!pool[i].live) return pool[i];
    return null; // at capacity — drop the effect rather than grow the pool
  }

  /* ---------- spawners ---------- */

  /* Goal burst. Auto-scored goals get a smaller, quieter version so a
     busy squad doesn't bury the screen in confetti. */
  function burst(x, y, count, opts) {
    opts = opts || {};
    var speed = opts.speed || 200;
    var gold  = !!opts.gold;

    for (var i = 0; i < count; i++) {
      var p = freeOf(particles);
      if (!p) return;

      var a = Math.random() * Math.PI * 2;
      var v = speed * (0.35 + Math.random() * 0.85);

      p.live = true;
      p.x = x; p.y = y;
      p.vx = Math.cos(a) * v;
      p.vy = Math.sin(a) * v - speed * 0.35;   // bias upward
      p.max = p.life = 0.45 + Math.random() * 0.5;
      p.size = 1.6 + Math.random() * 2.6;
      p.hue = gold ? 44 + Math.random() * 12 : 100 + Math.random() * 50;
      p.sat = gold ? 92 : 55 + Math.random() * 30;
      p.rot = Math.random() * Math.PI;
      p.spin = (Math.random() - 0.5) * 14;
      p.conf = false;
    }
  }

  /* Confetti rains from above on milestones — different silhouette and
     physics from the burst so the two never read as the same event. */
  function confetti(w, count) {
    for (var i = 0; i < count; i++) {
      var p = freeOf(particles);
      if (!p) return;

      p.live = true;
      p.x = Math.random() * w;
      p.y = -20 - Math.random() * 60;
      p.vx = (Math.random() - 0.5) * 70;
      p.vy = 90 + Math.random() * 130;
      p.max = p.life = 1.8 + Math.random() * 1.4;
      p.size = 3 + Math.random() * 3.5;
      p.hue = Math.random() * 360;
      p.sat = 78;
      p.rot = Math.random() * Math.PI;
      p.spin = (Math.random() - 0.5) * 12;
      p.conf = true;
    }
  }

  function popup(x, y, text, opts) {
    opts = opts || {};
    var p = freeOf(popups);
    if (!p) return;

    p.live = true;
    p.x = x; p.y = y;
    p.vy = -(opts.speed || 64);
    p.drift = (Math.random() - 0.5) * 26;
    p.max = p.life = opts.life || 1.05;
    p.text = text;
    p.size = opts.size || 15;
    p.gold = !!opts.gold;
  }

  function ripple(x, y, amp) {
    var r = freeOf(ripples);
    if (!r) return;
    r.live = true;
    r.x = x; r.y = y;
    r.age = 0;
    r.amp = amp || 9;
    r.radius = 46 + amp * 2.4;
  }

  function kick(mag) { shake.mag = Math.min(14, shake.mag + mag); }

  /* ---------- update ---------- */

  function update(dt) {
    var i, p;

    for (i = 0; i < particles.length; i++) {
      p = particles[i];
      if (!p.live) continue;

      p.life -= dt;
      if (p.life <= 0) { p.live = false; continue; }

      p.vy += (p.conf ? 130 : 620) * dt;      // confetti falls slower
      if (p.conf) p.vx += Math.sin(p.rot * 2) * 22 * dt;  // gentle flutter
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.spin * dt;

      var drag = Math.exp(-(p.conf ? 0.6 : 2.4) * dt);
      p.vx *= drag;
      if (!p.conf) p.vy *= drag;
    }

    for (i = 0; i < popups.length; i++) {
      p = popups[i];
      if (!p.live) continue;
      p.life -= dt;
      if (p.life <= 0) { p.live = false; continue; }
      p.y += p.vy * dt;
      p.x += p.drift * dt;
      p.vy *= Math.exp(-1.7 * dt);            // eases to a stop as it fades
    }

    for (i = 0; i < ripples.length; i++) {
      p = ripples[i];
      if (!p.live) continue;
      p.age += dt;
      if (p.age > 1.1) p.live = false;
    }

    shake.mag *= Math.exp(-shake.decay * dt);
    if (shake.mag < 0.05) shake.mag = 0;
  }

  /* Net displacement at a point — a decaying travelling wave per ripple.
     Scene calls this per net vertex, which is what makes the mesh wobble
     as one surface instead of a set of independent dots. */
  function netOffset(x, y) {
    var sum = 0;
    for (var i = 0; i < ripples.length; i++) {
      var r = ripples[i];
      if (!r.live) continue;

      var dx = x - r.x, dy = y - r.y;
      var d = Math.sqrt(dx * dx + dy * dy);
      if (d > r.radius * 2.2) continue;

      sum += r.amp
           * Math.sin(d * 0.22 - r.age * 15)
           * Math.exp(-d / r.radius)
           * Math.exp(-r.age * 3.6);
    }
    return sum;
  }

  function shakeOffset() {
    if (shake.mag === 0) return { x: 0, y: 0 };
    return {
      x: (Math.random() - 0.5) * shake.mag * 2,
      y: (Math.random() - 0.5) * shake.mag * 2
    };
  }

  /* ---------- draw ---------- */

  function drawParticles(ctx) {
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      if (!p.live) continue;

      var t = p.life / p.max;
      ctx.globalAlpha = t < 0.35 ? t / 0.35 : 1;   // fade only at the tail
      ctx.fillStyle = 'hsl(' + p.hue + ',' + p.sat + '%,' + (p.conf ? 62 : 66) + '%)';

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);

      if (p.conf) {
        ctx.fillRect(-p.size * 0.5, -p.size * 0.32, p.size, p.size * 0.64);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, p.size * (0.45 + t * 0.55), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  function drawPopups(ctx) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (var i = 0; i < popups.length; i++) {
      var p = popups[i];
      if (!p.live) continue;

      var t = p.life / p.max;
      // Overshoot on entry, shrink as it fades — reads as a pop, not a slide.
      var grow = t > 0.86 ? Fmt.ease.outBack((1 - t) / 0.14) : 1;
      var size = p.size * (0.55 + 0.45 * grow) * (0.85 + 0.15 * t);

      ctx.globalAlpha = t < 0.4 ? t / 0.4 : 1;
      ctx.font = '800 ' + size.toFixed(1) + 'px -apple-system, system-ui, sans-serif';

      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(4,12,8,.65)';
      ctx.strokeText(p.text, p.x, p.y);

      ctx.fillStyle = p.gold ? '#ffc94d' : '#eaf5ee';
      ctx.fillText(p.text, p.x, p.y);
    }
    ctx.globalAlpha = 1;
  }

  function clear() {
    var i;
    for (i = 0; i < particles.length; i++) particles[i].live = false;
    for (i = 0; i < popups.length; i++) popups[i].live = false;
    for (i = 0; i < ripples.length; i++) ripples[i].live = false;
    shake.mag = 0;
  }

  return {
    burst: burst, confetti: confetti, popup: popup, ripple: ripple, kick: kick,
    update: update, netOffset: netOffset, shakeOffset: shakeOffset,
    drawParticles: drawParticles, drawPopups: drawPopups, clear: clear
  };
})();
