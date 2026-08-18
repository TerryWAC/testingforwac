/* Mortgage Fixer — interactions
   Vanilla, no dependencies. Everything degrades gracefully without JS. */
(function () {
  'use strict';

  var $  = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };

  /* ---------------- Formatting ---------------- */
  var gbp0 = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 });
  var gbp2 = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 2, maximumFractionDigits: 2 });

  function money(n, dp) {
    if (!isFinite(n)) return '—';
    return (dp === 2 ? gbp2 : gbp0).format(n);
  }

  function months(total) {
    var y = Math.floor(total / 12), m = Math.round(total % 12);
    if (m === 12) { y += 1; m = 0; }
    var parts = [];
    if (y) parts.push(y + (y === 1 ? ' year' : ' years'));
    if (m) parts.push(m + (m === 1 ? ' month' : ' months'));
    return parts.join(' ') || '0 months';
  }

  /* ---------------- Mortgage maths ---------------- */

  // Standard amortising payment. Handles the 0% edge case.
  function monthlyPayment(principal, annualRatePct, years) {
    var n = Math.round(years * 12);
    if (n <= 0 || principal <= 0) return 0;
    var r = annualRatePct / 100 / 12;
    if (r === 0) return principal / n;
    return principal * r / (1 - Math.pow(1 + r, -n));
  }

  // Months needed to clear the balance at a given payment. Infinity if the
  // payment never covers the interest.
  function termWithPayment(principal, annualRatePct, payment) {
    if (principal <= 0 || payment <= 0) return 0;
    var r = annualRatePct / 100 / 12;
    if (r === 0) return principal / payment;
    if (payment <= principal * r) return Infinity;  // interest outruns payment
    return -Math.log(1 - (principal * r) / payment) / Math.log(1 + r);
  }

  function num(el) {
    if (!el) return NaN;
    var v = parseFloat(String(el.value).replace(/[, £]/g, ''));
    return isFinite(v) ? v : NaN;
  }

  function setError(el, msg) {
    if (!el) return;
    var holder = el.closest('.field') || el.parentElement;
    var slot = holder ? holder.querySelector('.error-text') : null;
    if (msg) {
      el.setAttribute('aria-invalid', 'true');
      if (slot) { slot.textContent = msg; slot.hidden = false; }
    } else {
      el.removeAttribute('aria-invalid');
      if (slot) { slot.textContent = ''; slot.hidden = true; }
    }
  }

  /* ---------------- Repayment calculator ---------------- */
  var repay = $('#calc-repayment');
  if (repay) {
    var elPrice   = $('#mf-price');
    var elDeposit = $('#mf-deposit');
    var elRate    = $('#mf-rate');
    var elTerm    = $('#mf-term');
    var elTermOut = $('#mf-term-out');
    var elType    = $('#mf-type');
    var elOver    = $('#mf-overpay');

    var outPayment  = $('#mf-out-payment');
    var outLoan     = $('#mf-out-loan');
    var outLtv      = $('#mf-out-ltv');
    var outInterest = $('#mf-out-interest');
    var outTotal    = $('#mf-out-total');
    var outSaving   = $('#mf-out-saving');
    var outSavingRow= $('#mf-out-saving-row');
    var barCapital  = $('#mf-bar-capital');
    var barInterest = $('#mf-bar-interest');
    var subLine     = $('#mf-out-sub');

    var calcRepayment = function () {
      var price = num(elPrice), deposit = num(elDeposit);
      var rate = num(elRate), term = num(elTerm);
      var over = num(elOver) || 0;
      var interestOnly = elType && elType.value === 'interest-only';

      if (elTermOut) elTermOut.textContent = term + (term === 1 ? ' year' : ' years');

      // Validate
      var ok = true;
      setError(elPrice, null); setError(elDeposit, null); setError(elRate, null);
      if (!isFinite(price) || price <= 0) { setError(elPrice, 'Enter a property value.'); ok = false; }
      if (!isFinite(deposit) || deposit < 0) { setError(elDeposit, 'Enter a deposit.'); ok = false; }
      if (ok && deposit >= price) { setError(elDeposit, 'Your deposit covers the full price — no mortgage needed.'); ok = false; }
      if (!isFinite(rate) || rate < 0) { setError(elRate, 'Enter an interest rate.'); ok = false; }
      if (!ok) { outPayment.textContent = '—'; return; }

      var loan = price - deposit;
      var ltv = (loan / price) * 100;

      var payment, totalInterest;
      if (interestOnly) {
        payment = loan * (rate / 100 / 12);
        totalInterest = payment * term * 12;
      } else {
        payment = monthlyPayment(loan, rate, term);
        totalInterest = (payment * term * 12) - loan;
      }
      var totalPaid = interestOnly ? totalInterest + loan : payment * term * 12;

      outPayment.textContent = money(payment, 2);
      outLoan.textContent = money(loan);
      outLtv.textContent = ltv.toFixed(1) + '%';
      outInterest.textContent = money(totalInterest);
      outTotal.textContent = money(totalPaid);

      if (subLine) {
        subLine.textContent = interestOnly
          ? 'Interest only — the ' + money(loan) + ' capital is still owed at the end of the term.'
          : 'over ' + months(term * 12) + ' at ' + rate + '%';
      }

      // Capital vs interest split
      var capShare = totalPaid > 0 ? (loan / totalPaid) * 100 : 0;
      if (barCapital)  barCapital.style.width = Math.max(0, Math.min(100, capShare)) + '%';
      if (barInterest) barInterest.style.width = Math.max(0, Math.min(100, 100 - capShare)) + '%';

      // Overpayment benefit (repayment mortgages only)
      if (outSavingRow) {
        if (!interestOnly && over > 0) {
          var newTerm = termWithPayment(loan, rate, payment + over);
          if (isFinite(newTerm)) {
            var saved = totalInterest - ((payment + over) * newTerm - loan);
            outSaving.textContent = money(Math.max(0, saved)) + ' saved · ' +
              months(Math.max(0, term * 12 - newTerm)) + ' earlier';
          } else {
            outSaving.textContent = '—';
          }
          outSavingRow.hidden = false;
        } else {
          outSavingRow.hidden = true;
        }
      }
    };

    $$('input, select', repay).forEach(function (el) {
      el.addEventListener('input', calcRepayment);
      el.addEventListener('change', calcRepayment);
    });
    calcRepayment();
  }

  /* ---------------- Affordability calculator ---------------- */
  var afford = $('#calc-affordability');
  if (afford) {
    var aIncome  = $('#af-income');
    var aSecond  = $('#af-income2');
    var aCommit  = $('#af-commitments');
    var aDeposit = $('#af-deposit');
    var aMult    = $('#af-multiple');
    var aMultOut = $('#af-multiple-out');

    var aBorrow  = $('#af-out-borrow');
    var aBudget  = $('#af-out-budget');
    var aLtv     = $('#af-out-ltv');
    var aNote    = $('#af-out-note');

    var calcAfford = function () {
      var income = num(aIncome) || 0;
      var second = num(aSecond) || 0;
      var commit = num(aCommit) || 0;
      var deposit = num(aDeposit) || 0;
      var mult = num(aMult) || 4.5;

      if (aMultOut) aMultOut.textContent = mult.toFixed(1) + '×';

      setError(aIncome, null);
      if (income <= 0) {
        setError(aIncome, 'Enter your annual income.');
        aBorrow.textContent = '—'; aBudget.textContent = '—'; aLtv.textContent = '—';
        return;
      }

      // Annualised credit commitments reduce the income lenders will work from.
      var effective = Math.max(0, (income + second) - (commit * 12));
      var borrow = effective * mult;
      var budget = borrow + deposit;
      var ltv = budget > 0 ? (borrow / budget) * 100 : 0;

      aBorrow.textContent = money(borrow);
      aBudget.textContent = money(budget);
      aLtv.textContent = ltv.toFixed(1) + '%';

      if (aNote) {
        if (deposit <= 0) {
          aNote.textContent = 'Add a deposit to see the property budget it unlocks.';
        } else if (ltv > 95) {
          aNote.textContent = 'That works out above 95% LTV. Most lenders cap here — worth a conversation about the options.';
        } else if (ltv > 90) {
          aNote.textContent = 'Around 95% LTV. Rates improve noticeably at 90%, 85% and 75% — small deposit increases go a long way.';
        } else if (ltv > 75) {
          aNote.textContent = 'A solid loan-to-value. The next rate band is usually 75%.';
        } else {
          aNote.textContent = 'Below 75% LTV puts you in the strongest rate bands.';
        }
      }
    };

    $$('input, select', afford).forEach(function (el) {
      el.addEventListener('input', calcAfford);
      el.addEventListener('change', calcAfford);
    });
    calcAfford();
  }

  /* ---------------- Stamp Duty calculator ----------------
     Progressive banding: each rate applies only to the slice of the price
     falling inside that band. Rates live in assets/rates.js. */
  function sdltBands(price, firstTimeBuyer, additional) {
    var R = window.SDLT;
    if (!R) return null;

    var bands = R.standard;
    var reliefApplied = false;
    if (firstTimeBuyer && price <= R.firstTimeBuyerCap) {
      bands = R.firstTimeBuyer;
      reliefApplied = true;
    }

    var surcharge = (additional && price >= R.additionalPropertyThreshold)
      ? R.additionalPropertySurcharge : 0;

    var rows = [], lower = 0, total = 0;
    for (var i = 0; i < bands.length && lower < price; i++) {
      var upper = Math.min(price, bands[i].upTo);
      var slice = upper - lower;
      if (slice > 0) {
        var rate = bands[i].rate + surcharge;
        var due = slice * rate;
        total += due;
        rows.push({ from: lower, to: upper, rate: rate, slice: slice, due: due });
      }
      lower = bands[i].upTo;
    }

    // A capped relief band list can stop short of the price; charge the rest
    // at the top standard rate plus any surcharge.
    if (lower < price) {
      var topRate = bands[bands.length - 1].rate + surcharge;
      var rest = price - lower;
      total += rest * topRate;
      rows.push({ from: lower, to: price, rate: topRate, slice: rest, due: rest * topRate });
    }

    return { total: total, rows: rows, reliefApplied: reliefApplied, surcharge: surcharge };
  }

  var sd = $('#calc-stampduty');
  if (sd && window.SDLT) {
    var sdPrice = $('#sd-price');
    var sdFtb   = $('#sd-ftb');
    var sdAdd   = $('#sd-additional');
    var sdOut   = $('#sd-out-total');
    var sdRate  = $('#sd-out-effective');
    var sdRows  = $('#sd-out-rows');
    var sdNote  = $('#sd-out-note');
    var sdWhen  = $('#sd-effective-from');

    if (sdWhen) sdWhen.textContent = window.SDLT.EFFECTIVE_FROM;

    var calcSdlt = function () {
      var price = num(sdPrice);
      setError(sdPrice, null);
      if (!isFinite(price) || price <= 0) {
        setError(sdPrice, 'Enter a purchase price.');
        sdOut.textContent = '—'; sdRows.innerHTML = ''; sdRate.textContent = '—';
        return;
      }

      // First-time buyer relief and the additional-property surcharge are
      // mutually exclusive in practice — you cannot be both.
      if (sdFtb.checked && sdAdd.checked) { sdAdd.checked = false; }

      var res = sdltBands(price, sdFtb.checked, sdAdd.checked);
      sdOut.textContent = money(res.total);
      sdRate.textContent = price > 0 ? (res.total / price * 100).toFixed(2) + '%' : '—';

      sdRows.innerHTML = '';
      res.rows.forEach(function (r) {
        var li = document.createElement('li');
        var k = document.createElement('span');
        k.className = 'k';
        k.textContent = money(r.from) + '–' + money(r.to) + ' at ' + (r.rate * 100).toFixed(0) + '%';
        var v = document.createElement('span');
        v.className = 'v';
        v.textContent = money(r.due);
        li.appendChild(k); li.appendChild(v);
        sdRows.appendChild(li);
      });

      if (sdNote) {
        if (sdFtb.checked && price > window.SDLT.firstTimeBuyerCap) {
          sdNote.textContent = 'Above ' + money(window.SDLT.firstTimeBuyerCap) +
            ' first-time buyer relief is lost entirely, so standard rates apply.';
        } else if (res.reliefApplied) {
          sdNote.textContent = 'First-time buyer relief applied.';
        } else if (res.surcharge > 0) {
          sdNote.textContent = 'Includes the ' + (res.surcharge * 100).toFixed(0) +
            '% additional property surcharge on the whole price.';
        } else {
          sdNote.textContent = 'Standard residential rates.';
        }
      }
    };

    $$('input', sd).forEach(function (el) {
      el.addEventListener('input', calcSdlt);
      el.addEventListener('change', calcSdlt);
    });
    calcSdlt();
  }

  /* ---------------- Calculator tabs ---------------- */
  var tablist = $('#calc-tabs');
  if (tablist) {
    var tabs = $$('[role="tab"]', tablist);

    function select(tab, focus) {
      tabs.forEach(function (t) {
        var on = t === tab;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        var panel = document.getElementById(t.getAttribute('aria-controls'));
        if (panel) panel.hidden = !on;
      });
      if (focus) tab.focus();
    }

    tabs.forEach(function (tab, i) {
      tab.addEventListener('click', function () { select(tab); });
      tab.addEventListener('keydown', function (e) {
        var next = null;
        if (e.key === 'ArrowRight') next = tabs[(i + 1) % tabs.length];
        else if (e.key === 'ArrowLeft') next = tabs[(i - 1 + tabs.length) % tabs.length];
        else if (e.key === 'Home') next = tabs[0];
        else if (e.key === 'End') next = tabs[tabs.length - 1];
        if (next) { e.preventDefault(); select(next, true); }
      });
    });
  }

  /* ---------------- Theme toggle ---------------- */
  var themeBtn = $('#theme-toggle');
  if (themeBtn) {
    themeBtn.addEventListener('click', function () {
      var systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      var current = document.documentElement.getAttribute('data-theme') || (systemDark ? 'dark' : 'light');
      var next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      themeBtn.setAttribute('aria-label', next === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
      try { localStorage.setItem('mf-theme', next); } catch (e) { /* private mode */ }
    });
  }

  /* ---------------- Mobile nav ---------------- */
  var navToggle = $('#nav-toggle');
  var nav = $('#primary-nav');
  if (navToggle && nav) {
    navToggle.addEventListener('click', function () {
      var open = nav.getAttribute('data-open') === 'true';
      nav.setAttribute('data-open', String(!open));
      navToggle.setAttribute('aria-expanded', String(!open));
    });
    nav.addEventListener('click', function (e) {
      if (e.target.tagName === 'A' && window.innerWidth <= 900) {
        nav.setAttribute('data-open', 'false');
        navToggle.setAttribute('aria-expanded', 'false');
      }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.getAttribute('data-open') === 'true') {
        nav.setAttribute('data-open', 'false');
        navToggle.setAttribute('aria-expanded', 'false');
        navToggle.focus();
      }
    });
  }

  /* ---------------- Sticky header shadow ---------------- */
  var header = $('#site-header');
  if (header) {
    var onScroll = function () {
      header.setAttribute('data-stuck', String(window.scrollY > 8));
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ---------------- Scroll spy ---------------- */
  var spyLinks = $$('.nav__list a[href^="#"]');
  if (spyLinks.length && 'IntersectionObserver' in window) {
    var byId = {};
    spyLinks.forEach(function (a) { byId[a.getAttribute('href').slice(1)] = a; });
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var link = byId[entry.target.id];
        if (!link) return;
        if (entry.isIntersecting) {
          spyLinks.forEach(function (a) { a.removeAttribute('aria-current'); });
          link.setAttribute('aria-current', 'true');
        }
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    Object.keys(byId).forEach(function (id) {
      var section = document.getElementById(id);
      if (section) obs.observe(section);
    });
  }

  /* ---------------- Enquiry form ---------------- */
  var form = $('#enquiry-form');
  if (form) {
    var status = $('#form-status');

    var showStatus = function (state, msg) {
      if (!status) return;
      status.setAttribute('data-state', state);
      status.textContent = msg;
      status.focus();
    };

    form.addEventListener('submit', function (e) {
      // Honeypot: bots fill hidden fields, humans never see them.
      var trap = $('#mf-website', form);
      if (trap && trap.value) { e.preventDefault(); return; }

      var required = $$('[required]', form);
      var firstBad = null;

      required.forEach(function (el) {
        var bad = false;
        if (el.type === 'checkbox') bad = !el.checked;
        else if (!el.value.trim()) bad = true;
        else if (el.type === 'email') bad = !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(el.value.trim());
        else if (el.type === 'tel') bad = el.value.replace(/\D/g, '').length < 10;

        setError(el, bad ? (el.dataset.error || 'This field is required.') : null);
        if (bad && !firstBad) firstBad = el;
      });

      if (firstBad) {
        e.preventDefault();
        showStatus('error', 'Please check the highlighted fields and try again.');
        firstBad.focus();
        return;
      }

      // No endpoint configured yet — see site/README.md for wiring this up.
      if (!form.getAttribute('action')) {
        e.preventDefault();
        showStatus('success', 'Thanks — your details are ready to send. The form still needs an endpoint connected before it will deliver. See site/README.md.');
      }
    });

    $$('[required]', form).forEach(function (el) {
      el.addEventListener('blur', function () {
        if (el.type === 'checkbox' ? el.checked : el.value.trim()) setError(el, null);
      });
    });
  }

  /* ---------------- Animated stats ---------------- */
  var stats = $$('[data-count-to]');
  if (stats.length && 'IntersectionObserver' in window &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    var statObs = new IntersectionObserver(function (entries, o) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        var target = parseFloat(el.dataset.countTo);
        // Placeholder values like "[NUMBER]" parse to NaN — leave the markup alone
        // rather than animating the stat to "NaN".
        if (!isFinite(target)) { o.unobserve(el); return; }
        var prefix = el.dataset.prefix || '';
        var suffix = el.dataset.suffix || '';
        var start = performance.now();
        var dur = 1100;
        var tick = function (now) {
          var p = Math.min(1, (now - start) / dur);
          var eased = 1 - Math.pow(1 - p, 3);
          el.textContent = prefix + Math.round(target * eased).toLocaleString('en-GB') + suffix;
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
        o.unobserve(el);
      });
    }, { threshold: 0.4 });
    stats.forEach(function (el) { statObs.observe(el); });
  }

  /* ---------------- Describe inputs by their hint + error text ----------------
     Wired at runtime so the association exists wherever a .field is used,
     without hand-maintaining ids across the markup. */
  (function wireDescriptions() {
    var seq = 0;
    $$('.field').forEach(function (field) {
      var control = field.querySelector('input, select, textarea');
      if (!control) return;
      var ids = (control.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
      ['.field__hint', '.error-text'].forEach(function (sel) {
        var node = field.querySelector(sel);
        if (!node) return;
        if (!node.id) node.id = 'mf-desc-' + (++seq);
        if (ids.indexOf(node.id) === -1) ids.push(node.id);
      });
      if (ids.length) control.setAttribute('aria-describedby', ids.join(' '));
    });
  })();

  /* ---------------- Footer year ---------------- */
  var year = $('#year');
  if (year) year.textContent = String(new Date().getFullYear());
})();
