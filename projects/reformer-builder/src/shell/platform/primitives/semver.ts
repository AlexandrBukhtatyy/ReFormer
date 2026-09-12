/**
 * Версии и диапазоны — ровно в том объёме, в каком их спрашивает манифест плагина.
 *
 * ## Решение: своя утилита, а не пакет `semver`
 *
 * Пакета `semver` в зависимостях нет, и заводить его ради трёх сравнений мы не стали. Довод
 * не «лишняя зависимость вообще», а измеримый: библиотека едет в БРАУЗЕРНЫЙ бандл оболочки,
 * потому что диапазон разбирается при обходе каталога плагинов, то есть в рантайме, — и платит
 * за это каждый, кто открыл инструмент, включая тех, у кого плагинов нет вовсе. Взамен мы
 * обязаны назвать, чего эта утилита НЕ умеет: список ниже и есть цена решения.
 *
 * ## Чего здесь нет — названо, а не забыто
 *
 * - **Пререлизы (`1.0.0-beta.1`) отвергаются.** Не «игнорируются»: {@link parseVersion}
 *   и {@link parseRange} возвращают `undefined`, а разбор манифеста превращает это в отказ
 *   с внятным текстом. Молчаливое отбрасывание суффикса дало бы худший из возможных исходов —
 *   плагин, объявивший `^1.0.0-beta`, работал бы против релизного API и узнал бы об этом
 *   поведением, а не сообщением.
 * - **Составных диапазонов нет.** Ни конъюнкции (`>=1.2.0 <2.0.0`), ни дизъюнкции (`1.x || 2.x`).
 *   Один сравнитель на диапазон — всё остальное отвергается разбором. Требование плагина,
 *   которое нельзя выразить каретой или тильдой, почти наверняка означает, что контракт
 *   пора делить на два, а не что нам нужна грамматика npm.
 * - **Метаданных сборки (`+build`) нет** — по той же причине, что и пререлизов.
 *
 * ## Отступление от npm, которое стоит знать
 *
 * У npm неполная версия при сравнителе округляется вверх: `>1.2` там значит `>=1.3.0`. Здесь
 * недостающие части заполняются нулями, и `>1.2` значит `>1.2.0`. Правило npm сюрпризно ровно
 * в том месте, где человек пишет диапазон руками в JSON, — а заполнение нулями читается
 * одинаково всеми. Всё остальное (карета на нулевом мажоре, тильда, X-диапазоны) совпадает
 * с npm намеренно: автор плагина приносит привычку из `package.json`.
 *
 * @module shell/platform/primitives/semver
 */

/** Разобранная версия. Три числа и ничего больше — см. «чего здесь нет» в шапке модуля. */
export interface SemVer {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
}

/** Граница диапазона: версия плюс то, входит ли она сама. */
export interface VersionBound {
  readonly version: SemVer;
  readonly inclusive: boolean;
}

/**
 * Разобранный диапазон — ВСЕГДА в виде пары границ, какой бы формой он ни был записан.
 *
 * Нормализация к границам, а не хранение сравнителя, нужна ради одного: `satisfies` тогда
 * не ветвится по форме записи вовсе. Карета, тильда и X-диапазон отличаются только тем,
 * как из них считается верхняя граница, и это различие обязано жить в разборе, а не в каждой
 * проверке.
 *
 * `source` сохраняется дословно: его показывают человеку в отказе, и `^1` там обязан выглядеть
 * как `^1`, а не как «>=1.0.0 <2.0.0», которого он не писал.
 */
export interface VersionRange {
  readonly source: string;
  /** Нижняя граница. Её нет только у `*`. */
  readonly min?: VersionBound;
  /** Верхняя граница. Её нет у `>=`, `>` и `*`. */
  readonly max?: VersionBound;
}

/** Сколько компонентов версии человек написал явно: `1.2` → 2, `1.x` → 1, `*` → 0. */
type Specified = 0 | 1 | 2 | 3;

interface PartialVersion {
  readonly version: SemVer;
  readonly specified: Specified;
  /** Был ли в записи подстановочный знак: `1.x` — не версия, хотя мажор в нём и написан. */
  readonly wildcard: boolean;
}

const WILDCARDS = new Set(['x', 'X', '*']);

/**
 * Разбирает версию: `1.2.3`, `1.2`, `1`.
 *
 * Неполная версия дополняется нулями — `1.2` это `1.2.0`. Пререлиз и метаданные сборки
 * отвергаются (см. шапку модуля), поэтому `undefined` здесь значит «так версия не пишется»,
 * а не «версия старая».
 */
export function parseVersion(text: string): SemVer | undefined {
  const partial = parsePartial(text.trim());
  // Подстановочный знак — это про диапазон, а не про версию: «какая версия у службы» обязано
  // иметь один ответ, а `1.x` его не даёт.
  return partial === undefined || partial.wildcard ? undefined : partial.version;
}

/** `1.2.3` — для сообщений об отказе и для сравнения строк в тестах. */
export function formatVersion(version: SemVer): string {
  return `${String(version.major)}.${String(version.minor)}.${String(version.patch)}`;
}

/** Обычный порядок: отрицательное — `a` раньше `b`. */
export function compareVersions(a: SemVer, b: SemVer): number {
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  return a.patch - b.patch;
}

/**
 * Разбирает диапазон: `^1`, `~1.2`, `>=1.2.3`, `>1`, `<=2.0.0`, `<2`, `1.2.3`, `1.x`, `*`.
 *
 * `undefined` — диапазон не той формы: составной (`>=1 <2`, `1.x || 2.x`), с пререлизом,
 * с лишними компонентами. Разбор манифеста превращает это в отказ, а не в «пропустим».
 */
export function parseRange(text: string): VersionRange | undefined {
  const source = text.trim();
  if (source === '') return undefined;

  const matched = /^(\^|~|>=|<=|>|<|=)?\s*(\S+)$/.exec(source);
  if (matched === null) return undefined;
  // Аннотация обязательна: группа необязательна, но `RegExpExecArray` объявлен как `string[]`,
  // и без неё компилятор считает сравнение с `undefined` заведомо ложным.
  const operator: string | undefined = matched[1];
  const partial = parsePartial(matched[2]);
  if (partial === undefined) return undefined;

  const { version, specified } = partial;

  if (specified === 0) {
    // `*` — любая версия. Со сравнителем (`>=x`) он не значит ничего, и «ничего» лучше
    // отвергнуть здесь, чем удовлетворять им чьё-то требование.
    return operator === undefined ? { source } : undefined;
  }

  switch (operator) {
    case '^':
      return { source, min: { version, inclusive: true }, max: caretMax(version, specified) };
    case '~':
      return { source, min: { version, inclusive: true }, max: tildeMax(version, specified) };
    case '>=':
      return { source, min: { version, inclusive: true } };
    case '>':
      return { source, min: { version, inclusive: false } };
    case '<=':
      return { source, max: { version, inclusive: true } };
    case '<':
      return { source, max: { version, inclusive: false } };
    default:
      // Без сравнителя и с `=`: полная версия — точное совпадение, неполная — X-диапазон,
      // то есть `1.2` покрывает все `1.2.*`. Это правило npm, и расходиться с ним здесь
      // нельзя: автор плагина приносит привычку из `package.json`.
      return specified === 3
        ? { source, min: { version, inclusive: true }, max: { version, inclusive: true } }
        : { source, min: { version, inclusive: true }, max: tildeMax(version, specified) };
  }
}

/** Попадает ли версия в диапазон. Обе стороны уже разобраны — отказов здесь не бывает. */
export function satisfiesRange(version: SemVer, range: VersionRange): boolean {
  if (range.min !== undefined) {
    const order = compareVersions(version, range.min.version);
    if (order < 0) return false;
    if (order === 0 && !range.min.inclusive) return false;
  }
  if (range.max !== undefined) {
    const order = compareVersions(version, range.max.version);
    if (order > 0) return false;
    if (order === 0 && !range.max.inclusive) return false;
  }
  return true;
}

/**
 * Удобная форма для вызывающего, которому нечего делать с разбором: строка против строки.
 *
 * Неразбираемая сторона даёт `false`, а не исключение, — но именно поэтому проверять ФОРМУ
 * записи этой функцией нельзя: «не та версия» и «так версия не пишется» здесь неразличимы.
 * Там, где различие нужно (разбор манифеста), зовут {@link parseVersion} и {@link parseRange}
 * по отдельности.
 */
export function satisfies(version: string, range: string): boolean {
  const parsedVersion = parseVersion(version);
  const parsedRange = parseRange(range);
  if (parsedVersion === undefined || parsedRange === undefined) return false;
  return satisfiesRange(parsedVersion, parsedRange);
}

/**
 * Верхняя граница кареты: увеличивается САМЫЙ ЛЕВЫЙ ненулевой из написанных компонентов.
 *
 * Одно правило вместо трёх веток «мажор ноль», «минор ноль», «всё ноль» — и оно даёт в точности
 * npm: `^1.2.3` → `<2.0.0`, `^0.2.3` → `<0.3.0`, `^0.0.3` → `<0.0.4`, `^0` → `<1.0.0`,
 * `^0.0` → `<0.1.0`. Смысл кареты на нулевом мажоре именно такой: до `1.0.0` минор ведёт себя
 * как мажор, потому что ломающие правки в нём — норма.
 */
function caretMax(version: SemVer, specified: Specified): VersionBound {
  const parts = [version.major, version.minor, version.patch];
  const nonZero = parts.slice(0, specified).findIndex((part) => part > 0);
  // Все написанные компоненты нулевые (`^0`, `^0.0`, `^0.0.0`) — растёт последний написанный.
  const index = nonZero >= 0 ? nonZero : specified - 1;
  return { version: bumped(parts, index), inclusive: false };
}

/**
 * Верхняя граница тильды и X-диапазона: растёт последний написанный компонент, но не глубже
 * минора. `~1.2.3` и `~1.2` → `<1.3.0`; `~1` и `1.x` → `<2.0.0`.
 */
function tildeMax(version: SemVer, specified: Specified): VersionBound {
  const parts = [version.major, version.minor, version.patch];
  return { version: bumped(parts, specified >= 2 ? 1 : 0), inclusive: false };
}

/** Увеличивает компонент по индексу, обнуляя младшие: `[1,2,3]`, 1 → `1.3.0`. */
function bumped(parts: readonly number[], index: number): SemVer {
  const next = parts.map((part, at) => (at < index ? part : at === index ? part + 1 : 0));
  return { major: next[0], minor: next[1], patch: next[2] };
}

/**
 * Разбирает версию, допуская подстановочные знаки и пропущенные компоненты.
 *
 * Возвращает ещё и число написанных компонентов: без него `1` и `1.0.0` неразличимы, а карета
 * с тильдой считают по нему верхнюю границу.
 */
function parsePartial(text: string): PartialVersion | undefined {
  if (text === '') return undefined;
  // Пререлиз и метаданные сборки — отказ, а не отбрасывание суффикса. Довод в шапке модуля.
  if (text.includes('-') || text.includes('+')) return undefined;

  const parts = text.split('.');
  if (parts.length > 3) return undefined;

  const numbers = [0, 0, 0];
  let specified = 0;
  let wildcardSeen = false;
  for (const [index, part] of parts.entries()) {
    if (WILDCARDS.has(part)) {
      wildcardSeen = true;
      continue;
    }
    // `1.x.3` смысла не имеет: подстановочный знак означает «и всё, что глубже».
    if (wildcardSeen) return undefined;
    if (!/^\d+$/.test(part)) return undefined;
    const value = Number.parseInt(part, 10);
    if (!Number.isSafeInteger(value)) return undefined;
    numbers[index] = value;
    specified += 1;
  }

  return {
    version: { major: numbers[0], minor: numbers[1], patch: numbers[2] },
    specified: specified as Specified,
    wildcard: wildcardSeen,
  };
}
