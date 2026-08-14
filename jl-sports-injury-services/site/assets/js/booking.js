/* Booking flow.
 *
 * The clinic's live diary lives in Fresha, so this wizard does the job the
 * website is actually good at: it qualifies the enquiry, shows only real
 * opening hours, and hands a fully-formed booking over to Fresha (or to the
 * inbox) in one click — instead of dumping a cold visitor on a third-party
 * page and hoping.
 */

(function () {
  'use strict';

  var root = document.getElementById('booking');
  if (!root) return;

  var $ = function (s, c) { return (c || root).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || root).querySelectorAll(s)); };

  var dataEl = document.getElementById('booking-data');
  if (!dataEl) return;
  var DATA = JSON.parse(dataEl.textContent);

  var OPEN_DAYS = DATA.openDays;          // 1=Mon … 4=Thu
  var OPEN_FROM = DATA.openFrom;          // 9
  var OPEN_TO = DATA.openTo;              // 20
  var SLOT_STEP = 30;                     // minutes between slot starts
  var LEAD_HOURS = 2;                     // no same-day bookings inside 2h

  var state = {
    step: 0,
    treatment: null,
    duration: null,
    price: null,
    date: null,
    time: null,
  };

  var steps = $$('.booking-step');
  var progressSteps = $$('.progress-step');

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  var DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var DAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var MON_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function ymd(d) {
    return (
      d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0')
    );
  }

  function parseYmd(s) {
    var p = s.split('-');
    return new Date(+p[0], +p[1] - 1, +p[2]);
  }

  function fmtTime(mins) {
    var h = Math.floor(mins / 60);
    var m = mins % 60;
    return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
  }

  function prettyDate(s) {
    var d = parseYmd(s);
    return DAY_LONG[d.getDay()] + ' ' + d.getDate() + ' ' + MON_SHORT[d.getMonth()];
  }

  function findTreatment(slug) {
    for (var i = 0; i < DATA.treatments.length; i++) {
      if (DATA.treatments[i].slug === slug) return DATA.treatments[i];
    }
    return null;
  }

  // -------------------------------------------------------------------------
  // Step navigation
  // -------------------------------------------------------------------------

  function goTo(i) {
    state.step = i;

    steps.forEach(function (s, n) { s.classList.toggle('is-active', n === i); });
    progressSteps.forEach(function (p, n) {
      p.classList.toggle('is-active', n === i);
      p.classList.toggle('is-done', n < i);
    });

    // Keep the wizard header in view when moving between steps.
    var top = root.getBoundingClientRect().top + window.scrollY - 110;
    if (window.scrollY > top) window.scrollTo({ top: top, behavior: 'smooth' });

    var heading = $('h2', steps[i]);
    if (heading) {
      heading.setAttribute('tabindex', '-1');
      heading.focus({ preventScroll: true });
    }

    renderSummary();
  }

  function setNextEnabled(stepIndex, enabled) {
    var btn = $('[data-next="' + stepIndex + '"]');
    if (btn) btn.disabled = !enabled;
  }

  // -------------------------------------------------------------------------
  // Step 1 — treatment
  // -------------------------------------------------------------------------

  $$('input[name="treatment"]').forEach(function (input) {
    input.addEventListener('change', function () {
      var t = findTreatment(input.value);
      if (!t) return;
      state.treatment = t;
      state.duration = null;
      state.price = null;
      state.time = null;
      renderDurations(t);
      setNextEnabled(0, true);
    });
  });

  // -------------------------------------------------------------------------
  // Step 2 — duration
  // -------------------------------------------------------------------------

  var durWrap = $('#duration-options');
  var durIntro = $('#duration-intro');

  function renderDurations(t) {
    var opts = t.priceOptions && t.priceOptions.length
      ? t.priceOptions
      : [{ duration: t.duration, price: t.price, label: t.priceNote || 'Standard appointment' }];

    durIntro.textContent = opts.length > 1
      ? 'Choose how long you need for your ' + t.title.toLowerCase() + '.'
      : 'Your ' + t.title.toLowerCase() + ' appointment.';

    durWrap.innerHTML = opts
      .map(function (o, i) {
        return (
          '<label class="opt">' +
          '<input type="radio" name="duration" value="' + o.duration + '" data-price="' + o.price + '"' +
          (opts.length === 1 ? ' checked' : '') + '>' +
          '<span class="opt-face">' +
          '<span class="opt-icon"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5.2l3.2 2"/></svg></span>' +
          '<span class="opt-text"><strong>' + o.duration + ' minutes</strong><span>' + o.label + '</span></span>' +
          '<span class="opt-price">£' + o.price + '</span>' +
          '</span></label>'
        );
      })
      .join('');

    $$('input[name="duration"]', durWrap).forEach(function (input) {
      input.addEventListener('change', function () {
        state.duration = parseInt(input.value, 10);
        state.price = parseInt(input.getAttribute('data-price'), 10);
        state.time = null;
        renderTimes();
        setNextEnabled(1, true);
        renderSummary();
      });
    });

    // Single-option treatments are pre-selected — reflect that in state.
    if (opts.length === 1) {
      state.duration = opts[0].duration;
      state.price = opts[0].price;
      setNextEnabled(1, true);
    } else {
      setNextEnabled(1, false);
    }
  }

  // -------------------------------------------------------------------------
  // Step 3 — date
  // -------------------------------------------------------------------------

  var dayWrap = $('#day-options');

  function renderDays() {
    var out = [];
    var cursor = new Date();
    cursor.setHours(0, 0, 0, 0);
    var guard = 0;

    while (out.length < 12 && guard < 60) {
      guard++;
      cursor.setDate(cursor.getDate() + 1);
      if (OPEN_DAYS.indexOf(cursor.getDay()) === -1) continue;
      out.push(new Date(cursor));
    }

    dayWrap.innerHTML = out
      .map(function (d) {
        var v = ymd(d);
        return (
          '<label class="opt opt-day">' +
          '<input type="radio" name="date" value="' + v + '">' +
          '<span class="opt-face">' +
          '<span class="dow">' + DAY_SHORT[d.getDay()] + '</span>' +
          '<span class="dom">' + d.getDate() + '</span>' +
          '<span class="mon">' + MON_SHORT[d.getMonth()] + '</span>' +
          '</span></label>'
        );
      })
      .join('');

    $$('input[name="date"]', dayWrap).forEach(function (input) {
      input.addEventListener('change', function () {
        state.date = input.value;
        state.time = null;
        renderTimes();
        setNextEnabled(2, true);
        renderSummary();
      });
    });
  }

  // -------------------------------------------------------------------------
  // Step 4 — time
  // -------------------------------------------------------------------------

  var timeWrap = $('#time-options');
  var timeIntro = $('#time-intro');

  function renderTimes() {
    if (!timeWrap) return;
    if (!state.date || !state.duration) {
      timeWrap.innerHTML = '';
      return;
    }

    var dur = state.duration;
    var lastStart = OPEN_TO * 60 - dur;
    var chosen = parseYmd(state.date);
    var now = new Date();
    var isToday = ymd(now) === state.date;
    var earliest = isToday ? now.getHours() * 60 + now.getMinutes() + LEAD_HOURS * 60 : -1;

    var slots = [];
    for (var m = OPEN_FROM * 60; m <= lastStart; m += SLOT_STEP) {
      slots.push({ m: m, ok: m > earliest });
    }

    timeIntro.textContent =
      prettyDate(state.date) + ' — ' + dur + ' minute appointment. Times shown are start times.';

    timeWrap.innerHTML = slots
      .map(function (s) {
        return (
          '<label class="opt opt-time">' +
          '<input type="radio" name="time" value="' + fmtTime(s.m) + '"' + (s.ok ? '' : ' disabled') + '>' +
          '<span class="opt-face">' + fmtTime(s.m) + '</span>' +
          '</label>'
        );
      })
      .join('');

    $$('input[name="time"]', timeWrap).forEach(function (input) {
      input.addEventListener('change', function () {
        state.time = input.value;
        setNextEnabled(3, true);
        renderSummary();
      });
    });

    setNextEnabled(3, false);
    if (chosen) { /* keeps `chosen` meaningful for future per-day rules */ }
  }

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------

  function renderSummary() {
    $$('[data-summary]').forEach(function (panel) {
      var set = function (key, value) {
        var el = $('[data-sum="' + key + '"]', panel);
        if (el) el.textContent = value;
      };
      set('treatment', state.treatment ? state.treatment.title : '—');
      set('duration', state.duration ? state.duration + ' minutes' : '—');
      set('when', state.date && state.time ? prettyDate(state.date) + ', ' + state.time : '—');
      set('price', state.price ? '£' + state.price : '—');
    });
  }

  // -------------------------------------------------------------------------
  // Step 5 — details & validation
  // -------------------------------------------------------------------------

  var form = $('#booking-form');

  function validateDetails() {
    var ok = true;
    $$('[required]', form).forEach(function (input) {
      var field = input.closest('.field') || input.closest('.checkbox');
      var valid = input.type === 'checkbox' ? input.checked : input.checkValidity() && input.value.trim() !== '';
      if (field) field.classList.toggle('has-error', !valid);
      if (!valid && ok) { input.focus(); ok = false; }
    });
    return ok;
  }

  if (form) {
    $$('[required]', form).forEach(function (input) {
      var clear = function () {
        var field = input.closest('.field') || input.closest('.checkbox');
        if (!field) return;
        var valid = input.type === 'checkbox' ? input.checked : input.checkValidity();
        if (valid) field.classList.remove('has-error');
      };
      input.addEventListener('input', clear);
      input.addEventListener('change', clear);
    });
  }

  // -------------------------------------------------------------------------
  // Confirmation
  // -------------------------------------------------------------------------

  function details() {
    var get = function (n) {
      var el = form.elements[n];
      return el ? String(el.value).trim() : '';
    };
    return {
      name: get('name'),
      email: get('email'),
      phone: get('phone'),
      notes: get('notes'),
    };
  }

  function bookingText() {
    var d = details();
    return [
      'Appointment request',
      '',
      'Treatment: ' + (state.treatment ? state.treatment.title : ''),
      'Duration: ' + state.duration + ' minutes',
      'Preferred date: ' + prettyDate(state.date),
      'Preferred time: ' + state.time,
      'Price: £' + state.price,
      '',
      'Name: ' + d.name,
      'Email: ' + d.email,
      'Phone: ' + d.phone,
      '',
      'Notes / what is bothering you:',
      d.notes || '(none given)',
    ].join('\n');
  }

  function icsFile() {
    var start = parseYmd(state.date);
    var tp = state.time.split(':');
    start.setHours(+tp[0], +tp[1], 0, 0);
    var end = new Date(start.getTime() + state.duration * 60000);

    var stamp = function (d) {
      return (
        d.getUTCFullYear() +
        String(d.getUTCMonth() + 1).padStart(2, '0') +
        String(d.getUTCDate()).padStart(2, '0') + 'T' +
        String(d.getUTCHours()).padStart(2, '0') +
        String(d.getUTCMinutes()).padStart(2, '0') + '00Z'
      );
    };

    return [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//JL Sports Injury Services//Booking//EN',
      'BEGIN:VEVENT',
      'UID:' + Date.now() + '@jlsportsinjuryservices.com',
      'DTSTAMP:' + stamp(new Date()),
      'DTSTART:' + stamp(start),
      'DTEND:' + stamp(end),
      'SUMMARY:' + (state.treatment ? state.treatment.title : 'Appointment') + ' — J.L. Sports Injury Services',
      'LOCATION:' + DATA.address.replace(/,/g, '\\,'),
      'DESCRIPTION:' + (state.duration + ' minute appointment. Please arrive a few minutes early.').replace(/,/g, '\\,'),
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');
  }

  function confirm() {
    var d = details();

    // Summary on the done screen.
    var done = $('#step-done');
    var nameEl = $('[data-done-name]', done);
    if (nameEl) nameEl.textContent = d.name.split(' ')[0] || 'there';
    renderSummary();

    // Hand off to the live diary with as much context as the URL allows.
    var freshaLink = $('[data-fresha]');
    if (freshaLink) freshaLink.href = DATA.bookingUrl;

    // Email fallback — a real, complete request Jack can act on.
    var mailLink = $('[data-mailto]');
    if (mailLink) {
      mailLink.href =
        'mailto:' + DATA.email +
        '?subject=' + encodeURIComponent(
          'Appointment request — ' + (state.treatment ? state.treatment.title : '') +
          ' — ' + prettyDate(state.date) + ' ' + state.time
        ) +
        '&body=' + encodeURIComponent(bookingText());
    }

    // WhatsApp / SMS style quick send.
    var smsLink = $('[data-sms]');
    if (smsLink) {
      smsLink.href = 'sms:' + DATA.phoneHref + '?&body=' + encodeURIComponent(
        'Hi Jack, I\'d like to book a ' + (state.treatment ? state.treatment.title : '') +
        ' (' + state.duration + ' min) on ' + prettyDate(state.date) + ' at ' + state.time +
        '. Name: ' + d.name + '.'
      );
    }

    // Add-to-calendar.
    var icsLink = $('[data-ics]');
    if (icsLink) {
      try {
        var blob = new Blob([icsFile()], { type: 'text/calendar;charset=utf-8' });
        icsLink.href = URL.createObjectURL(blob);
        icsLink.download = 'jl-sports-injury-appointment.ics';
      } catch (err) {
        icsLink.hidden = true;
      }
    }

    goTo(steps.length - 1);
  }

  // -------------------------------------------------------------------------
  // Wiring
  // -------------------------------------------------------------------------

  $$('[data-next]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var from = parseInt(btn.getAttribute('data-next'), 10);
      if (from === 4) {
        if (!validateDetails()) return;
        confirm();
        return;
      }
      goTo(from + 1);
    });
  });

  $$('[data-back]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      goTo(Math.max(0, parseInt(btn.getAttribute('data-back'), 10) - 1));
    });
  });

  $$('[data-restart]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      state = { step: 0, treatment: null, duration: null, price: null, date: null, time: null };
      if (form) form.reset();
      $$('input[name="treatment"]').forEach(function (i) { i.checked = false; });
      durWrap.innerHTML = '';
      if (timeWrap) timeWrap.innerHTML = '';
      [0, 1, 2, 3].forEach(function (n) { setNextEnabled(n, false); });
      renderDays();
      goTo(0);
    });
  });

  // Deep link: book.html?treatment=sports-massage preselects it.
  var params = new URLSearchParams(window.location.search);
  var preset = params.get('treatment');

  renderDays();
  renderSummary();
  [0, 1, 2, 3].forEach(function (n) { setNextEnabled(n, false); });

  if (preset) {
    var input = $('input[name="treatment"][value="' + preset + '"]');
    if (input) {
      input.checked = true;
      input.dispatchEvent(new Event('change'));
    }
  }
})();
