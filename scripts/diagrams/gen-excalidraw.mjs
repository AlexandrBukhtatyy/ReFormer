import fs from 'node:fs';
import path from 'node:path';
import { CODE_MODEL, resolveOut, ensureVizDir } from './paths.mjs';

// ---------- детерминированный PRNG (чтобы перегенерация давала тот же файл) ----------
let _s = 987654321;
const rnd = () => (_s = (_s * 1664525 + 1013904223) >>> 0) / 4294967296;
const seed = () => Math.floor(rnd() * 2 ** 31);

const els = [];
const textIndex = []; // для секции ## Text Elements

let _id = 0;
const nid = (p = 'el') => `${p}${(++_id).toString(36)}${Math.floor(rnd() * 1e6).toString(36)}`;

const BASE = () => ({
  angle: 0,
  strokeColor: '#1e1e1e',
  backgroundColor: 'transparent',
  fillStyle: 'solid',
  strokeWidth: 2,
  strokeStyle: 'solid',
  roughness: 0,
  opacity: 100,
  groupIds: [],
  frameId: null,
  roundness: null,
  seed: seed(),
  version: 1,
  versionNonce: seed(),
  isDeleted: false,
  boundElements: null,
  updated: 1,
  link: null,
  locked: false,
});

function rect(x, y, w, h, o = {}) {
  const el = {
    ...BASE(),
    id: nid('r'),
    type: 'rectangle',
    x,
    y,
    width: w,
    height: h,
    roundness: { type: 3 },
    ...o,
  };
  els.push(el);
  return el;
}

const CW = { 1: 0.58, 2: 0.52, 3: 0.6 }; // приблизительная ширина символа / fontSize

function text(x, y, str, o = {}) {
  const fontSize = o.fontSize ?? 16;
  const fontFamily = o.fontFamily ?? 2;
  const lines = str.split('\n');
  const w = o.width ?? Math.max(...lines.map((l) => l.length)) * fontSize * CW[fontFamily];
  const h = o.height ?? lines.length * fontSize * 1.25;
  const el = {
    ...BASE(),
    id: nid('t'),
    type: 'text',
    x,
    y,
    width: w,
    height: h,
    strokeWidth: 1,
    text: str,
    originalText: str,
    fontSize,
    fontFamily,
    textAlign: o.textAlign ?? 'left',
    verticalAlign: o.verticalAlign ?? 'top',
    containerId: null,
    lineHeight: 1.25,
    autoResize: true,
    ...o,
  };
  delete el.width2;
  els.push(el);
  textIndex.push({ text: str, id: el.id });
  return el;
}

function arrow(points, o = {}) {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const x0 = xs[0],
    y0 = ys[0];
  const rel = points.map(([px, py]) => [px - x0, py - y0]);
  const el = {
    ...BASE(),
    id: nid('a'),
    type: 'arrow',
    x: x0,
    y: y0,
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
    points: rel,
    // elbowed: false — ПРИНЦИПИАЛЬНО. У elbow-стрелок Excalidraw игнорирует
    // заданные точки и перекладывает маршрут своим роутером: на схеме появлялись
    // петли и развороты, которых нет в исходных координатах. С обычной ломаной
    // (roundness: null) рисуется ровно то, что рассчитано здесь, а все сегменты
    // и так строго горизонтальные/вертикальные — вид остаётся «под 90°».
    roundness: null,
    startBinding: null,
    endBinding: null,
    startArrowhead: null,
    endArrowhead: 'arrow',
    elbowed: false,
    ...o,
  };
  els.push(el);
  return el;
}

// ---------------- палитра ----------------
const C = {
  core: { s: '#1971c2', b: '#a5d8ff' },
  cdk: { s: '#6741d9', b: '#d0bfff' },
  rreact: { s: '#087f5b', b: '#96f2d7' },
  rjson: { s: '#0b7285', b: '#99e9f2' },
  uikit: { s: '#e8590c', b: '#ffd8a8' },
  mcp: { s: '#a61e4d', b: '#fcc2d7' },
  panel: { s: '#868e96', b: '#f8f9fa' },
  proj: { s: '#495057', b: '#e9ecef' },
};
const INK = '#1e1e1e';
const MUTED = '#5c5f66';

// ---------------- карточка пакета ----------------
function card({ x, y, w, h, color, name, version, role, body, metrics }) {
  rect(x, y, w, h, { strokeColor: color.s, backgroundColor: color.b, strokeWidth: 2 });
  text(x + 20, y + 16, name, { fontSize: 22, fontFamily: 2, strokeColor: color.s });
  text(x + w - 20 - version.length * 13 * 0.52, y + 20, version, {
    fontSize: 13,
    fontFamily: 3,
    strokeColor: MUTED,
  });
  text(x + 20, y + 48, role, { fontSize: 14, fontFamily: 2, strokeColor: INK });
  text(x + 20, y + 78, body, { fontSize: 13, fontFamily: 2, strokeColor: INK });
  text(x + 20, y + h - 26, metrics, { fontSize: 12, fontFamily: 3, strokeColor: MUTED });
}

// ================= ЗАГОЛОВОК =================
text(120, 60, 'ReFormer — карта пакетов и связей', {
  fontSize: 38,
  fontFamily: 2,
  strokeColor: INK,
});
text(
  120,
  112,
  'Монорепо npm workspaces · все пакеты v6.0.0 · граф построен по фактическим import-ам в packages/*/src (комментарии и JSDoc-примеры исключены)',
  { fontSize: 14, fontFamily: 2, strokeColor: MUTED }
);
text(
  120,
  140,
  'Читать снизу вверх: фундамент → надстройки → композиция → инструментарий. Стрелка всегда ведёт от того, кто импортирует, к тому, кого импортируют.',
  { fontSize: 14, fontFamily: 2, strokeColor: MUTED }
);
text(
  120,
  168,
  'Состояние: два расхождения из графа исправлены, под каждое добавлена автопроверка в CI. Метрики пересняты после пересборки.',
  { fontSize: 14, fontFamily: 2, strokeColor: '#2b8a3e' }
);

// ================= УРОВНИ =================
// подписи уровней слева
const LEVELS = [
  { y: 232, t: 'УРОВЕНЬ 3 · ИНСТРУМЕНТАРИЙ' },
  { y: 552, t: 'УРОВЕНЬ 2 · КОМПОЗИЦИЯ' },
  { y: 972, t: 'УРОВЕНЬ 1 · НАДСТРОЙКИ НАД ЯДРОМ' },
  { y: 1362, t: 'УРОВЕНЬ 0 · ФУНДАМЕНТ' },
];

// ================= КАРТОЧКИ =================
// L3 — mcp
card({
  x: 580,
  y: 260,
  w: 440,
  h: 232,
  color: C.mcp,
  name: '@reformer/mcp',
  version: 'v6.0.0',
  role: 'MCP-сервер: документация и валидация для AI-агентов',
  body:
    'src/: tools/ · prompts/ · utils/\n' +
    'tools: find_recipe · get_symbol_docs · list_symbols\n' +
    '       validate_json_schema · check_behaviors · report_issue\n' +
    'внешние: @modelcontextprotocol/sdk, handlebars\n' +
    'читает llms.txt + docs/llms всех 6 пакетов (createRequire)\n' +
    'резолв доков — тоже зависимость: все 5 объявлены optional peer',
  metrics: '28 файлов · 4 038 строк · 2 теста',
});

// L2 — ui-kit
card({
  x: 280,
  y: 580,
  w: 440,
  h: 332,
  color: C.uikit,
  name: '@reformer/ui-kit',
  version: 'v6.0.0',
  role: 'Готовые стилизованные компоненты (Tailwind + Radix)',
  body:
    'src/: components/ (72 каталога) · fields/ (8)\n' +
    '      meta.ts · lib/ · styles/\n' +
    '76 subpath-экспортов — больше, чем у всех остальных\n' +
    'вместе (./meta ./fields ./form-wizard ./table ./chart …)\n' +
    'внешние: radix-ui, lucide-react,\n' +
    'class-variance-authority, clsx, tailwind-merge\n' +
    '\n' +
    'meta.ts → defaultPropSchemas: контракт схем пропсов,\n' +
    'который динамически подгружает @reformer/mcp',
  metrics: '302 файла · 21 748 строк · 93 теста · 15/22 size-limit',
});

// L2 — renderer-json
card({
  x: 880,
  y: 580,
  w: 440,
  h: 332,
  color: C.rjson,
  name: '@reformer/renderer-json',
  version: 'v6.0.0',
  role: 'JSON-DSL → render-схема (форма из данных)',
  body:
    'src/: converter/ · operators · registry/ · schema/\n' +
    'locale/ · html/ · components/ · context/\n' +
    'операторы DSL: $model $component $dataSource $fn $locale\n' +
    '\n' +
    'subpath ./validate — изолированная точка входа с ajv,\n' +
    'чтобы ajv не попадал в основной render-бандл\n' +
    'внешние: ajv (единственная runtime-зависимость)\n' +
    'external задан предикатом /^@reformer\\// — покрывает\n' +
    'любой subpath, включая будущие',
  metrics: '25 файлов · 3 596 строк · 8 тестов · index 12.8 kB',
});

// L1 — cdk
card({
  x: 280,
  y: 1000,
  w: 440,
  h: 302,
  color: C.cdk,
  name: '@reformer/cdk',
  version: 'v6.0.0',
  role: 'Headless-компоненты поверх ядра (без стилей)',
  body:
    'src/components/: form-array · form-wizard · form-field\n' +
    '                 file-upload · async-boundary\n' +
    'src/validation/: error-resolver\n' +
    '\n' +
    '6 subpath-экспортов: ./form-array ./form-wizard\n' +
    './form-field ./file-upload ./async-boundary\n' +
    'внешних runtime-зависимостей нет (react — peer)',
  metrics: '78 файлов · 9 060 строк · 9 тестов · бюджет 10 kB',
});

// L1 — renderer-react
card({
  x: 880,
  y: 1000,
  w: 440,
  h: 302,
  color: C.rreact,
  name: '@reformer/renderer-react',
  version: 'v6.0.0',
  role: 'React-рендерер render-схемы',
  body:
    'src/core/: form-renderer · render-node · render-context\n' +
    '           render-behavior · render-schema-proxy · utils\n' +
    '\n' +
    'даёт RenderNodeComponent / FieldWrapperProps —\n' +
    'точку интеграции для ui-kit и renderer-json\n' +
    'внешних runtime-зависимостей нет (react — peer)',
  metrics: '9 файлов · 1 916 строк · 3 теста · бюджет 10 kB',
});

// L0 — core
card({
  x: 280,
  y: 1390,
  w: 1040,
  h: 250,
  color: C.core,
  name: '@reformer/core',
  version: 'v6.0.0',
  role: 'Реактивное ядро состояния формы на сигналах — единственный пакет без зависимостей на @reformer/*',
  body:
    'src/form/: nodes/ (FieldNode, GroupNode, ArrayNode) · factories/ · hooks/ · types/ · validation/     src/state/     src/signals.ts\n' +
    '\n' +
    '27 subpath-экспортов. Корневой barrel отдаёт form/types · form/factories · state · form + namespace validators,\n' +
    'но behaviors и schema-валидация в него НЕ входят: ./behaviors и ./validation — самостоятельные точки входа.\n' +
    './signals — единая точка владения @preact/signals-core: другие пакеты берут Signal отсюда, чтобы через границы\n' +
    'пакетов работал instanceof Signal (так написано в докблоке src/signals.ts).\n' +
    '\n' +
    'внешние runtime-зависимости: @preact/signals-core (27 импортов) · use-sync-external-store (мост к React через useSyncExternalStore)',
  metrics:
    '72 файла · 11 393 строк · 56 тестов (в packages/reformer/tests/) · бюджеты: index 21 kB · validators 5 kB · behaviors 5 kB · state 2 kB',
});

// подписи уровней (после карточек, чтобы были поверх)
for (const l of LEVELS) {
  text(126, l.y, l.t, { fontSize: 11, fontFamily: 3, strokeColor: '#adb5bd' });
}

// ================= СТРЕЛКИ =================
const SOLID = (color) => ({ strokeColor: color, strokeWidth: 2.5, strokeStyle: 'solid' });
const DOTTED = (color) => ({ strokeColor: color, strokeWidth: 2.5, strokeStyle: 'dotted' });

// A1 cdk -> core
arrow(
  [
    [430, 1302],
    [430, 1390],
  ],
  SOLID(C.cdk.s)
);
text(444, 1325, '6 знач. + 17 типов', { fontSize: 12, fontFamily: 3, strokeColor: C.cdk.s });

// A2 renderer-react -> core
arrow(
  [
    [1170, 1302],
    [1170, 1390],
  ],
  SOLID(C.rreact.s)
);
text(1184, 1325, '5 знач. + 4 типа', { fontSize: 12, fontFamily: 3, strokeColor: C.rreact.s });

// A3 ui-kit -> cdk
arrow(
  [
    [400, 912],
    [400, 1000],
  ],
  SOLID(C.uikit.s)
);
text(414, 935, '12 знач. + 4 типа', { fontSize: 12, fontFamily: 3, strokeColor: C.uikit.s });
text(414, 953, '5 subpath-ов', { fontSize: 12, fontFamily: 3, strokeColor: C.uikit.s });

// A4 renderer-json -> renderer-react
arrow(
  [
    [1200, 912],
    [1200, 1000],
  ],
  SOLID(C.rjson.s)
);
text(1214, 935, '2 знач. + 1 тип', { fontSize: 12, fontFamily: 3, strokeColor: C.rjson.s });

// A5 ui-kit -> renderer-react (обход справа)
arrow(
  [
    [720, 840],
    [800, 840],
    [800, 960],
    [960, 960],
    [960, 1000],
  ],
  SOLID(C.uikit.s)
);
text(742, 806, '1 знач. + 1 тип', { fontSize: 12, fontFamily: 3, strokeColor: C.uikit.s });

// A6 ui-kit -> core (обход слева)
arrow(
  [
    [280, 800],
    [190, 800],
    [190, 1500],
    [280, 1500],
  ],
  SOLID(C.uikit.s)
);
text(96, 1120, '4 знач.', { fontSize: 12, fontFamily: 3, strokeColor: C.uikit.s });
text(96, 1138, '+ 1 тип', { fontSize: 12, fontFamily: 3, strokeColor: C.uikit.s });

// A7 renderer-json -> core (обход справа)
arrow(
  [
    [1320, 800],
    [1412, 800],
    [1412, 1500],
    [1320, 1500],
  ],
  SOLID(C.rjson.s)
);
text(1424, 1120, '2 знач.', { fontSize: 12, fontFamily: 3, strokeColor: C.rjson.s });
text(1424, 1138, '+ 3 типа', { fontSize: 12, fontFamily: 3, strokeColor: C.rjson.s });

// A8 mcp -> ui-kit (динамический)
arrow(
  [
    [660, 492],
    [660, 536],
    [500, 536],
    [500, 580],
  ],
  DOTTED(C.mcp.s)
);
text(388, 512, "await import('@reformer/ui-kit/meta')", {
  fontSize: 12,
  fontFamily: 3,
  strokeColor: C.mcp.s,
});

// A9 mcp -> renderer-json (динамический)
arrow(
  [
    [940, 492],
    [940, 536],
    [1100, 536],
    [1100, 580],
  ],
  DOTTED(C.mcp.s)
);
text(950, 512, "await import('@reformer/renderer-json/validate')", {
  fontSize: 12,
  fontFamily: 3,
  strokeColor: C.mcp.s,
});

// A10 renderer-json -> ui-kit: объявлено, но не используется
arrow(
  [
    [880, 884],
    [724, 884],
  ],
  { strokeColor: '#adb5bd', strokeWidth: 2, strokeStyle: 'dashed' }
);
text(736, 894, 'optional peer: контракт реестра, не связь сборки', {
  fontSize: 11,
  fontFamily: 3,
  strokeColor: '#868e96',
});

// ================= ПРАВАЯ КОЛОНКА =================
const SX = 1620; // x сайдбара
const SW = 940;

// --- Легенда ---
const L0 = 170;
rect(SX, L0, SW, 300, { strokeColor: C.panel.s, backgroundColor: C.panel.b, strokeWidth: 1.5 });
text(SX + 24, L0 + 20, 'Как читать схему', { fontSize: 20, fontFamily: 2, strokeColor: INK });

arrow(
  [
    [SX + 30, L0 + 76],
    [SX + 110, L0 + 76],
  ],
  SOLID('#1971c2')
);
text(SX + 126, L0 + 66, 'статический import — реальная связь сборки; стрелка ведёт', {
  fontSize: 13,
  fontFamily: 2,
  strokeColor: INK,
});
text(SX + 126, L0 + 84, 'ОТ потребителя К зависимости (вниз по уровням)', {
  fontSize: 13,
  fontFamily: 2,
  strokeColor: INK,
});

arrow(
  [
    [SX + 30, L0 + 136],
    [SX + 110, L0 + 136],
  ],
  DOTTED('#a61e4d')
);
text(SX + 126, L0 + 126, 'динамический await import() — ленивая, необязательная связь;', {
  fontSize: 13,
  fontFamily: 2,
  strokeColor: INK,
});
text(SX + 126, L0 + 144, 'пакет работает и без неё (деградирует с понятной ошибкой)', {
  fontSize: 13,
  fontFamily: 2,
  strokeColor: INK,
});

arrow(
  [
    [SX + 30, L0 + 196],
    [SX + 110, L0 + 196],
  ],
  { strokeColor: '#adb5bd', strokeWidth: 2, strokeStyle: 'dashed' }
);
text(SX + 126, L0 + 186, 'связь объявлена в package.json (peerDependency), но ни одного', {
  fontSize: 13,
  fontFamily: 2,
  strokeColor: INK,
});
text(SX + 126, L0 + 204, 'импорта в исходниках нет — контракт потребителя, а не сборки', {
  fontSize: 13,
  fontFamily: 2,
  strokeColor: INK,
});

text(
  SX + 24,
  L0 + 240,
  '«знач.» = импорт значения (попадает в бандл).  «тип» = import type (стирается при компиляции).\n' +
    'Числа на стрелках — количество импорт-инструкций в src/ после вырезания комментариев.',
  { fontSize: 12, fontFamily: 2, strokeColor: MUTED }
);

// --- Метрики ---
const M0 = 505;
rect(SX, M0, SW, 330, { strokeColor: C.panel.s, backgroundColor: '#ffffff', strokeWidth: 1.5 });
text(SX + 24, M0 + 20, 'Объективные метрики (src/, без node_modules и dist)', {
  fontSize: 20,
  fontFamily: 2,
  strokeColor: INK,
});

const TBL = [
  ['пакет', 'файлов', 'строк', 'тестов', 'зависит от (по коду)'],
  ['core', '72', '11 393', '56', '—'],
  ['cdk', '78', '9 060', '9', 'core'],
  ['renderer-react', '9', '1 916', '3', 'core'],
  ['renderer-json', '25', '3 596', '8', 'core, renderer-react'],
  ['ui-kit', '302', '21 748', '93', 'core, cdk, renderer-react'],
  ['mcp', '28', '4 038', '2', 'ui-kit*, renderer-json*   (*динамически)'],
  ['ИТОГО', '514', '51 751', '171', ''],
];
const COLX = [SX + 24, SX + 210, SX + 300, SX + 400, SX + 490];
TBL.forEach((row, i) => {
  const y = M0 + 60 + i * 30 + (i === TBL.length - 1 ? 10 : 0);
  const isHead = i === 0;
  const isTotal = i === TBL.length - 1;
  row.forEach((cell, j) => {
    if (!cell) return;
    text(COLX[j], y, cell, {
      fontSize: 13,
      fontFamily: 3,
      strokeColor: isHead ? MUTED : isTotal ? INK : INK,
    });
  });
});
// разделители
rect(SX + 20, M0 + 86, SW - 40, 1, {
  strokeColor: '#dee2e6',
  backgroundColor: '#dee2e6',
  strokeWidth: 1,
  roundness: null,
});
rect(SX + 20, M0 + 270, SW - 40, 1, {
  strokeColor: '#dee2e6',
  backgroundColor: '#dee2e6',
  strokeWidth: 1,
  roundness: null,
});
text(SX + 24, M0 + 302, 'тесты считаются во всём пакете (src/ + tests/); строки — только src/', {
  fontSize: 11,
  fontFamily: 3,
  strokeColor: '#868e96',
});

// --- рендер списка наблюдений ---
function bullets(items, startY, accent) {
  let y = startY;
  for (const [head, tail] of items) {
    text(SX + 24, y, '▸', { fontSize: 14, fontFamily: 2, strokeColor: accent });
    text(SX + 46, y, head, { fontSize: 14, fontFamily: 2, strokeColor: accent });
    const hw = head.length * 14 * 0.52;
    const tl = tail.split('\n');
    text(SX + 46 + hw + 8, y, tl[0], { fontSize: 14, fontFamily: 2, strokeColor: INK });
    for (let i = 1; i < tl.length; i++) {
      text(SX + 46, y + 21 * i, tl[i], { fontSize: 14, fontFamily: 2, strokeColor: INK });
    }
    y += tl.length > 1 ? 21 * tl.length + 20 : 42;
  }
  return y;
}

// --- Сильные стороны ---
const O0 = 870;
rect(SX, O0, SW, 320, { strokeColor: '#2f9e44', backgroundColor: '#ebfbee', strokeWidth: 1.5 });
text(SX + 24, O0 + 20, 'Что граф говорит в пользу архитектуры', {
  fontSize: 20,
  fontFamily: 2,
  strokeColor: '#2b8a3e',
});
bullets(
  [
    ['Граф ацикличен.', 'Ровно 4 уровня, ни одного цикла между пакетами.'],
    [
      'Ядро изолировано.',
      '@reformer/core — ноль @reformer/*-импортов, всего две внешние runtime-зависимости.',
    ],
    [
      'cdk → core тоньше, чем кажется.',
      'Из 23 импортов 17 — import type, они стираются при сборке.',
    ],
    [
      'Тяжёлое вынесено в subpath-ы.',
      'ajv — только в renderer-json/validate; validators, behaviors и state\nв core — отдельными точками входа, а не одним barrel-ом.',
    ],
    [
      'Документация — единый контракт.',
      'Все 6 пакетов публикуют llms.txt и docs/llms (у core — 32 файла),\nmcp читает их через createRequire — поэтому знает больше, чем импортирует.',
    ],
  ],
  O0 + 60,
  '#2b8a3e'
);

// --- Расхождения (исправленные) ---
const D0 = 1225;
rect(SX, D0, SW, 330, { strokeColor: '#2f9e44', backgroundColor: '#f4fce3', strokeWidth: 1.5 });
text(SX + 24, D0 + 20, 'Найдено в коде и исправлено', {
  fontSize: 20,
  fontFamily: 2,
  strokeColor: '#2b8a3e',
});
bullets(
  [
    [
      'renderer-json вшивал рантайм сигналов.',
      'rollup сверяет external ПОСТРОЧНО, поэтому @reformer/core\nне покрывал /signals — в бандл уезжала вторая копия @preact/signals-core со своим классом Signal.\n`v instanceof Signal` в locale/use-signal-value.ts всегда давал false: <I18n> с $model рендерил\nобъект вместо значения и терял реактивность. Чинилось предикатом /^@reformer\\// в external.',
    ],
    [
      'core: мёртвый subpath ./validators/date.',
      'exports указывал на несобираемый файл, а 7 реально\nсобранных date-валидаторов в карте отсутствовали. Осталось от коммита «split date validator\ninto atomic validators»: vite.config поправили, exports — нет. Карта приведена в соответствие.',
    ],
  ],
  D0 + 60,
  '#2b8a3e'
);

// --- Открытые наблюдения ---
const N0 = 1585;
rect(SX, N0, SW, 250, { strokeColor: '#f08c00', backgroundColor: '#fff9db', strokeWidth: 1.5 });
text(SX + 24, N0 + 20, 'Открытые наблюдения (не дефекты)', {
  fontSize: 20,
  fontFamily: 2,
  strokeColor: '#e67700',
});
bullets(
  [
    [
      'Перекос массы в ui-kit.',
      '302 из 514 файлов (59%) и 21 748 из 51 751 строк (42%);\nединственный пакет, зависящий сразу от трёх других.',
    ],
    [
      'Тесты распределены неравномерно.',
      'ui-kit 93 и core 56 против renderer-react 3 и mcp 2 —\nпри том что renderer-react лежит на пути каждого рендера.',
    ],
    [
      'validate.js вне бюджета.',
      'Самый тяжёлый артефакт пакета (168 kB, ajv внутри — так задумано)\nне покрыт ни одной записью size-limit: там только dist/index.js на 10 kB.',
    ],
  ],
  N0 + 60,
  '#e67700'
);

// --- Сборка и контроль ---
const B0 = 1870;
rect(SX, B0, SW, 452, { strokeColor: '#1c7ed6', backgroundColor: '#e7f5ff', strokeWidth: 1.5 });
text(SX + 24, B0 + 20, 'Как это собирается и чем контролируется', {
  fontSize: 20,
  fontFamily: 2,
  strokeColor: '#1864ab',
});

const BUILD = [
  [
    'npm workspaces',
    'packages/* + projects/* в одном workspace; сборка всего — npm run build --workspaces',
  ],
  [
    'vite + dts ×5',
    'core, cdk, renderer-react, renderer-json, ui-kit собираются vite build + vite-plugin-dts.',
  ],
  ['', 'mcp — иначе: tsc + copy-templates.mjs (он не библиотека, а исполняемый bin reformer-mcp)'],
  [
    'generate:llms',
    'у всех 6 пакетов build начинается с генерации llms.txt — документация собирается',
  ],
  ['', 'вместе с кодом и не может разъехаться с ним'],
  ['generate:barrels', 'есть только у ui-kit — 76 subpath-экспортов руками не поддержать'],
  ['size-limit', '22 бюджета размера; падение бюджета ловит регрессию веса бандла'],
  ['knip', 'поиск мёртвого кода и неиспользуемых экспортов по всему монорепо'],
  ['check:dist-deps', 'сверяет реальные импорты в dist с объявленными зависимостями package.json'],
  ['check:exports-dist', 'НОВОЕ: карта exports против фактического dist — ловит и фантомы,'],
  ['', 'и «сирот» (собрано, но не объявлено). Добавлено вместе с починкой ./validators/date'],
  ['check:mcp-prompts', 'валидация промт-шаблонов mcp'],
  ['typecheck', 'корневой скрипт: 5 пакетов + react-playground; mcp в него не входит —'],
  ['', 'его типы проверяет только собственный tsc на этапе build'],
];
let by = B0 + 58;
for (const [k, v] of BUILD) {
  if (k) text(SX + 24, by, k, { fontSize: 13, fontFamily: 3, strokeColor: '#1864ab' });
  text(SX + 24 + 160, by, v, { fontSize: 13, fontFamily: 2, strokeColor: INK });
  by += k === '' ? 22 : 30;
}

// ================= ПОТРЕБИТЕЛИ =================
// ================= ПОРЯДОК СБОРКИ В CI =================
const CIY = 1672;
rect(120, CIY, 1200, 92, { strokeColor: '#1c7ed6', backgroundColor: '#e7f5ff', strokeWidth: 1.5 });
text(
  144,
  CIY + 14,
  'Порядок сборки и тестов в CI (.github/workflows/test.yml) — топологический, совпадает с уровнями схемы',
  { fontSize: 14, fontFamily: 2, strokeColor: '#1864ab' }
);
text(144, CIY + 42, 'core  →  cdk  →  renderer-react  →  ui-kit  →  renderer-json  →  mcp', {
  fontSize: 16,
  fontFamily: 3,
  strokeColor: '#1864ab',
});
text(
  144,
  CIY + 68,
  'каждый шаг — build, затем test. Здесь единственное место, где зафиксировано: renderer-json собирается ПОСЛЕ ui-kit.',
  { fontSize: 12, fontFamily: 2, strokeColor: MUTED }
);

const PY = 1792;
rect(120, PY, 1120, 200, { strokeColor: C.proj.s, backgroundColor: C.proj.b, strokeWidth: 1.5 });
text(144, PY + 20, 'Потребители внутри монорепо — projects/* (тот же npm workspace)', {
  fontSize: 20,
  fontFamily: 2,
  strokeColor: INK,
});

const PROJ = [
  [
    'react-playground',
    'витрина и песочница; dev-сервер монорепо (npm run dev)',
    'core · cdk · renderer-react · renderer-json · ui-kit',
  ],
  [
    'reformer-doc',
    'сайт документации (RU рендерится из i18n/ru/)',
    'core · cdk · renderer-react · renderer-json · ui-kit',
  ],
  [
    'react-playground-e2e',
    'playwright-тесты витрины',
    'зависимостей на @reformer/* нет — работает через UI',
  ],
];
PROJ.forEach((p, i) => {
  const y = PY + 62 + i * 44;
  text(144, y, p[0], { fontSize: 14, fontFamily: 3, strokeColor: C.proj.s });
  text(144 + 240, y, p[1], { fontSize: 13, fontFamily: 2, strokeColor: INK });
  text(144 + 240, y + 18, p[2], { fontSize: 12, fontFamily: 3, strokeColor: MUTED });
});

// ============================================================================
// ==================== РАЗДЕЛ 2: ДИАГРАММА КОДА ==============================
// ============================================================================
// Модель готовится .tmp/code-viz/{extract-code,extract-calls,prepare-model}.mjs:
// структура — через компилятор TypeScript, вызовы методов — через type checker.
const MODEL_PATH = CODE_MODEL;
if (!fs.existsSync(MODEL_PATH)) {
  console.error(`модель не найдена: ${MODEL_PATH}\nсначала выполните: npm run diagram`);
  process.exit(1);
}
const model = JSON.parse(fs.readFileSync(MODEL_PATH, 'utf8'));

// цвет региона = цвет пакета на карте выше
const PKG_COLOR = {
  core: C.core,
  cdk: C.cdk,
  'renderer-react': C.rreact,
  'renderer-json': C.rjson,
  'ui-kit': C.uikit,
  mcp: C.mcp,
};

const CODE_Y0 = 2400; // старт раздела по вертикали
const REGION_X = 400; // слева от регионов — коридор под 11 межпакетных линий
const COLW = 545; // ширина колонки = ширина бокса каталога
const COL_GAP = 92; // вертикальный коридор между колонками (до 6 полос по 15 px)
const ROW_GAP = 104; // горизонтальный коридор между рядами (до 8 полос по 13 px)
const PAD = 26; // отступ содержимого от края региона
const HEAD = 58; // высота шапки региона
const MAX_COLS = 4;
const FILE_GAP = 9;
const LINE_H = 14;
const CODE_FS = 11;

const boxes = {}; // 'pkg|dir' -> геометрия бокса каталога
const regions = []; // геометрия регионов + их коридоры

// --- заголовок раздела
text(REGION_X, CODE_Y0, 'Диаграмма кода', { fontSize: 38, fontFamily: 2, strokeColor: INK });
text(
  REGION_X,
  CODE_Y0 + 52,
  `Каталог → файлы → символы. Каждый файл — отдельный блок. Извлечено компилятором TypeScript из packages/*/src: ${model.totals.files} файлов, ${model.totals.symbols} экспортируемых символов, ${model.totals.classes} классов.`,
  { fontSize: 14, fontFamily: 2, strokeColor: MUTED }
);
text(
  REGION_X,
  CODE_Y0 + 78,
  `Пунктир — кто кого вызывает; имена на стрелке это реально вызываемые функции и методы, разрешённые type checker-ом (${model.totals.methodCallEdges} вызовов методов + ${model.totals.fnCallEdges} вызовов функций свёрнуты до ${model.edges.length} связей).`,
  { fontSize: 14, fontFamily: 2, strokeColor: MUTED }
);
text(
  REGION_X,
  CODE_Y0 + 104,
  'Линии идут только по коридорам между блоками — сетка построена так, чтобы стрелка нигде не пересекала содержимое.',
  { fontSize: 14, fontFamily: 2, strokeColor: '#2b8a3e' }
);

// --- обозначения видов символов
const KINDS = [
  ['cls', 'класс (ниже — публичные методы)'],
  ['fn', 'функция'],
  ['T', 'тип / интерфейс'],
  ['c', 'константа'],
  ['<>', 'React-компонент'],
  ['use', 'хук'],
];
let kx = REGION_X;
KINDS.forEach(([k, d]) => {
  text(kx, CODE_Y0 + 132, k, { fontSize: 12, fontFamily: 3, strokeColor: '#c92a2a' });
  text(kx + k.length * 12 * 0.6 + 8, CODE_Y0 + 132, d, {
    fontSize: 12,
    fontFamily: 2,
    strokeColor: MUTED,
  });
  kx += k.length * 12 * 0.6 + 16 + d.length * 12 * 0.52 + 26;
});

/** Размер бокса одного файла. */
function fileSize(f) {
  return { w: COLW - 2 * 14, h: 20 + f.lines.length * LINE_H + 8 };
}
/** Размер бокса каталога = шапка + вложенные боксы файлов. */
function dirSize(d) {
  let h = 34;
  for (const f of d.files) h += fileSize(f).h + FILE_GAP;
  if (d.hiddenFiles) h += 18;
  return { w: COLW, h: h + 8 };
}

let cursorY = CODE_Y0 + 176;

for (const pkg of model.packages) {
  const col = PKG_COLOR[pkg.key];
  const sized = pkg.dirs.map((d) => ({ d, ...dirSize(d) }));
  // сортировка по высоте — в СЕТКЕ ряд равен самому высокому боксу,
  // поэтому близкие по высоте боксы кладём в один ряд, иначе много пустоты
  sized.sort((a, b) => b.h - a.h);

  const nCols = Math.min(MAX_COLS, sized.length);
  const rows = [];
  for (let i = 0; i < sized.length; i += nCols) rows.push(sized.slice(i, i + nCols));

  const rowH = rows.map((r) => Math.max(...r.map((b) => b.h)));
  const innerH = rowH.reduce((a, h) => a + h, 0) + (rows.length - 1) * ROW_GAP;
  const regionW = 2 * PAD + nCols * COLW + (nCols - 1) * COL_GAP;
  // ROW_GAP после шапки — это верхний коридор; без него линии шли бы по названию пакета
  const regionH = HEAD + ROW_GAP + innerH + PAD;

  rect(REGION_X, cursorY, regionW, regionH, {
    strokeColor: col.s,
    backgroundColor: col.b,
    strokeWidth: 2,
  });
  text(REGION_X + PAD, cursorY + 16, pkg.name, { fontSize: 22, fontFamily: 2, strokeColor: col.s });
  text(
    REGION_X + PAD + pkg.name.length * 22 * 0.6 + 28,
    cursorY + 24,
    `${pkg.fileCount} файлов · ${pkg.symCount} символов · ${pkg.dirs.length} каталогов на схеме`,
    { fontSize: 13, fontFamily: 3, strokeColor: MUTED }
  );

  // координаты коридоров: между рядами/колонками и по краям содержимого
  const hCh = [cursorY + HEAD + ROW_GAP / 2];
  const vCh = [REGION_X + PAD - COL_GAP / 2];
  let ry = cursorY + HEAD + ROW_GAP;
  rows.forEach((row, ri) => {
    row.forEach((b, ci) => {
      const bx = REGION_X + PAD + ci * (COLW + COL_GAP);
      b.x = bx;
      b.y = ry;
      boxes[`${pkg.key}|${b.d.path}`] = { x: bx, y: ry, w: b.w, h: b.h, pkg: pkg.key };
    });
    ry += rowH[ri];
    hCh.push(ry + ROW_GAP / 2);
    ry += ROW_GAP;
  });
  for (let c = 1; c <= nCols; c++) vCh.push(REGION_X + PAD + c * (COLW + COL_GAP) - COL_GAP / 2);

  regions.push({ pkg: pkg.key, x: REGION_X, y: cursorY, w: regionW, h: regionH, hCh, vCh });

  // --- отрисовка боксов каталогов и вложенных файлов
  for (const b of rows.flat()) {
    rect(b.x, b.y, b.w, b.h, { strokeColor: col.s, backgroundColor: '#ffffff', strokeWidth: 1.5 });
    text(b.x + 14, b.y + 9, b.d.path, { fontSize: 13, fontFamily: 3, strokeColor: col.s });
    const stat = `${b.d.fileCount} ф · ${b.d.symCount} с`;
    text(b.x + b.w - 14 - stat.length * 11 * 0.6, b.y + 11, stat, {
      fontSize: 11,
      fontFamily: 3,
      strokeColor: '#adb5bd',
    });

    let fy = b.y + 34;
    for (const f of b.d.files) {
      const fs2 = fileSize(f);
      // сам файл — отдельный квадрат внутри каталога
      rect(b.x + 14, fy, fs2.w, fs2.h, {
        strokeColor: '#ced4da',
        backgroundColor: '#f8f9fa',
        strokeWidth: 1,
      });
      text(b.x + 22, fy + 5, f.name, { fontSize: CODE_FS, fontFamily: 3, strokeColor: INK });
      let ly = fy + 21;
      for (const l of f.lines) {
        const c2 = l.t === 'more' ? '#adb5bd' : l.t === 'meth' ? '#6741d9' : MUTED;
        text(b.x + 22, ly, l.s, { fontSize: CODE_FS, fontFamily: 3, strokeColor: c2 });
        ly += LINE_H;
      }
      fy += fs2.h + FILE_GAP;
    }
    if (b.d.hiddenFiles) {
      text(b.x + 22, fy, `… ещё ${b.d.hiddenFiles} файл(ов)`, {
        fontSize: CODE_FS,
        fontFamily: 3,
        strokeColor: '#adb5bd',
      });
    }
  }

  cursorY += regionH + 90; // зазор между регионами — тоже коридор
}

// ---------- маршрутизация: без петель, полосы разложены вложенно ----------
//
// Форма маршрута выбирается по ситуации, а не одна на всех:
//   Z — оба блока выходят в ОДИН коридор (соседние ряды): вниз, вбок, вниз. 3 отрезка.
//   S — коридоры разные: добавляется вертикальная перемычка. 5 отрезков.
//   ⌐ — блоки в одной колонке: спуск по своей вертикали без ухода вбок.
// Раньше форма всегда была одна (S), поэтому у соседних блоков получался крюк
// к вертикальному коридору и обратно — та самая «лишняя петля».
//
// Полосы внутри коридора раскладываются не в порядке поступления, а по ширине
// пролёта: длинные линии уходят наружу, короткие остаются у блоков. Так линии
// вкладываются друг в друга вместо того, чтобы перехлёстываться.

const regionOf = (pkgKey) => regions.find((r) => r.pkg === pkgKey);

const keyOf = (pkg, dir) => {
  const norm = dir === '.' ? 'src/' : dir.endsWith('/') ? dir : dir + '/';
  if (boxes[`${pkg}|${norm}`]) return `${pkg}|${norm}`;
  return Object.keys(boxes).find(
    (k) => k.startsWith(pkg + '|') && k.includes('components/') && norm.startsWith('components/')
  );
};

// ---- 1. планирование: коридоры и грани
const plans = [];
for (const e of model.edges) {
  const a = boxes[keyOf(e.fromPkg, e.fromDir)];
  const b = boxes[keyOf(e.toPkg, e.toDir)];
  if (!a || !b || a === b) continue;

  const ra = regionOf(e.fromPkg);
  const rb = regionOf(e.toPkg);
  const chanAbove = (r, box) => [...r.hCh].filter((y) => y <= box.y).pop() ?? r.hCh[0];
  const chanBelow = (r, box) => r.hCh.find((y) => y >= box.y + box.h) ?? r.hCh[r.hCh.length - 1];

  const aAbove = chanAbove(ra, a),
    aBelow = chanBelow(ra, a);
  const bAbove = chanAbove(rb, b),
    bBelow = chanBelow(rb, b);

  // Если у блоков есть ОБЩИЙ коридор — берём его и идём напрямую. Без этой
  // проверки блоки одного ряда получали коридоры по разные стороны ряда:
  // линия уходила вниз под ряд и возвращалась вверх над ним — петля на ~900 px.
  // из общих коридоров берём НЕ первый попавшийся, а ближайший к обоим блокам:
  // иначе линия уходит под ряд, хотя коридор над рядом вдвое ближе
  const distTo = (h, box) => Math.abs(h - Math.min(Math.max(h, box.y), box.y + box.h));
  const sharedCands = !e.cross
    ? [aAbove, aBelow].filter(
        (h) => Math.round(h) === Math.round(bAbove) || Math.round(h) === Math.round(bBelow)
      )
    : [];
  const shared = sharedCands.length
    ? sharedCands.reduce((p, c) =>
        distTo(c, a) + distTo(c, b) < distTo(p, a) + distTo(p, b) ? c : p
      )
    : undefined;

  let hA, hB, aSide, bSide;
  if (shared !== undefined) {
    hA = hB = shared;
    aSide = shared >= a.y + a.h ? 'bottom' : 'top';
    bSide = shared >= b.y + b.h ? 'bottom' : 'top';
  } else {
    const goDown = b.y >= a.y;
    hA = goDown ? aBelow : aAbove;
    hB = goDown ? bAbove : bBelow;
    aSide = goDown ? 'bottom' : 'top';
    bSide = goDown ? 'top' : 'bottom';
  }

  plans.push({
    e,
    a,
    b,
    ra,
    rb,
    aSide,
    bSide,
    hA,
    hB,
    single: shared !== undefined,
  });
}

// ---- 2. точки на гранях блоков
const sideGroups = new Map();
for (const p of plans) {
  const ka = `${keyOf(p.e.fromPkg, p.e.fromDir)}|${p.aSide}`;
  const kb = `${keyOf(p.e.toPkg, p.e.toDir)}|${p.bSide}`;
  if (!sideGroups.has(ka)) sideGroups.set(ka, []);
  if (!sideGroups.has(kb)) sideGroups.set(kb, []);
  sideGroups.get(ka).push({ p, end: 'a' });
  sideGroups.get(kb).push({ p, end: 'b' });
}
const usedAnchorX = new Set();
for (const [k, list] of sideGroups) {
  const box = boxes[k.split('|').slice(0, 2).join('|')];
  // порядок точек по горизонтали противоположного конца — линии не перехлёстываются
  list.sort((u, v) => {
    const tx = (z) => (z.end === 'a' ? z.p.b.x + z.p.b.w / 2 : z.p.a.x + z.p.a.w / 2);
    return tx(u) - tx(v);
  });
  const n = list.length;
  list.forEach((z, i) => {
    let x = box.x + (box.w * (i + 1)) / (n + 1);
    while (usedAnchorX.has(Math.round(x))) x += 7;
    usedAnchorX.add(Math.round(x));
    if (z.end === 'a') z.p.ax = x;
    else z.p.bx = x;
  });
}

// ---- 3. форма маршрута и опорные координаты
// Межпакетные вертикали НЕ обязаны идти в дальний левый коридор: колоночные
// зазоры у всех регионов рассчитываются по одной формуле, поэтому лежат на общих x
// и свободны по всей высоте (там, где у региона меньше колонок — там вообще пусто).
// Раньше линия уходила через весь холст влево и возвращалась: путь 6014 px при
// прямом расстоянии 975.
const globalVCh = [];
for (let c = 0; c <= MAX_COLS; c++) {
  globalVCh.push(REGION_X + PAD + c * (COLW + COL_GAP) - COL_GAP / 2);
}

/**
 * Вертикаль для маршрута. Берём зазор, лежащий МЕЖДУ точками входа: если взять
 * просто ближайший к середине, он может оказаться за пределами отрезка — и линия
 * сначала уедет в сторону, а потом вернётся (тот самый крюк).
 */
function pickV(cands, x1, x2) {
  const lo = Math.min(x1, x2);
  const hi = Math.max(x1, x2);
  const mid = (x1 + x2) / 2;
  const inside = cands.filter((x) => x > lo && x < hi);
  return (inside.length ? inside : cands).reduce((p, c) =>
    Math.abs(c - mid) < Math.abs(p - mid) ? c : p
  );
}

for (const p of plans) {
  if (p.e.cross) {
    p.shape = 'S';
    p.vBase = pickV(globalVCh, p.ax, p.bx);
  } else if (p.single) {
    // один коридор: вниз — вбок — вниз, без перемычки
    p.shape = 'Z';
  } else if (Math.abs(p.ax - p.bx) < 4) {
    // строго под блоком — спускаемся своей вертикалью
    p.shape = 'I';
  } else {
    p.shape = 'S';
    p.vBase = pickV(p.ra.vCh, p.ax, p.bx);
  }
}

// ---- 4. полосы: сортировка по ширине пролёта, потом равномерная раскладка
// Порядок полос в коридоре. Подбирался замером: center даёт меньше всего
// пересечений (98 против 114 у сортировки по длине пролёта).
const SORTERS = {
  spanDesc: (u, v) => v.span - u.span,
  spanAsc: (u, v) => u.span - v.span,
  left: (u, v) => u.lo - v.lo,
  center: (u, v) => (u.lo + u.hi) / 2 - (v.lo + v.hi) / 2,
};
function assignLanes(requests, gapWidth, maxSpacing) {
  const byChannel = new Map();
  for (const r of requests) {
    const k = Math.round(r.base);
    if (!byChannel.has(k)) byChannel.set(k, []);
    byChannel.get(k).push(r);
  }
  for (const [, list] of byChannel) {
    // длинный пролёт — наружу, короткий — внутрь: линии вкладываются
    list.sort(SORTERS[process.env.LANE_SORT ?? 'center']);
    const n = list.length;
    const usable = gapWidth - 12;
    const step = n > 1 ? Math.min(maxSpacing, usable / (n - 1)) : 0;
    list.forEach((r, i) => {
      r.value = r.base + (n === 1 ? 0 : (i - (n - 1) / 2) * step);
    });
  }
}

const hReq = [];
const vReq = [];
for (const p of plans) {
  const span = (x1, x2) => Math.abs(x2 - x1);
  if (p.shape === 'Z') {
    p.rA = {
      base: p.hA,
      span: span(p.ax, p.bx),
      lo: Math.min(p.ax, p.bx),
      hi: Math.max(p.ax, p.bx),
    };
    hReq.push(p.rA);
  } else if (p.shape === 'I') {
    // горизонталей нет вовсе
  } else {
    p.rA = {
      base: p.hA,
      span: span(p.ax, p.vBase),
      lo: Math.min(p.ax, p.vBase),
      hi: Math.max(p.ax, p.vBase),
    };
    p.rB = {
      base: p.hB,
      span: span(p.vBase, p.bx),
      lo: Math.min(p.vBase, p.bx),
      hi: Math.max(p.vBase, p.bx),
    };
    hReq.push(p.rA, p.rB);
    // и межпакетные, и внутренние вертикали делят одни и те же колоночные зазоры,
    // поэтому полосы для них выдаёт общий распределитель
    p.rV = {
      base: p.vBase,
      span: Math.abs(p.hB - p.hA),
      lo: Math.min(p.hA, p.hB),
      hi: Math.max(p.hA, p.hB),
    };
    vReq.push(p.rV);
  }
}
assignLanes(hReq, ROW_GAP, 14);
assignLanes(vReq, COL_GAP, 16);

// ---- 5. отрисовка
const skippedLabels = [];
const placedLabels = [];
const allSegs = [];
let drawnEdges = 0;

for (const p of plans) {
  const { e, a, b } = p;
  const col = PKG_COLOR[e.fromPkg].s;
  const ax = p.ax;
  const bx = p.bx;
  const ay = p.aSide === 'bottom' ? a.y + a.h : a.y;
  const by = p.bSide === 'bottom' ? b.y + b.h : b.y;

  let pts;
  if (p.shape === 'I') {
    pts = [
      [ax, ay],
      [bx, by],
    ];
  } else if (p.shape === 'Z') {
    const h = p.rA.value;
    pts = [
      [ax, ay],
      [ax, h],
      [bx, h],
      [bx, by],
    ];
  } else {
    const hA = p.rA.value;
    const hB = p.rB.value;
    const vX = p.rV.value;
    pts = [
      [ax, ay],
      [ax, hA],
      [vX, hA],
      [vX, hB],
      [bx, hB],
      [bx, by],
    ];
  }
  pts = pts.filter((q, i, arr) => i === 0 || q[0] !== arr[i - 1][0] || q[1] !== arr[i - 1][1]);

  arrow(pts, {
    strokeColor: col,
    strokeWidth: e.cross ? 2 : 1.5,
    strokeStyle: 'dashed',
    opacity: e.cross ? 100 : 70,
  });
  p.pts = pts;
  allSegs.push(
    ...pts.slice(1).map((q, i) => ({ x1: pts[i][0], y1: pts[i][1], x2: q[0], y2: q[1] }))
  );
  drawnEdges++;
}

// ---- 6. подписи — после всех линий
for (const p of plans) {
  const { e, pts } = p;
  if (!pts) continue;
  const col = PKG_COLOR[e.fromPkg].s;
  const cap = e.cross ? 3 : 2;
  const label =
    e.names.slice(0, cap).join(' ') + (e.names.length > cap ? ` +${e.names.length - cap}` : '');
  const fs_ = e.cross ? 11 : 10;
  const lw = label.length * fs_ * 0.6;
  const lh = fs_ * 1.25;
  const allB = Object.values(boxes);
  const hits = (x, y) =>
    allB.some((q) => x < q.x + q.w && q.x < x + lw && y < q.y + q.h && q.y < y + lh) ||
    placedLabels.some((q) => x < q.x + q.w && q.x < x + lw && y < q.y + q.h && q.y < y + lh) ||
    allSegs.some((s) => {
      const sl = Math.min(s.x1, s.x2),
        sr = Math.max(s.x1, s.x2);
      const st = Math.min(s.y1, s.y2),
        sb = Math.max(s.y1, s.y2);
      return x < sr && sl < x + lw && y < sb && st < y + lh;
    });

  const cands = [];
  for (let i = 1; i < pts.length; i++) {
    const [x1, y1] = pts[i - 1];
    const [x2, y2] = pts[i];
    if (y1 !== y2 || Math.abs(x2 - x1) < lw * 0.5) continue;
    for (const dy of [-lh - 3, 4]) {
      for (const f of [0.5, 0.3, 0.7, 0.15, 0.85]) {
        cands.push([x1 + (x2 - x1) * f - lw / 2, y1 + dy]);
      }
    }
  }
  const spot = cands.find(([x, y]) => !hits(x, y));
  if (spot) {
    text(spot[0], spot[1], label, {
      fontSize: fs_,
      fontFamily: 3,
      strokeColor: col,
      opacity: e.cross ? 100 : 85,
    });
    placedLabels.push({ x: spot[0], y: spot[1], w: lw, h: lh });
  } else {
    skippedLabels.push(`${e.fromPkg}/${e.fromDir} → ${e.toPkg}/${e.toDir}: ${e.names.join(' ')}`);
  }
}

// --- что свёрнуто
const capLines = [...model.caps];
if (skippedLabels.length) {
  capLines.push(
    `${skippedLabels.length} подпис(ь/и) не поместились у линии — связи нарисованы, имена здесь:`
  );
  capLines.push(...skippedLabels.map((s) => '    ' + s));
}
const capW = Math.max(...regions.map((r) => r.w));
rect(REGION_X, cursorY, capW, 44 + capLines.length * 18, {
  strokeColor: '#868e96',
  backgroundColor: '#f8f9fa',
  strokeWidth: 1.5,
});
text(
  REGION_X + PAD,
  cursorY + 14,
  'Что на схеме свёрнуто (полные данные — в .tmp/code-viz/code-structure.json)',
  {
    fontSize: 14,
    fontFamily: 2,
    strokeColor: INK,
  }
);
capLines.forEach((c, i) => {
  text(REGION_X + PAD, cursorY + 40 + i * 18, c.startsWith('    ') ? c : '· ' + c, {
    fontSize: 11,
    fontFamily: 3,
    strokeColor: MUTED,
  });
});

console.log(
  `[диаграмма кода] регионов: ${regions.length}, каталогов: ${Object.keys(boxes).length}, стрелок: ${drawnEdges}`
);

// ================= СБОРКА =================
const drawing = {
  type: 'excalidraw',
  version: 2,
  source: 'https://github.com/zsviczian/obsidian-excalidraw-plugin',
  elements: els,
  appState: {
    gridSize: null,
    gridStep: 5,
    gridModeEnabled: false,
    viewBackgroundColor: '#ffffff',
  },
  files: {},
};

const textSection = textIndex.map((t) => `${t.text} ^${t.id}`).join('\n\n');

const md = `---

excalidraw-plugin: parsed
tags: [excalidraw]

---
==⚠  Switch to EXCALIDRAW VIEW in the MORE OPTIONS menu of this document. ⚠== You can decompress Drawing data with the command palette: 'Decompress current Excalidraw file'. For more info check in plugin settings under 'Saving'


# Excalidraw Data

## Text Elements
${textSection}

%%
## Drawing
\`\`\`json
${JSON.stringify(drawing, null, 1)}
\`\`\`
%%`;

const OUT = resolveOut(process.argv[2]);
if (path.dirname(OUT) === path.dirname(CODE_MODEL)) ensureVizDir();
fs.writeFileSync(OUT, md, 'utf8');
console.log(`OK: ${OUT}`);
console.log(`элементов: ${els.length} (текстовых: ${textIndex.length})`);
