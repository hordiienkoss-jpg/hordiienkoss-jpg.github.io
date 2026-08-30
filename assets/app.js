/* ============================================================
   Serhii Hordiienko. Без збірки, без залежностей.
   ============================================================ */
(function () {
  'use strict';

  var VIDEO_URL = 'assets/hero-scrub.mp4';
  var VIDEO_BYTES = 8098151;
  var FRAME = 1 / 30;

  var stage = document.querySelector('.stage');
  var video = document.getElementById('hero');
  var ring = document.querySelector('.ring');
  var poster = document.querySelector('.panel__poster');
  var railLine = document.querySelector('.rail__line');
  var bandEls = [].slice.call(document.querySelectorAll('.band'));

  /* ---------------- розбивка тексту на слова і символи ---------------- */
  function rng(seed) {
    var s = seed >>> 0;
    return function () { return (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; };
  }

  function split(el, mode, seed) {
    var text = el.textContent;
    var emWord = el.querySelector('em');
    var emText = emWord ? emWord.textContent : null;
    var r = rng(seed);
    var sr = document.createElement('span');
    sr.className = 'sr';
    sr.textContent = text;
    var vis = document.createElement('span');
    vis.setAttribute('aria-hidden', 'true');

    var words = text.split(' ');
    var total = 0, i, j;
    for (i = 0; i < words.length; i++) total += words[i].length;

    var seen = 0;
    for (i = 0; i < words.length; i++) {
      var w = document.createElement('span');
      w.className = 'w';
      if (emText && words[i].replace(/[^\wа-яїієґА-ЯЇІЄҐ]/gi, '') === emText.replace(/[^\wа-яїієґА-ЯЇІЄҐ]/gi, '')) {
        w.className = 'w em';
      }
      if (mode === 'word') {
        w.style.setProperty('--th', (i / Math.max(1, words.length - 1) * 0.42).toFixed(3));
        w.textContent = words[i];
      } else {
        for (j = 0; j < words[i].length; j++) {
          var c = document.createElement('span');
          c.className = 'c';
          c.textContent = words[i][j];
          if (mode === 'scatter') {
            c.style.setProperty('--th', (r() * 0.5).toFixed(3));
            c.style.setProperty('--jx', ((r() - 0.5) * 60).toFixed(1) + 'px');
            c.style.setProperty('--jy', ((r() - 0.5) * 52).toFixed(1) + 'px');
            c.style.setProperty('--jr', ((r() - 0.5) * 26).toFixed(1) + 'deg');
          } else {
            c.style.setProperty('--th', (seen / Math.max(1, total) * 0.5 + r() * 0.05).toFixed(3));
            c.style.setProperty('--jx', (-26 - r() * 18).toFixed(1) + 'px');
            c.style.setProperty('--jy', '0px');
            c.style.setProperty('--jr', '0deg');
          }
          w.appendChild(c);
          seen++;
        }
      }
      vis.appendChild(w);
      if (i < words.length - 1) vis.appendChild(document.createTextNode(' '));
    }
    el.textContent = '';
    el.appendChild(sr);
    el.appendChild(vis);
  }

  var bands = bandEls.map(function (el, n) {
    var ent = el.getAttribute('data-ent');
    var h = el.querySelector('.band__h');
    if (h) {
      if (ent === 'scatter') split(h, 'scatter', 20260829 + n);
      else if (ent === 'grid') split(h, 'grid', 771 + n);
      else split(h, 'word', 4001 + n);
    }
    return {
      el: el,
      a: parseFloat(el.getAttribute('data-a')),
      b: parseFloat(el.getAttribute('data-b')),
      op: -1,
      k: -1
    };
  });

  /* ---------------- ворота перемотки ---------------- */
  var seekBusy = false, pendingTime = null, lastSeekAt = -1;
  function requestSeek(t) {
    if (!video.duration) return;
    t = Math.round(t / FRAME) * FRAME;
    if (Math.abs(t - lastSeekAt) < FRAME * 0.5) return;
    lastSeekAt = t;
    if (seekBusy) { pendingTime = t; return; }
    seekBusy = true;
    video.currentTime = t;
  }
  video.addEventListener('seeked', function () {
    seekBusy = false;
    if (pendingTime !== null) { var t = pendingTime; pendingTime = null; requestSeek(t); }
  });
  video.addEventListener('error', function () {
    seekBusy = false; pendingTime = null; failVideo();
  });

  /* ---------------- завантаження відео потоком ---------------- */
  var heroStarted = false;
  function initHeroOnce() {
    if (heroStarted) return;
    heroStarted = true;
    poster.style.backgroundImage = "url('assets/hero-poster.jpg')";
    var started = false;
    function go() { if (!started) { started = true; loadBlob().catch(failVideo); } }
    var img = new Image();
    img.onload = go; img.onerror = go;
    img.src = 'assets/hero-poster.jpg';
    setTimeout(go, 4000);
  }

  function loadBlob() {
    var ctrl = new AbortController();
    var watchdog = setTimeout(function () { ctrl.abort(); }, 20000);
    return fetch(VIDEO_URL, { priority: 'low', signal: ctrl.signal }).then(function (res) {
      var total = Number(res.headers.get('Content-Length')) || VIDEO_BYTES;
      var reader = res.body.getReader();
      var chunks = [], got = 0, lastRing = 0;
      function pump() {
        return reader.read().then(function (r) {
          if (r.done) return;
          clearTimeout(watchdog);
          watchdog = setTimeout(function () { ctrl.abort(); }, 20000);
          chunks.push(r.value);
          got += r.value.length;
          var frac = Math.min(1, got / total);
          var now = performance.now();
          if (now - lastRing > 100 || frac === 1) {
            lastRing = now;
            ring.style.setProperty('--ld', Math.round(126 * (1 - frac)));
          }
          return pump();
        });
      }
      return pump().then(function () {
        clearTimeout(watchdog);
        ring.style.setProperty('--ld', 0);
        video.src = URL.createObjectURL(new Blob(chunks, { type: 'video/mp4' }));
        video.load();
        video.addEventListener('canplay', function () {
          requestSeek(heroProgress() * video.duration);
          stage.classList.add('video-ready');
        }, { once: true });
      });
    });
  }

  function failVideo() {
    if (ring) ring.style.display = 'none';
    stage.classList.add('video-failed');
  }

  /* ---------------- прогрес крізь героя ---------------- */
  var hero = document.querySelector('.hero');
  var heroTop = 0, heroRange = 1;
  function measureHero() {
    if (!hero) return;
    heroTop = hero.offsetTop;
    heroRange = Math.max(1, hero.offsetHeight - window.innerHeight);
  }
  function heroProgress() {
    return Math.min(1, Math.max(0, (window.scrollY - heroTop) / heroRange));
  }

  /* ---------------- цикл, який відпочиває ---------------- */
  var target = 0, shown = 0, rafId = null, lastTick = 0, heroOnScreen = true;
  var loadK = 0, loadStart = 0;

  function smoothstep(p, e0, e1) {
    var t = Math.min(1, Math.max(0, (p - e0) / (e1 - e0)));
    return t * t * (3 - 2 * t);
  }

  function updateBands(p) {
    for (var i = 0; i < bands.length; i++) {
      var bd = bands[i], a = bd.a, b = bd.b;
      var f = Math.min(0.02, (b - a) / 3);
      var inE = (i === 0) ? 1 : smoothstep(p, a, a + f);
      var outE = (i === bands.length - 1) ? 1 : (1 - smoothstep(p, b - f, b));
      var op = inE * outE;
      var ramp = Math.min(0.025, (b - a) * 0.35);
      var k = Math.min(1, Math.max(0, (p - a) / ramp));
      if (i === 0) k = Math.max(k, loadK);
      if (Math.abs(op - bd.op) > 0.004) {
        bd.op = op;
        bd.el.style.opacity = op.toFixed(3);
        bd.el.classList.toggle('on', op > 0.5);
      }
      if (Math.abs(k - bd.k) > 0.008) {
        bd.k = k;
        bd.el.style.setProperty('--k', k.toFixed(3));
      }
    }
    if (railLine) railLine.style.setProperty('--p', p.toFixed(3));
    var hideCue = p > 0.05;
    if (hideCue !== cueHidden) { cueHidden = hideCue; stage.classList.toggle('cue-off', hideCue); }
  }
  var cueHidden = false;

  function tick(now) {
    var dt = Math.min(100, now - (lastTick || now));
    lastTick = now;
    var k = 0.16;
    shown += (target - shown) * (1 - Math.pow(1 - k, dt / 16.667));

    if (loadStart && loadK < 1) {
      loadK = Math.min(1, (now - loadStart) / 900);
    }

    var settled = Math.abs(target - shown) < 0.0005;
    if (settled) { shown = target; }

    if (video.duration) requestSeek(shown * video.duration);
    updateBands(shown);

    if (settled && loadK >= 1) { rafId = null; lastTick = 0; }
    else rafId = requestAnimationFrame(tick);
  }

  function kick() { if (rafId === null && heroOnScreen) { lastTick = 0; rafId = requestAnimationFrame(tick); } }
  function onScroll() { target = heroProgress(); kick(); }

  if (hero) {
    var io = new IntersectionObserver(function (es) {
      heroOnScreen = es[0].isIntersecting;
      if (heroOnScreen) kick();
    }, { rootMargin: '10px' });
    io.observe(hero);
  }

  /* ---------------- п'ять воріт, живі ---------------- */
  var GATES = [
    '(max-width: 720px)',
    '(orientation: portrait) and (max-width: 1024px)',
    '(orientation: portrait) and (pointer: coarse)',
    '(orientation: landscape) and (pointer: coarse) and (max-height: 560px)',
    '(prefers-reduced-motion: reduce)'
  ];
  var scrubOn = false;

  function enableScrub() {
    if (scrubOn || !hero) return;
    scrubOn = true;
    measureHero();
    initHeroOnce();
    if (!loadStart) loadStart = performance.now();
    window.addEventListener('scroll', onScroll, { passive: true });
    for (var i = 0; i < bands.length; i++) { bands[i].op = -1; bands[i].k = -1; }
    target = heroProgress();
    updateBands(target);
    kick();
  }
  function disableScrub() {
    if (!scrubOn) return;
    scrubOn = false;
    window.removeEventListener('scroll', onScroll);
    if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
  }
  function applyHeroMode() {
    var hit = false;
    for (var i = 0; i < GATES.length; i++) if (matchMedia(GATES[i]).matches) hit = true;
    if (hit) { disableScrub(); pinFinal(); } else { unpinFinal(); enableScrub(); }
  }
  var MQLS = GATES.map(function (q) { return matchMedia(q); });
  MQLS.forEach(function (m) {
    if (m.addEventListener) m.addEventListener('change', applyHeroMode);
    else m.addListener(applyHeroMode);
  });

  /* ---------------- входи секцій ---------------- */
  var revealIO = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (!e.isIntersecting) return;
      e.target.classList.add('in');
      setTimeout(function () { e.target.classList.add('done'); }, 900);
      revealIO.unobserve(e.target);
    });
  }, { rootMargin: '0px 0px -12% 0px' });
  [].slice.call(document.querySelectorAll('.reveal')).forEach(function (el) { revealIO.observe(el); });

  function pinFinal() {
    [].slice.call(document.querySelectorAll('.reveal')).forEach(function (el) {
      el.classList.add('in', 'done');
    });
    if (railLine) railLine.style.setProperty('--p', '1');
    if (measured === false) fillStats(true);
  }
  function unpinFinal() {
    if (railLine) railLine.style.setProperty('--p', '0');
  }

  /* ---------------- шапка ---------------- */
  var nav = document.querySelector('.nav');
  var navTick = false;
  window.addEventListener('scroll', function () {
    if (navTick) return;
    navTick = true;
    requestAnimationFrame(function () {
      nav.classList.toggle('scrolled', window.scrollY > 40);
      navTick = false;
    });
  }, { passive: true });

  /* ---------------- єдиний інтерактивний момент: сторінка міряє себе ---------------- */
  var measured = false;
  var btn = document.getElementById('measure');
  var readout = document.getElementById('readout');

  function pageNumbers() {
    var res = performance.getEntriesByType('resource') || [];
    var nav0 = (performance.getEntriesByType('navigation') || [])[0];
    var bytes = nav0 ? (nav0.transferSize || 0) : 0;
    var count = 1;
    for (var i = 0; i < res.length; i++) {
      if (res[i].name.indexOf('hero-scrub.mp4') > -1) continue;
      bytes += res[i].transferSize || 0;
      count++;
    }
    var paint = 0;
    var fcp = performance.getEntriesByName('first-contentful-paint')[0];
    if (fcp) paint = fcp.startTime;
    else if (nav0) paint = nav0.domContentLoadedEventEnd;
    return { kb: Math.max(1, Math.round(bytes / 1024)), ms: Math.round(paint), n: count };
  }

  function setStat(sel, value, suffix) {
    var box = readout.querySelector('[data-stat="' + sel + '"]');
    box.querySelector('.stat__n').textContent = value + suffix;
    box.classList.add('lit');
  }

  function fillStats(instant) {
    if (measured) return;
    measured = true;
    var d = pageNumbers();
    readout.classList.add('lit');
    var plan = [['w', d.kb, ' КБ'], ['t', d.ms, ' мс'], ['r', d.n, '']];
    if (instant || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      plan.forEach(function (p) { setStat(p[0], p[1], p[2]); });
      return;
    }
    plan.forEach(function (p, i) {
      setTimeout(function () {
        var from = 0, to = p[1], t0 = performance.now(), dur = 620;
        (function step(now) {
          var q = Math.min(1, (now - t0) / dur);
          var eased = 1 - Math.pow(1 - q, 3);
          setStat(p[0], Math.round(from + (to - from) * eased), p[2]);
          if (q < 1) requestAnimationFrame(step);
        })(t0);
      }, i * 260);
    });
  }

  if (btn) {
    btn.addEventListener('click', function () {
      measured = false;
      fillStats(false);
      btn.textContent = 'Виміряно';
    });
  }

  /* ---------------- форма ---------------- */
  var form = document.getElementById('form');
  if (form) {
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var ok = true, firstBad = null;
      [['f-name', 'e-name'], ['f-contact', 'e-contact']].forEach(function (pair) {
        var inp = document.getElementById(pair[0]);
        var err = document.getElementById(pair[1]);
        var bad = !inp.value.trim();
        inp.parentNode.classList.toggle('bad', bad);
        err.hidden = !bad;
        inp.setAttribute('aria-invalid', bad ? 'true' : 'false');
        if (bad) { ok = false; if (!firstBad) firstBad = inp; }
      });
      if (!ok) { firstBad.focus(); return; }

      var name = document.getElementById('f-name').value.trim();
      var contact = document.getElementById('f-contact').value.trim();
      var note = document.getElementById('f-note').value.trim();
      var body = 'Імʼя: ' + name + '\nКонтакт: ' + contact + '\n\n' + note;
      document.getElementById('form-ok').hidden = false;
      window.location.href = 'mailto:hordiienkoss@gmail.com'
        + '?subject=' + encodeURIComponent('Заявка з сайту: ' + name)
        + '&body=' + encodeURIComponent(body);
    });
  }

  /* ---------------- пауза, коли вкладку сховали ---------------- */
  document.addEventListener('visibilitychange', function () {
    document.body.classList.toggle('paused', document.hidden);
    if (!document.hidden) kick();
  });

  /* ---------------- розміри ---------------- */
  var rsTimer = null;
  window.addEventListener('resize', function () {
    clearTimeout(rsTimer);
    rsTimer = setTimeout(function () { measureHero(); if (scrubOn) { target = heroProgress(); kick(); } }, 120);
  });

  document.documentElement.classList.add('js');
  measureHero();
  applyHeroMode();
})();
