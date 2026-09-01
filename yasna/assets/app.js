/* ===========================================================
   Нитка · студія масажу
   Простий HTML, CSS і ванільний JavaScript. Без збірки.
   =========================================================== */
(function () {
  'use strict';
  document.documentElement.classList.add('js');

  /* -----------------------------------------------------------
     НАЛАШТУВАННЯ. Тут міняється все, що стосується контактів
     і того, куди йде заявка з форми.
     ----------------------------------------------------------- */
  // Бренд вигаданий, сайт зроблено для портфоліо.
  var CONTACT = {
    phone: '+380 68 606 35 45',
    messenger: 'https://t.me/nytka_studio',
    messengerLabel: 'Telegram, @nytka_studio',
    email: '',        // куди приходять заявки в режимі mailto
    address: 'вул. Прикладна, 12, Київ'
  };

  // 'demo'     заявка нікуди не йде, екран успіху каже про це чесно
  // 'mailto'   відкриється поштова програма відвідувача, лист адресовано на CONTACT.email
  // 'endpoint' заявка йде POST-запитом на FORM_ENDPOINT (наприклад Formspree)
  var FORM_MODE = 'demo';
  var FORM_ENDPOINT = '';

  var M = window.YASNA_MEDIA || { photos: {} };
  if (!M.photos) M.photos = {};

  /* ----------------------------------------------------------- */
  var clamp = function (v, lo, hi) { return Math.min(hi, Math.max(lo, v)); };
  var smoothstep = function (p, e0, e1) {
    var t = clamp((p - e0) / (e1 - e0), 0, 1);
    return t * t * (3 - 2 * t);
  };
  function rng(seed) {
    var s = seed >>> 0;
    return function () { return (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; };
  }
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ===========================================================
     НИТКА. Один генератор шляху на весь сайт: герой, вузол
     в інтерактиві і дуги в порожніх слотах під фото.
     =========================================================== */
  function threadPath(t, o) {
    o = o || {};
    var h = o.h || 1000, cx = o.cx || 200, cy = o.cy || 520,
        sigma = o.sigma || 190, wave = o.wave || 18, f1 = o.f1 || 0.0168,
        loopA = o.loopA === undefined ? 128 : o.loopA,
        loopL = o.loopL === undefined ? 178 : o.loopL,
        loops = o.loops === undefined ? 1.35 : o.loops,
        phase = o.phase || 0, steps = o.steps || 72;
    var pts = [], i, s, y0, g, th, x, y;
    for (i = 0; i <= steps; i++) {
      s = i / steps;
      y0 = h * s;
      g = Math.exp(-Math.pow((y0 - cy) / sigma, 2));
      th = (y0 - cy) / sigma * Math.PI * loops + phase;
      x = cx + t * (wave * Math.sin(y0 * f1 + phase) + g * loopA * Math.sin(th));
      y = y0 - t * g * loopL * Math.cos(th);
      pts.push([x, y]);
    }
    var d = 'M' + pts[0][0].toFixed(1) + ' ' + pts[0][1].toFixed(1);
    for (i = 1; i < pts.length - 1; i++) {
      var mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
      d += ' Q' + pts[i][0].toFixed(1) + ' ' + pts[i][1].toFixed(1) + ' ' + mx.toFixed(1) + ' ' + my.toFixed(1);
    }
    var L = pts[pts.length - 1];
    d += ' L' + L[0].toFixed(1) + ' ' + L[1].toFixed(1);
    return d;
  }

  // скільки нитка заплутана на цьому місці подорожі
  function tangleAt(p) {
    var t = p < 0.42 ? smoothstep(p, 0, 0.42) : 1 - smoothstep(p, 0.42, 0.94);
    return 0.1 + 0.9 * t;   // навіть спокійна нитка лишається живою
  }

  /* ===========================================================
     РОЗБИТТЯ ТЕКСТУ на слова і літери, один раз при завантаженні
     =========================================================== */
  function splitText(el, entrance, spread) {
    var text = el.textContent.trim();
    var rand = rng(text.length * 977 + 41);
    var words = text.split(' ');
    var total = text.replace(/\s/g, '').length;

    var sr = document.createElement('span');
    sr.className = 'sr-only';
    sr.textContent = text;

    var vis = document.createElement('span');
    vis.className = 'vis';
    vis.setAttribute('aria-hidden', 'true');

    var ci = 0;
    words.forEach(function (word, wi) {
      var w = document.createElement('span');
      w.className = 'w';
      if (entrance === 'drift' || entrance === 'rise') {
        w.style.setProperty('--th', (wi / Math.max(1, words.length) * 0.5 + rand() * 0.06).toFixed(3));
      }
      for (var i = 0; i < word.length; i++) {
        var c = document.createElement('span');
        c.className = 'c';
        c.textContent = word[i];
        if (entrance === 'weave') {
          c.style.setProperty('--th', (rand() * 0.5).toFixed(3));
          c.style.setProperty('--jy', (ci % 2 ? 30 : -30).toFixed(0) + 'px');
        } else if (entrance === 'grid') {
          c.style.setProperty('--th', (ci / Math.max(1, total) * (spread || 0.55) + rand() * 0.05).toFixed(3));
          c.style.setProperty('--jx', (-34 - rand() * 26).toFixed(0) + 'px');
        }
        w.appendChild(c);
        ci++;
      }
      vis.appendChild(w);
      if (wi < words.length - 1) vis.appendChild(document.createTextNode(' '));
    });

    el.textContent = '';
    el.appendChild(sr);
    el.appendChild(vis);
  }

  /* ===========================================================
     ГЕРОЙ
     =========================================================== */
  var hero = $('.hero'), stage = $('.stage'), video = $('#hero-video'),
      posterLayer = $('.poster'), ring = $('.ring'), threadSvg = $('.thread'),
      threadLine = $('.thread-line'), threadGlow = $('.thread-glow');

  var bands = $$('.band').map(function (el) {
    var h = el.querySelector('.split');
    if (h) splitText(h, el.dataset.entrance, parseFloat(el.dataset.spread));
    return {
      el: el,
      a: parseFloat(el.dataset.a),
      b: parseFloat(el.dataset.b),
      first: el.dataset.first === '1',
      last: parseFloat(el.dataset.b) >= 1,
      ramp: el.dataset.ramp ? parseFloat(el.dataset.ramp) : 0,
      op: -1, k: -1, hidden: null
    };
  });
  var staticH = $('.static-h');
  if (staticH) splitText(staticH, 'none');

  var target = 0, shown = 0, rafId = null, lastTick = 0, loadK = 0;
  var loadStart = performance.now();
  var heroOnScreen = true, scrubOn = false, lastThread = -1, cueOff = false;
  var heroHasVideo = false;

  var heroRange = 0;
  function measureHero() {
    heroRange = hero ? hero.offsetHeight - window.innerHeight : 0;
  }
  function heroProgress() {
    // offsetHeight змінюється лише на resize, тому міряємо один раз і кешуємо.
    // Читання геометрії на кожній події скролу коштує синхронного reflow.
    if (!hero || heroRange <= 0) return 0;
    return clamp(-hero.getBoundingClientRect().top / heroRange, 0, 1);
  }

  function drawThread(p) {
    // На цьому сайті намальованої нитки немає, вона належала іншому бренду.
    // Двигун лишається спільним, тому просто виходимо.
    if (!threadSvg || !threadLine) return;
    if (Math.abs(p - lastThread) < 0.0022) return;   // пишемо в DOM тільки на зміну
    lastThread = p;
    // Коли нитка схована за відео, немає сенсу рахувати її шлях: це
    // 72 точки і два записи в DOM на кожному кадрі прокрутки задарма.
    if (!heroHasVideo) {
      var d = threadPath(tangleAt(p), { phase: p * 3.2 });
      threadLine.setAttribute('d', d);
      threadGlow.setAttribute('d', d);
    }
    // Коли відео на місці, у кадрі вже є справжня мотузка, і намальована
    // нитка стає зайвою. Без відео вона несе всю подорож сама.
    // На зупинці вона стишується, щоб не різати назву і кнопки.
    threadSvg.style.opacity = heroHasVideo ? '0' : (1 - 0.8 * smoothstep(p, 0.74, 0.93)).toFixed(3);
  }

  function updateCaptions(p) {
    for (var i = 0; i < bands.length; i++) {
      var b = bands[i];
      var f = Math.min(0.02, (b.b - b.a) / 3);
      var op = (b.first ? 1 : smoothstep(p, b.a, b.a + f)) *
               (b.last ? 1 : 1 - smoothstep(p, b.b - f, b.b));
      var ramp = b.ramp || Math.min(0.025, (b.b - b.a) * 0.35);
      var k = clamp((p - b.a) / ramp, 0, 1);
      if (b.first) k = Math.max(k, loadK);

      if (Math.abs(op - b.op) > 0.004) {
        b.op = op;
        b.el.style.opacity = op.toFixed(3);
        var hide = op < 0.02;
        if (hide !== b.hidden) {
          b.hidden = hide;
          b.el.classList.toggle('band-hidden', hide);
        }
      }
      if (Math.abs(k - b.k) > 0.008) {
        b.k = k;
        b.el.style.setProperty('--k', k.toFixed(3));
      }
    }
  }

  /* ---- ворота на seek, без дедлоку ---- */
  // Відео має скінченну частоту кадрів, тому перемотка з точністю до
  // мілісекунди це марна робота: браузер декодує той самий кадр знову.
  // Кладемо ціль на сітку кадрів і не чіпаємо відео, поки кадр той самий.
  var FRAME = 1 / (M.heroVideoFps || 25);
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
  video.addEventListener('error', function () { seekBusy = false; pendingTime = null; failVideo(); });

  /* ---- цикл, який відпочиває ---- */
  function tick(now) {
    var dt = Math.min(100, now - (lastTick || now));
    lastTick = now;
    // Складання першого рядка йде за годинником, а не за кадрами. Якщо
    // браузер на секунду загруз (наприклад, розбирає відео), перший
    // намальований кадр покаже слова там, де вони мають бути, а не порожньо.
    if (loadK < 1) loadK = Math.min(1, (now - loadStart) / 850);

    var k = 0.16;
    shown += (target - shown) * (1 - Math.pow(1 - k, dt / 16.667));

    if (Math.abs(target - shown) < 0.0005 && loadK >= 1) {
      shown = target; rafId = null; lastTick = 0;
    } else {
      rafId = requestAnimationFrame(tick);
    }
    if (video.duration) requestSeek(shown * video.duration);
    drawThread(shown);
    updateCaptions(shown);
  }

  function wake() {
    if (rafId === null && heroOnScreen) { lastTick = 0; rafId = requestAnimationFrame(tick); }
  }
  function onScroll() {
    target = heroProgress();
    if (!cueOff && window.scrollY > 60) { cueOff = true; hero.classList.add('scrolled'); }
    else if (cueOff && window.scrollY <= 60) { cueOff = false; hero.classList.remove('scrolled'); }
    wake();
  }

  /* ---- відео: вантажимо тільки якщо файл справді є ---- */
  var heroInited = false;
  function initHeroOnce() {
    if (heroInited) return;
    heroInited = true;
    if (!M.heroVideo) { hero.classList.add('no-video'); return; }
    if (M.heroPoster) posterLayer.style.backgroundImage = "url('" + M.heroPoster + "')";

    // Відео чекає двох речей: щоб постер уже був на екрані і щоб
    // відкриття встигло скластися. Розбір відео забирає головний потік,
    // і без цієї паузи перші слова зʼявляються із запізненням.
    var started = false, posterIn = false, openingDone = false;
    function startBlobFetch() {
      if (started || !posterIn || !openingDone) return;
      started = true;
      loadHeroBlob()['catch'](failVideo);
    }
    setTimeout(function () { openingDone = true; startBlobFetch(); }, 950);
    if (M.heroPoster) {
      var pi = new Image();
      pi.onload = pi.onerror = function () { posterIn = true; startBlobFetch(); };
      pi.src = M.heroPoster;
      setTimeout(function () { posterIn = true; startBlobFetch(); }, 4000);
    } else {
      posterIn = true;
      startBlobFetch();
    }
  }

  function loadHeroBlob() {
    var ctrl = new AbortController();
    var watchdog = setTimeout(function () { ctrl.abort(); }, 20000);
    return fetch(M.heroVideo, { signal: ctrl.signal }).then(function (res) {
      var total = Number(res.headers.get('Content-Length')) || M.heroVideoBytes || 8000000;
      var reader = res.body.getReader();
      var chunks = [], got = 0, lastRing = 0;
      return (function pump() {
        return reader.read().then(function (r) {
          if (r.done) return;
          clearTimeout(watchdog);
          watchdog = setTimeout(function () { ctrl.abort(); }, 20000);
          chunks.push(r.value);
          got += r.value.length;
          var frac = Math.min(1, got / total), now = performance.now();
          if (now - lastRing > 100 || frac === 1) {
            lastRing = now;
            ring.style.setProperty('--ld', Math.round(126 * (1 - frac)));
          }
          return pump();
        });
      })().then(function () {
        clearTimeout(watchdog);
        ring.style.setProperty('--ld', 0);
        video.src = URL.createObjectURL(new Blob(chunks));
        video.load();
        video.addEventListener('canplay', function () {
          requestSeek(heroProgress() * video.duration);
          stage.classList.add('video-ready');
          heroHasVideo = true;
          lastThread = -1;          // щоб намальована нитка встигла згаснути
          drawThread(shown);
        }, { once: true });
      });
    });
  }

  function failVideo() {
    hero.classList.add('no-video');
    stage.classList.add('video-failed');
    heroHasVideo = false;
    lastThread = -1;             // намальована нитка знову веде подорож
    drawThread(shown);
  }

  /* ===========================================================
     ПʼЯТЬ ВОРІТ НЕРУХОМОГО ГЕРОЯ
     Ці рядки мусять збігатися символ у символ із медіазапитом
     у кінці assets/style.css.
     =========================================================== */
  var GATES = [
    '(max-width: 720px)',
    '(orientation: portrait) and (max-width: 1024px)',
    '(orientation: portrait) and (pointer: coarse)',
    '(orientation: landscape) and (pointer: coarse) and (max-height: 560px)',
    '(prefers-reduced-motion: reduce)'
  ];

  function enableScrub() {
    if (scrubOn) return;
    scrubOn = true;
    measureHero();
    initHeroOnce();
    window.addEventListener('scroll', onScroll, { passive: true });
    bands.forEach(function (b) { b.op = -1; b.k = -1; b.hidden = null; });
    lastThread = -1;
    unpinFinalStates();
    updateCaptions(heroProgress());
    onScroll();
  }
  // Нерухомий герой отримує сам кадр, але ніколи не відео.
  // Це свідомий відступ від правила «телефон не тягне нічого»: картинка
  // важить близько 55 КБ, а без неї власник телефона не побачив би
  // жодного кадру зйомки.
  var staticInited = false;
  function initStaticOnce() {
    if (staticInited || !M.heroPoster) return;
    staticInited = true;
    posterLayer.style.backgroundImage = "url('" + M.heroPoster + "')";
    stage.classList.add('has-still');
  }

  function disableScrub() {
    if (!scrubOn) return;
    scrubOn = false;
    window.removeEventListener('scroll', onScroll);
    if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
    lastThread = -1;
    drawThread(1);          // спокійна пряма нитка, якщо кадру немає
    initStaticOnce();
  }
  function applyHeroMode() {
    var gated = GATES.some(function (q) { return matchMedia(q).matches; });
    if (gated) { disableScrub(); initStaticOnce(); } else enableScrub();
  }
  var MQLS = GATES.map(function (q) { return matchMedia(q); });
  MQLS.forEach(function (m) {
    if (m.addEventListener) m.addEventListener('change', applyHeroMode);
    else m.addListener(applyHeroMode);
  });

  if (hero) {
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) {
        heroOnScreen = es[0].isIntersecting;
        if (heroOnScreen && scrubOn) wake();
      }, { rootMargin: '120px' }).observe(hero);
    }
    window.addEventListener('resize', function () { measureHero(); if (scrubOn) onScroll(); }, { passive: true });
    drawThread(0);
    applyHeroMode();
  }

  /* ===========================================================
     ВХОДИ СЕКЦІЙ
     =========================================================== */
  $$('.sec, .foot').forEach(function (sec) {
    $$('.item', sec).forEach(function (el, i) { el.style.setProperty('--i', i); });
  });
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.06 });
    $$('.sec, .foot').forEach(function (s) { io.observe(s); });
  } else {
    $$('.sec, .foot').forEach(function (s) { s.classList.add('in'); });
  }

  /* ===========================================================
     СЛОТИ ПІД ФОТО
     Порожній слот малює дугу з тієї самої нитки.
     Заповнений слот показує фото і ховає підпис.
     =========================================================== */
  $$('.slot').forEach(function (fig) {
    var ratio = (fig.dataset.ratio || '4/5').split('/');
    var pad = (parseFloat(ratio[1]) / parseFloat(ratio[0]) * 100);
    if (isFinite(pad)) fig.style.setProperty('--pad', pad.toFixed(2) + '%');

    var src = M.photos[fig.dataset.media];
    if (src) {
      var img = document.createElement('img');
      img.alt = fig.dataset.alt || '';
      img.loading = 'lazy';
      img.decoding = 'async';
      // Розміри проставляємо з пропорції слота, інакше макет стрибає,
      // поки картинка ще їде.
      var rw = parseFloat(ratio[0]), rh = parseFloat(ratio[1]);
      if (isFinite(rw) && isFinite(rh)) {
        img.setAttribute('width', Math.round(rw * 600));
        img.setAttribute('height', Math.round(rh * 600));
      }
      fig.insertBefore(img, fig.firstChild);
      fig.classList.add('filled');
      // портрет у відгуку перебудовує секцію на розворот
      if (fig.classList.contains('rev-portrait')) {
        var rs = fig.closest('.sec');
        if (rs) rs.classList.add('has-portrait');
      }
      // Власне вікно завантаження: браузер за своїм lazy тягне картинки
      // за кілька тисяч пікселів наперед, і телефон качав усі вісім
      // ще на першому екрані.
      if ('IntersectionObserver' in window) {
        var io2 = new IntersectionObserver(function (es) {
          if (es[0].isIntersecting) { img.src = src; io2.disconnect(); }
        }, { rootMargin: '600px' });
        io2.observe(fig);
      } else {
        img.src = src;
      }
      return;
    }
    var seed = parseFloat(fig.dataset.seed || 1);
    var art = fig.querySelector('.slot-art');
    if (!art) return;
    art.innerHTML =
      '<svg viewBox="0 0 400 500" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' +
      '<path d="' + threadPath(1, {
        h: 500, cy: 250, sigma: 140, wave: 52, loopA: 44, loopL: 26, loops: 0.8,
        phase: seed * 1.27, steps: 42
      }) +
      '" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>';
  });

  /* ---- знак над відгуком: та сама нитка, тільки маленька ---- */
  (function () {
    var p = $('.qmark-line');
    if (!p) return;
    p.setAttribute('d', threadPath(1, {
      h: 220, cx: 60, cy: 110, sigma: 58, wave: 7,
      loopA: 33, loopL: 29, loops: 0.95, phase: 0.4, steps: 46
    }));
    try {
      var len = Math.ceil(p.getTotalLength());
      p.style.setProperty('--len', len);
    } catch (e) { /* без довжини просто не буде малювання, лінія лишиться на місці */ }
  })();

  /* ---- кадр із кінця відео працює як тиха підкладка ---- */
  (function () {
    var bg = $('.untie-bg');
    if (!bg || !M.heroEnding) return;
    var set = function () { bg.style.backgroundImage = "url('" + M.heroEnding + "')"; };
    if (!('IntersectionObserver' in window)) { set(); return; }
    // вантажимо тільки коли секція наближається, щоб телефон не тягнув її дарма
    var io = new IntersectionObserver(function (es) {
      if (es[0].isIntersecting) { set(); io.disconnect(); }
    }, { rootMargin: '300px' });
    io.observe($('.sec-untie'));
  })();

  /* ---- програвач студії: без автозапуску ---- */
  $$('.player').forEach(function (pl) {
    var src = M[pl.dataset.video];
    var btn = pl.querySelector('.player-btn');
    if (!src) {
      // Порожня рамка серед заповнених фото читається як дірка, тому
      // прибираємо її зовсім, а сусідні знімки робимо вищими, щоб блок
      // не осів. Зʼявиться файл, рамка повернеться сама.
      pl.hidden = true;
      var sec = pl.closest('.sec');
      if (sec) {
        sec.classList.add('no-video');
        $$('.studio-media .slot', sec).forEach(function (f) { f.style.setProperty('--pad', '125%'); });
      }
      return;
    }
    if (!btn) return;
    pl.classList.add('filled');
    btn.hidden = false;
    btn.addEventListener('click', function () {
      var v = document.createElement('video');
      v.src = src;
      v.controls = true;
      v.playsInline = true;
      v.preload = 'metadata';
      if (M.studioVideoPoster) v.poster = M.studioVideoPoster;
      pl.appendChild(v);
      btn.remove();
      v.play();
    });
  });

  /* ===========================================================
     ІНТЕРАКТИВНИЙ МОМЕНТ: розвʼязати вузол
     =========================================================== */
  var holdBtn = $('.hold'), untieSec = $('.sec-untie'),
      knotLine = $('.knot-line'), knotGlow = $('.knot-glow');
  var u = 0, holding = false, hRaf = null, hLast = 0, holdDone = false;
  var HOLD_MS = 1500;

  function drawKnot(v) {
    if (!knotLine) return;
    var d = threadPath(1 - v, {
      h: 520, cx: 200, cy: 260, sigma: 110, wave: 14,
      loopA: 116, loopL: 130, loops: 1.35, phase: 0.6 + v * 1.2, steps: 84
    });
    knotLine.setAttribute('d', d);
    knotGlow.setAttribute('d', d);
  }
  function holdTick(now) {
    var dt = Math.min(100, now - (hLast || now));
    hLast = now;
    if (holdDone) { u = 1; }
    else if (holding) u = Math.min(1, u + dt / HOLD_MS);
    else u = Math.max(0, u - dt / (HOLD_MS * 1.6));

    holdBtn.style.setProperty('--u', u.toFixed(3));
    drawKnot(u);

    if (u >= 1 && !holdDone) finishHold();
    if ((holding && u < 1) || (!holding && u > 0 && !holdDone)) {
      hRaf = requestAnimationFrame(holdTick);
    } else { hRaf = null; hLast = 0; }
  }
  function holdWake() { if (hRaf === null) { hLast = 0; hRaf = requestAnimationFrame(holdTick); } }
  function finishHold() {
    holdDone = true;
    u = 1;
    holdBtn.style.setProperty('--u', '1');
    holdBtn.classList.add('done');
    holdBtn.querySelector('.hold-label').textContent = 'Розвʼязано';
    untieSec.classList.add('done');
    drawKnot(1);
  }
  if (holdBtn) {
    drawKnot(0);
    var start = function (e) {
      if (holdDone) return;
      if (e && e.preventDefault) e.preventDefault();
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) { finishHold(); return; }
      holding = true; holdWake();
    };
    var stop = function () { if (holdDone) return; holding = false; holdWake(); };
    holdBtn.addEventListener('pointerdown', start);
    holdBtn.addEventListener('pointerup', stop);
    holdBtn.addEventListener('pointercancel', stop);
    holdBtn.addEventListener('pointerleave', stop);
    holdBtn.addEventListener('keydown', function (e) {
      if (e.repeat) return;
      if (e.key === ' ' || e.key === 'Enter') start(e);
    });
    holdBtn.addEventListener('keyup', function (e) {
      if (e.key === ' ' || e.key === 'Enter') stop();
    });
    holdBtn.addEventListener('click', function (e) { e.preventDefault(); });
  }

  /* ===========================================================
     КОНТАКТИ В ПІДВАЛІ
     =========================================================== */
  (function () {
    var map = {
      phone: CONTACT.phone ? { text: CONTACT.phone, href: 'tel:' + CONTACT.phone.replace(/[^\d+]/g, '') } : null,
      messenger: CONTACT.messenger ? { text: CONTACT.messengerLabel || 'Написати в месенджер', href: CONTACT.messenger } : null,
      address: CONTACT.address ? { text: CONTACT.address, href: '' } : null
    };
    $$('[data-contact]').forEach(function (el) {
      var v = map[el.dataset.contact];
      if (!v) return;
      if (v.href) {
        var a = document.createElement('a');
        a.href = v.href;
        a.textContent = v.text;
        if (v.href.indexOf('http') === 0) { a.target = '_blank'; a.rel = 'noopener'; }
        el.textContent = '';
        el.appendChild(a);
      } else {
        el.textContent = v.text;
      }
    });
  })();

  /* ===========================================================
     ФОРМА
     =========================================================== */
  var form = $('#book-form');
  if (form) {
    var done = $('.form-done', form);
    var doneText = $('.form-done-t', form);

    var setErr = function (id, msg) {
      var field = document.getElementById(id).closest('.field');
      var box = $('.err[data-for="' + id + '"]', form);
      field.classList.toggle('invalid', !!msg);
      if (box) box.textContent = msg || '';
      return !msg;
    };

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = $('#f-name').value.trim();
      var phone = $('#f-phone').value.trim();
      var okName = setErr('f-name', name ? '' : 'Напишіть, як до вас звертатися.');
      var digits = phone.replace(/\D/g, '');
      var okPhone = setErr('f-phone', digits.length >= 9 ? '' : 'Потрібен номер, щоб передзвонити.');
      if (!okName || !okPhone) {
        (okName ? $('#f-phone') : $('#f-name')).focus();
        return;
      }

      var data = {
        'Імʼя': name,
        'Телефон': phone,
        'Послуга': $('#f-serv').value,
        'Зручний час': $('#f-time').value,
        'Коментар': $('#f-note').value.trim()
      };

      if (FORM_MODE === 'mailto' && CONTACT.email) {
        var body = Object.keys(data).map(function (k) { return k + ': ' + data[k]; }).join('\n');
        window.location.href = 'mailto:' + CONTACT.email +
          '?subject=' + encodeURIComponent('Заявка на масаж: ' + name) +
          '&body=' + encodeURIComponent(body);
        show('Лист із заявкою відкрився у вашій поштовій програмі. Натисніть «надіслати», і ми його отримаємо.');
        return;
      }
      if (FORM_MODE === 'endpoint' && FORM_ENDPOINT) {
        fetch(FORM_ENDPOINT, {
          method: 'POST',
          headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        }).then(function () {
          show('Передзвонимо протягом дня і підтвердимо час.');
        })['catch'](function () {
          show('Заявка не пішла. Напишіть нам напряму, і ми вас запишемо.');
        });
        return;
      }
      show('Це демонстраційний макет, тому заявка нікуди не пішла. На справжньому сайті клініки тут було б підтвердження і дзвінок протягом дня.');
    });

    function show(msg) {
      doneText.textContent = msg;
      done.hidden = false;
      done.setAttribute('tabindex', '-1');
      done.focus();
    }
  }

  /* ===========================================================
     ЗМЕНШЕНИЙ РУХ І ПАУЗА
     =========================================================== */
  function pinToFinalStates() {
    document.body.classList.add('pinned');
    $$('.sec, .foot').forEach(function (s) { s.classList.add('in'); });
    if (holdBtn && !holdDone) finishHold();
  }
  function unpinFinalStates() {
    document.body.classList.remove('pinned');
  }
  var rmq = matchMedia('(prefers-reduced-motion: reduce)');
  var onRM = function (e) {
    if (e.matches) pinToFinalStates();
    else applyHeroMode();
  };
  if (rmq.addEventListener) rmq.addEventListener('change', onRM); else rmq.addListener(onRM);
  if (rmq.matches) pinToFinalStates();

  document.addEventListener('visibilitychange', function () {
    document.body.classList.toggle('paused', document.hidden);
  });

  /* ===========================================================
     ЛІЧИЛЬНИК ШВИДКОСТІ
     Вмикається тільки адресою з ?debug=1. Показує, скільки
     міліметрів часу йде на кадр саме на цій машині.
     =========================================================== */
  if (/[?&]debug=1/.test(location.search)) {
    var box = document.createElement('div');
    box.setAttribute('style',
      'position:fixed;left:10px;bottom:10px;z-index:999;padding:10px 12px;' +
      'font:12px/1.5 ui-monospace,monospace;white-space:pre;color:#F2F4EE;' +
      'background:rgba(20,26,22,.92);border-radius:10px;pointer-events:none');
    document.body.appendChild(box);

    var samples = [], seeks = 0, last = performance.now(), worst = 0;
    video.addEventListener('seeked', function () { seeks++; });

    var renderer = 'невідомо';
    try {
      var gl = document.createElement('canvas').getContext('webgl');
      var ext = gl && gl.getExtension('WEBGL_debug_renderer_info');
      if (ext) renderer = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL));
    } catch (e) { renderer = 'недоступно'; }
    var ua = navigator.userAgent;
    var browser = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' :
                  /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' :
                  /Safari\//.test(ua) ? 'Safari' : 'інший';

    // Браузер не малює кадри, поки вкладка у фоні. Такі паузи це не
    // гальмування сторінки, тому пропускаємо перший кадр після повернення
    // і не рахуємо розриви довші за секунду.
    var skipNext = false;
    document.addEventListener('visibilitychange', function () { skipNext = true; });
    addEventListener('blur', function () { skipNext = true; });

    (function loop(now) {
      var gap = now - last;
      last = now;
      if (skipNext || gap > 1000 || document.hidden) {
        skipNext = false;
        requestAnimationFrame(loop);
        return;
      }
      samples.push(gap);
      if (gap > worst) worst = Math.round(gap);
      if (samples.length >= 45) {
        var s = samples.slice().sort(function (a, b) { return a - b; });
        var p = function (q) { return Math.round(s[Math.floor(s.length * q)]); };
        box.textContent =
          'кадр: ' + p(0.5) + ' мс (типово)\n' +
          'важкий: ' + p(0.9) + ' мс\n' +
          'найгірший: ' + worst + ' мс\n' +
          'кадрів за секунду: ' + Math.round(1000 / Math.max(1, p(0.5))) + '\n' +
          'перемоток: ' + seeks + '\n' +
          'відео: ' + (video.videoWidth || 0) + 'x' + (video.videoHeight || 0) +
          (stage.classList.contains('video-ready') ? ' готове' : ' ще ні') + '\n' +
          'екран: ' + innerWidth + 'x' + innerHeight + ' @' + (devicePixelRatio || 1) + 'x\n' +
          'браузер: ' + browser + '\n' +
          'малює: ' + renderer.slice(0, 46);
        samples = [];
        seeks = 0;
      }
      requestAnimationFrame(loop);
    })(performance.now());
  }
})();
