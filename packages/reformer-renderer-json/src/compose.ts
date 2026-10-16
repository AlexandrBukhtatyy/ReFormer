/**
 * Сборка схемы визарда, разбитой по шагам.
 *
 * Схема с шагами в отдельных файлах держит ссылки ({@link JsonStepRef}) на месте шагов — в
 * `children` визарда, а файлы шагов — узлы (`JsonFormStep`). Конвертер ссылок не понимает,
 * поэтому схема собирается ДО сборки формы, а не при рендере.
 *
 * @module reformer/renderer-json/compose
 */

import type { JsonFormSchema, JsonFormStep, JsonNode, JsonStepRef } from './types/json-schema';

/**
 * Ссылка ли это на файл шага: объект ровно с одним ключом `$ref`-строкой.
 *
 * @param value - Элемент `children` визарда.
 * @returns `true` для {@link JsonStepRef}.
 *
 * @example
 * ```ts
 * isJsonStepRef({ $ref: './steps/contacts/form.schema.json' }); // true
 * ```
 */
export function isJsonStepRef(value: unknown): value is JsonStepRef {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  return keys.length === 1 && typeof (value as { $ref?: unknown }).$ref === 'string';
}

/**
 * Ключ ссылки без ведущего `./`: `./steps/a/form.schema.json` и `steps/a/form.schema.json` —
 * один и тот же файл.
 *
 * @param ref - Спецификатор из `$ref`.
 * @returns Нормализованный ключ.
 *
 * @example
 * ```ts
 * normalizeStepRef('./steps/a/form.schema.json'); // 'steps/a/form.schema.json'
 * ```
 */
export function normalizeStepRef(ref: string): string {
  return ref.replace(/^(\.\/)+/, '');
}

/** Файл шага: узел под ключом `node`; допускается и сам узел. */
type StepPart = JsonFormStep | JsonNode;

function isFormStep(part: StepPart): part is JsonFormStep {
  return 'node' in part && typeof (part as { node: unknown }).node === 'object';
}

/**
 * Подставляет узлы шагов на место ссылок в `children` визарда.
 *
 * Не мутирует аргументы: меняются только объекты на пути к ссылке, остальные поддеревья
 * возвращаются по ссылке. Инлайн-шаги рядом со ссылками остаются как есть.
 *
 * @typeParam S - Тип схемы: {@link JsonFormSchema} (по умолчанию) либо его уточнение.
 * @param skeleton - Корневая схема со ссылками.
 * @param parts - Файлы шагов по спецификатору `$ref` (с `./` или без). Значение — содержимое
 *   файла шага ({@link JsonFormStep}) или сразу узел.
 * @returns Собранная схема, которую принимает сборка формы.
 * @throws Error если для ссылки нет части — с путём ссылки в схеме.
 *
 * @example
 * ```ts
 * import rawSchema from './form.schema.json';
 * import { stepSchemas } from './steps';
 *
 * const schema = composeJsonFormSchema(rawSchema as JsonFormSchema, stepSchemas);
 * ```
 */
export function composeJsonFormSchema<S extends JsonFormSchema = JsonFormSchema>(
  skeleton: S,
  parts: Readonly<Record<string, StepPart>>
): S {
  const byRef = new Map<string, unknown>();
  for (const [ref, part] of Object.entries(parts)) {
    byRef.set(normalizeStepRef(ref), isFormStep(part) ? part.node : part);
  }

  /** Список шагов: ссылки заменяются узлами, остальное обходится как обычно. */
  const composeList = (list: unknown[], path: string): unknown[] => {
    const out = list.map((step, index) => {
      const at = `${path}[${index}]`;
      if (!isJsonStepRef(step)) return visit(step, at);
      const node = byRef.get(normalizeStepRef(step.$ref));
      if (node === undefined) {
        throw new Error(
          `composeJsonFormSchema: ${at} ссылается на "${step.$ref}", но такого шага нет в parts`
        );
      }
      // Шаг сам может держать вложенный визард со ссылками — собираем и его.
      return visit(node, at);
    });
    return out.every((step, index) => step === list[index]) ? list : out;
  };

  const visit = (value: unknown, path: string): unknown => {
    if (Array.isArray(value)) {
      let changed = false;
      const next = value.map((item, index) => {
        const out = visit(item, `${path}[${index}]`);
        if (out !== item) changed = true;
        return out;
      });
      return changed ? next : value;
    }
    if (value === null || typeof value !== 'object') return value;
    const node = value as Record<string, unknown>;
    let changed = false;
    const next: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(node)) {
      let out: unknown;
      if (key === 'children' && Array.isArray(child)) {
        out = composeList(child, join(path, 'children'));
      } else {
        out = visit(child, join(path, key));
      }
      if (out !== child) changed = true;
      next[key] = out;
    }
    return changed ? next : value;
  };

  return visit(skeleton, '') as S;
}

function join(path: string, key: string): string {
  return path === '' ? key : `${path}.${key}`;
}
