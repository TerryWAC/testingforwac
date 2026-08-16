/* DOM binding. Rows are built once and then mutated in place — rebuilding
   innerHTML every frame is the usual cause of scroll jank in idle games. */

var UI = (function () {

  var el = {};
  var squadRows = {};
  var trackRows = {};
  var buyAmount = 1;

  var shown = { goals: 0, rate: 0 };   // smoothed display values
  var listTimer = 0;
  var milestoneSeen = {};
  var onPrestige = null;

  function $(id) { return document.getElementById(id); }

  function init(handlers) {
    onPrestige = handlers.onPrestige;

    ['goals','rate','chipSeason','chipTrophies','tapHint','squadList','trainingList',
     'seasonGoals','pendingTrophies','trophyBonus','seasonBar','prestigeBtn',
     'lastSaved','offlineCap','saveBtn','resetBtn','offlineModal','offlineTime',
     'offlineGoals','offlineNote','offlineClose','panel']
      .forEach(function (id) { el[id] = $(id); });

    buildSquad();
    buildTracks();
    bindTabs();
    bindBuyOpts();

    el.prestigeBtn.addEventListener('click', function () {
      if (onPrestige) onPrestige();
    });

    el.saveBtn.addEventListener('click', function () {
      State.save();
      flash(el.saveBtn, 'Saved');
    });

    el.resetBtn.addEventListener('click', function () {
      if (!confirm('Wipe your save? Trophies and squad go with it.')) return;
      State.wipe();
      Scene.reset();
      rebuild();
    });

    shown.goals = State.data.goals;
  }

  function flash(button, text) {
    var old = button.textContent;
    button.textContent = text;
    setTimeout(function () { button.textContent = old; }, 900);
  }

  /* ---------- construction ---------- */

  function rowMarkup(icon, name, desc, withMilestone) {
    return '<div class="row-icon">' + icon + '</div>' +
           '<div class="row-body">' +
             '<div class="row-top">' +
               '<span class="row-name">' + name + '</span>' +
               '<span class="row-own"></span>' +
             '</div>' +
             '<div class="row-desc">' + desc + '</div>' +
             '<div class="row-bot">' +
               '<span class="row-cost"></span>' +
               '<span class="row-rate"></span>' +
             '</div>' +
             (withMilestone
               ? '<div class="row-mile"><div class="row-mile-fill"></div></div>'
               : '') +
           '</div>';
  }

  function buildSquad() {
    el.squadList.innerHTML = '';
    squadRows = {};

    Data.SQUAD.forEach(function (def) {
      var node = document.createElement('button');
      node.className = 'row is-locked';
      node.innerHTML = rowMarkup(def.icon, def.name, def.desc, true);
      node.addEventListener('click', function () { buySquad(def, node); });
      el.squadList.appendChild(node);

      squadRows[def.id] = {
        node: node,
        own:  node.querySelector('.row-own'),
        cost: node.querySelector('.row-cost'),
        rate: node.querySelector('.row-rate'),
        mile: node.querySelector('.row-mile-fill'),
        wasRevealed: false
      };
    });
  }

  function buildTracks() {
    el.trainingList.innerHTML = '';
    trackRows = {};

    Data.TRACKS.forEach(function (track) {
      var node = document.createElement('button');
      node.className = 'row';
      node.innerHTML = rowMarkup(track.icon, track.name, track.desc, false);
      node.addEventListener('click', function () { buyTrack(track, node); });
      el.trainingList.appendChild(node);

      trackRows[track.id] = {
        node: node,
        own:  node.querySelector('.row-own'),
        cost: node.querySelector('.row-cost'),
        rate: node.querySelector('.row-rate')
      };
    });
  }

  function bindTabs() {
    var tabs = document.querySelectorAll('.tab');
    Array.prototype.forEach.call(tabs, function (tab) {
      tab.addEventListener('click', function () {
        Array.prototype.forEach.call(tabs, function (t) { t.classList.remove('is-active'); });
        tab.classList.add('is-active');

        var name = tab.getAttribute('data-tab');
        Array.prototype.forEach.call(document.querySelectorAll('.tab-page'), function (p) {
          p.classList.toggle('is-active', p.id === 'page-' + name);
        });
        el.panel.scrollTop = 0;
      });
    });
  }

  function bindBuyOpts() {
    var opts = document.querySelectorAll('.buy-opt');
    Array.prototype.forEach.call(opts, function (opt) {
      opt.addEventListener('click', function () {
        Array.prototype.forEach.call(opts, function (o) { o.classList.remove('is-active'); });
        opt.classList.add('is-active');

        var v = opt.getAttribute('data-buy');
        buyAmount = v === 'max' ? 'max' : parseInt(v, 10);
        updateLists(true);
      });
    });
  }

  /* ---------- purchases ---------- */

  function buySquad(def, node) {
    var before = State.owned(def.id);
    var got = State.buySquad(def, buyAmount);
    if (!got) return;

    bump(node);
    haptic(12);

    // Crossing a multiple of 10 is the moment worth celebrating.
    var after = before + got;
    var m = Data.CFG.milestoneEvery;
    if (Math.floor(after / m) > Math.floor(before / m)) {
      Scene.celebrate(def.name + ' ×' + Math.floor(after / m) * m);
      haptic([12, 40, 18]);
    }
    updateLists(true);
  }

  function buyTrack(track, node) {
    if (!State.buyTrack(track)) return;
    bump(node);
    haptic(12);
    updateLists(true);
  }

  function bump(node) {
    node.classList.remove('is-bought');
    void node.offsetWidth;            // restart the animation
    node.classList.add('is-bought');
  }

  function haptic(pattern) {
    if (navigator.vibrate) { try { navigator.vibrate(pattern); } catch (e) {} }
  }

  /* ---------- per-frame update ---------- */

  function update(dt) {
    var d = State.data;

    // Counters ease toward the true value rather than snapping, which is
    // what gives the header its odometer feel while idle income ticks in.
    shown.goals = Fmt.approach(shown.goals, d.goals, 9, dt);
    shown.rate  = Fmt.approach(shown.rate, State.goalsPerSec(), 6, dt);

    // Snap when the gap is trivial, so the number can actually settle.
    if (Math.abs(shown.goals - d.goals) < Math.max(0.5, d.goals * 1e-4)) {
      shown.goals = d.goals;
    }

    el.goals.textContent = Fmt.num(shown.goals);
    el.rate.textContent = Fmt.rate(shown.rate);

    listTimer += dt;
    if (listTimer >= 0.12) { listTimer = 0; updateLists(false); }
  }

  function updateLists(force) {
    var d = State.data;
    var mEvery = Data.CFG.milestoneEvery;

    Data.SQUAD.forEach(function (def, i) {
      var row = squadRows[def.id];
      var revealed = State.isRevealed(def, i);

      if (revealed && !row.wasRevealed) {
        row.wasRevealed = true;
        row.node.classList.remove('is-locked');
        row.node.classList.add('is-new');
      }
      if (!revealed) return;

      var count = buyAmount === 'max'
        ? Math.max(1, State.maxAffordable(def))
        : buyAmount;

      var cost = State.squadCost(def, count);
      var owned = State.owned(def.id);
      var afford = d.goals >= cost;

      row.own.textContent = owned || '';
      row.cost.textContent = Fmt.num(cost)
        + (buyAmount === 1 ? '' : ' · ×' + count);
      row.rate.textContent = owned
        ? '+' + Fmt.rate(State.unitRate(def) * State.globalMult()) + '/s'
        : Fmt.rate(def.rate) + '/s each';

      row.node.classList.toggle('can-buy', afford);

      var progress = (owned % mEvery) / mEvery;
      row.mile.style.transform = 'scaleX(' + progress.toFixed(3) + ')';

      // Announce the ×1.5 the first time each threshold is reached.
      var key = def.id + ':' + Math.floor(owned / mEvery);
      if (owned > 0 && owned % mEvery === 0 && !milestoneSeen[key]) {
        milestoneSeen[key] = true;
      }
    });

    Data.TRACKS.forEach(function (track) {
      var row = trackRows[track.id];
      var cost = State.trackCost(track);
      var lvl = State.level(track.id);

      row.own.textContent = lvl ? 'Lv ' + lvl : '';
      row.cost.textContent = Fmt.num(cost);
      row.rate.textContent = track.effect;
      row.node.classList.toggle('can-buy', d.goals >= cost);
    });

    updateSeason();
  }

  function updateSeason() {
    var d = State.data;
    var pending = State.pendingTrophies();

    el.chipSeason.textContent = 'Season ' + d.season;
    el.chipTrophies.textContent = '🏆 ' + Fmt.num(d.trophies);
    el.seasonGoals.textContent = Fmt.num(d.seasonGoals);
    el.pendingTrophies.textContent = Fmt.num(pending);
    el.trophyBonus.textContent = '+' + Math.round(d.trophies * Data.CFG.trophyBonus * 100) + '%';
    el.seasonBar.style.transform = 'scaleX(' + State.seasonProgress().toFixed(3) + ')';
    el.offlineCap.textContent = State.offlineCapHours() + 'h';
    el.lastSaved.textContent = Fmt.ago(d.lastSave);

    el.prestigeBtn.disabled = pending <= 0;
    el.prestigeBtn.textContent = pending > 0
      ? 'End season for ' + Fmt.num(pending) + ' 🏆'
      : 'Score ' + Fmt.num(Data.CFG.prestigeBase) + ' this season';
  }

  function popTrophies() {
    el.chipTrophies.classList.remove('is-pop');
    void el.chipTrophies.offsetWidth;
    el.chipTrophies.classList.add('is-pop');
  }

  function hideHint() { el.tapHint.classList.add('is-gone'); }

  /* Full teardown, used after a wipe or a season change. */
  function rebuild() {
    milestoneSeen = {};
    shown.goals = State.data.goals;
    shown.rate = 0;
    buildSquad();
    buildTracks();
    updateLists(true);
  }

  /* ---------- offline modal ---------- */

  function showOffline(result) {
    el.offlineTime.textContent = 'Away for ' + Fmt.duration(result.seconds);
    el.offlineGoals.textContent = Fmt.num(result.gain);
    el.offlineNote.textContent = result.wasCapped
      ? 'Capped at ' + State.offlineCapHours() + 'h — upgrade the physio team to bank more.'
      : 'Squad played on at ' + Math.round(result.rate * 100) + '% while you were gone.';
    el.offlineModal.classList.remove('hidden');
  }

  function bindOfflineClose(fn) {
    el.offlineClose.addEventListener('click', function () {
      el.offlineModal.classList.add('hidden');
      if (fn) fn();
    });
  }

  return {
    init: init, update: update, updateLists: updateLists, rebuild: rebuild,
    hideHint: hideHint, popTrophies: popTrophies,
    showOffline: showOffline, bindOfflineClose: bindOfflineClose
  };
})();
