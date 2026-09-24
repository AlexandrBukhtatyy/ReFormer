/**
 * Сборка схемы визарда, разбитой по шагам.
 *
 * Схема с шагами в отдельных файлах держит в `componentProps.steps` ссылки
 * ({@link JsonStepRef}), а файлы шагов — узлы ({@link JsonFormStep}). Конвертер ссылок не
 * понимает: ссылка для него — обычный литерал пропса, и мастер получил бы объект вместо шага.
 * Поэтому схема собирается ДО `createJsonForm`, а не при рендере.
 *
 * @module reformer/renderer-json/compose
 */

import type { JsonFormSchema, JsonFormStep, JsonNode, JsonStepRef } from './types/json-schema';

/**
 * Ссылка ли это на файл шага: объект ровно с одним ключом `$ref`-строкой.
 *
 * @param value - Элемент `componentProps.steps`.
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

function isFormStep(part: JsonFormStep | JsonNode): part is JsonFormStep {
  return 'node' in part && typeof (part as JsonFormStep).node === 'object';
}

/**
 * Подставляет узлы шагов на место ссылок в `componentProps.steps`.
 *
 * Не мутирует аргументы: меняются только объекты на пути к ссылке, остальные поддеревья
 * возвращаются по ссылке. Инлайн-шаги рядом со ссылками остаются как есть.
 *
 * @param skeleton - Корневая схема со ссылками.
 * @param parts - Файлы шагов по спецификатору `$ref` (с `./` или без). Значение — содержимое
 *   файла шага ({@link JsonFormStep}) или сразу узел.
 * @returns Собранная схема, которую принимает `createJsonForm`.
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
export function composeJsonFormSchema<T = unknown>(
  skeleton: JsonFormSchema<T>,
  parts: Readonly<Record<string, JsonFormStep<T> | JsonNode<T>>>
): JsonFormSchema<T> {
  const byRef = new Map<string, JsonNode<T>>();
  for (const [ref, part] of Object.entries(parts)) {
    byRef.set(normalizeStepRef(ref), isFormStep(part) ? part.node : part);
  }

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
      if (key === 'componentProps' && isRecord(child) && Array.isArray(child.steps)) {
        out = composeSteps(child, join(path, 'componentProps'));
      } else {
        out = visit(child, join(path, key));
      }
      if (out !== child) changed = true;
      next[key] = out;
    }
    return changed ? next : value;
  };

  const composeSteps = (props: Record<string, unknown>, path: string): Record<string, unknown> => {
    let changed = false;
    const next: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(props)) {
      let out: unknown;
      if (key === 'steps') {
        out = (value as unknown[]).map((step, index) => {
          const at = `${path}.steps[${index}]`;
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
        const same = (out as unknown[]).every(
          (step, index) => step === (value as unknown[])[index]
        );
        if (same) out = value;
      } else {
        out = visit(value, join(path, key));
      }
      if (out !== value) changed = true;
      next[key] = out;
    }
    return changed ? next : props;
  };

  return visit(skeleton, '') as JsonFormSchema<T>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function join(path: string, key: string): string {
  return path === '' ? key : `${path}.${key}`;
}
