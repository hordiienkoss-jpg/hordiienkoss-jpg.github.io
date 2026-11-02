/* Serhii Hordiienko. Без збірки в браузері, без залежностей.
   Без JavaScript сторінки повні: меню розгорнути не вийде, але всі розділи й картки на місці. */
(function () {
  'use strict';

  var reduce = matchMedia('(prefers-reduced-motion: reduce)');

  /* ---------------- шапка і меню ---------------- */
  var nav = document.querySelector('.nav');
  var toggle = document.querySelector('.nav__toggle');
  var navTick = false;
  function paintNav() { nav.classList.toggle('scrolled', window.scrollY > 40); navTick = false; }
  window.addEventListener('scroll', function () {
    if (navTick) return;
    navTick = true;
    requestAnimationFrame(paintNav);
  }, { passive: true });
  paintNav();

  function setMenu(open) {
    nav.classList.toggle('open', open);
    if (toggle) {
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.textContent = open ? 'Закрити' : 'Меню';
    }
  }
  if (toggle) {
    toggle.addEventListener('click', function () { setMenu(!nav.classList.contains('open')); });
    nav.addEventListener('click', function (e) { if (e.target.closest('.nav__links a')) setMenu(false); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('open')) { setMenu(false); toggle.focus(); }
    });
  }

  /* підсвітка поточного розділу */
  var navLinks = [].slice.call(document.querySelectorAll('.nav__links a[href^="#"]'));
  if (navLinks.length) {
    var byId = {};
    navLinks.forEach(function (a) { byId[a.getAttribute('href').slice(1)] = a; });
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        navLinks.forEach(function (a) { a.removeAttribute('aria-current'); });
        var a = byId[en.target.id];
        if (a) a.setAttribute('aria-current', 'true');
      });
    }, { rootMargin: '-40% 0px -55% 0px' });
    Object.keys(byId).forEach(function (id) { var el = document.getElementById(id); if (el) spy.observe(el); });
  }

  /* ---------------- появи блоків ---------------- */
  var revealEls = [].slice.call(document.querySelectorAll('.reveal'));
  var revealIO = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (!en.isIntersecting) return;
      en.target.classList.add('in');
      revealIO.unobserve(en.target);
    });
  }, { rootMargin: '0px 0px -8% 0px' });
  revealEls.forEach(function (el) { revealIO.observe(el); });

  /* ---------------- перемикач напрямів і фільтр за нішею ---------------- */
  [].slice.call(document.querySelectorAll('[data-filter-root]')).forEach(function (root) {
    var cards = [].slice.call(root.querySelectorAll('.card'));
    var segs = [].slice.call(root.querySelectorAll('.seg button'));
    var chips = [].slice.call(root.querySelectorAll('.chip'));
    var grid = root.querySelector('.cards');
    var useBig = grid && grid.hasAttribute('data-big');
    var empty = root.querySelector('.empty');
    var cat = '', type = '';
    function apply() {
      var first = null, shown = 0;
      cards.forEach(function (c) {
        var ok = (!cat || c.getAttribute('data-cat') === cat) && (!type || c.getAttribute('data-type') === type);
        c.hidden = !ok;
        c.classList.remove('is-big');
        if (ok) { shown++; if (!first) first = c; }
      });
      if (first && (useBig || shown === 1)) first.classList.add('is-big');
      if (empty) empty.hidden = shown > 0;
    }
    segs.forEach(function (b) {
      b.addEventListener('click', function () {
        segs.forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
        cat = b.getAttribute('data-value');
        apply();
      });
    });
    chips.forEach(function (b) {
      b.addEventListener('click', function () {
        var on = b.getAttribute('aria-pressed') === 'true';
        chips.forEach(function (x) { x.setAttribute('aria-pressed', 'false'); });
        b.setAttribute('aria-pressed', on ? 'false' : 'true');
        type = on ? '' : b.getAttribute('data-value');
        apply();
      });
    });
  });

  /* ---------------- галерея екранів: палець, кнопки, клавіатура ---------------- */
  [].slice.call(document.querySelectorAll('.gallery')).forEach(function (g) {
    var track = g.querySelector('.gallery__track');
    var step = function (dir) {
      var item = track.querySelector('.gallery__item');
      var w = item ? item.offsetWidth + 18 : 280;
      track.scrollBy({ left: dir * w, behavior: reduce.matches ? 'auto' : 'smooth' });
    };
    var prev = g.querySelector('[data-dir="-1"]');
    var next = g.querySelector('[data-dir="1"]');
    if (prev) prev.addEventListener('click', function () { step(-1); });
    if (next) next.addEventListener('click', function () { step(1); });
    track.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
    });
  });

  /* ---------------- єдиний інтерактивний момент: сторінка міряє себе ---------------- */
  var measure = document.getElementById('measure');
  if (measure) {
    var readout = document.getElementById('readout');
    var setStat = function (name, text) {
      var box = readout.querySelector('[data-stat="' + name + '"]');
      box.querySelector('.stat__n').textContent = text;
      box.classList.add('lit');
    };
    measure.addEventListener('click', function () {
      var res = performance.getEntriesByType('resource') || [];
      var nav0 = (performance.getEntriesByType('navigation') || [])[0];
      /* із кешу transferSize дорівнює нулю, тоді беремо справжній розмір файла */
      var bytes = nav0 ? (nav0.transferSize || nav0.encodedBodySize || 0) : 0;
      for (var i = 0; i < res.length; i++) bytes += res[i].transferSize || res[i].encodedBodySize || 0;
      var fcp = performance.getEntriesByName('first-contentful-paint')[0];
      var paint = fcp ? fcp.startTime : (nav0 ? nav0.domContentLoadedEventEnd : 0);
      setStat('w', Math.max(1, Math.round(bytes / 1024)) + ' КБ');
      setStat('t', Math.round(paint) + ' мс');
      setStat('r', String(res.length + 1));
      measure.textContent = 'Виміряти ще раз';
    });
  }

  /* ---------------- герой: стрічка робіт ведеться прокруткою ---------------- */
  var hero = document.querySelector('.hero');
  if (hero) {
    var stage = hero.querySelector('.stage');
    var reel = hero.querySelector('.reel');
    var slides = [].slice.call(hero.querySelectorAll('.reel__slide'));
    var cap = hero.querySelector('.panel-cap');
    var rail = hero.querySelector('.rail');
    slides.forEach(function (s, i) { s.style.top = (i * 100) + '%'; });

    var bands = [].slice.call(hero.querySelectorAll('.band')).map(function (el) {
      var h = el.querySelector('.band__h');
      if (el.hasAttribute('data-split') && h) {
        var text = h.textContent.trim();
        var words = text.split(' ');
        var sr = document.createElement('span'); sr.className = 'sr'; sr.textContent = text;
        var vis = document.createElement('span'); vis.setAttribute('aria-hidden', 'true');
        words.forEach(function (w, i) {
          var sp = document.createElement('span');
          sp.className = 'w';
          sp.textContent = w;
          sp.style.setProperty('--th', (i / Math.max(1, words.length - 1) * 0.42).toFixed(3));
          vis.appendChild(sp);
          if (i < words.length - 1) vis.appendChild(document.createTextNode(' '));
        });
        h.textContent = '';
        h.appendChild(sr); h.appendChild(vis);
      }
      return { el: el, a: parseFloat(el.getAttribute('data-a')), b: parseFloat(el.getAttribute('data-b')), op: -1, k: -1 };
    });

    var heroTop = 0, heroRange = 1, target = 0, shown = 0, rafId = null, lastTick = 0, onScreen = true;
    var lastY = null, lastCap = -1, lastP = -1, cueOff = false;
    function measureHero() {
      heroTop = hero.offsetTop;
      heroRange = Math.max(1, hero.offsetHeight - window.innerHeight);
    }
    function progress() { return Math.min(1, Math.max(0, (window.scrollY - heroTop) / heroRange)); }
    function smooth(p, a, b) { var t = Math.min(1, Math.max(0, (p - a) / (b - a))); return t * t * (3 - 2 * t); }

    function paint(p) {
      for (var i = 0; i < bands.length; i++) {
        var bd = bands[i], f = Math.min(0.03, (bd.b - bd.a) / 3);
        var inE = i === 0 ? 1 : smooth(p, bd.a, bd.a + f);
        var outE = i === bands.length - 1 ? 1 : 1 - smooth(p, bd.b - f, bd.b);
        var op = inE * outE;
        var k = i === 0 ? 1 : Math.min(1, Math.max(0, (p - bd.a) / Math.min(0.05, (bd.b - bd.a) * 0.35)));
        if (Math.abs(op - bd.op) > 0.004) {
          bd.op = op;
          bd.el.style.opacity = op.toFixed(3);
          bd.el.classList.toggle('on', op > 0.5);
          bd.el.classList.toggle('off', op < 0.02);
        }
        if (Math.abs(k - bd.k) > 0.008) { bd.k = k; bd.el.style.setProperty('--k', k.toFixed(3)); }
      }
      /* стрічка стоїть на кожному слайді, а переїзд займає коротку ділянку */
      var n = slides.length - 1;
      var q = Math.min(1, Math.max(0, (p - 0.26) / 0.46));   // перший і останній кадри тримаються під своїми смугами
      var raw = q * n, base = Math.floor(raw), frac = raw - base;
      var pos = Math.min(n, base + smooth(frac, 0.2, 0.8));
      var y = -pos * 100;
      if (lastY === null || Math.abs(y - lastY) > 0.02) { lastY = y; reel.style.transform = 'translate3d(0,' + y.toFixed(2) + '%,0)'; }
      var idx = Math.round(pos);
      if (idx !== lastCap && cap && slides[idx]) { lastCap = idx; cap.textContent = slides[idx].getAttribute('data-cap'); }
      if (rail && Math.abs(p - lastP) > 0.002) { lastP = p; rail.style.setProperty('--p', p.toFixed(3)); }
      var off = p > 0.04;
      if (off !== cueOff) { cueOff = off; stage.classList.toggle('cue-off', off); }
    }
    function tick(now) {
      var dt = Math.min(100, now - (lastTick || now));
      lastTick = now;
      shown += (target - shown) * (1 - Math.pow(1 - 0.16, dt / 16.667));
      var done = Math.abs(target - shown) < 0.0005;
      if (done) shown = target;
      paint(shown);
      if (done) { rafId = null; lastTick = 0; } else rafId = requestAnimationFrame(tick);
    }
    var scrubOn = false;
    function kick() { if (scrubOn && rafId === null && onScreen) { lastTick = 0; rafId = requestAnimationFrame(tick); } }
    function onScroll() { target = progress(); kick(); }
    new IntersectionObserver(function (es) { onScreen = es[0].isIntersecting; if (onScreen) kick(); }, { rootMargin: '10px' }).observe(hero);

    /* п'ять воріт, живі. Рядки збігаються зі style.css символ у символ */
    var GATES = [
      '(max-width: 720px)',
      '(orientation: portrait) and (max-width: 1024px)',
      '(orientation: portrait) and (pointer: coarse)',
      '(orientation: landscape) and (pointer: coarse) and (max-height: 560px)',
      '(prefers-reduced-motion: reduce)'
    ];
    function clearPins() {
      reel.style.transform = '';
      stage.classList.remove('scrub');
      bands.forEach(function (b) { b.el.style.opacity = ''; b.el.classList.remove('on', 'off'); b.op = -1; b.k = -1; });
      lastY = null; lastCap = -1; lastP = -1;
    }
    function enable() {
      if (scrubOn) return;
      scrubOn = true;
      stage.classList.add('scrub');
      measureHero();
      window.addEventListener('scroll', onScroll, { passive: true });
      target = shown = progress();
      paint(target);
    }
    function disable() {
      if (!scrubOn) { clearPins(); if (cap && slides[0]) cap.textContent = slides[0].getAttribute('data-cap'); return; }
      scrubOn = false;
      window.removeEventListener('scroll', onScroll);
      if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
      clearPins();
      if (cap && slides[0]) cap.textContent = slides[0].getAttribute('data-cap');
    }
    var MQLS = GATES.map(function (q) { return matchMedia(q); });
    function applyMode() {
      if (MQLS.some(function (m) { return m.matches; })) disable(); else enable();
    }
    MQLS.forEach(function (m) { m.addEventListener('change', applyMode); });
    var rs = null;
    window.addEventListener('resize', function () {
      clearTimeout(rs);
      rs = setTimeout(function () { if (scrubOn) { measureHero(); target = progress(); kick(); } }, 120);
    });
    applyMode();
  }

  /* ---------------- пауза, коли вкладку сховали ---------------- */
  document.addEventListener('visibilitychange', function () {
    document.body.classList.toggle('paused', document.hidden);
  });
})();
