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
import { parseOperator, isModelOp } from './operators';
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

/** Похож ли объект на array-узел (`array: '$model(...)'` + `item.$template`)? */
function looksLikeArrayNode(n: Record<string, unknown>): boolean {
  return (
    isModelOp(n.array) &&
    typeof n.item === 'object' &&
    n.item !== null &&
    '$template' in (n.item as Record<string, unknown>)
  );
}

/**
 * Рекурсивно флагает array-узлы без `initialValue`. Листья шаблона несут `value: '$model(...)'`
 * (под-пути элемента-объекта), поэтому без литерал-`initialValue` кнопка «Добавить» кладёт `{}` —
 * core строит GroupNode без детей, `$model(...)`-листья резолвятся в undefined-сигналы и ничего
 * не рендерят (карточка только с кнопками). Схема при этом структурно валидна (initialValue
 * опционален), так что молчаливую поломку ловим здесь.
 */
function walkArrayInitialValue(node: unknown, path: string, errors: string[]): void {
  if (Array.isArray(node)) {
    node.forEach((v, i) => walkArrayInitialValue(v, `${path}[${i}]`, errors));
    return;
  }
  if (node !== null && typeof node === 'object') {
    const n = node as Record<string, unknown>;
    if (looksLikeArrayNode(n) && n.initialValue === undefined) {
      errors.push(
        `${path || '/'}: array node is missing "initialValue" — the "Add" button would create an empty element and its "$model(...)" template leaves would render nothing. Provide an "initialValue" literal with the element's keys.`
      );
    }
    for (const [k, v] of Object.entries(n)) {
      walkArrayInitialValue(v, path ? `${path}.${k}` : k, errors);
    }
  }
}

/**
 * Валидирует form-DSL JSON-схему. Если передан `registry`, имена компонентов/source берутся из него
 * (иначе можно задать `componentNames`/`dataSourceNames` явно). Тянет `ajv` — живёт в subpath
 * `@reformer/renderer-json/validate`, чтобы не попадать в основной render-бандл.
 *
 * @param schema - Проверяемая JSON-схема (обычно {@link JsonFormSchema}, но принимает `unknown`).
 * @param opts - {@link ValidateFormSchemaOptions}: `registry` либо явные списки имён.
 * @returns {@link FormSchemaValidationResult} — `{ valid, errors }` (ошибки — путь + сообщение).
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
      // Node discriminates via if/then/else — ajv emits a redundant meta-error
      // ('must match "then"/"else" schema') next to the real branch error. Drop it so the
      // actual cause isn't buried under generic branch noise (the whole point of a DSL validator).
      if (e.keyword === 'if') continue;
      errors.push(`${e.instancePath || '/'} ${e.message ?? 'invalid'}`.trim());
    }
  }

  // (b) Имена $component/$dataSource по всему дереву (включая вложенные в opaque componentProps)
  walkOperatorNames(schema, '', componentNames, dataSourceNames, errors);

  // (c) Array-узлы без initialValue → молчаливо ломающиеся элементы (см. walkArrayInitialValue)
  walkArrayInitialValue(schema, '', errors);

  return { valid: errors.length === 0, errors };
}
