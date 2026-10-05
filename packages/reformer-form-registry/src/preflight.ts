/**
 * Preflight — проверки ДО сборки формы.
 *
 * Мотив: `convertJsonToM1Tree` синхронный и бросает при первом же незарегистрированном
 * компоненте, а для схемы, приехавшей по сети, это самый вероятный отказ. Бросок из конвертера
 * называет один промах и не говорит ни о версии, ни о том, сколько ещё промахов впереди.
 * Preflight собирает полную картину и позволяет решить, что делать: показать панель или
 * подставить плейсхолдеры.
 *
 * Шесть проверок, из которых пять не делаются сегодня нигде:
 *
 * | проверка | что ловит |
 * |---|---|
 * | `compatibleSchema` ↔ версия схемы | схема ушла вперёд кода: CDN отдал v2, поведение осталось v1 |
 * | `id`/`version` записи ↔ схемы | CDN отдал ЧУЖУЮ схему — форма молча пишет не те поля |
 * | имена операторов ⊆ реестр | ссылка на незарегистрированный компонент/источник/функцию |
 * | имена `$part(...)` ⊆ `parts` документа | подформа или шаблон строки ссылается на необъявленную часть |
 * | ключи `validation.steps` ⊆ selector'ы | пошаговая валидация молча не срабатывает на переименованном шаге |
 * | пути `$model(...)` ⊆ начальные значения | поля нет в модели → нет сигнала → **ошибки валидации тихо исчезают** |
 *
 * Последняя — самая коварная: `validateModel` роутит ошибки через `getNodeForSignal(sig)?.setErrors(...)`,
 * и опциональная цепочка означает, что для нематериализованного поля ошибка просто исчезает.
 *
 * Документ принимается в обоих форматах. В формате 2 обход идёт и по именованным частям
 * (`parts`): их операторы и селекторы учитываются наравне с корневым деревом, а пути модели
 * внутри части считаются от группы, к которой она подключена.
 *
 * @module reformer/form-registry/preflight
 */

import {
  collectOperatorNames,
  collectSchemaSelectors,
  getDataSourceNames,
  getFnNames,
  schemaFormatOf,
  type ComponentRegistry,
  type JsonFormSchema,
  type JsonFormSchemaV1,
} from '@reformer/renderer-json';
import type { FormEntry, FormValidation } from './types';

/** Документ схемы любого формата. */
type AnyFormSchema<T = unknown> = JsonFormSchema<T> | JsonFormSchemaV1<T>;

export interface PreflightProblem {
  code:
    | 'schema-version-drift'
    | 'schema-identity-mismatch'
    | 'missing-components'
    | 'missing-data-sources'
    | 'missing-fns'
    | 'missing-parts'
    | 'unknown-step-selectors'
    | 'unmaterialized-model-paths';
  message: string;
  /** Имена/пути, к которым относится проблема. */
  items: string[];
  /**
   * `error` — форму собирать нельзя. `warn` — соберётся, но часть поведения молча не сработает.
   */
  level: 'error' | 'warn';
}

export interface PreflightResult {
  ok: boolean;
  problems: PreflightProblem[];
}

/** Минимальная проверка semver-диапазона: `1.x`, `^1.2.0`, `>=1.0.0`, `1.2.3`, `*`. */
export function satisfiesRange(version: string, range: string): boolean {
  const r = range.trim();
  if (!r || r === '*' || r === 'x') return true;
  const parse = (v: string): number[] =>
    v
      .replace(/^[v=]+/, '')
      .split(/[.\-+]/)
      .slice(0, 3)
      .map((p) => (p === 'x' || p === '*' ? -1 : Number(p)))
      .map((n) => (Number.isFinite(n) ? n : -1));
  const cmp = (a: number[], b: number[]): number => {
    for (let i = 0; i < 3; i++) {
      const x = a[i] ?? 0;
      const y = b[i] ?? 0;
      if (x !== y) return x < y ? -1 : 1;
    }
    return 0;
  };
  const v = parse(version);

  const opMatch = /^(>=|<=|>|<|\^|~)?\s*(.+)$/.exec(r);
  const op = opMatch?.[1] ?? '';
  const target = parse(opMatch?.[2] ?? r);

  // `1.x` / `1.2.x` — сравниваем только заданные позиции.
  if (target.includes(-1)) {
    for (let i = 0; i < 3; i++) {
      if (target[i] === -1) return true;
      if ((v[i] ?? 0) !== target[i]) return false;
    }
    return true;
  }

  switch (op) {
    case '>=':
      return cmp(v, target) >= 0;
    case '>':
      return cmp(v, target) > 0;
    case '<=':
      return cmp(v, target) <= 0;
    case '<':
      return cmp(v, target) < 0;
    case '^':
      // Совместимо в пределах старшей значащей позиции.
      if (target[0] > 0) return v[0] === target[0] && cmp(v, target) >= 0;
      if (target[1] > 0) return v[0] === 0 && v[1] === target[1] && cmp(v, target) >= 0;
      return cmp(v, target) === 0;
    case '~':
      return v[0] === target[0] && v[1] === target[1] && cmp(v, target) >= 0;
    default:
      return cmp(v, target) === 0;
  }
}

const MODEL_OP = /^\$model\(([^)]*)\)$/;
const PART_OP = /^\$part\(([^)]*)\)$/;

const modelPathOf = (v: unknown): string | undefined =>
  typeof v === 'string' ? MODEL_OP.exec(v)?.[1] || undefined : undefined;
const partNameOf = (v: unknown): string | undefined =>
  typeof v === 'string' ? PART_OP.exec(v)?.[1] || undefined : undefined;

const isRecord = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v);

/** Именованные части документа формата 2; у прежнего формата их нет. */
function partsOf(schema: AnyFormSchema): Record<string, unknown> {
  const parts = (schema as { parts?: unknown }).parts;
  return schemaFormatOf(schema) === 2 && isRecord(parts) ? parts : {};
}

/**
 * Пути `$model(...)`, встреченные в схеме, — от корня модели.
 *
 * Прежний формат: все операторы дерева как есть.
 *
 * Формат 2: путь внутри именованной части относителен группе, к которой часть подключена, —
 * он достраивается до пути от корня. Шаблон строки массива (`item`) не обходится: его пути
 * относительны элементу, а массив на старте обычно пуст, и проверить их против начальных значений
 * нечем. Сам массив в результат попадает.
 */
export function collectModelPaths(schema: AnyFormSchema): string[] {
  const out = new Set<string>();

  if (schemaFormatOf(schema) !== 2) {
    const scan = (v: unknown): void => {
      const path = modelPathOf(v);
      if (path) out.add(path);
      else if (Array.isArray(v)) v.forEach(scan);
      else if (isRecord(v)) for (const x of Object.values(v)) scan(x);
    };
    scan(schema.root);
    return [...out];
  }

  const parts = partsOf(schema);
  /** `stack` — части на пути от корня: защита от части, подключающей саму себя. */
  const walk = (v: unknown, prefix: string, stack: readonly string[]): void => {
    const path = modelPathOf(v);
    if (path) {
      out.add(prefix + path);
      return;
    }
    if (Array.isArray(v)) {
      for (const x of v) walk(x, prefix, stack);
      return;
    }
    if (!isRecord(v)) return;

    const bound = modelPathOf(v.model);
    const partName = partNameOf(v.part);
    if (bound && partName) {
      // Подформа: часть разворачивается от своей группы.
      out.add(prefix + bound);
      if (partName in parts && !stack.includes(partName)) {
        walk(parts[partName], `${prefix}${bound}.`, [...stack, partName]);
      }
      return;
    }
    for (const [key, x] of Object.entries(v)) {
      // Шаблон строки массива — пути относительны элементу, см. описание функции.
      if (key === 'item' && bound) continue;
      walk(x, prefix, stack);
    }
  };
  walk(schema.root, '', []);
  return [...out];
}

/** Имена частей, на которые документ ссылается оператором `$part(...)`. */
function collectPartNames(schema: AnyFormSchema): string[] {
  const out = new Set<string>();
  const scan = (v: unknown): void => {
    const name = partNameOf(v);
    if (name) out.add(name);
    else if (Array.isArray(v)) v.forEach(scan);
    else if (isRecord(v)) for (const x of Object.values(v)) scan(x);
  };
  scan(schema.root);
  scan(partsOf(schema));
  return [...out];
}

/** Есть ли путь `a.b.c` в объекте начальных значений. */
export function hasPath(obj: unknown, path: string): boolean {
  // Индексы массивов в путях шаблонов (`items.0.name`) не проверяем: массив на старте пуст
  // по определению, и отсутствие элемента не является ошибкой.
  if (/(^|\.)\d+(\.|$)/.test(path)) return true;
  let cur: unknown = obj;
  for (const seg of path.split('.')) {
    if (cur === null || typeof cur !== 'object') return false;
    if (!(seg in (cur as Record<string, unknown>))) return false;
    cur = (cur as Record<string, unknown>)[seg];
  }
  return true;
}

export interface PreflightInput<T extends object> {
  entry: FormEntry<T>;
  /** Документ схемы любого формата. */
  schema: AnyFormSchema<T>;
  registry: ComponentRegistry;
  /** Начальные значения либо снимок модели. `undefined` — проверка путей пропускается. */
  initial?: unknown;
  validation?: FormValidation<T>;
}

export function preflight<T extends object>(input: PreflightInput<T>): PreflightResult {
  const { entry, schema, registry, initial, validation } = input;
  const problems: PreflightProblem[] = [];
  const meta = schema as unknown as { id?: string; version?: string };

  // 1. Версия схемы против диапазона, который объявил код.
  if (
    entry.compatibleSchema &&
    meta.version &&
    !satisfiesRange(meta.version, entry.compatibleSchema)
  ) {
    problems.push({
      code: 'schema-version-drift',
      level: 'error',
      items: [meta.version],
      message:
        `схема версии ${meta.version} вне диапазона "${entry.compatibleSchema}", объявленного кодом. ` +
        `Похоже, схему выкатили вперёд кода — обновите микрофронт либо откатите схему.`,
    });
  }

  // 2. Та ли это вообще схема. Молчаливая подмена опаснее отказа: форма соберётся и начнёт
  //    писать в модель поля чужой схемы.
  const mismatched: string[] = [];
  if (meta.id && meta.id !== entry.id)
    mismatched.push(`id: ждали "${entry.id}", получили "${meta.id}"`);
  if (mismatched.length) {
    problems.push({
      code: 'schema-identity-mismatch',
      level: 'error',
      items: mismatched,
      message: `схема не соответствует записи (${mismatched.join('; ')})`,
    });
  }

  // 3. Имена операторов против реестра.
  const used = collectOperatorNames(schema);
  const missingComponents = used.components.filter((n) => !registry.has(n));
  if (missingComponents.length) {
    problems.push({
      code: 'missing-components',
      level: 'error',
      items: missingComponents,
      message: `в реестре нет компонентов: ${missingComponents.join(', ')}`,
    });
  }
  const dataSources = new Set(getDataSourceNames(registry));
  const missingDataSources = used.dataSources.filter((n) => !dataSources.has(n));
  if (missingDataSources.length) {
    problems.push({
      code: 'missing-data-sources',
      level: 'error',
      items: missingDataSources,
      message: `в реестре нет источников данных: ${missingDataSources.join(', ')}`,
    });
  }
  const fns = new Set(getFnNames(registry));
  const missingFns = used.fns.filter((n) => !fns.has(n));
  if (missingFns.length) {
    problems.push({
      code: 'missing-fns',
      level: 'error',
      items: missingFns,
      message: `в реестре нет функций: ${missingFns.join(', ')}`,
    });
  }

  // 3а. Имена частей против словаря `parts` документа. Конвертер на необъявленной части бросает —
  //     и называет только первую.
  const declaredParts = partsOf(schema);
  const missingParts = collectPartNames(schema).filter((n) => !(n in declaredParts));
  if (missingParts.length) {
    problems.push({
      code: 'missing-parts',
      level: 'error',
      items: missingParts,
      message:
        `документ ссылается на необъявленные части: ${missingParts.join(', ')}. ` +
        `Объявленные в \`parts\`: ${Object.keys(declaredParts).sort().join(', ') || '(нет)'}.`,
    });
  }

  // 4. Ключи пошаговой валидации против селекторов схемы.
  if (validation?.steps) {
    const known = collectSchemaSelectors(schema);
    const unknown = Object.keys(validation.steps).filter((s) => !known.has(s));
    if (unknown.length) {
      problems.push({
        code: 'unknown-step-selectors',
        level: 'error',
        items: unknown,
        message:
          `валидация ссылается на несуществующие шаги: ${unknown.join(', ')}. ` +
          `Известные селекторы: ${[...known].sort().join(', ') || '(нет)'}. ` +
          `Переименованный шаг иначе просто перестал бы валидироваться — молча.`,
      });
    }
  }

  // 5. Пути модели против начальных значений.
  if (initial !== undefined && initial !== null) {
    const missingPaths = collectModelPaths(schema).filter((p) => !hasPath(initial, p));
    if (missingPaths.length) {
      problems.push({
        code: 'unmaterialized-model-paths',
        level: 'warn',
        items: missingPaths,
        message:
          `в начальных значениях нет полей: ${missingPaths.join(', ')}. ` +
          `У таких полей нет сигнала, поэтому ни поведение, ни ошибки валидации к ним не привяжутся — ` +
          `и это не проявится ничем, кроме «валидация не работает».`,
      });
    }
  }

  return { ok: !problems.some((p) => p.level === 'error'), problems };
}

/** Человекочитаемая сводка — для панели ошибок и диагностики. */
export function formatPreflight(entryKey: string, result: PreflightResult): string {
  if (!result.problems.length) return `${entryKey}: проверки пройдены`;
  return [
    `Форма ${entryKey} не прошла проверку:`,
    ...result.problems.map((p) => `  • [${p.level}] ${p.message}`),
  ].join('\n');
}
