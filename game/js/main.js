/* Boot, input, and the single delta-timed loop that drives everything. */

(function () {

  var canvas = document.getElementById('pitch');
  var stage = document.getElementById('stage');
  var hinted = false;
  var saveTimer = 0;
  var last = 0;

  /* ---------- boot ---------- */

  Scene.init(canvas);

  UI.init({
    onPrestige: function () {
      var pending = State.pendingTrophies();
      if (pending <= 0) return;

      if (!confirm('End the season for ' + Fmt.num(pending) +
                   ' trophies? Squad and training reset.')) return;

      State.endSeason();
      Scene.reset();
      Scene.celebrate('+' + Fmt.num(pending) + ' 🏆');
      UI.rebuild();
      UI.popTrophies();
      State.save();
    }
  });

  UI.bindOfflineClose(function () { State.save(); });

  var elapsed = State.load();
  UI.rebuild();

  if (elapsed !== null && elapsed > 0) {
    var result = State.claimOffline(elapsed);
    if (result) UI.showOffline(result);
  }

  /* ---------- input ---------- */

  /* pointerdown rather than click: a shot should leave the boot the
     instant the finger lands, not 300ms later on touch-end. */
  stage.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    if (!Scene.isOnPitch(e.clientY)) return;

    var value = State.tap();
    Scene.shoot(value, false);

    if (!hinted) { hinted = true; UI.hideHint(); }
    if (navigator.vibrate) { try { navigator.vibrate(8); } catch (err) {} }
  }, { passive: false });

  // Long-press on the pitch shouldn't offer to select or save anything.
  stage.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  /* ---------- resize ---------- */

  var resizeTimer = null;
  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () { Scene.resize(); }, 120);
  }
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', onResize);

  /* ---------- persistence hooks ---------- */

  function persist() { State.save(); }

  window.addEventListener('pagehide', persist);
  window.addEventListener('beforeunload', persist);

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      persist();
      return;
    }

    // Coming back from a backgrounded tab: credit the gap the same way a
    // cold start would, so minimising is never punished.
    var away = Date.now() - State.data.lastSave;
    if (away > 60000) {
      var result = State.claimOffline(away);
      if (result) UI.showOffline(result);
    }
    last = performance.now();   // don't let the stall become one huge dt
  });

  /* ---------- loop ---------- */

  function frame(now) {
    if (!last) last = now;

    // Cap dt so a hitch or a background stall can never teleport the
    // simulation; long absences are handled by the offline path instead.
    var dt = Math.min((now - last) / 1000, 0.05);
    last = now;

    State.tick(dt);
    Scene.update(dt);
    FX.update(dt);
    Scene.draw();
    UI.update(dt);

    saveTimer += dt;
    if (saveTimer >= 15) { saveTimer = 0; State.save(); }

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
})();
