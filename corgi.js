/* Пиксельный корги: стоит на верхней рамке календаря между субботой и воскресеньем,
   смотрит в сторону надписи с месяцем и виляет хвостиком. Лапы неподвижны. */
(function () {
  'use strict';

  var lane = document.getElementById('corgi-lane');
  var title = document.getElementById('month-title');
  if (!lane || !title) return;

  // рисунок: K — контур, O — рыжий, W — белый, N — чёрный носик, точка — пусто (корги смотрит вправо)
  var ART = [
    '...............................KK........',
    '..............................KOOK.......',
    '..............................KOOK.......',
    '.....................KK......KOOOK.......',
    '....................KWWK.....KOOOK.......',
    '...................KWWWWK...KKOOOK.......',
    '...................KWWWWWK..KOOOOK.......',
    '...................KWWWWWKK.KOOOOKK......',
    '...................KWWWWWKOKKKKKOOK......',
    '...................KKWWWWOOOOOOWWWKK.....',
    '....................KOWWWWKOOOOOOWWK.....',
    '....................KOKWWKKOOOOOOOOWK....',
    '....................KKOWWKOOOOOOOOOWK....',
    '....................KKOKKOOOOOOOKKOWKKNNN',
    '.....................KOOOOOOOOOOKKOWWWWNN',
    '.....................KOOOOOOOOOOOOOWWWWNN',
    '.....................KKOOOOOOOOOOOWWWWWWK',
    '.....................KOOOOOOOOOOOOWWWWWWK',
    '.....................KKOOOOOOOOWWKWWWWWK.',
    '....KKK...............KKOOOOOOWWWKWWWKK..',
    '...KWWOK.............KKOOOOWWWWWWWKKKK...',
    '...KWWOKKKKK.........KOOOOWWWWWWWWWK.....',
    '...KWWOKOOOOKKKKK...KKOOOOWWWWWWWWWK.....',
    '...KWWKOOOOOOOOOOKKKKOOOOOWWWWWWWWKK.....',
    '...KWKOOOOOOOOOOOOOOOOOOOOWWWWWWWWWKK....',
    '....KOOOOOOOOOOOOOOOOOOOOOOWWWWWWWWWK....',
    '...KKOOOOOOOOOOOOOOOOOOOOOOWWWWWWWWWK....',
    '...KKOOOOOOOOOOOOOOOOOOOOOOOWWWWWWWWKK...',
    '...KOOOOOOOOOOOOOOOOOOOOOOOOOWWWWWWWWK...',
    '...KOOOOOOOOOOOOOOOOOOOOOOOOOOWWWWWWWK...',
    '...KOOOOOOOOOOOOOOOOOOOOOOOOOOWWWWWWWK...',
    '...KOOOOOOOOOOOOOOOOOOOOOOOOOOWWWWWWK....',
    '...KOOOOOOOOOOKOOOOOOOOOOOOOOWWWWWWKK....',
    '....KOOOOOOOOOKOOOOOOOOKOOOOWWWWWWWK.....',
    '....KOOOOOOOKOKOOOOOOOOKOOOOWWWWWWKK.....',
    '...KOOOOOOOOKKKOOOOOOOKKOOOWWWWWWKKK.....',
    '...KOOOOOKKKKKKKKKKOOOKOOOOWWKKKKKOK.....',
    '.KKOOOOOOKOOOK.....KKKOOOOOKKK.KOOOOK....',
    'KWWWWWOOKOOOOK.......KOOOOOK....KOOOOKK..',
    'KWWWWWOK.KOWWWK......KOOOOK......KOWWWK..',
    '.KKKKKK...KWWWWK.....KWWWWK.......KWWWK..',
    '...........KKKKK......KWWWWK.......KKK...',
    '.......................KKKK..............'
  ];
  var COLORS = { K: '#673d32', O: '#eaa559', W: '#ffffff', N: '#000000' };

  var CW = 41, CH = 44;       // размер рисунка в клетках
  var U = 4;                  // пикселей канваса на клетку
  var CELL = 1.25;            // css-пикселей на клетку
  var PAD = 5;                // запас по бокам, чтобы вынесенные лапы не обрезались
  var W = (CW + 2 * PAD) * CELL;
  var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  var canvas = document.createElement('canvas');
  canvas.width = (CW + 2 * PAD) * U; canvas.height = CH * U;
  canvas.className = 'corgi-sprite';
  canvas.style.width = W + 'px'; canvas.style.height = CH * CELL + 'px';
  lane.appendChild(canvas);
  var ctx = canvas.getContext('2d');

  function put(ch, x, y) {
    if (ch === '.' || y < 0 || y >= CH || x < -PAD || x >= CW + PAD) return;
    ctx.fillStyle = COLORS[ch];
    ctx.fillRect((x + PAD) * U, (y + 1) * U, U, U);
  }

  // хвост — маленький круглый «кругляшок»: он не растягивается, а целиком чуть-чуть двигается в сторону
  // от тела и обратно; щель между ним и спиной закрывается дорисованной линией контура
  var BALL = ['.KKK.', 'KWWOK', 'KWWOK', 'KWWOK'];       // строки 19–22, левый край в колонке 3
  function isTail(x, y) { return y >= 19 && y <= 22 && x >= 3 && (x <= 6 || (y <= 20 && x === 7)); }

  function tailCells(k) {
    var dx = -Math.round((1 + k) * 0.75);                  // 0, -1 или -2 клетки
    var out = [];
    BALL.forEach(function (row, i) {
      for (var c = 0; c < row.length; c++) {
        if (row.charAt(c) !== '.') out.push([row.charAt(c), 3 + dx + c, 19 + i]);
      }
    });
    for (var x = 3 + dx + 5; x <= 6; x++) out.push(['K', x, 22]);   // соединительная линия до спины
    return out;
  }

  function draw(k) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (var y = 0; y < ART.length; y++) {
      for (var x = 0; x < CW; x++) {
        if (isTail(x, y)) continue;
        put(ART[y].charAt(x), x, y);
      }
    }
    tailCells(k).forEach(function (c) { put(c[0], c[1], c[2]); });
  }

  // центр собаки — на границе колонок «Сб» и «Вс»; морда смотрит влево, на надпись
  function place() {
    var cx = lane.clientWidth * 6 / 7;
    canvas.style.transform = 'translateX(' + (cx - W / 2) + 'px) scaleX(-1)';
  }

  function frame(now) {
    requestAnimationFrame(frame);
    if (lane.offsetParent === null || document.hidden) return;
    draw(Math.sin(now / 1000 * 4.5));
    place();
  }

  draw(0); place();
  if (!reduced) requestAnimationFrame(frame);
  window.addEventListener('resize', place);
})();
