(function () {
  'use strict';

  var STORE_KEY = 'planner.tasks.v1';
  var WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  var MONTHS_BACK = 12, MONTHS_FORWARD = 24;

  var tasks = load();           // { 'YYYY-MM-DD': [ {id,title,start,end,done} ] }
  var currentDay = null;        // 'YYYY-MM-DD', если открыт экран дня
  var editing = null;           // { date, id|null }
  var currentMonthTitle = '';
  var curIndex = 0;
  var months = [];            // блоки месяцев в списке
  var ticking = false;

  function $(id) { return document.getElementById(id); }

  function load() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch (e) { return {}; }
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(tasks)); } catch (e) {}
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function key(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parse(k) { var p = k.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function list(k) { return (tasks[k] || []).slice().sort(function (a, b) { return a.start < b.start ? -1 : a.start > b.start ? 1 : 0; }); }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  /* ---------- Календарь: длинный список недель ---------- */
  function buildGrid() {
    var now = new Date();
    var from = new Date(now.getFullYear(), now.getMonth() - MONTHS_BACK, 1);
    var to = new Date(now.getFullYear(), now.getMonth() + MONTHS_FORWARD + 1, 0);
    var todayKey = key(now);
    currentMonthTitle = cap(now.toLocaleDateString('ru-RU', { month: 'long' })) + ' ' + now.getFullYear();
    var html = '';
    // каждый месяц — отдельный блок со своим заголовком; чужие дни в неделях остаются пустыми
    for (var m = from; m <= to; m = new Date(m.getFullYear(), m.getMonth() + 1, 1)) {
      var days = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
      var lead = (m.getDay() + 6) % 7;
      var trail = (7 - (lead + days) % 7) % 7;
      html += '<div class="month" data-title="' + cap(m.toLocaleDateString('ru-RU', { month: 'long' })) + ' ' + m.getFullYear() + '"><div class="grid">';
      for (var i = 0; i < lead; i++) html += '<div class="day empty"></div>';
      for (var n = 1; n <= days; n++) {
        var d = new Date(m.getFullYear(), m.getMonth(), n);
        html += dayCell(d, key(d), todayKey);
      }
      for (i = 0; i < trail; i++) html += '<div class="day empty"></div>';
      html += '</div></div>';
    }
    $('days').innerHTML = html;
    months = $('days').querySelectorAll('.month');
  }

  function dayCell(d, k, todayKey) {
    var cls = 'day' + (k === todayKey ? ' today' : '');
    var label = d.getDate();
    var html = '<button class="' + cls + '" data-date="' + k + '"><span class="num">' + label + '</span>';
    var items = list(k);
    var today = k === todayKey;
    // в сегодняшней клетке только число и стрелка вниз: по ней открывается день со всеми планами
    (today ? [] : items.slice(0, 3)).forEach(function (t) {
      html += '<span class="chip' + (t.done ? ' done' : '') + '">' + esc(t.title) + '</span>';
    });
    if (!today && items.length > 3) html += '<span class="more">+' + (items.length - 3) + '</span>';
    if (today) html += '<span class="expand" role="button" aria-label="Открыть сегодняшний день"></span>';
    return html + '</button>';
  }

  // перерисовать одну ячейку (после изменения дел)
  function refreshCell(k) {
    var old = document.querySelector('.day[data-date="' + k + '"]');
    if (!old) return;
    var tmp = document.createElement('div');
    tmp.innerHTML = dayCell(parse(k), k, key(new Date()));
    old.replaceWith(tmp.firstChild);
  }

  // показываем один месяц; переключается только стрелками
  function showMonth(i) {
    curIndex = Math.max(0, Math.min(months.length - 1, i));
    for (var j = 0; j < months.length; j++) months[j].classList.toggle('active', j === curIndex);
    $('title-text').textContent = months[curIndex].dataset.title;
    $('prev-month').disabled = curIndex === 0;
    $('next-month').disabled = curIndex === months.length - 1;
    document.body.classList.add('no-scroll');
    window.scrollTo(0, 0);
    fitRows();
    paintTitle();
  }

  // название месяца рисуется на canvas: замкнутые «дырки» букв и цифр (О, б, р, ь, я, 0, 6…) заливаются розовым
  function paintTitle() {
    var span = $('title-text'), canvas = $('title-canvas'), h1 = $('month-title');
    var r = span.getBoundingClientRect();
    if (!r.width || !r.height) return;
    var s = Math.min(4, Math.max(2, (window.devicePixelRatio || 1) * 2));
    var w = Math.ceil(r.width * s), h = Math.ceil(r.height * s);
    var hb = h1.getBoundingClientRect();
    canvas.style.left = (r.left - hb.left) + 'px';
    canvas.style.top = (r.top - hb.top) + 'px';
    canvas.style.width = r.width + 'px';
    canvas.style.height = r.height + 'px';
    canvas.width = w; canvas.height = h;

    var cs = getComputedStyle(span);
    var font = cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
    function drawText(c) {
      c.save();
      c.scale(s, s);
      c.font = font;
      c.textBaseline = 'alphabetic';
      c.fillStyle = '#1c1c1e';
      var m = c.measureText(span.textContent);
      c.fillText(span.textContent, 0, m.fontBoundingBoxAscent || parseFloat(cs.fontSize) * 0.92);
      c.restore();
    }

    var tmp = document.createElement('canvas');
    tmp.width = w; tmp.height = h;
    var tc = tmp.getContext('2d');
    drawText(tc);
    var data = tc.getImageData(0, 0, w, h).data;

    // всё «пустое», до чего не добраться с краёв картинки, — это внутренности букв
    var empty = new Uint8Array(w * h), outside = new Uint8Array(w * h), stack = [];
    for (var i = 0; i < w * h; i++) empty[i] = data[i * 4 + 3] < 110 ? 1 : 0;
    function seed(x, y) { var k = y * w + x; if (empty[k] && !outside[k]) { outside[k] = 1; stack.push(k); } }
    for (var x = 0; x < w; x++) { seed(x, 0); seed(x, h - 1); }
    for (var y = 0; y < h; y++) { seed(0, y); seed(w - 1, y); }
    while (stack.length) {
      var k = stack.pop(), px = k % w, py = (k - px) / w;
      if (px > 0) seed(px - 1, py);
      if (px < w - 1) seed(px + 1, py);
      if (py > 0) seed(px, py - 1);
      if (py < h - 1) seed(px, py + 1);
    }
    var pink = getComputedStyle(document.documentElement).getPropertyValue('--soft-pink').trim() || '#f4c6d6';
    var pc = document.createElement('canvas').getContext('2d');
    pc.fillStyle = pink; pc.fillRect(0, 0, 1, 1);
    var pd = pc.getImageData(0, 0, 1, 1).data;
    var out = ctx2(canvas), img = out.createImageData(w, h);
    for (var j = 0; j < w * h; j++) {
      var inner = empty[j] && !outside[j];
      if (!inner) {                                  // чуть заходим под контур, чтобы не было светлой каймы
        var jx = j % w;
        inner = (jx > 0 && empty[j - 1] && !outside[j - 1]) || (jx < w - 1 && empty[j + 1] && !outside[j + 1]) ||
          (j >= w && empty[j - w] && !outside[j - w]) || (j < w * h - w && empty[j + w] && !outside[j + w]);
      }
      if (inner) { img.data[j * 4] = pd[0]; img.data[j * 4 + 1] = pd[1]; img.data[j * 4 + 2] = pd[2]; img.data[j * 4 + 3] = 255; }
    }
    out.putImageData(img, 0, 0);
    out.drawImage(tmp, 0, 0);
  }
  function ctx2(c) { return c.getContext('2d'); }
  window.addEventListener('resize', paintTitle);
  window.addEventListener('load', paintTitle);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(paintTitle);

  // весь месяц должен помещаться на экране без прокрутки: высота недели считается из свободного места.
  // Берём самую низкую из высот экрана (с учётом адресной строки телефона), чтобы нижняя неделя не уходила вниз.
  var probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;left:0;top:0;width:0;height:100svh;visibility:hidden;pointer-events:none';
  document.body.appendChild(probe);

  function viewHeight() {
    var h = window.innerHeight;
    if (window.visualViewport) h = Math.min(h, window.visualViewport.height);
    if (probe.offsetHeight) h = Math.min(h, probe.offsetHeight);
    return h;
  }

  function fitRows() {
    if (!months.length || $('month-view').hidden) return;
    var cells = months[curIndex].querySelector('.grid').children.length;
    var rows = Math.ceil(cells / 7);
    var free = viewHeight() - $('sticky').getBoundingClientRect().bottom - $('bottom-bar').offsetHeight - 10;
    document.documentElement.style.setProperty('--row', Math.max(56, Math.floor(free / rows)) + 'px');
  }
  window.addEventListener('resize', fitRows);
  window.addEventListener('orientationchange', fitRows);
  window.addEventListener('load', fitRows);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', fitRows);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitRows);
  if (window.ResizeObserver) new ResizeObserver(fitRows).observe($('sticky'));

  /* ---------- День ---------- */
  function renderDay() {
    var d = parse(currentDay);
    $('day-title').textContent = d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
    $('day-sub').textContent = d.toLocaleDateString('ru-RU', { weekday: 'long' }) + ', ' + d.getFullYear();

    var items = list(currentDay);
    var done = items.filter(function (t) { return t.done; }).length;
    $('progress-bar').style.width = (items.length ? done / items.length * 100 : 0) + '%';
    $('progress-text').textContent = items.length ? 'Сделано ' + done + ' из ' + items.length : 'Дел нет';

    var html = '';
    items.forEach(function (t) {
      html += '<div class="task' + (t.done ? ' done' : '') + '" data-id="' + t.id + '">' +
        '<button class="check" data-check="' + t.id + '" aria-label="Отметить"></button>' +
        '<div class="t-main"><div class="t-title">' + esc(t.title) + '</div>' +
        '<div class="t-time">' + t.start + (t.end ? ' – ' + t.end : '') + '</div></div></div>';
    });
    if (!items.length) html += '<p class="empty-day">Планов на этот день пока нет</p>';
    html += '<button class="add-plan" id="add-plan">Добавить план</button>';
    $('planner').innerHTML = html;
  }

  function showDay(dayKey) {
    currentDay = dayKey;
    $('month-view').hidden = true;
    $('day-view').hidden = false;
    document.body.classList.remove('no-scroll');
    document.body.classList.add('day-mode');
    $('prev-month').disabled = false; $('next-month').disabled = false;
    // экран сегодняшнего дня заливается тем же розовым, что и его клетка в календаре
    document.body.classList.toggle('day-today', dayKey === key(new Date()));
    renderDay();
    window.scrollTo(0, 0);
  }

  function showMonths() {
    var k = currentDay;
    currentDay = null;
    $('day-view').hidden = true;
    document.body.classList.remove('day-today', 'day-mode');
    $('month-view').hidden = false;
    var cell = document.querySelector('.day[data-date="' + k + '"]');
    showMonth(Array.prototype.indexOf.call(months, cell.closest('.month')));
  }

  function shiftDay(n) {
    if (!currentDay) return;
    var d = parse(currentDay); d.setDate(d.getDate() + n);
    showDay(key(d));
  }

  /* ---------- Окно задачи ---------- */
  function openModal(date, id, hour) {
    editing = { date: date, id: id || null };
    var t = id ? (tasks[date] || []).filter(function (x) { return x.id === id; })[0] : null;
    $('modal-title').textContent = t ? 'Изменить дело' : 'Новое дело';
    $('f-title').value = t ? t.title : '';
    $('f-start').value = t ? t.start : pad(hour == null ? 9 : hour) + ':00';
    $('f-end').value = t && t.end ? t.end : '';
    $('f-delete').hidden = !t;
    $('modal').hidden = false;
    document.body.classList.add('modal-open');
    fitModal();
    setTimeout(function () { $('f-title').focus({ preventScroll: true }); }, 30);
  }
  function closeModal() {
    $('modal').hidden = true; editing = null;
    document.body.classList.remove('modal-open');
    ['top', 'left', 'width', 'height', 'right', 'bottom'].forEach(function (p) { $('modal').style[p] = ''; });
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    resetView();
  }

  // окно следует за видимой областью экрана (когда выезжает клавиатура), чтобы iPhone не сдвигал и не приближал страницу
  function fitModal() {
    var vv = window.visualViewport, m = $('modal');
    if (!vv || m.hidden) return;
    m.style.top = vv.offsetTop + 'px'; m.style.left = vv.offsetLeft + 'px';
    m.style.width = vv.width + 'px'; m.style.height = vv.height + 'px';
    m.style.right = 'auto'; m.style.bottom = 'auto';
  }
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', fitModal);
    window.visualViewport.addEventListener('scroll', fitModal);
  }
  // когда уходим из поля (в том числе из полей времени), приближение сбрасывается
  $('modal').addEventListener('focusout', function () { setTimeout(function () { if (!$('modal').hidden) resetView(); }, 80); });

  // после ввода iPhone может оставить страницу приближенной или прокрученной: возвращаем обычный вид
  function resetView() {
    var vp = document.querySelector('meta[name=viewport]');
    if (vp) {
      var base = vp.getAttribute('content');
      vp.setAttribute('content', base + ', minimum-scale=1');
      setTimeout(function () { vp.setAttribute('content', base); }, 60);
    }
    window.scrollTo(0, 0);
    setTimeout(function () { window.scrollTo(0, 0); }, 120);
  }

  /* ---------- События ---------- */
  $('weekdays').innerHTML = WEEKDAYS.map(function (w) { return '<div>' + w + '</div>'; }).join('');

  $('days').onclick = function (e) {
    var b = e.target.closest('.day');
    if (b) showDay(b.dataset.date);
  };

  $('back-btn').onclick = showMonths;

  /* ---------- листание: нижняя панель, свайп пальцем и клавиатура ----------
     В календаре переключаются месяцы, на экране дня — дни; экран уезжает целиком, нижняя панель остаётся. */
  function activeView() { return currentDay ? $('day-view') : $('month-view'); }

  function canGo(dir) {
    if (currentDay) return true;
    return dir < 0 ? curIndex > 0 : curIndex < months.length - 1;
  }
  function applyStep(dir) { if (currentDay) shiftDay(dir); else showMonth(curIndex + dir); }

  var busy = false;
  function animateTo(el, x, ms) {
    el.style.transition = 'transform ' + ms + 'ms ease-out';
    el.style.transform = 'translateX(' + x + 'px)';
    return new Promise(function (res) { setTimeout(res, ms + 20); });
  }

  // dir: +1 — вперёд (следующий месяц/день), -1 — назад; from — откуда продолжить, если экран уже тянули пальцем
  function go(dir, from) {
    if (busy || !canGo(dir)) { snapBack(); return; }
    busy = true;
    var el = activeView(), w = window.innerWidth;
    el.style.willChange = 'transform';
    el.style.transition = 'none'; el.style.transform = 'translateX(' + (from || 0) + 'px)';
    el.offsetWidth;
    animateTo(el, -dir * w, 170).then(function () {
      applyStep(dir);
      var el2 = activeView();                              // тот же экран (месяц→месяц, день→день)
      el2.style.transition = 'none'; el2.style.transform = 'translateX(' + (dir * w) + 'px)';
      el2.offsetWidth;
      return animateTo(el2, 0, 200).then(function () {
        el2.style.transition = ''; el2.style.transform = ''; el2.style.willChange = '';
        busy = false;
      });
    });
  }
  function snapBack() {
    var el = activeView();
    animateTo(el, 0, 160).then(function () { el.style.transition = ''; el.style.transform = ''; });
  }

  $('prev-month').onclick = function () { go(-1); };
  $('next-month').onclick = function () { go(1); };

  // свайп: экран едет за пальцем; отпустили далеко или резко — переключается, иначе возвращается
  var drag = null, dragged = false;
  function onTouchStart(e) {
    if (busy || !$('modal').hidden || e.touches.length !== 1) { drag = null; return; }
    dragged = false;
    drag = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now(), dx: 0, active: false };
  }
  function onTouchMove(e) {
    if (!drag) return;
    var dx = e.touches[0].clientX - drag.x, dy = e.touches[0].clientY - drag.y;
    if (!drag.active) {
      if (Math.abs(dx) < 12 || Math.abs(dx) < Math.abs(dy) * 1.3) {
        if (Math.abs(dy) > 12) drag = null;                // вертикальная прокрутка — не наша
        return;
      }
      drag.active = true; dragged = true;
    }
    drag.dx = dx;
    var dir = dx < 0 ? 1 : -1, resist = canGo(dir) ? 1 : 0.25;   // на первом/последнем месяце экран «упирается»
    var el = activeView();
    el.style.transition = 'none';
    el.style.transform = 'translateX(' + (dx * resist) + 'px)';
  }
  function onTouchEnd() {
    if (!drag || !drag.active) { drag = null; return; }
    var dx = drag.dx, dt = Date.now() - drag.t, w = window.innerWidth;
    var fast = Math.abs(dx) > 30 && Math.abs(dx) / dt > 0.5;
    drag = null;
    setTimeout(function () { dragged = false; }, 350);      // «лишний» клик после свайпа приходит сразу; потом флаг сбрасываем
    if (Math.abs(dx) > w * 0.25 || fast) go(dx < 0 ? 1 : -1, dx);
    else snapBack();
  }
  ['month-view', 'day-view'].forEach(function (id) {
    var el = $(id);
    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: true });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    el.addEventListener('touchcancel', function () { if (drag && drag.active) snapBack(); drag = null; }, { passive: true });
  });
  // после перетаскивания палец «нажимает» на то, где остановился — этот клик не нужен
  document.addEventListener('click', function (e) {
    if (dragged) { e.stopPropagation(); e.preventDefault(); dragged = false; }
  }, true);

  document.addEventListener('keydown', function (e) {
    if (!$('modal').hidden) { if (e.key === 'Escape') closeModal(); return; }
    if (e.key === 'ArrowLeft' || (!currentDay && e.key === 'ArrowUp')) { e.preventDefault(); go(-1); }
    else if (e.key === 'ArrowRight' || (!currentDay && e.key === 'ArrowDown')) { e.preventDefault(); go(1); }
    else if (e.key === 'Escape' && currentDay) showMonths();
  });

  $('planner').onclick = function (e) {
    var chk = e.target.closest('[data-check]');
    if (chk) {
      var t = (tasks[currentDay] || []).filter(function (x) { return x.id === chk.dataset.check; })[0];
      if (t) { t.done = !t.done; save(); renderDay(); refreshCell(currentDay); }
      return;
    }
    var task = e.target.closest('.task');
    if (task) { openModal(currentDay, task.dataset.id); return; }
    if (e.target.closest('.add-plan')) {
      var now = new Date();
      openModal(currentDay, null, key(now) === currentDay ? Math.min(23, now.getHours() + 1) : 9);
    }
  };

  $('f-cancel').onclick = closeModal;
  $('modal').onclick = function (e) { if (e.target === $('modal')) closeModal(); };

  $('f-delete').onclick = function () {
    var date = editing.date;
    tasks[date] = (tasks[date] || []).filter(function (x) { return x.id !== editing.id; });
    if (!tasks[date].length) delete tasks[date];
    save(); closeModal(); refresh(date);
  };

  $('task-form').onsubmit = function (e) {
    e.preventDefault();
    var title = $('f-title').value.trim();
    if (!title) return;
    var date = editing.date;
    var arr = tasks[date] = tasks[date] || [];
    var t = editing.id ? arr.filter(function (x) { return x.id === editing.id; })[0] : null;
    if (!t) {
      t = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), done: false };
      arr.push(t);
    }
    t.title = title; t.start = $('f-start').value; t.end = $('f-end').value;
    save(); closeModal(); refresh(date);
  };

  function refresh(date) {
    refreshCell(date);
    if (currentDay) renderDay();
  }

  // работа без интернета: service worker включается на https (GitHub Pages); для проверки локально — ?sw=1
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || /[?&]sw=1/.test(location.search))) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
  }

  // приложение живёт в памяти телефона днями: если дата сменилась, перезагружаем, чтобы «сегодня» обновилось
  var builtDay = key(new Date());
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && key(new Date()) !== builtDay) location.reload();
  });

  buildGrid();
  var todayCell = document.querySelector('.day[data-date="' + key(new Date()) + '"]');
  showMonth(Array.prototype.indexOf.call(months, todayCell.closest('.month')));
})();
