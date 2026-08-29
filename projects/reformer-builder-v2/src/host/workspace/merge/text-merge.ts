/**
 * Трёхстороннее слияние по строкам — чистая функция и ничего кроме.
 *
 * ## Почему по тексту, а не по модели
 *
 * Решение записано в контракте (`docs/assistant-and-merge.md`, Э11) и здесь не переоткрывается:
 * слияние на уровне модели потребовало бы преобразования операций — это задача совместного
 * редактирования целиком. Текстовое слияние стандартно и работает одинаково для схемы формы,
 * для сайдкара и для README.
 *
 * Цена названа там же: слияние JSON по строкам может дать текст, который не разбирается.
 * Поэтому за автоматическим слиянием ОБЯЗАН идти повторный разбор — но он живёт не здесь,
 * а в `./resolve`, потому что разбор знает про формат, а слияние не знает и не должно.
 *
 * ## Устройство
 *
 * Классический diff3: строки основания сопоставляются с каждой из сторон по наибольшей общей
 * подпоследовательности (та же LCS, что в v1 `io/diff.ts`), из сопоставления собираются правки
 * в координатах ОСНОВАНИЯ, и правки, пересёкшиеся в этих координатах, разбираются как одно
 * целое. Пересечение — именно пересечение, а не соседство: правка соседней строки сливается
 * сама, иначе «я поправил заголовок, коллега — строку под ним» было бы конфликтом.
 *
 * Каждая группа классифицируется:
 *
 * | Участок                         | Итог                                    |
 * | ------------------------------- | --------------------------------------- |
 * | обе стороны равны основанию     | `stable` — никто не трогал              |
 * | наша равна основанию            | `theirs` — правка только у источника     |
 * | их равна основанию              | `ours` — правка только у нас            |
 * | стороны равны друг другу        | `both` — одинаковая правка, берём один раз |
 * | всё остальное                   | `conflict` — спрашиваем человека        |
 *
 * **Правка против удаления попадает в `conflict`, и это осознанно.** Формально можно было бы
 * «сохранить правку» или «уважить удаление», но обе трактовки — догадка о намерении, а цена
 * ошибки здесь несимметрична: молча потерянная правка обнаруживается через день. Правило
 * контракта «молча выбрать сторону нельзя ни в каком случае» разрешает этот спор в пользу
 * вопроса. Удаление строк, которых ВТОРАЯ сторона не трогала, конфликтом не является —
 * это обычный случай «правка только у одной стороны».
 *
 * ## Разделитель строк
 *
 * Строки режутся по `\n`, `\r` остаётся частью строки. Это не небрежность: так файл с CRLF
 * сливается сам с собой без единого различия, а смешанные концы строк не «чинятся» молча —
 * строка с другим окончанием честно выглядит изменённой. Приводить концы строк к одному виду
 * означало бы записать в файл то, чего не писал ни один из авторов.
 *
 * @module host/workspace/merge/text-merge
 */

/** Операция построчного diff'а. Формат перенесён из v1 (`io/diff.ts`) без изменений. */
export interface DiffOp {
  readonly type: 'same' | 'add' | 'del';
  readonly text: string;
}

/** Что стало с участком при слиянии. */
export type MergeRegionKind = 'stable' | 'ours' | 'theirs' | 'both' | 'conflict';

/**
 * Участок слияния — единица, которой оперирует диалог.
 *
 * Стороны хранятся все три даже там, где две из них совпадают: колонка «основание» в диалоге
 * существует именно затем, чтобы человек видел, ОТ ЧЕГО разошлись, и восстанавливать её
 * вычитанием из соседей пришлось бы в отрисовке.
 */
export interface MergeRegion {
  readonly kind: MergeRegionKind;
  readonly base: readonly string[];
  readonly ours: readonly string[];
  readonly theirs: readonly string[];
}

export interface MergeResult {
  /** Все расхождения свелись сами: спрашивать не о чем. */
  readonly clean: boolean;
  /**
   * Слитый текст.
   *
   * При `clean` — готовый результат. При конфликте — тот же текст, но с разметкой
   * ({@link MergeMarkers}): он не годится для записи, зато годится как заготовка ручного
   * слияния, и именно его получает редактор.
   */
  readonly text: string;
  readonly regions: readonly MergeRegion[];
  /** Сколько участков потребовали человека. Ноль ровно тогда, когда `clean`. */
  readonly conflicts: number;
  /**
   * Слияние не считалось: стороны крупнее бюджета ({@link LCS_CELL_BUDGET}).
   *
   * Тогда результат — один конфликт на весь файл. Это осознанно консервативный ответ:
   * альтернатива (эвристика на больших файлах) даёт правдоподобный результат, проверить
   * который человеку нечем, а диалог с тремя колонками работает и на файле целиком.
   */
  readonly overBudget: boolean;
}

/** Подписи сторон в разметке конфликта. */
export interface MergeMarkers {
  readonly ours: string;
  readonly base: string;
  readonly theirs: string;
}

export const DEFAULT_MARKERS: MergeMarkers = Object.freeze({
  ours: 'наша версия',
  base: 'общее основание',
  theirs: 'версия источника',
});

export interface MergeOptions {
  readonly markers?: MergeMarkers;
  /**
   * Показывать ли основание внутри разметки конфликта.
   *
   * По умолчанию да (стиль `diff3`): весь смысл этого механизма в трёх сторонах, и прятать
   * основание в ручном слиянии значило бы отобрать у человека ровно то, ради чего он открыл
   * диалог. Выключение оставлено тем, кому текст с разметкой уходит в чужой инструмент,
   * понимающий только две стороны.
   */
  readonly includeBase?: boolean;
}

/**
 * Потолок ячеек таблицы LCS после отсечения общих начала и конца.
 *
 * Таблица — `Int32Array`, то есть 4 байта на ячейку: 4 млн ячеек это 16 МБ и доли секунды.
 * Реальные файлы форм до потолка не достают и близко — общие префикс и суффикс съедают почти
 * всё, потому что правки локальны. Потолок нужен для случая «файл целиком переписан
 * генератором», где точный LCS не только дорог, но и бессмыслен.
 */
export const LCS_CELL_BUDGET = 4_000_000;

/** Режет текст на строки. Пустой текст — одна пустая строка: у `''.split('\n')` так же. */
function toLines(text: string): string[] {
  return text.split('\n');
}

function sameLines(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/**
 * Сопоставление строк двух текстов: `pairs[i]` — индекс в `b`, парный `a[i]`, или `-1`.
 *
 * `budget: false` означает, что таблица не поместилась в потолок и сопоставления нет вовсе —
 * вызывающий обязан отнестись к текстам как к целиком разным.
 */
interface Alignment {
  readonly pairs: Int32Array;
  readonly withinBudget: boolean;
}

/**
 * Наибольшая общая подпоследовательность строк.
 *
 * Таблица суффиксная и правило выбора при равенстве то же, что в v1 (`dp[i+1][j] >= dp[i][j+1]`
 * — сначала удаление, потом вставка): порядок операций в diff'е виден человеку, и менять его
 * при переносе значило бы получить другой diff на тех же данных без единой причины.
 *
 * Общие начало и конец отсекаются до таблицы. Это не только скорость: без отсечения таблица
 * на паре файлов по паре тысяч строк уже десятки мегабайт, а после него — сотни ячеек,
 * потому что правка почти всегда локальна.
 */
function align(a: readonly string[], b: readonly string[]): Alignment {
  const pairs = new Int32Array(a.length).fill(-1);

  let head = 0;
  while (head < a.length && head < b.length && a[head] === b[head]) {
    pairs[head] = head;
    head++;
  }

  let tail = 0;
  while (
    tail < a.length - head &&
    tail < b.length - head &&
    a[a.length - 1 - tail] === b[b.length - 1 - tail]
  ) {
    pairs[a.length - 1 - tail] = b.length - 1 - tail;
    tail++;
  }

  const m = a.length - head - tail;
  const n = b.length - head - tail;
  if (m === 0 || n === 0) return { pairs, withinBudget: true };
  if ((m + 1) * (n + 1) > LCS_CELL_BUDGET) {
    // Середина не считается — но общие края уже проставлены, и это честно: они совпадают
    // буквально, а не по догадке.
    return { pairs, withinBudget: false };
  }

  const width = n + 1;
  const dp = new Int32Array((m + 1) * width);
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i * width + j] =
        a[head + i] === b[head + j]
          ? dp[(i + 1) * width + j + 1] + 1
          : Math.max(dp[(i + 1) * width + j], dp[i * width + j + 1]);
    }
  }

  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (a[head + i] === b[head + j]) {
      pairs[head + i] = head + j;
      i++;
      j++;
    } else if (dp[(i + 1) * width + j] >= dp[i * width + j + 1]) {
      i++;
    } else {
      j++;
    }
  }

  return { pairs, withinBudget: true };
}

/**
 * Построчный diff. Перенос v1 (`io/diff.ts`) с той же семантикой: `del` — строки старого
 * текста, `add` — нового.
 *
 * Отличие ровно одно и оно наружу не видно: LCS считается общей функцией со слиянием, потому
 * что две копии одного алгоритма разъезжаются на первой же оптимизации.
 */
export function diffLines(oldText: string, newText: string): DiffOp[] {
  const a = toLines(oldText);
  const b = toLines(newText);
  const { pairs, withinBudget } = align(a, b);
  const ops: DiffOp[] = [];

  if (!withinBudget) {
    // Замена целиком: сказать «эти строки общие» мы не можем, а выдумывать общность нельзя.
    for (const line of a) ops.push({ type: 'del', text: line });
    for (const line of b) ops.push({ type: 'add', text: line });
    return ops;
  }

  let j = 0;
  for (let i = 0; i < a.length; i++) {
    const pair = pairs[i];
    if (pair < 0) {
      ops.push({ type: 'del', text: a[i] });
      continue;
    }
    while (j < pair) ops.push({ type: 'add', text: b[j++] });
    ops.push({ type: 'same', text: a[i] });
    j++;
  }
  while (j < b.length) ops.push({ type: 'add', text: b[j++] });
  return ops;
}

/** Счётчик изменений: сколько строк добавлено и удалено. Перенос v1. */
export function diffStat(ops: readonly DiffOp[]): { added: number; removed: number } {
  let added = 0;
  let removed = 0;
  for (const op of ops) {
    if (op.type === 'add') added++;
    else if (op.type === 'del') removed++;
  }
  return { added, removed };
}

/** Есть ли изменения между текстами. Перенос v1: вопрос дешевле, чем diff ради ответа. */
export function hasChanges(oldText: string, newText: string): boolean {
  return oldText !== newText;
}

/**
 * Правка одной стороны в координатах основания: `[b0, b1)` заменено на `[s0, s1)`.
 *
 * Пустой диапазон основания — вставка, пустой диапазон стороны — удаление. Оба нужны:
 * без них «вставили в конец» и «удалили последнюю строку» невыразимы.
 */
interface Hunk {
  readonly b0: number;
  readonly b1: number;
  readonly s0: number;
  readonly s1: number;
}

/** На сколько строк сторона длиннее основания на этих правках. */
function shift(hunks: readonly Hunk[]): number {
  let delta = 0;
  for (const h of hunks) delta += h.s1 - h.s0 - (h.b1 - h.b0);
  return delta;
}

/** Собирает правки стороны из сопоставления строк. */
function hunksOf(pairs: Int32Array, baseLength: number, sideLength: number): Hunk[] {
  const out: Hunk[] = [];
  let bi = 0;
  let si = 0;
  for (let i = 0; i <= baseLength; i++) {
    const end = i === baseLength;
    const p = end ? sideLength : pairs[i];
    if (!end && p < 0) continue;
    if (i > bi || p > si) out.push({ b0: bi, b1: i, s0: si, s1: p });
    if (end) break;
    bi = i + 1;
    si = p + 1;
  }
  return out;
}

/**
 * Пересекается ли правка с уже набранной группой.
 *
 * Правка, начинающаяся ровно там, где группа кончилась, НЕ пересекается — и это то самое
 * место, где сходство с diff3 важнее простоты: правки соседних строк («я поправил заголовок,
 * коллега — строку под ним») обязаны сливаться сами. Единственное исключение — две вставки
 * в одну и ту же точку: диапазоны у обеих пустые, порядок между ними ничем не задан,
 * и выбрать его за человека значило бы угадать, чей текст идёт первым.
 */
function overlaps(h: Hunk, from: number, to: number): boolean {
  if (h.b0 < to) return true;
  return h.b0 === to && h.b0 === h.b1 && from === to;
}

/** Группа правок, разбираемых как одно целое: всё, что пересеклось в координатах основания. */
interface HunkGroup {
  readonly from: number;
  readonly to: number;
  readonly ours: readonly Hunk[];
  readonly theirs: readonly Hunk[];
  readonly oi: number;
  readonly ti: number;
}

function takeGroup(
  ourHunks: readonly Hunk[],
  theirHunks: readonly Hunk[],
  startOur: number,
  startTheir: number
): HunkGroup {
  let oi = startOur;
  let ti = startTheir;
  const ours: Hunk[] = [];
  const theirs: Hunk[] = [];

  const first = ourHunks[oi];
  const second = theirHunks[ti];
  // Из двух правок в одной точке первой берётся более короткая в основании: вставка обязана
  // встать ПЕРЕД заменой, иначе вставленное уедет за заменённый кусок.
  const startWithOurs =
    second === undefined ||
    (first !== undefined &&
      (first.b0 !== second.b0
        ? first.b0 < second.b0
        : first.b1 - first.b0 <= second.b1 - second.b0));

  let from: number;
  let to: number;
  if (startWithOurs && first !== undefined) {
    ours.push(first);
    oi++;
    from = first.b0;
    to = first.b1;
  } else {
    const seed = second as Hunk;
    theirs.push(seed);
    ti++;
    from = seed.b0;
    to = seed.b1;
  }

  for (;;) {
    const o = ourHunks[oi];
    if (o !== undefined && overlaps(o, from, to)) {
      ours.push(o);
      oi++;
      to = Math.max(to, o.b1);
      continue;
    }
    const t = theirHunks[ti];
    if (t !== undefined && overlaps(t, from, to)) {
      theirs.push(t);
      ti++;
      to = Math.max(to, t.b1);
      continue;
    }
    break;
  }

  return { from, to, ours, theirs, oi, ti };
}

/** Классифицирует участок: кто его тронул и спорят ли стороны. */
function classify(
  base: readonly string[],
  ours: readonly string[],
  theirs: readonly string[]
): MergeRegionKind {
  const ourChange = !sameLines(base, ours);
  const theirChange = !sameLines(base, theirs);
  if (!ourChange && !theirChange) return 'stable';
  if (!ourChange) return 'theirs';
  if (!theirChange) return 'ours';
  return sameLines(ours, theirs) ? 'both' : 'conflict';
}

/** Строки, которыми участок входит в слитый текст. У конфликта их нет — там разметка. */
function resolved(region: MergeRegion): readonly string[] {
  switch (region.kind) {
    case 'stable':
    case 'ours':
      return region.ours;
    case 'theirs':
    case 'both':
      return region.theirs;
    case 'conflict':
      return region.ours;
  }
}

/** Разметка конфликта — тот же формат, что у git, чтобы он читался без обучения. */
function markup(region: MergeRegion, markers: MergeMarkers, includeBase: boolean): string[] {
  const out: string[] = [`<<<<<<< ${markers.ours}`, ...region.ours];
  if (includeBase) out.push(`||||||| ${markers.base}`, ...region.base);
  out.push('=======', ...region.theirs, `>>>>>>> ${markers.theirs}`);
  return out;
}

/**
 * Сводит три стороны в одну.
 *
 * @param base общий предок — текст, каким его отдал источник, когда мы его прочитали
 * @param ours рабочая копия сейчас
 * @param theirs то, что в источнике сейчас
 */
export function mergeThreeWay(
  base: string,
  ours: string,
  theirs: string,
  options: MergeOptions = {}
): MergeResult {
  const markers = options.markers ?? DEFAULT_MARKERS;
  const includeBase = options.includeBase ?? true;

  const baseLines = toLines(base);
  const ourLines = toLines(ours);
  const theirLines = toLines(theirs);

  // Быстрого пути для «стороны совпали» здесь нет намеренно: отсечение общих начала и конца
  // внутри `align` уже делает совпадающие тексты линейными, а лишняя ветка — это лишний
  // способ получить регионы другой формы на тех же данных.
  const toOurs = align(baseLines, ourLines);
  const toTheirs = align(baseLines, theirLines);

  if (!toOurs.withinBudget || !toTheirs.withinBudget) {
    const region: MergeRegion = {
      kind: 'conflict',
      base: baseLines,
      ours: ourLines,
      theirs: theirLines,
    };
    return {
      clean: false,
      text: markup(region, markers, includeBase).join('\n'),
      regions: [region],
      conflicts: 1,
      overBudget: true,
    };
  }

  const ourHunks = hunksOf(toOurs.pairs, baseLines.length, ourLines.length);
  const theirHunks = hunksOf(toTheirs.pairs, baseLines.length, theirLines.length);
  const regions: MergeRegion[] = [];

  /** Курсоры: `baseAt` в основании и соответствующие ему позиции в сторонах. */
  let baseAt = 0;
  let ourAt = 0;
  let theirAt = 0;
  let oi = 0;
  let ti = 0;

  const pushStable = (until: number): void => {
    if (until <= baseAt) return;
    const lines = baseLines.slice(baseAt, until);
    regions.push({ kind: 'stable', base: lines, ours: lines, theirs: lines });
    // Вне правок соответствие сторон основанию — сдвиг на константу, поэтому курсоры
    // двигаются на одинаковую длину. Это же свойство делает арифметику ниже верной.
    ourAt += until - baseAt;
    theirAt += until - baseAt;
    baseAt = until;
  };

  while (oi < ourHunks.length || ti < theirHunks.length) {
    const group = takeGroup(ourHunks, theirHunks, oi, ti);
    oi = group.oi;
    ti = group.ti;

    pushStable(group.from);

    const span = group.to - group.from;
    const ourEnd = ourAt + span + shift(group.ours);
    const theirEnd = theirAt + span + shift(group.theirs);
    const changedBase = baseLines.slice(group.from, group.to);
    const changedOurs = ourLines.slice(ourAt, ourEnd);
    const changedTheirs = theirLines.slice(theirAt, theirEnd);
    regions.push({
      kind: classify(changedBase, changedOurs, changedTheirs),
      base: changedBase,
      ours: changedOurs,
      theirs: changedTheirs,
    });

    baseAt = group.to;
    ourAt = ourEnd;
    theirAt = theirEnd;
  }
  pushStable(baseLines.length);

  let conflicts = 0;
  const out: string[] = [];
  for (const region of regions) {
    if (region.kind === 'conflict') {
      conflicts++;
      out.push(...markup(region, markers, includeBase));
      continue;
    }
    out.push(...resolved(region));
  }

  return {
    clean: conflicts === 0,
    text: out.join('\n'),
    regions,
    conflicts,
    overBudget: false,
  };
}

/**
 * Остались ли в тексте следы разметки конфликта.
 *
 * Нужна ровно одному потребителю — приёму ручного слияния: человек мог нажать «готово»,
 * не убрав маркеры, и записать такой текст в источник значит записать заведомый мусор.
 * Проверка по началу строки, а не по вхождению: `<<<<<<<` внутри строки бывает законным
 * содержимым (например, в markdown или в тестовых данных этого самого модуля).
 */
export function hasConflictMarkers(text: string): boolean {
  for (const line of toLines(text)) {
    if (
      line.startsWith('<<<<<<<') ||
      line.startsWith('=======') ||
      line.startsWith('>>>>>>>') ||
      line.startsWith('|||||||')
    ) {
      return true;
    }
  }
  return false;
}
