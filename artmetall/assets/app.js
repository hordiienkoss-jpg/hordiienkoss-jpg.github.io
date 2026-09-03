/* АРТМЕТАЛ УКРАЇНА — показовий макет. Без бібліотек. */
(function () {
  'use strict';
  document.documentElement.classList.add('js');

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var nf = new Intl.NumberFormat('uk-UA');

  /* --- Площа: 54 → «54», 728.5 → «728,5» --------------------------------- */
  function area(v) {
    return (Math.round(v * 10) / 10).toString().replace('.', ',');
  }

  /* ======================================================================
     Каталог
     ====================================================================== */
  var grid = document.getElementById('grid');
  var empty = document.getElementById('empty');
  var count = document.getElementById('f-count');
  var areaIn = document.getElementById('f-area');
  var areaOut = document.getElementById('f-area-val');

  var state = { g: 'all', maxA: 1633, f: 'any' };

  function card(p) {
    var el = document.createElement('article');
    el.className = 'pcard';

    var specs = [];
    if (p.d) specs.push(p.d.replace(/;$/, '').replace(/\s*[xх]\s*/gi, ' × '));
    if (p.m) specs.push(p.m + ' мод.');
    if (p.f) specs.push(p.f + ' пов.');

    var price = p.r ? '<span class="pcard__price">від ' + nf.format(Math.round(p.a * p.r)) + ' $</span>' : '';

    el.innerHTML =
      '<div class="pcard__fig">' +
        '<img class="is-view" src="assets/img/p/' + p.s + '.webp" alt="' + p.t.replace(/"/g, '&quot;') + '" ' +
             'loading="lazy" decoding="async" width="660" height="412">' +
        (p.pl ? '<img class="is-plan" data-src="assets/img/pl/' + p.s + '.webp" alt="" ' +
                'loading="lazy" decoding="async" width="780" height="500">' : '') +
        (p.pl ? '<button class="pcard__plan" type="button" aria-pressed="false">План</button>' : '') +
        '<span class="pcard__area mono">' + area(p.a) + ' м²</span>' +
      '</div>' +
      '<div class="pcard__body">' +
        '<span class="pcard__cat">' + p.cn + '</span>' +
        '<h3 class="pcard__t">' + p.t + '</h3>' +
        '<div class="pcard__specs">' +
          (specs.length ? '<span>' + specs.join('</span><span>') + '</span>' : '') +
          price +
        '</div>' +
      '</div>';

    var btn = el.querySelector('.pcard__plan');
    if (btn) {
      btn.addEventListener('click', function () {
        var on = el.classList.toggle('show-plan');
        btn.setAttribute('aria-pressed', String(on));
        btn.textContent = on ? 'Вигляд' : 'План';
        var pl = el.querySelector('.is-plan');
        if (on && pl && !pl.src) pl.src = pl.dataset.src;   // план вантажимо лише на вимогу
      });
    }
    return el;
  }

  var PAGE = 12;
  var shown = PAGE;
  var moreBox = document.getElementById('more');
  var moreBtn = document.getElementById('more-btn');

  function matches(p) {
    if (state.g !== 'all' && p.g !== state.g) return false;
    if (p.a > state.maxA) return false;
    if (state.f === '1' && p.f !== 1) return false;
    if (state.f === '2' && !(p.f && p.f >= 2)) return false;
    return true;
  }

  function render(keepShown) {
    var list = PROJECTS.filter(matches);
    if (!keepShown) shown = PAGE;

    grid.textContent = '';
    var frag = document.createDocumentFragment();
    list.slice(0, shown).forEach(function (p) { frag.appendChild(card(p)); });
    grid.appendChild(frag);

    var rest = list.length - shown;
    moreBox.hidden = rest <= 0;
    if (rest > 0) moreBtn.textContent = 'Показати ще ' + Math.min(PAGE, rest);

    empty.hidden = list.length > 0;
    var n = list.length;
    var word = (n % 10 === 1 && n % 100 !== 11) ? 'проєкт'
             : (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14)) ? 'проєкти'
             : 'проєктів';
    count.innerHTML = '<b>' + n + '</b> ' + word;
  }

  document.querySelectorAll('.chip[data-g]').forEach(function (b) {
    b.addEventListener('click', function () {
      document.querySelectorAll('.chip[data-g]').forEach(function (o) { o.setAttribute('aria-pressed', 'false'); });
      b.setAttribute('aria-pressed', 'true');
      state.g = b.dataset.g;
      render();
    });
  });
  document.querySelectorAll('.chip[data-f]').forEach(function (b) {
    b.addEventListener('click', function () {
      document.querySelectorAll('.chip[data-f]').forEach(function (o) { o.setAttribute('aria-pressed', 'false'); });
      b.setAttribute('aria-pressed', 'true');
      state.f = b.dataset.f;
      render();
    });
  });
  areaIn.addEventListener('input', function () {
    state.maxA = +areaIn.value;
    areaOut.textContent = nf.format(state.maxA) + ' м²';
    render();
  });
  moreBtn.addEventListener('click', function () {
    shown += PAGE;
    render(true);
  });

  render();

  /* ======================================================================
     Калькулятор
     ====================================================================== */
  // Стандартний модуль — 14,6 м². Медіана по 25 проєктах каталогу, де вказано
  // і площу, і кількість модулів; це ж значення трапляється в них найчастіше.
  var MODULE = 14.6;
  var cRate = 350, cArea = 120;
  var cAreaIn = document.getElementById('c-area');
  var out = {
    sum: document.getElementById('c-sum'),
    area: document.getElementById('c-area-val'),
    bArea: document.getElementById('c-b-area'),
    bRate: document.getElementById('c-b-rate'),
    bMods: document.getElementById('c-b-mods')
  };

  function calc() {
    out.sum.textContent = nf.format(Math.round(cArea * cRate));
    out.area.textContent = nf.format(cArea) + ' м²';
    out.bArea.textContent = nf.format(cArea) + ' м²';
    out.bRate.textContent = cRate + ' $';
    out.bMods.textContent = String(Math.max(1, Math.round(cArea / MODULE)));
  }

  document.querySelectorAll('.seg button').forEach(function (b) {
    b.addEventListener('click', function () {
      document.querySelectorAll('.seg button').forEach(function (o) { o.setAttribute('aria-pressed', 'false'); });
      b.setAttribute('aria-pressed', 'true');
      cRate = +b.dataset.rate;
      calc();
    });
  });
  cAreaIn.addEventListener('input', function () { cArea = +cAreaIn.value; calc(); });
  calc();

  /* ======================================================================
     Розріз стіни
     ====================================================================== */
  var svg = document.querySelector('.tech__svg');
  var techList = document.getElementById('tech-list');

  function paintLayer(n) {
    if (!svg) return;
    svg.querySelectorAll('.ly').forEach(function (g) {
      var on = g.dataset.ly === String(n);
      // Зсувати шар не можна: група перекошена skewY, і зсув по X їде разом із
      // перекосом — шар вилітає зі стосу. Тому акцент — обведення й прозорість.
      g.style.transition = reduce ? 'none' : 'opacity .28s cubic-bezier(.22,.61,.36,1)';
      g.style.opacity = on ? '1' : '.42';
      var hl = g.querySelector('.hl');
      if (hl) {
        hl.style.transition = reduce ? 'none' : 'opacity .28s cubic-bezier(.22,.61,.36,1)';
        hl.style.opacity = on ? '1' : '0';
      }
    });
    svg.querySelectorAll('.lbl').forEach(function (g) {
      var on = g.dataset.ly === String(n);
      g.querySelector('text').setAttribute('fill', on ? '#E0762F' : '#94A2A9');
      g.querySelector('path').setAttribute('stroke', on ? '#E0762F' : '#3A464D');
    });
    techList.querySelectorAll('li').forEach(function (li) {
      li.dataset.on = li.querySelector('button').dataset.ly === String(n) ? '1' : '0';
    });
  }

  if (techList) {
    techList.querySelectorAll('button').forEach(function (b) {
      b.addEventListener('click', function () { paintLayer(b.dataset.ly); });
      b.addEventListener('mouseenter', function () { paintLayer(b.dataset.ly); });
    });
    paintLayer(1);
  }

  /* ======================================================================
     Лічильники
     ====================================================================== */
  function runCount(el) {
    var target = +el.dataset.count;
    if (reduce) { el.textContent = nf.format(target); return; }
    var dur = 1100, t0 = null;
    function tick(t) {
      if (t0 === null) t0 = t;
      var k = Math.min(1, (t - t0) / dur);
      var e = 1 - Math.pow(1 - k, 3);
      el.textContent = nf.format(Math.round(target * e));
      if (k < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  /* ======================================================================
     Поява при скролі
     ====================================================================== */
  var rises = document.querySelectorAll('.rise');
  if (!('IntersectionObserver' in window) || reduce) {
    rises.forEach(function (el) { el.classList.add('in'); });
    document.querySelectorAll('[data-count]').forEach(runCount);
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.classList.add('in');
        en.target.querySelectorAll('[data-count]').forEach(runCount);
        io.unobserve(en.target);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });
    rises.forEach(function (el) { io.observe(el); });
    // Страховка: якщо спостерігач із будь-якої причини не спрацював — показуємо все.
    setTimeout(function () {
      rises.forEach(function (el) {
        if (!el.classList.contains('in')) {
          el.classList.add('in');
          el.querySelectorAll('[data-count]').forEach(runCount);
        }
      });
    }, 2500);
  }

  /* ======================================================================
     Мобільне меню
     ====================================================================== */
  var nav = document.querySelector('.nav');
  var burger = document.getElementById('burger');
  if (burger) {
    burger.addEventListener('click', function () {
      var open = nav.dataset.open === '1';
      nav.dataset.open = open ? '0' : '1';
      burger.setAttribute('aria-expanded', String(!open));
    });
    document.querySelectorAll('.nav__panel a').forEach(function (a) {
      a.addEventListener('click', function () {
        nav.dataset.open = '0';
        burger.setAttribute('aria-expanded', 'false');
      });
    });
  }

  /* ======================================================================
     Форма — макет, нічого не відправляє
     ====================================================================== */
  var form = document.getElementById('lead');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      document.getElementById('lead-ok').hidden = false;
    });
  }
})();
