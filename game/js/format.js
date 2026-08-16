/* Number and time formatting, plus the easing helpers the whole game shares. */

var Fmt = (function () {

  var UNITS = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];

  /* Short-scale abbreviation. Keeps 3 significant figures so the number
     reads as a steady odometer rather than jittering a digit at a time. */
  function num(n) {
    if (!isFinite(n)) return '∞';
    if (n < 0) return '-' + num(-n);
    if (n < 1000) return n < 10 && n % 1 !== 0 ? n.toFixed(1) : String(Math.floor(n));

    var i = 0;
    while (n >= 1000 && i < UNITS.length - 1) { n /= 1000; i++; }
    var d = n < 10 ? 2 : n < 100 ? 1 : 0;
    return n.toFixed(d) + UNITS[i];
  }

  /* Rates want a decimal at low values — "0.4/sec" is more encouraging
     than "0/sec" when you've only just signed your first trainee. */
  function rate(n) {
    if (n > 0 && n < 100) return n.toFixed(n < 10 ? 1 : 0);
    return num(n);
  }

  function duration(seconds) {
    var s = Math.max(0, Math.floor(seconds));
    var d = Math.floor(s / 86400);
    var h = Math.floor(s % 86400 / 3600);
    var m = Math.floor(s % 3600 / 60);

    if (d > 0) return d + 'd ' + h + 'h';
    if (h > 0) return h + 'h ' + m + 'm';
    if (m > 0) return m + 'm ' + (s % 60) + 's';
    return s + 's';
  }

  function ago(ms) {
    var s = Math.floor((Date.now() - ms) / 1000);
    if (s < 5) return 'just now';
    return duration(s) + ' ago';
  }

  /* Frame-rate independent smoothing. `speed` is roughly "how many
     e-foldings per second", so the same call looks identical at 30fps
     and 120fps — this is what keeps the counters buttery. */
  function approach(current, target, speed, dt) {
    return target + (current - target) * Math.exp(-speed * dt);
  }

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }

  var ease = {
    outCubic:  function (t) { return 1 - Math.pow(1 - t, 3); },
    outQuint:  function (t) { return 1 - Math.pow(1 - t, 5); },
    inQuad:    function (t) { return t * t; },
    outBack:   function (t) {
      var c = 1.70158;
      return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
    }
  };

  return {
    num: num, rate: rate, duration: duration, ago: ago,
    approach: approach, clamp: clamp, lerp: lerp, ease: ease
  };
})();
