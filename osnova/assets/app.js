/* ============================================================
   Osnova. Без збірки, без залежностей.
   ============================================================ */
(function () {
  'use strict';

  var VIDEO_URL = 'assets/hero-scrub.mp4';
  var VIDEO_BYTES = 1703979;
  var FRAME = 1 / 30;

  var stage = document.querySelector('.stage');
  var video = document.getElementById('hero');
  var ring = document.querySelector('.ring');
  var poster = document.querySelector('.stage__poster');
  var bandEls = [].slice.call(document.querySelectorAll('.band'));

  /* ---------------- розбивка тексту ---------------- */
  function rng(seed) {
    var s = seed >>> 0;
    return function () { return (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; };
  }

  function split(el, mode, seed) {
    var text = el.textContent, r = rng(seed);
    var sr = document.createElement('span');
    sr.className = 'sr'; sr.textContent = text;
    var vis = document.createElement('span');
    vis.setAttribute('aria-hidden', 'true');
    var words = text.split(' '), total = 0, i, j;
    for (i = 0; i < words.length; i++) total += words[i].length;
    var seen = 0;
    for (i = 0; i < words.length; i++) {
      var w = document.createElement('span');
      w.className = 'w';
      if (mode === 'word') {
        w.style.setProperty('--th', (i / Math.max(1, words.length - 1) * 0.42).toFixed(3));
        w.textContent = words[i];
      } else {
        for (j = 0; j < words[i].length; j++) {
          var c = document.createElement('span');
          c.className = 'c'; c.textContent = words[i][j];
          if (mode === 'scatter') {
            c.style.setProperty('--th', (r() * 0.5).toFixed(3));
            c.style.setProperty('--jx', ((r() - 0.5) * 54).toFixed(1) + 'px');
            c.style.setProperty('--jy', ((r() - 0.5) * 46).toFixed(1) + 'px');
            c.style.setProperty('--jr', ((r() - 0.5) * 22).toFixed(1) + 'deg');
          } else {
            c.style.setProperty('--th', (seen / Math.max(1, total) * 0.5 + r() * 0.05).toFixed(3));
            c.style.setProperty('--jx', (-24 - r() * 16).toFixed(1) + 'px');
            c.style.setProperty('--jy', '0px'); c.style.setProperty('--jr', '0deg');
          }
          w.appendChild(c); seen++;
        }
      }
      vis.appendChild(w);
      if (i < words.length - 1) vis.appendChild(document.createTextNode(' '));
    }
    el.textContent = '';
    el.appendChild(sr); el.appendChild(vis);
  }

  var bands = bandEls.map(function (el, n) {
    var ent = el.getAttribute('data-ent');
    var h = el.querySelector('.band__h');
    if (h) {
      if (ent === 'scatter') split(h, 'scatter', 20260830 + n);
      else if (ent === 'grid') split(h, 'grid', 613 + n);
      else split(h, 'word', 2201 + n);
    }
    return { el: el, a: parseFloat(el.getAttribute('data-a')), b: parseFloat(el.getAttribute('data-b')), op: -1, k: -1 };
  });

  /* ---------------- ворота перемотки ---------------- */
  var seekBusy = false, pendingTime = null, lastSeekAt = -1;
  function requestSeek(t) {
    if (!video.duration) return;
    t = Math.round(t / FRAME) * FRAME;
    if (Math.abs(t - lastSeekAt) < FRAME * 0.5) return;
    lastSeekAt = t;
    if (seekBusy) { pendingTime = t; return; }
    seekBusy = true; video.currentTime = t;
  }
  video.addEventListener('seeked', function () {
    seekBusy = false;
    if (pendingTime !== null) { var t = pendingTime; pendingTime = null; requestSeek(t); }
  });
  video.addEventListener('error', function () { seekBusy = false; pendingTime = null; failVideo(); });

  /* ---------------- завантаження відео ---------------- */
  var heroStarted = false;
  function initHeroOnce() {
    if (heroStarted) return;
    heroStarted = true;
    poster.style.backgroundImage = "url('assets/hero-poster.jpg')";
    var started = false;
    function go() { if (!started) { started = true; loadBlob().catch(failVideo); } }
    var img = new Image();
    img.onload = go; img.onerror = go; img.src = 'assets/hero-poster.jpg';
    setTimeout(go, 4000);
  }
  function loadBlob() {
    var ctrl = new AbortController();
    var watchdog = setTimeout(function () { ctrl.abort(); }, 20000);
    return fetch(VIDEO_URL, { priority: 'low', signal: ctrl.signal }).then(function (res) {
      var total = Number(res.headers.get('Content-Length')) || VIDEO_BYTES;
      var reader = res.body.getReader(), chunks = [], got = 0, lastRing = 0;
      function pump() {
        return reader.read().then(function (r) {
          if (r.done) return;
          clearTimeout(watchdog);
          watchdog = setTimeout(function () { ctrl.abort(); }, 20000);
          chunks.push(r.value); got += r.value.length;
          var frac = Math.min(1, got / total), now = performance.now();
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
  function failVideo() { if (ring) ring.style.display = 'none'; stage.classList.add('video-failed'); }

  /* ---------------- прогрес ---------------- */
  var hero = document.querySelector('.hero');
  var heroTop = 0, heroRange = 1;
  function measureHero() {
    if (!hero) return;
    heroTop = hero.offsetTop;
    heroRange = Math.max(1, hero.offsetHeight - window.innerHeight);
  }
  function heroProgress() { return Math.min(1, Math.max(0, (window.scrollY - heroTop) / heroRange)); }

  /* ---------------- цикл ---------------- */
  var target = 0, shown = 0, rafId = null, lastTick = 0, heroOnScreen = true;
  var loadK = 0, loadStart = 0, cueHidden = false;
  function smoothstep(p, e0, e1) { var t = Math.min(1, Math.max(0, (p - e0) / (e1 - e0))); return t * t * (3 - 2 * t); }

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
        bd.op = op; bd.el.style.opacity = op.toFixed(3);
        bd.el.classList.toggle('on', op > 0.5);
      }
      if (Math.abs(k - bd.k) > 0.008) { bd.k = k; bd.el.style.setProperty('--k', k.toFixed(3)); }
    }
    var hide = p > 0.05;
    if (hide !== cueHidden) { cueHidden = hide; stage.classList.toggle('cue-off', hide); }
  }

  function tick(now) {
    var dt = Math.min(100, now - (lastTick || now));
    lastTick = now;
    shown += (target - shown) * (1 - Math.pow(1 - 0.16, dt / 16.667));
    if (loadStart && loadK < 1) loadK = Math.min(1, (now - loadStart) / 900);
    var settled = Math.abs(target - shown) < 0.0005;
    if (settled) shown = target;
    if (video.duration) requestSeek(shown * video.duration);
    updateBands(shown);
    if (settled && loadK >= 1) { rafId = null; lastTick = 0; }
    else rafId = requestAnimationFrame(tick);
  }
  function kick() { if (rafId === null && heroOnScreen) { lastTick = 0; rafId = requestAnimationFrame(tick); } }
  function onScroll() { target = heroProgress(); kick(); }

  if (hero) {
    new IntersectionObserver(function (es) {
      heroOnScreen = es[0].isIntersecting;
      if (heroOnScreen) kick();
    }, { rootMargin: '10px' }).observe(hero);
  }

  /* ---------------- пʼять воріт ---------------- */
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
    measureHero(); initHeroOnce();
    if (!loadStart) loadStart = performance.now();
    window.addEventListener('scroll', onScroll, { passive: true });
    for (var i = 0; i < bands.length; i++) { bands[i].op = -1; bands[i].k = -1; }
    target = heroProgress(); updateBands(target); kick();
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
    if (hit) { disableScrub(); pinFinal(); } else { enableScrub(); }
  }
  GATES.map(function (q) { return matchMedia(q); }).forEach(function (m) {
    if (m.addEventListener) m.addEventListener('change', applyHeroMode); else m.addListener(applyHeroMode);
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
    [].slice.call(document.querySelectorAll('.reveal')).forEach(function (el) { el.classList.add('in', 'done'); });
  }

  /* ---------------- шапка ---------------- */
  var nav = document.querySelector('.nav'), navTick = false;
  window.addEventListener('scroll', function () {
    if (navTick) return;
    navTick = true;
    requestAnimationFrame(function () {
      nav.classList.toggle('scrolled', window.scrollY > 40);
      navTick = false;
    });
  }, { passive: true });

  /* ============================================================
     Єдиний інтерактивний момент: три відповіді креслять план.
     ============================================================ */
  var canvas = document.getElementById('plan');
  var readout = document.getElementById('planread');
  var answers = [null, null, null];

  var PLAN_W = 1120, PLAN_H = 720;
  if (canvas) { canvas.width = PLAN_W * 2; canvas.height = PLAN_H * 2; }

  function buildPlan(a) {
    var early = a[0] === 0, often = a[1] === 0, works = a[2] === 0;
    var out = works
      ? [[0, 0], [11, 0], [11, 5], [15.4, 5], [15.4, 8.6], [0, 8.6]]
      : [[0, 0], [11, 0], [11, 8.6], [0, 8.6]];
    var inner = [[[6.6, 0], [6.6, 8.6]], [[6.6, 4.3], [11, 4.3]]];
    if (!often) inner.push([[0, 4.3], [6.6, 4.3]]);
    if (works) inner.push([[11, 5], [11, 8.6]]);
    var rooms = [
      { at: [3.3, often ? 3.9 : 2.6], label: often ? 'вітальня і кухня' : 'вітальня' },
      { at: [8.8, 3.7], label: 'спальня' },
      { at: [8.8, 8.0], label: 'спальня' }
    ];
    if (!often) rooms.push({ at: [3.3, 8.0], label: 'кухня' });
    if (works) rooms.push({ at: [13.2, 8.1], label: 'кабінет' });
    var furn = often
      ? [[0.7, 0.7, 5.2, 1.7], [1.2, 5.4, 4.0, 2.4]]
      : [[0.7, 0.7, 5.2, 1.7], [1.4, 5.2, 3.6, 2.6]];
    furn.push([7.3, 0.7, 3.0, 2.6], [7.3, 5.0, 3.0, 2.6]);
    if (works) furn.push([11.9, 5.7, 2.8, 1.5]);
    var light = early
      ? [[6.9, 0.5], [10.7, 0.5], [10.7, 3.9], [6.9, 3.9]]
      : [[0.4, 0.5], [4.4, 0.5], [4.4, 3.9], [0.4, 3.9]];
    return { out: out, inner: inner, rooms: rooms, furn: furn, light: light, early: early, often: often, works: works };
  }

  function drawPlan(P, prog, ghost) {
    var g = canvas.getContext('2d');
    var minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9;
    P.out.forEach(function (p) {
      minx = Math.min(minx, p[0]); maxx = Math.max(maxx, p[0]);
      miny = Math.min(miny, p[1]); maxy = Math.max(maxy, p[1]);
    });
    var pad = 1.5;
    var s = Math.min((PLAN_W - 90) / (maxx - minx + pad * 2), (PLAN_H - 90) / (maxy - miny + pad * 2));
    var ox = (PLAN_W - (maxx - minx) * s) / 2 - minx * s;
    var oy = (PLAN_H - (maxy - miny) * s) / 2 - miny * s;
    var to = function (x, y) { return [ox + x * s, oy + y * s]; };

    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#F2F0EA'; g.fillRect(0, 0, PLAN_W * 2, PLAN_H * 2);
    g.setTransform(2, 0, 0, 2, 0, 0);
    g.lineCap = 'round'; g.lineJoin = 'round';

    /* сітка */
    g.save(); g.globalAlpha = 0.10; g.strokeStyle = '#171A19'; g.lineWidth = 1;
    for (var k = Math.floor(minx - pad); k <= maxx + pad; k++) {
      var p1 = to(k, miny - pad), p2 = to(k, maxy + pad);
      g.beginPath(); g.moveTo(p1[0], p1[1]); g.lineTo(p2[0], p2[1]); g.stroke();
    }
    for (var m = Math.floor(miny - pad); m <= maxy + pad; m++) {
      var q1 = to(minx - pad, m), q2 = to(maxx + pad, m);
      g.beginPath(); g.moveTo(q1[0], q1[1]); g.lineTo(q2[0], q2[1]); g.stroke();
    }
    g.restore();

    /* світло */
    g.save(); g.globalAlpha = ghost ? 0 : Math.min(1, prog * 1.4);
    var la = to(P.light[0][0], P.light[0][1]), lb = to(P.light[2][0], P.light[2][1]);
    var lg = g.createLinearGradient(la[0], la[1], lb[0], lb[1]);
    lg.addColorStop(0, 'rgba(255,238,200,0.85)');
    lg.addColorStop(1, 'rgba(255,250,238,0.15)');
    g.fillStyle = lg;
    g.beginPath();
    P.light.forEach(function (p, i) { var q = to(p[0], p[1]); i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); });
    g.closePath(); g.fill(); g.restore();

    /* меблі */
    g.save(); g.globalAlpha = ghost ? 0 : Math.max(0, (prog - 0.45) / 0.55);
    g.strokeStyle = '#171A19'; g.lineWidth = 1.4; g.fillStyle = 'rgba(23,26,25,0.05)';
    P.furn.forEach(function (f) {
      var a1 = to(f[0], f[1]), b1 = to(f[0] + f[2], f[1] + f[3]);
      g.beginPath(); g.rect(a1[0], a1[1], b1[0] - a1[0], b1[1] - a1[1]);
      g.fill(); g.stroke();
    });
    g.restore();

    /* стіни, що креслять себе */
    function line(pts, p, close, width) {
      var list = close ? pts.concat([pts[0]]) : pts;
      var pr = [], tot = 0, segs = [];
      list.forEach(function (pt) { pr.push(to(pt[0], pt[1])); });
      for (var i = 1; i < pr.length; i++) {
        var d = Math.hypot(pr[i][0] - pr[i - 1][0], pr[i][1] - pr[i - 1][1]);
        segs.push(d); tot += d;
      }
      var want = tot * Math.min(1, Math.max(0, p));
      g.beginPath(); g.moveTo(pr[0][0], pr[0][1]);
      for (var j = 1; j < pr.length; j++) {
        var dd = segs[j - 1];
        if (want >= dd) { g.lineTo(pr[j][0], pr[j][1]); want -= dd; }
        else {
          var f2 = dd > 0 ? want / dd : 0;
          g.lineTo(pr[j - 1][0] + (pr[j][0] - pr[j - 1][0]) * f2, pr[j - 1][1] + (pr[j][1] - pr[j - 1][1]) * f2);
          break;
        }
      }
      g.lineWidth = width; g.stroke();
    }
    g.save(); g.strokeStyle = '#171A19'; if (ghost) g.globalAlpha = 0.20;
    line(P.out, Math.min(1, prog / 0.55), true, 5);
    P.inner.forEach(function (seg, i) {
      line(seg, Math.min(1, Math.max(0, (prog - 0.45 - i * 0.05) / 0.3)), false, 3);
    });
    g.restore();

    /* підписи кімнат */
    g.save();
    g.globalAlpha = ghost ? 0 : Math.max(0, (prog - 0.72) / 0.28);
    g.fillStyle = '#5C5F5B';
    g.font = '500 26px "IBM Plex Mono", monospace';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    P.rooms.forEach(function (r) { var q = to(r.at[0], r.at[1]); g.fillText(r.label, q[0], q[1]); });
    g.restore();
  }

  function readoutText(P) {
    var out = [];
    out.push(P.early
      ? 'Рання: вікна спалень дивляться на схід, ранкове світло приходить туди, де ви прокидаєтесь.'
      : 'Вечірня: велике вікно у вітальні ловить захід, спальні лишаються в тіні зранку.');
    out.push(P.often
      ? 'Гості часто: вітальня і кухня це одна кімната на всю ширину будинку.'
      : 'Гості зрідка: кухня відокремлена стіною, вітальня менша й тихіша.');
    out.push(P.works
      ? 'Працюєте вдома: кабінет винесено окремим крилом, щоб робота не заходила в дім.'
      : 'Не працюєте вдома: без кабінету, периметр компактніший і дешевший.');
    return out.join(' ');
  }

  var planRaf = null;
  function runPlan() {
    if (answers.indexOf(null) > -1 || !canvas) return;
    var P = buildPlan(answers);
    readout.textContent = readoutText(P);
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { drawPlan(P, 1); return; }
    if (planRaf) cancelAnimationFrame(planRaf);
    var t0 = performance.now();
    (function step(now) {
      var p = Math.min(1, (now - t0) / 1500);
      drawPlan(P, 1 - Math.pow(1 - p, 3));
      if (p < 1) planRaf = requestAnimationFrame(step); else planRaf = null;
    })(t0);
  }

  if (canvas) drawPlan(buildPlan([0, 0, 1]), 1, true);

  var qaset = document.getElementById('qaset');
  if (qaset) {
    [].slice.call(qaset.querySelectorAll('.qa-row')).forEach(function (row) {
      var qi = parseInt(row.getAttribute('data-q'), 10);
      var btns = [].slice.call(row.querySelectorAll('button'));
      btns.forEach(function (b) {
        b.setAttribute('aria-pressed', 'false');
        b.addEventListener('click', function () {
          answers[qi] = parseInt(b.getAttribute('data-v'), 10);
          btns.forEach(function (o) { o.setAttribute('aria-pressed', String(o === b)); });
          if (answers.indexOf(null) > -1) {
            readout.textContent = 'Лишилось відповідей: ' + answers.filter(function (x) { return x === null; }).length + '.';
          } else runPlan();
        });
      });
    });
  }

  /* ---------------- форма ---------------- */
  var form = document.getElementById('form');
  if (form) {
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var ok = true, firstBad = null;
      [['f-name', 'e-name'], ['f-contact', 'e-contact']].forEach(function (pair) {
        var inp = document.getElementById(pair[0]), err = document.getElementById(pair[1]);
        var bad = !inp.value.trim();
        inp.parentNode.classList.toggle('bad', bad);
        err.hidden = !bad;
        inp.setAttribute('aria-invalid', bad ? 'true' : 'false');
        if (bad) { ok = false; if (!firstBad) firstBad = inp; }
      });
      if (!ok) { firstBad.focus(); return; }
      document.getElementById('form-ok').hidden = false;
      form.querySelector('button[type=submit]').disabled = true;
    });
  }

  /* ---------------- службове ---------------- */
  document.addEventListener('visibilitychange', function () {
    document.body.classList.toggle('paused', document.hidden);
    if (!document.hidden) kick();
  });
  var rsTimer = null;
  window.addEventListener('resize', function () {
    clearTimeout(rsTimer);
    rsTimer = setTimeout(function () { measureHero(); if (scrubOn) { target = heroProgress(); kick(); } }, 120);
  });

  document.documentElement.classList.add('js');
  measureHero();
  applyHeroMode();
})();
