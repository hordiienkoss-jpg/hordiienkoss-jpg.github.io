/* ===========================================================
   NOVA DENT · імплантація та естетика
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
    phone: '+380 44 337 20 20',
    email: '',                 // куди приходять заявки в режимі mailto
    address: 'Київ, вул. Антоновича 48'
  };

  // 'demo'     заявка нікуди не йде, екран успіху каже про це чесно
  // 'mailto'   відкриється поштова програма відвідувача
  // 'endpoint' заявка йде POST-запитом на FORM_ENDPOINT (наприклад Formspree)
  var FORM_MODE = 'demo';
  var FORM_ENDPOINT = '';

  var M = window.NOVA_MEDIA || {};

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
     Чотирнадцять цяток, зерно стале, тому вигляд однаковий
     при кожному завантаженні.
     =========================================================== */
  (function () {
    var box = $('.motes');
    if (!box || reduced()) return;
    var rand = rng(20260831), html = '';
    for (var i = 0; i < 14; i++) {
      html += '<i style="left:' + (rand() * 100).toFixed(1) + '%;top:' +
              (60 + rand() * 60).toFixed(1) + '%;animation-duration:' +
              (68 + rand() * 46).toFixed(0) + 's;animation-delay:-' +
              (rand() * 90).toFixed(0) + 's"></i>';
    }
    box.innerHTML = html;
  })();

  /* ===========================================================
     РОЗБИТТЯ ТЕКСТУ на слова і літери, один раз при завантаженні
     Кожен вхід читає свої власні пороги --th.
     =========================================================== */
  function splitText(el, entrance, emIndexes, ltIndexes) {
    var text = el.textContent.replace(/\s+/g, ' ').trim();
    var rand = rng(text.length * 977 + 41);
    var words = text.split(' ');
    var em = {}, lt = {};
    (emIndexes || '').split(',').forEach(function (n) {
      n = parseInt(n, 10);
      if (!isNaN(n)) em[n] = 1;
    });
    // слова, які йдуть тихішим кольором (друга половина логотипа)
    (ltIndexes || '').split(',').forEach(function (n) {
      n = parseInt(n, 10);
      if (!isNaN(n)) lt[n] = 1;
    });

    var sr = document.createElement('span');
    sr.className = 'sr-only';
    sr.textContent = text;

    var vis = document.createElement('span');
    vis.className = 'vis';
    vis.setAttribute('aria-hidden', 'true');

    words.forEach(function (word, wi) {
      var w = document.createElement('span');
      w.className = 'w' + (em[wi] ? ' em' : '') + (lt[wi] ? ' lt' : '');
      // поріг на слово: порядок читання плюс дрібний розкид
      if (entrance === 'punch' || entrance === 'drift' || entrance === 'rise') {
        w.style.setProperty('--th',
          (wi / Math.max(1, words.length) * 0.52 + rand() * 0.05).toFixed(3));
      }
      for (var i = 0; i < word.length; i++) {
        var c = document.createElement('span');
        c.className = 'c';
        c.textContent = word[i];
        w.appendChild(c);
      }
      vis.appendChild(w);
      if (wi < words.length - 1) vis.appendChild(document.createTextNode(' '));
    });

    el.textContent = '';
    el.appendChild(sr);

    // мла розходиться: під різкою копією лежить нерухомо розмита.
    // filter не анімуємо ніколи, він не дружить з композитором.
    if (entrance === 'blur') {
      var soft = vis.cloneNode(true);
      soft.className = 'vis soft';
      el.appendChild(soft);
    }
    el.appendChild(vis);
  }

  /* ===========================================================
     ГЕРОЙ
     =========================================================== */
  var hero = $('.hero'), stage = $('.stage'), video = $('#hero-video'),
      plate = $('.plate'), posterLayer = $('.poster'), ring = $('.ring');

  var bands = $$('.band').map(function (el) {
    var h = el.querySelector('.split');
    if (h) splitText(h, el.dataset.entrance, el.dataset.em, el.dataset.lt);
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
  var heroOnScreen = true, scrubOn = false, cueOff = false, lastSettle = -1, lastPx = -99;

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

  /* ---- прогрес у час відео, нелінійно ----
     Заміряний рух по кадрах показав рівну криву від початку до кінця:
     зуб обертається сталою швидкістю і ніде не сідає у спокій.
     Тому останні 20 відсотків скролу проходять лише 3 відсотки
     тривалості, з нульовим нахилом на самому кінці. Сторінка сідає
     у справжню зупинку, а файл лишається цілим. */
  var T_KNEE = 0.80, T_HEAD = 0.97;
  function timeAt(p, dur) {
    if (p <= T_KNEE) return dur * T_HEAD * (p / T_KNEE);
    var x = (p - T_KNEE) / (1 - T_KNEE);
    return dur * (T_HEAD + (1 - T_HEAD) * (1 - (1 - x) * (1 - x)));
  }

  /* ---- куди їде зуб ----
     Ключові позиції в частках від ширини сцени: праворуч під ліву
     колонку, ліворуч під праву, знову праворуч, і по центру на фініші.
     Між ключами йде smoothstep, тому рух ніде не смикається. */
  var PX_KEYS = [[0.00, 1], [0.16, 1], [0.37, -1], [0.50, -1], [0.63, 1], [0.72, 1], [0.86, 0], [1.00, 0]];
  var PX_AMP = 16;
  function plateX(p) {
    for (var i = 0; i < PX_KEYS.length - 1; i++) {
      var a = PX_KEYS[i], b = PX_KEYS[i + 1];
      if (p <= b[0]) return a[1] + (b[1] - a[1]) * smoothstep(p, a[0], b[0]);
    }
    return PX_KEYS[PX_KEYS.length - 1][1];
  }

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

    // зуб від'їжджає в темряву, і знизу відкривається місце під назву
    var s = smoothstep(p, 0.76, 0.98);
    if (Math.abs(s - lastSettle) > 0.004) {
      lastSettle = s;
      plate.style.setProperty('--settle', s.toFixed(3));
    }
    var px = plateX(p) * PX_AMP;
    if (Math.abs(px - lastPx) > 0.06) {
      lastPx = px;
      plate.style.setProperty('--px', px.toFixed(2));
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
    if (loadK < 1) loadK = Math.min(1, (now - loadStart) / 850);

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
    if (M.heroPoster) posterLayer.style.backgroundImage = "url('" + M.heroPoster + "')";

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
      var total = Number(res.headers.get('Content-Length')) || M.heroVideoBytes || 4000000;
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

  // Нерухомий герой отримує кадр, але ніколи не відео. Це свідомий
  // відступ від правила «телефон не тягне нічого»: картинка важить
  // близько 97 КБ, а без неї власник телефона не побачив би зйомки взагалі.
  var staticInited = false;
  function initStaticOnce() {
    if (staticInited || !M.heroPoster) return;
    staticInited = true;
    posterLayer.style.backgroundImage = "url('" + M.heroPoster + "')";
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
    lastSettle = -1; lastPx = -99;
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
     ВХОДИ СЕКЦІЙ
     Після приходу знімаємо затримки, інакше кожне наведення на
     сусідні картки запізнюється на всю сходинку назавжди.
     =========================================================== */
  $$('.sec, .foot, .divider').forEach(function (sec) {
    $$('.reveal', sec).forEach(function (el, i) { el.style.setProperty('--i', i); });
  });
  function settleSection(sec) {
    var n = $$('.reveal', sec).length;
    setTimeout(function () { sec.classList.add('settled'); }, 90 * n + 900);
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
     ІНТЕРАКТИВНИЙ МОМЕНТ: ціна збирається на очах
     Три справжні radio у трьох fieldset, тому клавіатура працює
     сама собою: стрілки всередині групи, Tab між групами.
     =========================================================== */
  (function () {
    var calc = $('#calc');
    if (!calc) return;
    var out = $('#ctotal'), live = $('#ctotal-live');
    var groups = ['implant', 'crown', 'bone'];
    var shownSum = 0, sumRaf = null, sumFrom = 0, sumTo = 0, sumT0 = 0;
    var SUM_MS = 620;

    function money(v) {
      return String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' ₴';
    }
    function paint(v) { out.textContent = money(v); }

    function animateSum(now) {
      var t = clamp((now - sumT0) / SUM_MS, 0, 1);
      var e = 1 - Math.pow(1 - t, 3);
      shownSum = sumFrom + (sumTo - sumFrom) * e;
      paint(shownSum);
      if (t < 1) { sumRaf = requestAnimationFrame(animateSum); }
      else { sumRaf = null; shownSum = sumTo; paint(sumTo); }
    }

    function recount() {
      var total = 0, filled = 0;
      groups.forEach(function (g) {
        var hit = calc.querySelector('input[name="' + g + '"]:checked');
        if (hit) { filled++; total += parseInt(hit.value, 10) || 0; }
      });

      if (filled < groups.length) {
        calc.classList.remove('ready');
        out.classList.add('empty');
        out.textContent = 'Оберіть три пункти';
        if (sumRaf !== null) { cancelAnimationFrame(sumRaf); sumRaf = null; }
        shownSum = 0;
        if (live) live.textContent = '';
        return;
      }

      calc.classList.add('ready');
      out.classList.remove('empty');
      if (live) live.textContent = 'Разом ' + money(total);

      // Правильне число малюємо одразу, і тільки потім заводимо лічильник.
      // На прихованій вкладці rAF не працює взагалі, і без цього рядка
      // сума лишилась би старою до повернення на вкладку.
      paint(total);
      if (reduced()) { shownSum = total; return; }
      sumFrom = shownSum; sumTo = total; sumT0 = performance.now();
      if (sumRaf === null) sumRaf = requestAnimationFrame(animateSum);
    }

    $$('input[type="radio"]', calc).forEach(function (r) {
      r.addEventListener('change', recount);
    });
    recount();
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
    function show(msg) {
      doneText.textContent = msg;
      done.hidden = false;
      done.setAttribute('tabindex', '-1');
      done.focus();
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
          '?subject=' + encodeURIComponent('Запис на огляд: ' + name) +
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
          show('Записали. Передзвонимо протягом години, з 9:00 до 20:00.');
        })['catch'](function () {
          show('Заявка не пішла. Подзвоніть нам напряму, і ми вас запишемо.');
        });
        return;
      }
      show('Це показовий макет вигаданої клініки, тому заявка нікуди не пішла. На справжньому сайті тут було б підтвердження і дзвінок протягом години.');
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
    var box = document.createElement('div');
    box.setAttribute('style',
      'position:fixed;left:10px;bottom:10px;z-index:999;padding:10px 12px;' +
      'font:12px/1.5 ui-monospace,monospace;white-space:pre;color:#E8F0F8;' +
      'background:rgba(10,16,28,.92);border-radius:10px;pointer-events:none');
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
        var q = function (v) { return Math.round(s[Math.floor(s.length * v)]); };
        box.textContent =
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
      requestAnimationFrame(loop);
    })(performance.now());
  }
})();
