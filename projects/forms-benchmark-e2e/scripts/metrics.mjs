/**
 * Что отчёт извлекает из записей фаз (phases.ndjson). Каждая метрика — свёртка ОДНОГО прогона;
 * статистика по прогонам — в report.mjs. Меньше — лучше для всех метрик.
 */
import { median, quantile } from './stats.mjs';

const perKey = (total, keys) => (keys?.length ? total / keys.length : null);

export const METRICS = {
  load: [
    {
      id: 'ready',
      label: 'Готовность формы (от начала навигации)',
      unit: 'мс',
      get: (r) => r.readyMs,
    },
    { id: 'fcp', label: 'First Contentful Paint', unit: 'мс', get: (r) => r.fcpMs },
    {
      id: 'hydrate',
      label: 'Гидратация: ответ префилла → готово',
      unit: 'мс',
      get: (r) => r.hydrateMs,
      only: ['load-invite'],
    },
    {
      id: 'script',
      label: 'Выполнение JS (CDP ScriptDuration)',
      unit: 'мс',
      get: (r) => r.cdp.script,
    },
    { id: 'tbt', label: 'Total Blocking Time', unit: 'мс', get: (r) => r.longTasks.tbt },
    { id: 'heap', label: 'JS heap после GC', unit: 'КБ', get: (r) => r.heap / 1024 },
    { id: 'nodes', label: 'DOM-узлы', unit: '', get: (r) => r.nodes },
  ],
  typing: [
    {
      id: 'keyProc',
      label: 'Клавиша → конец обработки (медиана)',
      unit: 'мс',
      get: (r) => median(r.keys.proc),
    },
    {
      id: 'keyProcP95',
      label: 'Клавиша → конец обработки (p95 прогона)',
      unit: 'мс',
      get: (r) => quantile(r.keys.proc, 0.95),
    },
    {
      id: 'keyFrame',
      label: 'Клавиша → конец кадра (медиана)',
      unit: 'мс',
      get: (r) => median(r.keys.frame),
    },
    {
      id: 'scriptPerKey',
      label: 'JS на клавишу (CDP)',
      unit: 'мс',
      get: (r) => perKey(r.cdp.script, r.keys.proc),
    },
    {
      id: 'layoutPerKey',
      label: 'Layout + style на клавишу',
      unit: 'мс',
      get: (r) => perKey(r.cdp.layout + r.cdp.style, r.keys.proc),
    },
    {
      id: 'slowEvents',
      label: 'События ≥ 16 мс (Event Timing)',
      unit: 'шт',
      get: (r) => r.eventTiming.count16,
    },
    { id: 'tbt', label: 'Total Blocking Time', unit: 'мс', get: (r) => r.longTasks.tbt },
  ],
  click: [
    {
      id: 'clickFrame',
      label: 'Клик → конец кадра',
      unit: 'мс',
      get: (r) => r.clicks.frame[0] ?? null,
    },
    { id: 'settle', label: 'Клик → UI затих', unit: 'мс', get: (r) => r.uiSettleMs },
    { id: 'script', label: 'Выполнение JS (CDP)', unit: 'мс', get: (r) => r.cdp.script },
    { id: 'layout', label: 'Layout + style', unit: 'мс', get: (r) => r.cdp.layout + r.cdp.style },
  ],
  async: [
    {
      id: 'settle',
      label: 'Ввод → UI затих (вкл. debounce 300 мс и сеть 20 мс)',
      unit: 'мс',
      get: (r) => r.uiSettleMs,
    },
    {
      id: 'keyProc',
      label: 'Клавиша → конец обработки (медиана)',
      unit: 'мс',
      get: (r) => median(r.keys.proc),
    },
    { id: 'script', label: 'Выполнение JS за фазу (CDP)', unit: 'мс', get: (r) => r.cdp.script },
  ],
  remount: [
    {
      id: 'mountSync',
      label: 'Монтирование: рендер + commit + эффекты',
      unit: 'мс',
      get: (r) => median(r.mountSyncMs),
    },
    {
      id: 'mountReady',
      label: 'Монтирование: до кадра с готовой формой',
      unit: 'мс',
      get: (r) => median(r.mountReadyMs),
    },
    {
      id: 'scriptPerCycle',
      label: 'JS на цикл mount + unmount (CDP)',
      unit: 'мс',
      get: (r) => r.cdp.script,
    },
    {
      id: 'heapSlope',
      label: 'Прирост heap на перемонтирование (утечка)',
      unit: 'КБ',
      get: (r) => slope(r.checkpoints, 'heap') / 1024,
      signed: true,
    },
    {
      id: 'nodesSlope',
      label: 'Прирост DOM-узлов на перемонтирование',
      unit: 'шт',
      get: (r) => slope(r.checkpoints, 'nodes'),
      signed: true,
    },
  ],
};

/**
 * Метрики чистого CPU-времени main thread: время кода и вёрстки без таймеров, сети и ожидания
 * кадра. Их масштаб следует за скоростью машины почти пропорционально, поэтому по ним
 * `bench:compare` строит индекс скорости по baseline и сводку по участникам. У остальных метрик в
 * мс (готовность, FCP, «UI затих», «до кадра», TBT) нормировка приблизительна: debounce, задержка
 * fake API и кадры от CPU не зависят, а TBT считает только часть задачи сверх 50 мс.
 */
export const CPU_TIME_METRICS = new Set([
  'script',
  'scriptPerKey',
  'layoutPerKey',
  'layout',
  'keyProc',
  'keyProcP95',
  'mountSync',
  'scriptPerCycle',
]);

function slope(points, key) {
  if (!points || points.length < 2) return null;
  const xs = points.map((p) => p.i);
  const ys = points.map((p) => p[key]);
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  const num = xs.reduce((acc, x, i) => acc + (x - mx) * (ys[i] - my), 0);
  const den = xs.reduce((acc, x) => acc + (x - mx) ** 2, 0);
  return den ? num / den : null;
}

/** Фазы форм: порядок в отчёте, заголовок, тип метрик. */
export const PHASES = {
  registration: [
    { id: 'load', title: 'Холодная загрузка', kind: 'load' },
    { id: 'load-invite', title: 'Загрузка по приглашению (гидратация префиллом)', kind: 'load' },
    { id: 'typing-pristine', title: 'Ввод до первой отправки (username, email)', kind: 'typing' },
    { id: 'submit-invalid', title: 'Отправка с ошибками → ошибки на экране', kind: 'click' },
    {
      id: 'typing-live',
      title: 'Ввод после отправки — живая валидация (пароль, имя, телефон)',
      kind: 'typing',
    },
    { id: 'async-taken', title: 'Занятое имя: ввод → ошибка от сервера', kind: 'async' },
    { id: 'async-fix', title: 'Исправление имени: ввод → ошибка снята', kind: 'async' },
    { id: 'captcha-refresh', title: 'Обновление капчи', kind: 'click' },
    { id: 'captcha-type', title: 'Ввод капчи с проверкой на сервере', kind: 'async' },
    { id: 'terms', title: 'Чекбокс условий', kind: 'click' },
    { id: 'submit-valid', title: 'Успешная отправка', kind: 'click' },
    { id: 'remount', title: 'Перемонтирование формы', kind: 'remount' },
  ],
  credit: [
    { id: 'load', title: 'Холодная загрузка', kind: 'load' },
    {
      id: 'load-application',
      title: 'Загрузка сохранённой заявки (гидратация данными)',
      kind: 'load',
    },
    { id: 'next-invalid', title: '«Далее» на пустом шаге 1 → ошибки', kind: 'click' },
    { id: 'loan-type', title: 'Тип кредита → ипотека: условные поля и ставка', kind: 'click' },
    {
      id: 'step1-typing',
      title: 'Шаг 1: сумма, срок, цель, стоимость (живая валидация, вычисляемые)',
      kind: 'typing',
    },
    { id: 'next-1', title: 'Переход на шаг 2', kind: 'click' },
    { id: 'step2-typing', title: 'Шаг 2: ФИО, паспорт, ИНН (маски)', kind: 'typing' },
    { id: 'next-2', title: 'Переход на шаг 3', kind: 'click' },
    { id: 'step3-typing', title: 'Шаг 3: телефон, email, адрес', kind: 'typing' },
    { id: 'next-3', title: 'Переход на шаг 4', kind: 'click' },
    { id: 'employment-switch', title: 'Статус занятости → ИП: смена секций', kind: 'click' },
    {
      id: 'step4-typing',
      title: 'Шаг 4: стаж и доход (кросс-правила, доля платежа)',
      kind: 'typing',
    },
    { id: 'next-4', title: 'Переход на шаг 5', kind: 'click' },
    { id: 'array-toggle-on', title: 'Массив имущества: включение (первая строка)', kind: 'click' },
    { id: 'array-add', title: 'Массив имущества: добавление строк до N', kind: 'click' },
    { id: 'array-type-last', title: 'Массив имущества: ввод в последней строке', kind: 'typing' },
    { id: 'array-remove', title: 'Массив имущества: удаление последней строки', kind: 'click' },
    { id: 'array-toggle-off', title: 'Массив имущества: выключение (очистка)', kind: 'click' },
    { id: 'next-5', title: 'Переход на шаг 6', kind: 'click' },
    { id: 'sms-type', title: 'Код из СМС с проверкой на сервере', kind: 'async' },
    { id: 'submit-valid', title: 'Отправка заявки', kind: 'click' },
    { id: 'remount', title: 'Перемонтирование формы', kind: 'remount' },
  ],
};

/**
 * Пояснения под таблицей фазы: поведение библиотеки, которое объясняет цифры. Только то, что
 * следует из устройства библиотеки, а не из конкретной версии; находки конкретного прогона — в
 * задачах трекера.
 */
const SETTLE_NOTE =
  '«UI затих» — последнее изменение DOM. Formik и RHF прогоняют синхронные правила вместе с ' +
  'серверной проверкой и снимают ошибку только по её ответу; RJSF и ReFormer снимают ' +
  'синхронную ошибку сразу. Если по ответу сервера DOM не меняется, фаза затихает раньше.';
export const NOTES = {
  registration: {
    'async-taken': [SETTLE_NOTE],
    'async-fix': [SETTLE_NOTE],
    'captcha-type': [SETTLE_NOTE],
  },
  credit: {
    'sms-type': [
      SETTLE_NOTE,
      'Formik валидирует с первой клавиши, включая серверные проверки (submitCount скрывает только ' +
        'показ ошибок, см. README Formik), поэтому проверяет код ещё до первой отправки; остальные — ' +
        'при отправке.',
    ],
  },
};

/** Сводка по форме: ключевые метрики для таблицы «Итог». */
export const HEADLINE = {
  registration: [
    { phase: 'load', metric: 'ready' },
    { phase: 'load', metric: 'script' },
    { phase: 'typing-pristine', metric: 'keyProc' },
    { phase: 'typing-live', metric: 'keyProc' },
    { phase: 'typing-live', metric: 'keyProcP95' },
    { phase: 'typing-live', metric: 'scriptPerKey' },
    { phase: 'submit-invalid', metric: 'settle' },
    { phase: 'remount', metric: 'mountSync' },
    { phase: 'load', metric: 'heap' },
  ],
  credit: [
    { phase: 'load', metric: 'ready' },
    { phase: 'load', metric: 'script' },
    { phase: 'load-application', metric: 'hydrate' },
    { phase: 'step1-typing', metric: 'keyProc' },
    { phase: 'step1-typing', metric: 'scriptPerKey' },
    { phase: 'step4-typing', metric: 'keyProc' },
    { phase: 'next-1', metric: 'settle' },
    { phase: 'next-invalid', metric: 'settle' },
    { phase: 'array-add', metric: 'script' },
    { phase: 'array-type-last', metric: 'keyProc' },
    { phase: 'remount', metric: 'mountSync' },
    { phase: 'load', metric: 'heap' },
  ],
};
