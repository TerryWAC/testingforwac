/* Content tables. Balance lives here and nowhere else, so tuning the
   curve never means touching game logic. */

var Data = (function () {

  /* Classic idle pacing: each tier costs ~11x the last and pays ~8x more,
     so a new signing always feels like a jump but never trivialises the
     tier below it. Costs grow 1.15x per unit owned. */
  var SQUAD = [
    { id: 'trainee',  icon: '🧒', name: 'Youth Trainee',  cost: 15,      rate: 0.1,
      desc: 'Keen, raw, occasionally on target.' },
    { id: 'winger',   icon: '🏃', name: 'Winger',         cost: 110,     rate: 1,
      desc: 'Beats the full-back, sometimes crosses.' },
    { id: 'striker',  icon: '⚽', name: 'Striker',        cost: 1.2e3,   rate: 8,
      desc: 'Lives on the shoulder of the last defender.' },
    { id: 'playmaker',icon: '🎯', name: 'Playmaker',      cost: 13e3,    rate: 47,
      desc: 'Sees the pass three seconds early.' },
    { id: 'captain',  icon: '🎖️', name: 'Captain',        cost: 140e3,   rate: 260,
      desc: 'Drags the whole squad up a level.' },
    { id: 'legend',   icon: '🔥', name: 'Club Legend',    cost: 1.5e6,   rate: 1400,
      desc: 'There is a stand named after him.' },
    { id: 'icon',     icon: '👑', name: 'Icon',           cost: 21e6,    rate: 7800,
      desc: 'Shirt sales alone fund the academy.' },
    { id: 'goat',     icon: '🐐', name: 'The GOAT',       cost: 340e6,   rate: 44000,
      desc: 'Scores from the halfway line. Twice.' }
  ];

  /* Repeatable upgrade tracks — no cap, so there is always a next thing
     to save toward no matter how deep the run gets. */
  var TRACKS = [
    { id: 'boots',   icon: '👟', name: 'Better Boots',
      desc: 'Every tap of yours hits 60% harder.',
      cost: 60,   growth: 3.2, effect: '×1.6 tap power' },
    { id: 'stadium', icon: '🏟️', name: 'Stadium Upgrade',
      desc: 'A bigger crowd lifts everything you score.',
      cost: 900,  growth: 4.1, effect: '+12% to all output' },
    { id: 'physio',  icon: '🧊', name: 'Physio Team',
      desc: 'Squad keeps performing while the app is shut.',
      cost: 4200, growth: 5.0, effect: '+2h offline cap, +6% offline rate' }
  ];

  var CFG = {
    squadGrowth:     1.15,   // cost multiplier per unit owned
    milestoneEvery:  10,     // units per output milestone
    milestoneMult:   1.5,    // multiplier granted per milestone
    bootsMult:       1.6,
    stadiumMult:     1.12,
    trophyBonus:     0.05,   // +5% global per trophy
    prestigeBase:    1e6,    // goals needed for the first trophy
    offlineBaseHrs:  4,
    offlineBaseRate: 0.5,
    offlineMaxRate:  0.9
  };

  return { SQUAD: SQUAD, TRACKS: TRACKS, CFG: CFG };
})();
