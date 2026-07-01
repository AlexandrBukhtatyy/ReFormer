/**
 * Валидация form-DSL JSON-схемы (ajv) — отдельная точка входа `@reformer/renderer-json/validate`,
 * чтобы `ajv` не попадал в основной render-бандл (грузится только при явном импорте/динамически).
 *
 * Две проверки:
 *  (a) ajv против {@link formSchemaMetaSchema} — структура узлов + синтаксис операторов;
 *  (b) рекурсивный обход — ИМЕНА `$component(...)` и `$dataSource(...)` против реестра.
 *
 * Почему имена проверяет обход, а не enum в JSON Schema: реальные формы вкладывают дерево узлов
 * в произвольный `componentProps` (напр. `RendererFormWizard.steps`), который JSON Schema видит как
 * opaque `object` — enum достал бы только имена на структурных позициях верхних уровней. Обход же
 * доходит до любого оператора. (Enum-вариант — {@link buildFormSchemaMetaSchema} — нужен для IDE
 * `$schema`, где squiggle на структурных `component` полезен сам по себе.) `$model(...)` — только
 * синтаксис (пути динамичны, в каждой форме свои).
 *
 * @module reformer/renderer-json/validate
 */

import Ajv, { type ErrorObject } from 'ajv';
import { formSchemaMetaSchema, getComponentNames, getDataSourceNames } from './schema';
import { parseOperator } from './operators';
import type { ComponentRegistry } from './registry/types';

/** Результат валидации схемы. */
export interface FormSchemaValidationResult {
  valid: boolean;
  /** Человекочитаемые ошибки (путь + сообщение). Пусто, если валидно. */
  errors: string[];
}

/** Опции: реестр (имена извлекаются автоматически) либо явные списки имён. */
export interface ValidateFormSchemaOptions {
  registry?: ComponentRegistry;
  componentNames?: string[];
  dataSourceNames?: string[];
}

/** Рекурсивно собирает ошибки неизвестных `$component(...)`/`$dataSource(...)`-имён по всему дереву. */
function walkOperatorNames(
  node: unknown,
  path: string,
  componentNames: string[] | undefined,
  dataSourceNames: string[] | undefined,
  errors: string[]
): void {
  if (typeof node === 'string') {
    const op = parseOperator(node);
    if (op?.op === 'component' && componentNames && !componentNames.includes(op.arg)) {
      errors.push(`${path || '/'}: unknown component "${op.arg}"`);
    } else if (op?.op === 'dataSource' && dataSourceNames && !dataSourceNames.includes(op.arg)) {
      errors.push(`${path || '/'}: unknown dataSource "${op.arg}"`);
    }
    return;
  }
  if (Array.isArray(node)) {
    node.forEach((v, i) =>
      walkOperatorNames(v, `${path}[${i}]`, componentNames, dataSourceNames, errors)
    );
    return;
  }
  if (node !== null && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      walkOperatorNames(v, path ? `${path}.${k}` : k, componentNames, dataSourceNames, errors);
    }
  }
}

/**
 * Валидирует form-DSL JSON-схему. Если передан `registry`, имена компонентов/source берутся из него.
 *
 * @example
 * ```ts
 * const { valid, errors } = validateFormSchema(jsonSchema, { registry });
 * if (!valid) console.error(errors);
 * ```
 */
export function validateFormSchema(
  schema: unknown,
  opts: ValidateFormSchemaOptions = {}
): FormSchemaValidationResult {
  const componentNames =
    opts.componentNames ?? (opts.registry ? getComponentNames(opts.registry) : undefined);
  const dataSourceNames =
    opts.dataSourceNames ?? (opts.registry ? getDataSourceNames(opts.registry) : undefined);

  const errors: string[] = [];

  // (a) Структура узлов + синтаксис операторов (имена НЕ enum-чекаются здесь — см. (b))
  const ajv = new Ajv({ allErrors: true });
  const validateFn = ajv.compile(formSchemaMetaSchema);
  if (!validateFn(schema)) {
    for (const e of (validateFn.errors ?? []) as ErrorObject[]) {
      errors.push(`${e.instancePath || '/'} ${e.message ?? 'invalid'}`.trim());
    }
  }

  // (b) Имена $component/$dataSource по всему дереву (включая вложенные в opaque componentProps)
  walkOperatorNames(schema, '', componentNames, dataSourceNames, errors);

  return { valid: errors.length === 0, errors };
}
