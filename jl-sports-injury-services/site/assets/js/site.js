/* J.L. Sports Injury Services — site behaviour.
   No dependencies. Everything degrades gracefully without JS. */

(function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  // -------------------------------------------------------------------------
  // Header: condense on scroll, hide on scroll down, progress bar
  // -------------------------------------------------------------------------

  var header = $('#site-header');
  var progress = $('.scroll-progress span');
  var ctaBar = $('#cta-bar');
  var lastY = window.scrollY;
  var ticking = false;

  function onScroll() {
    var y = window.scrollY;
    var doc = document.documentElement;
    var max = doc.scrollHeight - window.innerHeight;

    if (header) {
      header.classList.toggle('is-stuck', y > 12);
      // Hide when scrolling down past the hero, show again on the way up.
      var goingDown = y > lastY && y > 420;
      header.classList.toggle('is-hidden', goingDown && !document.body.classList.contains('nav-open'));
    }

    if (progress) progress.style.setProperty('--p', max > 0 ? y / max : 0);

    if (ctaBar) {
      // Show once past the hero, hide again near the footer CTA.
      var nearEnd = max > 0 && y > max - 260;
      ctaBar.classList.toggle('is-visible', y > 620 && !nearEnd);
    }

    lastY = y;
    ticking = false;
  }

  window.addEventListener(
    'scroll',
    function () {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(onScroll);
      }
    },
    { passive: true }
  );
  onScroll();

  // -------------------------------------------------------------------------
  // Mobile navigation
  // -------------------------------------------------------------------------

  var toggle = $('.nav-toggle');
  var mobileNav = $('#mobile-nav');

  function setNav(open) {
    if (!toggle || !mobileNav) return;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    document.body.classList.toggle('nav-open', open);

    if (open) {
      mobileNav.hidden = false;
      // Next frame so the transition runs.
      requestAnimationFrame(function () { mobileNav.classList.add('is-open'); });
    } else {
      mobileNav.classList.remove('is-open');
      var done = function () { mobileNav.hidden = true; };
      reduced ? done() : setTimeout(done, 450);
    }
  }

  if (toggle) {
    toggle.addEventListener('click', function () {
      setNav(toggle.getAttribute('aria-expanded') !== 'true');
    });
  }
  if (mobileNav) {
    mobileNav.addEventListener('click', function (e) {
      if (e.target === mobileNav || e.target.closest('a')) setNav(false);
    });
  }
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && document.body.classList.contains('nav-open')) setNav(false);
  });

  // -------------------------------------------------------------------------
  // Scroll reveal
  // -------------------------------------------------------------------------

  var revealables = $$('[data-reveal]');
  if (revealables.length) {
    if (reduced || !('IntersectionObserver' in window)) {
      revealables.forEach(function (el) { el.classList.add('is-in'); });
    } else {
      var io = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            entry.target.classList.add('is-in');
            io.unobserve(entry.target);
          });
        },
        { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }
      );
      revealables.forEach(function (el) { io.observe(el); });
    }
  }

  // Stagger children of any [data-stagger] container.
  $$('[data-stagger]').forEach(function (group) {
    var gap = parseInt(group.getAttribute('data-stagger'), 10) || 80;
    $$('[data-reveal]', group).forEach(function (el, i) {
      el.style.setProperty('--d', i * gap + 'ms');
    });
  });

  // -------------------------------------------------------------------------
  // Animated counters
  // -------------------------------------------------------------------------

  var counters = $$('[data-count]');
  if (counters.length) {
    var run = function (el) {
      var target = parseFloat(el.getAttribute('data-count'));
      var decimals = parseInt(el.getAttribute('data-decimals'), 10) || 0;
      var prefix = el.getAttribute('data-prefix') || '';
      var suffix = el.getAttribute('data-suffix') || '';
      var dur = 1500;
      var start = null;

      if (reduced) {
        el.textContent = prefix + target.toFixed(decimals) + suffix;
        return;
      }

      var tick = function (ts) {
        if (start === null) start = ts;
        var p = Math.min((ts - start) / dur, 1);
        var eased = 1 - Math.pow(1 - p, 3);
        el.textContent = prefix + (target * eased).toFixed(decimals) + suffix;
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };

    if (!('IntersectionObserver' in window)) {
      counters.forEach(run);
    } else {
      var cio = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            run(entry.target);
            cio.unobserve(entry.target);
          });
        },
        { threshold: 0.5 }
      );
      counters.forEach(function (el) { cio.observe(el); });
    }
  }

  // -------------------------------------------------------------------------
  // FAQ accordion
  // -------------------------------------------------------------------------

  $$('.faq-item').forEach(function (item) {
    var btn = $('.faq-q', item);
    var panel = $('.faq-a', item);
    if (!btn || !panel) return;

    btn.addEventListener('click', function () {
      var open = item.classList.contains('is-open');

      // Single-open accordion.
      $$('.faq-item.is-open', item.parentNode).forEach(function (other) {
        if (other === item) return;
        other.classList.remove('is-open');
        var b = $('.faq-q', other);
        if (b) b.setAttribute('aria-expanded', 'false');
        var p = $('.faq-a', other);
        if (p) p.setAttribute('aria-hidden', 'true');
      });

      item.classList.toggle('is-open', !open);
      btn.setAttribute('aria-expanded', String(!open));
      panel.setAttribute('aria-hidden', String(open));
    });
  });

  // -------------------------------------------------------------------------
  // Cursor-follow glow on cards
  // -------------------------------------------------------------------------

  if (!reduced && window.matchMedia('(hover: hover)').matches) {
    $$('.card').forEach(function (card) {
      card.addEventListener('pointermove', function (e) {
        var r = card.getBoundingClientRect();
        card.style.setProperty('--mx', e.clientX - r.left + 'px');
        card.style.setProperty('--my', e.clientY - r.top + 'px');
      });
    });
  }

  // -------------------------------------------------------------------------
  // Today's opening hours
  // -------------------------------------------------------------------------

  var days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var today = days[new Date().getDay()];
  $$('.hours-row').forEach(function (row) {
    if (row.getAttribute('data-day') === today) row.classList.add('is-today');
  });

  // Live "open now" indicator.
  var openNow = $('[data-open-now]');
  if (openNow) {
    var now = new Date();
    var isWeekday = now.getDay() >= 1 && now.getDay() <= 4; // Mon–Thu
    var h = now.getHours() + now.getMinutes() / 60;
    var open = isWeekday && h >= 9 && h < 20;
    openNow.textContent = open ? 'Open now' : 'Book online 24/7';
  }

  // -------------------------------------------------------------------------
  // Footer year
  // -------------------------------------------------------------------------

  $$('[data-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });

  // -------------------------------------------------------------------------
  // Marquee: duplicate the track so the loop is seamless
  // -------------------------------------------------------------------------

  $$('.marquee-track').forEach(function (track) {
    var group = $('.marquee-group', track);
    if (group && track.children.length === 1) {
      var clone = group.cloneNode(true);
      clone.setAttribute('aria-hidden', 'true');
      track.appendChild(clone);
    }
  });

  // -------------------------------------------------------------------------
  // Contact form (progressive enhancement)
  // -------------------------------------------------------------------------

  var contactForm = $('#contact-form');
  if (contactForm) {
    contactForm.addEventListener('submit', function (e) {
      var ok = true;
      $$('[required]', contactForm).forEach(function (input) {
        var field = input.closest('.field');
        var valid = input.checkValidity() && String(input.value).trim() !== '';
        if (field) field.classList.toggle('has-error', !valid);
        if (!valid && ok) { input.focus(); ok = false; }
      });
      if (!ok) { e.preventDefault(); return; }

      // No backend is wired up on the demo, so hand off to the user's mail
      // client with everything pre-filled. Replace `action` with a form
      // endpoint (Formspree, Netlify Forms, etc.) to collect these directly.
      if (!contactForm.getAttribute('action')) {
        e.preventDefault();
        var get = function (n) {
          var el = contactForm.elements[n];
          return el ? String(el.value).trim() : '';
        };
        var body = [
          'Name: ' + get('name'),
          'Email: ' + get('email'),
          'Phone: ' + get('phone'),
          'Enquiry: ' + get('subject'),
          '',
          get('message'),
        ].join('\n');
        window.location.href =
          'mailto:' + contactForm.dataset.email +
          '?subject=' + encodeURIComponent('Website enquiry — ' + (get('subject') || 'General')) +
          '&body=' + encodeURIComponent(body);

        var status = $('#contact-status', contactForm);
        if (status) {
          status.hidden = false;
          status.textContent =
            'Opening your email app with the message ready to send. If nothing happens, email ' +
            contactForm.dataset.email + ' directly.';
        }
      }
    });

    $$('[required]', contactForm).forEach(function (input) {
      input.addEventListener('input', function () {
        var field = input.closest('.field');
        if (field && field.classList.contains('has-error') && input.checkValidity()) {
          field.classList.remove('has-error');
        }
      });
    });
  }
})();
