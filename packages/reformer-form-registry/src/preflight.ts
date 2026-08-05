/**
 * Preflight — проверки ДО сборки формы.
 *
 * Мотив: `convertJsonToM1Tree` синхронный и бросает при первом же незарегистрированном
 * компоненте, а для схемы, приехавшей по сети, это самый вероятный отказ. Бросок из конвертера
 * называет один промах и не говорит ни о версии, ни о том, сколько ещё промахов впереди.
 * Preflight собирает полную картину и позволяет решить, что делать: показать панель или
 * подставить плейсхолдеры.
 *
 * Пять проверок, из которых четыре не делаются сегодня нигде:
 *
 * | проверка | что ловит |
 * |---|---|
 * | `compatibleSchema` ↔ версия схемы | схема ушла вперёд кода: CDN отдал v2, поведение осталось v1 |
 * | `id`/`version` записи ↔ схемы | CDN отдал ЧУЖУЮ схему — форма молча пишет не те поля |
 * | имена операторов ⊆ реестр | ссылка на незарегистрированный компонент/источник/функцию |
 * | ключи `validation.steps` ⊆ selector'ы | пошаговая валидация молча не срабатывает на переименованном шаге |
 * | пути `$model(...)` ⊆ начальные значения | поля нет в модели → нет сигнала → **ошибки валидации тихо исчезают** |
 *
 * Последняя — самая коварная: `validateModel` роутит ошибки через `getNodeForSignal(sig)?.setErrors(...)`,
 * и опциональная цепочка означает, что для нематериализованного поля ошибка просто исчезает.
 *
 * @module reformer/form-registry/preflight
 */

import {
  collectOperatorNames,
  collectSchemaSelectors,
  getDataSourceNames,
  getFnNames,
  type ComponentRegistry,
  type JsonFormSchema,
} from '@reformer/renderer-json';
import type { FormEntry, FormValidation } from './types';

export interface PreflightProblem {
  code:
    | 'schema-version-drift'
    | 'schema-identity-mismatch'
    | 'missing-components'
    | 'missing-data-sources'
    | 'missing-fns'
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

/** Пути `$model(...)`, встреченные в схеме. */
export function collectModelPaths(schema: JsonFormSchema): string[] {
  const out = new Set<string>();
  const scan = (v: unknown): void => {
    if (typeof v === 'string') {
      const m = /^\$model\(([^)]*)\)$/.exec(v);
      if (m?.[1]) out.add(m[1]);
      return;
    }
    if (Array.isArray(v)) {
      v.forEach(scan);
      return;
    }
    if (v && typeof v === 'object') for (const x of Object.values(v)) scan(x);
  };
  scan(schema.root);
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
  schema: JsonFormSchema<T>;
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
