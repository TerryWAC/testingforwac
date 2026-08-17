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
  var heroBg = $('.hero-bg');
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

    // The hero backdrop drifts slower than the copy over it.
    if (heroBg && !reduced && y < window.innerHeight * 1.5) {
      heroBg.style.transform = 'translate3d(0,' + (y * 0.14).toFixed(1) + 'px,0)';
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

    if (!('IntersectionObserver' in window) || reduced) {
      // The markup already carries the real figure, so with no observer and
      // no motion there is nothing to do.
      return;
    }

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

    counters.forEach(function (el) {
      // Zero it now rather than at the moment it scrolls into view — otherwise
      // the real figure is on screen first and visibly snaps back to zero.
      var decimals = parseInt(el.getAttribute('data-decimals'), 10) || 0;
      el.textContent =
        (el.getAttribute('data-prefix') || '') +
        (0).toFixed(decimals) +
        (el.getAttribute('data-suffix') || '');
      cio.observe(el);
    });
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
    openNow.textContent = open ? 'Open now' : 'Book 24/7';
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
  // Light / dark
  //
  // The initial resolution happens inline in <head> to avoid a flash; this only
  // handles the toggle and remembering the choice.
  // -------------------------------------------------------------------------

  (function () {
    var toggles = $$('[data-theme-toggle]');
    if (!toggles.length) return;

    var sync = function () {
      var light = document.documentElement.getAttribute('data-theme') === 'light';
      var label = light ? 'Switch to dark mode' : 'Switch to light mode';
      toggles.forEach(function (b) {
        b.setAttribute('aria-label', label);
        b.setAttribute('title', label);
        b.setAttribute('aria-pressed', String(light));
      });
    };

    toggles.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var light = document.documentElement.getAttribute('data-theme') === 'light';
        if (light) document.documentElement.removeAttribute('data-theme');
        else document.documentElement.setAttribute('data-theme', 'light');
        try { localStorage.setItem('jl-theme', light ? 'dark' : 'light'); } catch (e) {}
        sync();
      });
    });

    sync();
  })();

  // -------------------------------------------------------------------------
  // Photo rail
  // -------------------------------------------------------------------------

  $$('.gallery-section').forEach(function (section) {
    var rail = $('.gallery-rail', section);
    var prev = $('[data-gallery="prev"]', section);
    var next = $('[data-gallery="next"]', section);
    if (!rail || !prev || !next) return;

    var step = function () {
      var item = $('.gallery-item', rail);
      if (!item) return rail.clientWidth * 0.8;
      var gap = parseFloat(getComputedStyle(rail).columnGap) || 0;
      return item.getBoundingClientRect().width + gap;
    };

    var scrollBy = function (dir) {
      rail.scrollBy({ left: dir * step(), behavior: reduced ? 'auto' : 'smooth' });
    };

    prev.addEventListener('click', function () { scrollBy(-1); });
    next.addEventListener('click', function () { scrollBy(1); });

    rail.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { e.preventDefault(); scrollBy(1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); scrollBy(-1); }
    });

    // Grey out an arrow once there is nothing further that way.
    var sync = function () {
      var max = rail.scrollWidth - rail.clientWidth;
      prev.disabled = rail.scrollLeft < 8;
      next.disabled = rail.scrollLeft > max - 8;
    };
    rail.addEventListener('scroll', function () {
      window.requestAnimationFrame(sync);
    }, { passive: true });
    window.addEventListener('resize', sync);
    sync();
  });

  // -------------------------------------------------------------------------
  // Copy the offer code
  // -------------------------------------------------------------------------

  $$('[data-copy]').forEach(function (btn) {
    var original = btn.innerHTML;
    btn.addEventListener('click', function () {
      var code = btn.getAttribute('data-copy');
      var done = function () {
        btn.textContent = 'Copied';
        setTimeout(function () { btn.innerHTML = original; }, 2000);
      };

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(code).then(done, function () {});
      } else {
        // Older Safari and any non-secure context.
        var field = document.createElement('textarea');
        field.value = code;
        field.setAttribute('readonly', '');
        field.style.position = 'fixed';
        field.style.opacity = '0';
        document.body.appendChild(field);
        field.select();
        try { document.execCommand('copy'); done(); } catch (e) {}
        field.remove();
      }
    });
  });

  // -------------------------------------------------------------------------
  // Google map, loaded on request
  //
  // Nothing from Google is fetched until someone asks for the map, so no
  // third-party cookies are set on a visitor who never wanted one.
  // -------------------------------------------------------------------------

  $$('[data-map-load]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var card = btn.closest('.map-card');
      if (!card || card.classList.contains('is-live')) return;

      var frame = document.createElement('iframe');
      frame.src = btn.getAttribute('data-map-src');
      frame.title = btn.getAttribute('data-map-title') || 'Map';
      frame.loading = 'lazy';
      frame.referrerPolicy = 'no-referrer-when-downgrade';
      frame.setAttribute('allowfullscreen', '');

      card.insertBefore(frame, card.firstChild);
      card.classList.add('is-live');
      btn.remove();
    });
  });

  // -------------------------------------------------------------------------
  // Photography
  //
  // Each photo position ships a real <img> over a branded placeholder. Until
  // the file exists the image is removed and the placeholder shows through, so
  // dropping a photo into assets/img/ is the only step needed to use it.
  // -------------------------------------------------------------------------

  $$('img.photo').forEach(function (img) {
    var shown = function () { img.classList.add('is-loaded'); };
    var missing = function () { img.remove(); };

    if (img.complete) {
      img.naturalWidth > 0 ? shown() : missing();
    } else {
      img.addEventListener('load', shown);
      img.addEventListener('error', missing);
    }
  });

  // -------------------------------------------------------------------------
  // Pointer-reactive polish (desktop, motion allowed)
  // -------------------------------------------------------------------------

  if (!reduced && window.matchMedia('(hover: hover)').matches) {
    // Primary calls to action lean towards the cursor.
    $$('.btn-primary.btn-lg, .hero-card .btn-primary').forEach(function (btn) {
      btn.addEventListener('pointermove', function (e) {
        var r = btn.getBoundingClientRect();
        var x = (e.clientX - r.left - r.width / 2) / r.width;
        var y = (e.clientY - r.top - r.height / 2) / r.height;
        btn.style.transform = 'translate(' + (x * 7).toFixed(1) + 'px,' + (y * 4 - 2).toFixed(1) + 'px)';
      });
      btn.addEventListener('pointerleave', function () { btn.style.transform = ''; });
    });

    // The booking card tilts a few degrees with the cursor.
    $$('.hero-card').forEach(function (card) {
      var frame = card.parentNode;
      frame.addEventListener('pointermove', function (e) {
        var r = card.getBoundingClientRect();
        var x = (e.clientX - r.left - r.width / 2) / r.width;
        var y = (e.clientY - r.top - r.height / 2) / r.height;
        card.style.transform =
          'rotateY(' + (x * 4).toFixed(2) + 'deg) rotateX(' + (-y * 4).toFixed(2) + 'deg) translateZ(0)';
      });
      frame.addEventListener('pointerleave', function () { card.style.transform = ''; });
    });
  }

  // -------------------------------------------------------------------------
  // Body map — "where does it hurt?"
  //
  // Hovering a region heats it; choosing one opens the matching condition
  // panel. The chip buttons below the figure are the accessible control and do
  // exactly the same thing, so keyboard and screen reader users lose nothing.
  // -------------------------------------------------------------------------

  // Scoped per instance — the single-file demo inlines every page into one
  // document, so more than one map can share it.
  $$('.bodymap').forEach(function (bodyMap) {
    var stage = $('.bm-stage', bodyMap);
    var figure = $('.bm-figure', bodyMap);
    var regions = $$('.bm-region', bodyMap);
    var picks = $$('.bm-pick', bodyMap);
    var panels = $$('.bm-panel', bodyMap);
    var hint = $('[data-bm-hint]', bodyMap);
    var chosen = null;

    // Pre-set aria-pressed so the buttons announce as toggles from the start.
    picks.forEach(function (b) { b.setAttribute('aria-pressed', 'false'); });

    // Warm the glow only once the map is interactive, so it never appears
    // on a page where the script failed to run.
    bodyMap.classList.add('is-live');

    // The attention pulse and the "tap a body part" cue exist to get someone
    // started. The moment they engage at all — hover, focus or tap — they have
    // understood it, and a cue that keeps going after that is just noise.
    function used() {
      bodyMap.classList.add('is-used');
    }

    function heat(condition, on) {
      if (on) used();
      regions.forEach(function (r) {
        if (r.dataset.condition === condition) r.classList.toggle('is-hot', on && r.dataset.condition !== chosen);
      });
    }

    function choose(condition) {
      used();
      chosen = condition;
      regions.forEach(function (r) {
        var mine = r.dataset.condition === condition;
        r.classList.toggle('is-on', mine);
        if (mine) r.classList.remove('is-hot');
      });
      picks.forEach(function (b) {
        b.setAttribute('aria-pressed', b.dataset.condition === condition ? 'true' : 'false');
      });
      panels.forEach(function (p) { p.hidden = p.dataset.panel !== condition; });
      if (hint) hint.hidden = true;
    }

    regions.forEach(function (r) {
      var condition = r.dataset.condition;
      r.addEventListener('mouseenter', function () { heat(condition, true); });
      r.addEventListener('mouseleave', function () { heat(condition, false); });
      r.addEventListener('click', function () { choose(condition); });
    });

    picks.forEach(function (b) {
      var condition = b.dataset.condition;
      b.addEventListener('mouseenter', function () { heat(condition, true); });
      b.addEventListener('mouseleave', function () { heat(condition, false); });
      b.addEventListener('focus', function () { heat(condition, true); });
      b.addEventListener('blur', function () { heat(condition, false); });
      b.addEventListener('click', function () { choose(condition); });
    });

    // Pointer tilt. Small on purpose — enough to give the figure some depth as
    // you move across it, not enough to make anything harder to hit. The CSS
    // derives the tilt, the contour parallax and the follow light from this one
    // pair of numbers, so there is nothing to keep in sync here.
    if (stage && figure && !reduced && window.matchMedia('(pointer: fine)').matches) {
      stage.addEventListener('pointermove', function (e) {
        var box = stage.getBoundingClientRect();
        var x = (e.clientX - box.left) / box.width;
        var y = (e.clientY - box.top) / box.height;
        stage.classList.add('is-tracking');
        stage.style.setProperty('--bm-x', (x - 0.5).toFixed(3));
        stage.style.setProperty('--bm-y', (y - 0.5).toFixed(3));
        stage.style.setProperty('--bm-mx', (x * 100).toFixed(1) + '%');
        stage.style.setProperty('--bm-my', (y * 100).toFixed(1) + '%');
      });
      stage.addEventListener('pointerleave', function () {
        stage.classList.remove('is-tracking');
        stage.style.setProperty('--bm-x', '0');
        stage.style.setProperty('--bm-y', '0');
      });
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
