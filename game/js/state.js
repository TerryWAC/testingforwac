/* Game state, derived economy values, purchases, and persistence.
   Nothing here knows the game is drawn — it is pure simulation. */

var State = (function () {

  var CFG = Data.CFG;
  var SAVE_KEY = 'striker-idle-v1';

  var s = blank();

  function blank() {
    return {
      goals: 0,
      seasonGoals: 0,      // earned since last prestige — drives trophies
      lifetimeGoals: 0,
      taps: 0,
      squad: {},           // id -> count owned
      levels: {},          // track id -> level
      revealed: {},        // ids the player has been shown at least once
      trophies: 0,
      season: 1,
      lastSave: Date.now()
    };
  }

  /* ---------- derived economy ---------- */

  function owned(id)  { return s.squad[id] || 0; }
  function level(id)  { return s.levels[id] || 0; }

  /* Every `milestoneEvery` of a unit multiplies that unit's output. */
  function milestoneMult(id) {
    return Math.pow(CFG.milestoneMult, Math.floor(owned(id) / CFG.milestoneEvery));
  }

  function unitRate(def) {
    return owned(def.id) * def.rate * milestoneMult(def.id);
  }

  function globalMult() {
    return Math.pow(CFG.stadiumMult, level('stadium'))
         * (1 + CFG.trophyBonus * s.trophies);
  }

  function goalsPerSec() {
    var total = 0;
    for (var i = 0; i < Data.SQUAD.length; i++) total += unitRate(Data.SQUAD[i]);
    return total * globalMult();
  }

  function tapPower() {
    return Math.pow(CFG.bootsMult, level('boots')) * globalMult();
  }

  function offlineCapHours() { return CFG.offlineBaseHrs + 2 * level('physio'); }

  function offlineRate() {
    return Math.min(CFG.offlineMaxRate, CFG.offlineBaseRate + 0.06 * level('physio'));
  }

  /* ---------- costs ---------- */

  function squadCost(def, count) {
    var n = owned(def.id);
    var g = CFG.squadGrowth;
    // Geometric series: buying `count` units starting from `n` already owned.
    return Math.ceil(def.cost * Math.pow(g, n) * (Math.pow(g, count) - 1) / (g - 1));
  }

  /* Largest affordable batch, from inverting the series above. */
  function maxAffordable(def) {
    var g = CFG.squadGrowth;
    var base = def.cost * Math.pow(g, owned(def.id));
    var n = Math.floor(Math.log(s.goals * (g - 1) / base + 1) / Math.log(g));
    return Math.max(0, n);
  }

  function trackCost(track) {
    return Math.ceil(track.cost * Math.pow(track.growth, level(track.id)));
  }

  /* ---------- reveal gating ---------- */

  /* A unit shows up once it is within reach, and never hides again —
     the drip of new names is most of what keeps an idle game moving. */
  function isRevealed(def, index) {
    if (s.revealed[def.id]) return true;

    var unlocked = index === 0
      || owned(Data.SQUAD[index - 1].id) > 0
      || s.lifetimeGoals >= def.cost * 0.45;

    if (unlocked) { s.revealed[def.id] = true; return true; }
    return false;
  }

  /* ---------- mutations ---------- */

  function earn(amount) {
    s.goals += amount;
    s.seasonGoals += amount;
    s.lifetimeGoals += amount;
  }

  function tick(dt) {
    var gain = goalsPerSec() * dt;
    if (gain > 0) earn(gain);
  }

  function tap() {
    var v = tapPower();
    s.taps++;
    earn(v);
    return v;
  }

  /* Returns units actually bought, so the UI knows whether to celebrate. */
  function buySquad(def, requested) {
    var count = requested === 'max' ? maxAffordable(def) : requested;
    if (count <= 0) return 0;

    var cost = squadCost(def, count);
    if (cost > s.goals) {
      // Fall back to whatever the player can actually afford.
      count = Math.min(count, maxAffordable(def));
      if (count <= 0) return 0;
      cost = squadCost(def, count);
    }

    s.goals -= cost;
    s.squad[def.id] = owned(def.id) + count;
    return count;
  }

  function buyTrack(track) {
    var cost = trackCost(track);
    if (cost > s.goals) return false;
    s.goals -= cost;
    s.levels[track.id] = level(track.id) + 1;
    return true;
  }

  /* ---------- prestige ---------- */

  function pendingTrophies() {
    if (s.seasonGoals < CFG.prestigeBase) return 0;
    return Math.floor(Math.sqrt(s.seasonGoals / CFG.prestigeBase));
  }

  /* Progress toward the next trophy, for the season bar. */
  function seasonProgress() {
    var have = pendingTrophies();
    var nextAt = CFG.prestigeBase * Math.pow(have + 1, 2);
    var prevAt = have === 0 ? 0 : CFG.prestigeBase * Math.pow(have, 2);
    return Fmt.clamp((s.seasonGoals - prevAt) / (nextAt - prevAt), 0, 1);
  }

  function endSeason() {
    var gained = pendingTrophies();
    if (gained <= 0) return 0;

    s.trophies += gained;
    s.season++;
    s.goals = 0;
    s.seasonGoals = 0;
    s.squad = {};
    s.levels = {};
    s.revealed = {};
    return gained;
  }

  /* ---------- offline ---------- */

  /* Called once on load. Pays out at a reduced rate, capped, so shutting
     the app never feels like the better play. */
  function claimOffline(elapsedMs) {
    var seconds = elapsedMs / 1000;
    if (seconds < 60) return null;

    var capped = Math.min(seconds, offlineCapHours() * 3600);
    var gain = goalsPerSec() * capped * offlineRate();
    if (gain <= 0) return null;

    earn(gain);
    return {
      seconds: seconds,
      credited: capped,
      wasCapped: seconds > capped,
      gain: gain,
      rate: offlineRate()
    };
  }

  /* ---------- persistence ---------- */

  function save() {
    s.lastSave = Date.now();
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(s));
      return true;
    } catch (e) {
      return false; // private mode / quota — the game plays on regardless
    }
  }

  function load() {
    var raw;
    try { raw = localStorage.getItem(SAVE_KEY); } catch (e) { return null; }
    if (!raw) return null;

    var parsed;
    try { parsed = JSON.parse(raw); } catch (e) { return null; }
    if (!parsed || typeof parsed !== 'object') return null;

    var fresh = blank();
    for (var k in fresh) {
      if (parsed[k] !== undefined && parsed[k] !== null) fresh[k] = parsed[k];
    }
    var elapsed = Date.now() - (parsed.lastSave || Date.now());
    s = fresh;
    return elapsed > 0 ? elapsed : 0;
  }

  function wipe() {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
    s = blank();
  }

  return {
    get data() { return s; },

    owned: owned, level: level,
    unitRate: unitRate, milestoneMult: milestoneMult,
    goalsPerSec: goalsPerSec, tapPower: tapPower, globalMult: globalMult,
    squadCost: squadCost, maxAffordable: maxAffordable, trackCost: trackCost,
    isRevealed: isRevealed,
    offlineCapHours: offlineCapHours, offlineRate: offlineRate,

    tick: tick, tap: tap, earn: earn,
    buySquad: buySquad, buyTrack: buyTrack,
    pendingTrophies: pendingTrophies, seasonProgress: seasonProgress, endSeason: endSeason,
    claimOffline: claimOffline,
    save: save, load: load, wipe: wipe
  };
})();
