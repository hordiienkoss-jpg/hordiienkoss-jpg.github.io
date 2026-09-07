// Каталог і підсумок. Підпис напрямку: коли звужуєш вибір, підсумок
// переобчислюється — документ перескладає свою суму, а не ховає її.
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const money = (n) => '$' + n.toLocaleString('uk-UA').replace(/ /g, ' ');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const state = { min: null, max: null, kind: null, status: null, place: null, limit: 24 };
  let DATA = null;

  const matches = (l) => {
    if (state.kind && l.kind !== state.kind) return false;
    if (state.status && l.status !== state.status) return false;
    if (state.place && l.place !== state.place) return false;
    if (state.min != null && (l.price == null || l.price < state.min)) return false;
    if (state.max != null && (l.price == null || l.price > state.max)) return false;
    return true;
  };

  // Підсумок перекочується до нового значення. Один авторський момент,
  // експоненційне сповільнення, старт із уже видимого числа.
  function tally(el, from, to, render) {
    // Правильне значення стоїть одразу й безумовно. Анімація — оздоблення поверх
    // нього: у фоновій вкладці requestAnimationFrame не викликається зовсім,
    // і якби число жило тільки в кадрах, підсумок застигав би на старому.
    el.textContent = render(to);
    if (reduced || from === to || typeof requestAnimationFrame !== 'function') return;
    const t0 = performance.now(), dur = 460;
    el.dataset.tallying = '';
    const step = (t) => {
      const p = Math.min(1, (t - t0) / dur);
      if (p < 1) {
        // Експоненційне сповільнення. На p=1 множник дорівнює 1−2⁻¹⁰, а не одиниці,
        // тож остання кадрівка ставить точне значення — інакше підсумок застигає
        // на 0,1% нижче за справжню ціну.
        el.textContent = render(Math.round(from + (to - from) * (1 - Math.pow(2, -10 * p))));
        requestAnimationFrame(step);
      } else {
        el.textContent = render(to);
        delete el.dataset.tallying;
      }
    };
    requestAnimationFrame(step);
  }

  const prev = { lo: null, hi: null, n: null };

  function paintSummary(rows) {
    const prices = rows.map((l) => l.price).filter((p) => p != null);
    const loEl = $('#sum-lo'), hiEl = $('#sum-hi'), nEl = $('#sum-n');
    const dash = $('#sum-dash'), none = $('#sum-none');
    if (!loEl) return;

    if (prices.length) {
      const lo = Math.min(...prices), hi = Math.max(...prices);
      loEl.hidden = hiEl.hidden = false; dash.hidden = false; none.hidden = true;
      tally(loEl, prev.lo ?? lo, lo, money); tally(hiEl, prev.hi ?? hi, hi, money);
      prev.lo = lo; prev.hi = hi;
    } else {
      loEl.hidden = hiEl.hidden = dash.hidden = true; none.hidden = false;
    }
    if (nEl) { tally(nEl, prev.n ?? rows.length, rows.length, (v) => String(v)); prev.n = rows.length; }

    // Озвучуємо лише усталений підсумок. Якби aria-live висіла на самому
    // числі, читач диктував би кожен кадр анімації.
    const live = $('#sum-live');
    if (live) {
      live.textContent = prices.length
        ? `Разом: від ${money(Math.min(...prices))} до ${money(Math.max(...prices))}, ${rows.length} позицій.`
        : `У вибірці ${rows.length} позицій, ціни не вказано.`;
    }

    for (const el of $$('[data-count]')) {
      const key = el.dataset.count;
      const v = key === 'all' ? rows.length : rows.filter((l) => l.status === key).length;
      el.textContent = String(v);
    }

    // Підпис мусить називати те, що під ним стоїть. Щойно ввімкнено фільтр,
    // цифри описують вибірку, а не каталог, — інакше виходить «Продано 0»
    // під заголовком «Разом у каталозі».
    const scoped = filtered();
    for (const el of $$('[data-scope]')) {
      el.textContent = scoped ? el.dataset.scopeSel : el.dataset.scopeAll;
    }
  }

  const filtered = () => !!(state.min || state.max || state.kind || state.status || state.place);

  // Ділянка в їхніх даних у м². Два лоти стоять зі значеннями 2,5 і 2,6 —
  // це майже напевно сотки, підписані метрами. Позначаємо зірочкою,
  // а не переписуємо чуже число.
  const plot = (l) => {
    if (l.plot == null) return '—';
    const v = String(l.plot).replace('.', ',');
    return l.plotSuspect
      ? `${v}<abbr title="У джерелі вказано «${v} м²». Для будинку ${l.area} м² це майже напевно сотки, а не метри. Чуже число не переписуємо.">*</abbr>`
      : v;
  };

  function row(l, i) {
    const stamp = l.status === 'продано' ? '<span class="stamp stamp--sold">продано</span>'
      : l.status === 'під замовлення' ? '<span class="stamp stamp--order">під замовлення</span>'
      : '<span class="stamp stamp--sale">у продажу</span>';
    const price = l.price != null ? money(l.price) : '—';
    const place = l.place ? `${l.place}` : '<span title="Локацію в їхніх даних не підтверджено">—</span>';
    const href = `lot.html?slug=${encodeURIComponent(l.slug)}`;
    const name = `<b>${l.kind ? l.kind[0].toUpperCase() + l.kind.slice(1) : 'Лот'}</b> ${l.area ?? '—'} м²`;
    // Одне посилання на рядок, а не сім однакових: клавіатурою рядок
    // проходиться одним табом, решта клітинок клікається делегуванням.
    return `<tr data-status="${l.status}" data-href="${href}">
      <td class="c-num">${String(i + 1).padStart(3, '0')}</td>
      <td class="c-name"><a class="cell" href="${href}">${name}</a></td>
      <td class="c-place">${place}</td>
      <td class="c-fig">${l.rooms ? l.rooms : '—'}</td>
      <td class="c-fig">${plot(l)}</td>
      <td class="c-fig">${stamp}</td>
      <td class="c-price">${price}</td>
    </tr>`;
  }

  function paintRows(rows) {
    const body = $('#rows'); if (!body) return;
    const shown = rows.slice(0, state.limit);
    body.innerHTML = shown.map(row).join('');
    const more = $('#more');
    if (more) {
      if (!rows.length) {
        // Порожня вибірка говорить одним голосом: працює блок #empty,
        // а лічильник мовчить, інакше поруч стоїть «Показано всі 0».
        more.hidden = true;
        more.innerHTML = '';
      } else if (rows.length > shown.length) {
        more.hidden = false;
        more.innerHTML = `Показано ${shown.length} зі ${rows.length}. <button id="more-btn" class="range__reset" type="button">Показати ще</button>`;
        $('#more-btn').onclick = () => { state.limit += 40; render(); };
      } else {
        more.hidden = false;
        more.innerHTML = `Показано всі ${rows.length}.`;
      }
    }
    const empty = $('#empty');
    if (empty) empty.hidden = rows.length > 0;
  }

  function render() {
    const rows = DATA.lots.filter(matches);
    paintSummary(rows);
    paintRows(rows);
    const reset = $('#reset');
    if (reset) reset.hidden = !filtered();
  }

  // Клік будь-де по рядку веде на лот; посилання в рядку лишається одне.
  document.addEventListener('click', (e) => {
    if (e.target.closest('a, button')) return;
    const tr = e.target.closest('tr[data-href]');
    if (tr) location.href = tr.dataset.href;
  });

  function wire() {
    const lo = $('#in-lo'), hi = $('#in-hi');
    const num = (el) => { const v = parseInt(String(el.value).replace(/\D/g, ''), 10); return Number.isFinite(v) ? v : null; };
    for (const el of [lo, hi]) {
      if (!el) continue;
      el.addEventListener('input', () => {
        state.min = num(lo); state.max = num(hi); state.limit = 24; render();
      });
    }
    for (const el of $$('[data-filter]')) {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        const [k, v] = el.dataset.filter.split(':');
        state[k] = state[k] === v ? null : v;
        state.limit = 24;
        for (const o of $$(`[data-filter^="${k}:"]`)) o.toggleAttribute('aria-pressed', state[k] === o.dataset.filter.split(':')[1]);
        render();
      });
    }
    const places = $('#places');
    if (places && DATA) {
      const names = [...new Set(DATA.lots.map((l) => l.place).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'uk'));
      for (const n of names) {
        const count = DATA.lots.filter((l) => l.place === n).length;
        places.insertAdjacentHTML('beforeend', `<option value="${n}">${n} (${count})</option>`);
      }
      places.addEventListener('change', () => {
        state.place = places.value || null; state.limit = 24; render();
      });
    }

    const reset = $('#reset');
    if (reset) reset.onclick = () => {
      if (places) places.value = '';
      Object.assign(state, { min: null, max: null, kind: null, status: null, place: null, limit: 24 });
      if (lo) lo.value = ''; if (hi) hi.value = '';
      for (const o of $$('[data-filter]')) o.removeAttribute('aria-pressed');
      render();
    };
  }

  // «Збудоване» показує кадри проданих лотів: продане — за визначенням збудоване,
  // тож це правило відбору, а не наш здогад про те, де фото, а де візуалізація.
  function paintShots(d) {
    const box = $('#shots'); if (!box) return;
    // Один і той самий кадр прикріплений у них до кількох лотів. Показуємо
    // кожну фотографію один раз — інакше вибірка читається як помилка.
    const seen = new Set();
    const sold = d.lots.filter((l) => {
      if (l.status !== 'продано' || !l.pic || seen.has(l.pic.card)) return false;
      seen.add(l.pic.card);
      return true;
    }).slice(0, 8);
    // Без lazy: це секція доказів, і порожня плитка тут коштує дорожче
    // за вісім картинок наперед.
    box.innerHTML = sold.map((l) => `
      <figure>
        <a href="lot.html?slug=${encodeURIComponent(l.slug)}">
          <img decoding="async" width="640" height="480"
               src="assets/img/${l.pic.card}"
               alt="${l.kind || 'Будинок'} ${l.area ?? ''} м²${l.place ? ', ' + l.place : ''}">
        </a>
        <figcaption>${l.area ?? '—'} м²${l.place ? ' · ' + l.place : ''}</figcaption>
      </figure>`).join('');
  }

  fetch('data/catalog.json').then((r) => r.json()).then((d) => {
    DATA = d;
    paintShots(d);
    for (const el of $$('[data-sum]')) {
      const v = d.summary[el.dataset.sum];
      el.textContent = typeof v === 'number' && el.dataset.sum.startsWith('price') ? money(v) : String(v);
    }
    wire();
    render();
  }).catch(() => {
    const e = $('#empty');
    if (e) { e.hidden = false; e.textContent = 'Каталог не завантажився. Перезавантажте сторінку.'; }
  });
})();
