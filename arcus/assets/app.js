/* ===========================================================
   ARCUS · ортодонтія та елайнери
   Простий HTML, CSS і ванільний JavaScript. Без збірки.
   =========================================================== */
(function () {
  'use strict';
  document.documentElement.classList.add('js');

  /* -----------------------------------------------------------
     НАЛАШТУВАННЯ. Тут міняється все, що стосується контактів
     і того, куди йде заявка з форми.
     Бренд вигаданий, сайт зроблено для портфоліо.
     ----------------------------------------------------------- */
  var CONTACT = {
    phone: '+380 32 245 04 50',
    email: '',                 // куди приходять заявки в режимі mailto
    address: 'Львів, вул. Городоцька 120'
  };

  // 'demo'     заявка нікуди не йде, екран успіху каже про це чесно
  // 'mailto'   відкриється поштова програма відвідувача
  // 'endpoint' заявка йде POST-запитом на FORM_ENDPOINT (наприклад Formspree)
  var FORM_MODE = 'demo';
  var FORM_ENDPOINT = '';

  var M = window.ARCUS_MEDIA || {};

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
  var reduced = function () { return matchMedia('(prefers-reduced-motion: reduce)').matches; };

  /* ===========================================================
     ПИЛ СВІТЛА
     Зерно стале, тому вигляд однаковий при кожному завантаженні.
     =========================================================== */
  (function () {
    var box = $('.motes');
    if (!box || reduced()) return;
    var rand = rng(20260902), html = '';
    for (var i = 0; i < 14; i++) {
      html += '<i style="left:' + (rand() * 100).toFixed(1) + '%;top:' +
              (58 + rand() * 62).toFixed(1) + '%;animation-duration:' +
              (70 + rand() * 48).toFixed(0) + 's;animation-delay:-' +
              (rand() * 92).toFixed(0) + 's"></i>';
    }
    box.innerHTML = html;
  })();

  /* ===========================================================
     РОЗБИТТЯ ТЕКСТУ на слова і літери, один раз при завантаженні
     Кожен вхід читає свої власні пороги --th.
     =========================================================== */
  function splitText(el, entrance, emIndexes) {
    var text = el.textContent.replace(/\s+/g, ' ').trim();
    var rand = rng(text.length * 977 + 41);
    var words = text.split(' ');
    var em = {};
    (emIndexes || '').split(',').forEach(function (n) {
      n = parseInt(n, 10);
      if (!isNaN(n)) em[n] = 1;
    });

    var sr = document.createElement('span');
    sr.className = 'sr-only';
    sr.textContent = text;

    var vis = document.createElement('span');
    vis.className = 'vis';
    vis.setAttribute('aria-hidden', 'true');

    words.forEach(function (word, wi) {
      var w = document.createElement('span');
      w.className = 'w' + (em[wi] ? ' em' : '');
      // поріг на слово: порядок читання плюс дрібний розкид
      if (entrance === 'punch' || entrance === 'drift' || entrance === 'rise') {
        w.style.setProperty('--th',
          (wi / Math.max(1, words.length) * 0.52 + rand() * 0.05).toFixed(3));
      }
      for (var i = 0; i < word.length; i++) {
        var c = document.createElement('span');
        c.className = 'c';
        c.textContent = word[i];
        // розсип: кожен символ злітається зі свого зсуву, як зуб у кадрі
        if (entrance === 'scatter') {
          c.style.setProperty('--th', (rand() * 0.55).toFixed(3));
          c.style.setProperty('--jx', ((rand() - 0.5) * 90).toFixed(1) + 'px');
          c.style.setProperty('--jy', ((rand() - 0.5) * 70).toFixed(1) + 'px');
          c.style.setProperty('--jr', ((rand() - 0.5) * 34).toFixed(1) + 'deg');
        }
        w.appendChild(c);
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
      plate = $('.plate'), posterLayer = $('.poster'), ring = $('.ring'),
      stageFill = $('.stage-fill'), stageFillEnd = $('.stage-fill-end'),
      surround = $('.surround');

  var bands = $$('.band').map(function (el) {
    var h = el.querySelector('.split');
    if (h) splitText(h, el.dataset.entrance, el.dataset.em);
    return {
      el: el,
      a: parseFloat(el.dataset.a),
      b: parseFloat(el.dataset.b),
      first: el.dataset.first === '1',
      last: parseFloat(el.dataset.b) >= 1,
      ramp: el.dataset.ramp ? parseFloat(el.dataset.ramp) : 0.04,
      op: -1, k: -1, hidden: null
    };
  });

  var target = 0, shown = 0, rafId = null, lastTick = 0, loadK = 0;
  var loadStart = performance.now();
  var heroOnScreen = true, scrubOn = false, cueOff = false, lastZoom = -9, lastLift = -99, lastFill = -9;

  var heroRange = 0;
  function measureHero() {
    heroRange = hero ? hero.offsetHeight - window.innerHeight : 0;
  }
  function heroProgress() {
    // offsetHeight змінюється лише на resize, тому міряємо один раз і кешуємо.
    // Читати геометрію на кожній події скролу означає синхронний reflow.
    if (!hero || heroRange <= 0) return 0;
    return clamp(-hero.getBoundingClientRect().top / heroRange, 0, 1);
  }

  /* ---- прогрес у час відео ----
     Тут відображення пряме, і це навмисно. Заміряний рух по кадрах
     показав, що після обрізки на 5.2 секунди кінець сідає у справжній
     спокій сам: крива тримається на 1.18 до 1.48 і не розганяється.
     На NOVA довелось гальмувати хвіст штучно, бо там зуб крутився
     сталою швидкістю до останнього кадру. Тут гальмувати нічого. */
  function timeAt(p, dur) { return dur * p; }

  /* ---- як живе сам кадр ----
     Дуга росте назустріч глядачеві, поки складається, а на фініші
     кадр сідає назад і підіймається, відкриваючи чашу під дугою
     для назви й кнопок. Обидва рухи це чистий transform. */
  // Стиск у фіналі навмисно неглибокий. На 0.83 кадр відходив від країв
  // сцени так далеко, що на вузьких високих вікнах ставали видні його
  // бічні межі. На 0.92 чаша під дугою відкривається так само, бо решту
  // роботи робить підйом, а межі лишаються за краєм екрана.
  function zoomAt(p) { return 1 + 0.05 * smoothstep(p, 0, 0.70) - 0.13 * smoothstep(p, 0.74, 0.98); }
  function liftAt(p) { return -11 * smoothstep(p, 0.74, 0.98); }

  /* Тло сцени навмисно СТАТИЧНЕ. Перша версія переписувала кінці
     градієнта на кожному кроці прокрутки, і кожен такий запис це повний
     перефарб градієнта на весь екран, сотні разів за прохід героя.
     Тон тепер веде розмита підкладка, яка міняється прозорістю, а
     прозорість компонується без перефарбу. */

  function updateCaptions(p) {
    for (var i = 0; i < bands.length; i++) {
      var b = bands[i];
      var f = Math.min(0.02, (b.b - b.a) / 3);
      var op = (b.first ? 1 : smoothstep(p, b.a, b.a + f)) *
               (b.last ? 1 : 1 - smoothstep(p, b.b - f, b.b));
      var k = clamp((p - b.a) / b.ramp, 0, 1);
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

    var z = zoomAt(p);
    if (Math.abs(z - lastZoom) > 0.0015) {
      lastZoom = z;
      // Пишемо на сцену, а не на плиту: підкладка теж їх читає,
      // і рухається разом із кадром.
      surround.style.setProperty('--zoom', z.toFixed(4));
    }
    var lf = liftAt(p);
    if (Math.abs(lf - lastLift) > 0.05) {
      lastLift = lf;
      surround.style.setProperty('--lift', lf.toFixed(2) + '%');
    }
    // Підкладка йде за тоном кадру: кінцевий кадр проступає рівно
    // настільки, наскільки просунувся прокрут. Разом із ним їдуть і
    // кінці градієнта сцени, знятi піпеткою з кутів обох кадрів.
    if (stageFillEnd && Math.abs(p - lastFill) > 0.004) {
      lastFill = p;
      stageFillEnd.style.setProperty('--fend', p.toFixed(3));
    }
  }

  /* ---- ворота на seek, без дедлоку ---- */
  // Відео має скінченну частоту кадрів, тому перемотка з точністю до
  // мілісекунди це марна робота: браузер декодує той самий кадр знову.
  // Кладемо ціль на сітку кадрів і не чіпаємо відео, поки кадр той самий.
  var FRAME = 1 / (M.heroVideoFps || 24);
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

  /* ---- цикл, який відпочиває ---- */
  function tick(now) {
    var dt = Math.min(100, now - (lastTick || now));
    lastTick = now;
    // Складання першого рядка йде за годинником, а не за кадрами. Якщо
    // браузер на мить загруз (наприклад, розбирає відео), перший
    // намальований кадр покаже слова там, де вони мають бути.
    if (loadK < 1) loadK = Math.min(1, (now - loadStart) / 900);

    var k = 0.16;
    shown += (target - shown) * (1 - Math.pow(1 - k, dt / 16.667));

    if (Math.abs(target - shown) < 0.0005 && loadK >= 1) {
      shown = target; rafId = null; lastTick = 0;
    } else {
      rafId = requestAnimationFrame(tick);
    }
    if (video.duration) requestSeek(timeAt(shown, video.duration));
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

  /* ---- відео: вантажимо тільки на тих екранах, де воно грає ---- */
  var heroInited = false;
  function initHeroOnce() {
    if (heroInited) return;
    heroInited = true;
    if (!M.heroVideo) { failVideo(); return; }
    if (M.heroPoster) {
      posterLayer.style.backgroundImage = "url('" + M.heroPoster + "')";
      if (stageFill) stageFill.style.backgroundImage = "url('" + M.heroPoster + "')";
    }
    if (M.heroEnding && stageFillEnd) {
      stageFillEnd.style.backgroundImage = "url('" + M.heroEnding + "')";
    }

    // Відео чекає двох речей: щоб постер уже був на екрані і щоб
    // відкриття встигло скластися. Розбір відео забирає головний потік.
    var started = false, posterIn = false, openingDone = false;
    function startBlobFetch() {
      if (started || !posterIn || !openingDone) return;
      started = true;
      loadHeroBlob()['catch'](failVideo);
    }
    setTimeout(function () { openingDone = true; startBlobFetch(); }, 900);
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
    // Багато хостів мовчки не вміють часткове завантаження, і тоді кожна
    // перемотка падає в нуль. Тягнемо файл цілком у пам'ять, це працює скрізь.
    var ctrl = new AbortController();
    var watchdog = setTimeout(function () { ctrl.abort(); }, 20000);
    return fetch(M.heroVideo, { signal: ctrl.signal }).then(function (res) {
      var total = Number(res.headers.get('Content-Length')) || M.heroVideoBytes || 1800000;
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
          requestSeek(timeAt(heroProgress(), video.duration));
          stage.classList.add('video-ready');
        }, { once: true });
      });
    });
  }

  function failVideo() {
    // Кадр не прийшов. Сторінка лишається цілою: постер несе героя далі,
    // а замість кільця стає чесна підказка гортати.
    stage.classList.add('video-failed');
    if (M.heroPoster && !posterLayer.style.backgroundImage) {
      posterLayer.style.backgroundImage = "url('" + M.heroPoster + "')";
    }
  }

  /* ===========================================================
     П'ЯТЬ ВОРІТ НЕРУХОМОГО ГЕРОЯ
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

  // Нерухомий герой отримує кадр, але ніколи не відео. Картинка важить
  // близько 42 КБ, а без неї власник телефона не побачив би зйомки взагалі.
  var staticInited = false, staticShot = $('.static-shot');
  function initStaticOnce() {
    if (staticInited || !M.heroEnding) return;
    staticInited = true;
    if (staticShot) staticShot.style.backgroundImage = "url('" + M.heroEnding + "')";
    stage.classList.add('has-still');
  }

  function enableScrub() {
    if (scrubOn) return;
    scrubOn = true;
    stage.classList.remove('has-still');
    measureHero();
    initHeroOnce();
    window.addEventListener('scroll', onScroll, { passive: true });
    bands.forEach(function (b) { b.op = -1; b.k = -1; b.hidden = null; });
    lastZoom = -9; lastLift = -99; lastFill = -9;
    unpinFinalStates();
    updateCaptions(heroProgress());
    onScroll();
  }
  function disableScrub() {
    if (!scrubOn) return;
    scrubOn = false;
    window.removeEventListener('scroll', onScroll);
    if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
  }
  function applyHeroMode() {
    var gated = GATES.some(function (q) { return matchMedia(q).matches; });
    if (gated) { disableScrub(); initStaticOnce(); } else { enableScrub(); }
  }
  // Списки запитів тримаємо в змінній: незалучені колись губили слухачів.
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
    window.addEventListener('resize', function () {
      measureHero();
      if (scrubOn) onScroll();
    }, { passive: true });
    applyHeroMode();
  }

  /* ===========================================================
     ДУГИ СТАДІЙ У СЕКЦІЇ КУРСУ
     Під кожну домальовуємо бліду повну дугу, щоб чверть читалась
     як чверть шляху, а не як уламок знака. Робимо це кодом, аби не
     дублювати той самий шлях чотири рази в розмітці.
     =========================================================== */
  $$('.stage-mark').forEach(function (svg) {
    var arc = svg.querySelector('.arc');
    if (!arc) return;
    var track = arc.cloneNode(false);
    track.setAttribute('class', 'track');
    svg.insertBefore(track, arc);
  });

  /* ===========================================================
     ВХОДИ СЕКЦІЙ
     =========================================================== */
  $$('.sec, .foot, .divider').forEach(function (sec) {
    $$('.reveal', sec).forEach(function (el, i) { el.style.setProperty('--i', i); });
  });
  function settleSection(sec) {
    var n = $$('.reveal', sec).length;
    setTimeout(function () { sec.classList.add('settled'); }, 80 * n + 900);
  }
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('in');
        settleSection(e.target);
        io.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.05 });
    $$('.sec, .foot, .divider').forEach(function (s) { io.observe(s); });
  } else {
    $$('.sec, .foot, .divider').forEach(function (s) { s.classList.add('in', 'settled'); });
  }

  /* ===========================================================
     ІНТЕРАКТИВНИЙ МОМЕНТ: ВТРИМАЙТЕ РЯД
     Відвідувач руками проживає премису сайту. Тримає, і ряд
     стоїть. Відпускає раніше, і ряд роз'їжджається назад.
     =========================================================== */
  (function () {
    var box = $('#hold');
    if (!box) return;
    var btn = $('#hold-btn'), teeth = $('.teeth', box), wire = $('.wire', box),
        num = $('#hold-num'), state = $('#hold-state'), live = $('#hold-live'),
        marks = $$('.hold-marks li', box);

    var MONTHS = 24, UP_MS = 3400, DOWN_MS = 2400;
    // Довжину дроту питаємо в самого шляху: підганяти її на око означає
    // або обрізаний дріт, або дріт, що домальовується після кінця.
    var WIRE_LEN = Math.ceil(wire.getTotalLength());
    wire.style.strokeDasharray = WIRE_LEN;

    var TOOTH = 'M-21,-32 C-21,-45 21,-45 21,-32 L21,-14 C21,-8 18,-4 16,4 ' +
                'L12,27 C11,32 4,32 3,27 L1,6 L-1,6 L-3,27 C-4,32 -11,32 -12,27 ' +
                'L-16,4 C-18,-4 -21,-8 -21,-14 Z';

    // Дев'ять зубів сідають на ту саму дугу, що й дріт: парабола з
    // вершиною (450,90) і кінцями на y=230. Кожен повернутий по дотичній.
    var rand = rng(4242), items = [];
    for (var i = -4; i <= 4; i++) {
      var x = 450 + i * 88;
      var u = (x - 450) / 352;
      var y = 90 + 140 * u * u;
      var slope = 2 * 140 * u / 352;
      var g = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      g.setAttribute('class', 'th');
      g.setAttribute('d', TOOTH);
      g.style.setProperty('--x', x.toFixed(1) + 'px');
      g.style.setProperty('--y', y.toFixed(1) + 'px');
      g.style.setProperty('--br', (Math.atan(slope) * 180 / Math.PI).toFixed(1) + 'deg');
      g.style.setProperty('--ox', ((rand() - 0.5) * 26).toFixed(1) + 'px');
      g.style.setProperty('--oy', ((rand() - 0.5) * 32).toFixed(1) + 'px');
      g.style.setProperty('--or', ((rand() - 0.5) * 30).toFixed(1) + 'deg');
      teeth.appendChild(g);
      items.push(g);
    }

    var p = 0, engaged = false, locked = false, pressing = false;
    var raf = null, last = 0, lastNum = -1, lastState = '', lastDrift = -1;

    function paintDrift(d) {
      if (Math.abs(d - lastDrift) < 0.004) return;
      lastDrift = d;
      teeth.style.setProperty('--drift', d.toFixed(3));
    }
    function say(txt) {
      if (txt === lastState) return;
      lastState = txt;
      state.textContent = txt;
    }
    function paint() {
      var m = Math.round(p * MONTHS);
      if (m !== lastNum) {
        lastNum = m;
        num.textContent = m;
        marks.forEach(function (li) {
          li.classList.toggle('on', m >= parseInt(li.dataset.at, 10));
        });
        if (live && (m === 6 || m === 12 || m === 24 || m === 0)) {
          live.textContent = m + ' місяців ретенції';
        }
      }
      wire.style.strokeDashoffset = (WIRE_LEN * (1 - p)).toFixed(1);
      // На майже нульовому прогресі від дроту лишається куций хвостик,
      // який читається як помилка малювання, а не як початок дроту.
      wire.style.opacity = Math.min(1, p * 6).toFixed(3);
      // Поки відвідувач не торкався, ряд стоїть рівно. Щойно торкнувся,
      // ряд тримається лише на прогресі: відпустив, і зуби роз'їхались.
      paintDrift(engaged && !locked ? (1 - p) : 0);
    }

    function loop(now) {
      var dt = Math.min(100, now - (last || now));
      last = now;
      if (pressing) p = Math.min(1, p + dt / UP_MS);
      else p = Math.max(0, p - dt / DOWN_MS);

      if (p >= 1 && !locked) {
        locked = true; pressing = false;
        box.classList.add('locked');
        btn.classList.remove('pressing');
        btn.textContent = 'Утримано';
        btn.setAttribute('aria-pressed', 'true');
      }
      if (locked) say('Ряд утримано. Саме так це працює в житті.');
      else if (pressing) say('Тримаєте. Кістка твердне навколо кожного кореня.');
      else if (p > 0.02) say('Ряд поїхав назад.');
      else say(engaged ? 'Ряд роз’їхався. Спробуйте ще раз і не відпускайте.' : 'Ряд стоїть рівно. Поки що.');

      paint();
      if (locked || (!pressing && p <= 0)) { raf = null; last = 0; return; }
      raf = requestAnimationFrame(loop);
    }
    function wake() {
      if (raf === null) { last = 0; raf = requestAnimationFrame(loop); }
    }

    function press(e) {
      if (locked) return;
      if (e && e.type === 'pointerdown') e.preventDefault();
      engaged = true; pressing = true;
      btn.classList.add('pressing');
      wake();
    }
    function release() {
      if (locked || !pressing) return;
      pressing = false;
      btn.classList.remove('pressing');
      wake();
    }

    btn.addEventListener('pointerdown', press);
    btn.addEventListener('pointerup', release);
    btn.addEventListener('pointercancel', release);
    btn.addEventListener('pointerleave', release);
    btn.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    // Клавіатура: пробіл або Enter тримають так само, як палець.
    btn.addEventListener('keydown', function (e) {
      if (e.key === ' ' || e.key === 'Enter' || e.key === 'Spacebar') { e.preventDefault(); press(); }
    });
    btn.addEventListener('keyup', function (e) {
      if (e.key === ' ' || e.key === 'Enter' || e.key === 'Spacebar') { e.preventDefault(); release(); }
    });
    btn.addEventListener('blur', release);
    // Кнопка це button, тому клік приходить і після пробілу. Гасимо його,
    // інакше він переривав би утримання.
    btn.addEventListener('click', function (e) { e.preventDefault(); });

    function finishNow() {
      p = 1; locked = true; pressing = false;
      box.classList.add('locked');
      btn.textContent = 'Утримано';
      btn.setAttribute('aria-pressed', 'true');
      say('Ряд утримано. Саме так це працює в житті.');
      paint();
    }
    if (reduced()) finishNow();
    box.finishNow = finishNow;
    paint();
  })();

  /* ===========================================================
     ФОРМА
     =========================================================== */
  (function () {
    var form = $('#book-form');
    if (!form) return;
    var done = $('.form-done', form), doneText = $('.form-done-t', form);

    function setErr(id, msg) {
      var field = document.getElementById(id).closest('.field');
      var box = $('.err[data-for="' + id + '"]', form);
      field.classList.toggle('invalid', !!msg);
      document.getElementById(id).setAttribute('aria-invalid', msg ? 'true' : 'false');
      if (box) box.textContent = msg || '';
      return !msg;
    }
    /* Успіх показуємо вікном, а не рядком під кнопкою: рядок легко
       не помітити, надто коли поштова програма в ту саму мить забирає
       увагу на себе. Заголовок і два абзаци різні для кожного режиму
       форми, тому show бере їх параметрами. */
    var dlg = $('#thanks'), dlgH = $('#thanks-h'), dlgP = $('#thanks-p'), dlgQ = $('#thanks-q');

    function show(head, msg, quiet) {
      if (dlg && dlg.showModal) {
        if (dlgH) dlgH.textContent = head;
        if (dlgP) dlgP.textContent = msg;
        if (dlgQ) dlgQ.textContent = quiet || '';
        try { dlg.showModal(); return; } catch (e) { /* нижче запасний варіант */ }
      }
      // Браузер без dialog. Сторінка не мовчить: лишається той самий
      // блок під формою, що був тут раніше.
      doneText.textContent = head + ' ' + msg + (quiet ? ' ' + quiet : '');
      done.hidden = false;
      done.setAttribute('tabindex', '-1');
      done.focus();
    }

    if (dlg) {
      var dlgClose = $('#thanks-close');
      if (dlgClose) dlgClose.addEventListener('click', function () { dlg.close(); });
      // Ціль події збігається з самим dialog лише при натисканні в
      // підкладку: вміст лежить у дочірніх вузлах.
      dlg.addEventListener('click', function (ev) {
        if (ev.target === dlg) dlg.close();
      });
    }

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
        'Коментар': $('#f-note').value.trim()
      };

      if (FORM_MODE === 'mailto' && CONTACT.email) {
        var body = Object.keys(data).map(function (k) { return k + ': ' + data[k]; }).join('\n');
        window.location.href = 'mailto:' + CONTACT.email +
          '?subject=' + encodeURIComponent('Запис на консультацію: ' + name) +
          '&body=' + encodeURIComponent(body);
        show('Лист відкрився у пошті.',
              'Натисніть у поштовій програмі «надіслати», і заявка прийде нам.');
        return;
      }
      if (FORM_MODE === 'endpoint' && FORM_ENDPOINT) {
        fetch(FORM_ENDPOINT, {
          method: 'POST',
          headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        }).then(function () {
          show('Дякуємо, записали.',
            'Передзвонимо протягом години, з 9:00 до 20:00.');
        })['catch'](function () {
          show('Заявка не пішла.',
            'Зв’язок обірвався дорогою. Подзвоніть нам напряму, і ми вас запишемо.');
        });
        return;
      }
      show('Дякуємо, записали.',
          'Передзвонимо протягом години, з 9:00 до 20:00.',
          'Це показовий макет вигаданої клініки, тому заявка нікуди не пішла. На справжньому сайті тут була б справжня заявка і справжній дзвінок.');
    });
  })();

  /* ===========================================================
     ЗМЕНШЕНИЙ РУХ І ПАУЗА
     Живе перемикання в обидва боки: увімкнули посеред сеансу,
     все стає в кінцевий стан; вимкнули, привід повертається.
     =========================================================== */
  function pinToFinalStates() {
    document.body.classList.add('pinned');
    $$('.sec, .foot, .divider').forEach(function (s) { s.classList.add('in', 'settled'); });
    var h = $('#hold');
    if (h && h.finishNow) h.finishNow();
  }
  function unpinFinalStates() {
    document.body.classList.remove('pinned');
  }
  var rmq = matchMedia('(prefers-reduced-motion: reduce)');
  function onRM(e) {
    if (e.matches) pinToFinalStates();
    else applyHeroMode();
  }
  if (rmq.addEventListener) rmq.addEventListener('change', onRM); else rmq.addListener(onRM);
  if (rmq.matches) pinToFinalStates();

  document.addEventListener('visibilitychange', function () {
    document.body.classList.toggle('paused', document.hidden);
  });

  /* ===========================================================
     ЛІЧИЛЬНИК ШВИДКОСТІ
     Вмикається тільки адресою з ?debug=1.
     =========================================================== */
  if (/[?&]debug=1/.test(location.search)) {
    var dbg = document.createElement('div');
    dbg.setAttribute('style',
      'position:fixed;left:10px;bottom:10px;z-index:999;padding:10px 12px;' +
      'font:12px/1.5 ui-monospace,monospace;white-space:pre;color:#12161E;' +
      'background:rgba(244,246,250,.94);border:1px solid rgba(18,22,30,.2);' +
      'border-radius:10px;pointer-events:none');
    document.body.appendChild(dbg);

    var samples = [], seeks = 0, lastF = performance.now(), worst = 0;
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

    var skipNext = false;
    document.addEventListener('visibilitychange', function () { skipNext = true; });
    addEventListener('blur', function () { skipNext = true; });

    (function loopD(now) {
      var gap = now - lastF;
      lastF = now;
      if (skipNext || gap > 1000 || document.hidden) {
        skipNext = false;
        requestAnimationFrame(loopD);
        return;
      }
      samples.push(gap);
      if (gap > worst) worst = Math.round(gap);
      if (samples.length >= 45) {
        var s = samples.slice().sort(function (a, b) { return a - b; });
        var q = function (v) { return Math.round(s[Math.floor(s.length * v)]); };
        dbg.textContent =
          'кадр: ' + q(0.5) + ' мс (типово)\n' +
          'важкий: ' + q(0.9) + ' мс\n' +
          'найгірший: ' + worst + ' мс\n' +
          'кадрів за секунду: ' + Math.round(1000 / Math.max(1, q(0.5))) + '\n' +
          'перемоток: ' + seeks + '\n' +
          'відео: ' + (video.videoWidth || 0) + 'x' + (video.videoHeight || 0) +
          (stage.classList.contains('video-ready') ? ' готове' : ' ще ні') + '\n' +
          'екран: ' + innerWidth + 'x' + innerHeight + ' @' + (devicePixelRatio || 1) + 'x\n' +
          'браузер: ' + browser + '\n' +
          'малює: ' + renderer.slice(0, 46);
        samples = [];
        seeks = 0;
      }
      requestAnimationFrame(loopD);
    })(performance.now());
  }
})();
