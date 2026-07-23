/**
 * Мета-схема form-DSL (IETF JSON Schema, draft-07) + утилиты расширения именами реестра.
 *
 * - {@link formSchemaMetaSchema} — базовая мета-схема (структура узлов + синтаксис операторов).
 * - {@link buildFormSchemaMetaSchema} — конкретная схема: сужает `$component(...)` до enum имён.
 * - {@link getComponentNames}/{@link getDataSourceNames} — извлечь имена из реестра по типу.
 *
 * Не тянет ajv (лёгкое; ajv — в `validate.ts`/`@reformer/renderer-json/validate`).
 *
 * @module reformer/renderer-json/schema
 */

import metaSchema from './form-schema.schema.json';
import { ALLOWED_HTML_TAGS } from '../html/html-tags';
import type { ComponentRegistry } from '../registry/types';

/**
 * Схема `componentProps` одного компонента (структурно = ui-kit `PropsSchema` после
 * `mergeFieldPropsSchema`, но БЕЗ завязки на `@reformer/ui-kit`: renderer-json React-free
 * и не зависит от ui-kit). Draft-07 JSON Schema плюс `x-*`-расширения (`x-doc`/`x-runtimeProps`/
 * `x-registryName`) — последние вырезаются перед компиляцией ajv ({@link stripDocExtensions}).
 */
export type ComponentPropsSchema = Record<string, unknown>;

/**
 * Базовая мета-схема form-DSL (draft-07): структура узлов + синтаксис операторов, имена компонентов
 * НЕ ограничены (паттерн `$component(...)` открыт). Для сужения до конкретного реестра —
 * {@link buildFormSchemaMetaSchema}. Используется как `$schema` в IDE и как база валидатора.
 *
 * @example Подключить как `$schema` в JSON-файле схемы
 * ```ts
 * // record можно записать в файл и сослаться на него из "$schema" JSON-схемы.
 * formSchemaMetaSchema.$schema; // 'http://json-schema.org/draft-07/schema#'
 * ```
 */
export const formSchemaMetaSchema = metaSchema as Record<string, unknown>;

/**
 * Имена компонентов реестра (тип `component`) — то, что валидно в `$component(...)`.
 *
 * @param registry - Реестр (см. {@link defineRegistry}).
 * @returns Массив имён компонентов.
 *
 * @example Сузить мета-схему до компонентов реестра
 * ```ts
 * const names = getComponentNames(registry); // ['Input', 'Select', 'Box', ...]
 * const schema = buildFormSchemaMetaSchema({ componentNames: names });
 * ```
 */
export function getComponentNames(registry: ComponentRegistry): string[] {
  return registry.names().filter((n) => registry.get(n)?.type === 'component');
}

/**
 * Имена registry-dataSource (`reg.dataSource`) — то, что валидно в `$dataSource(...)`:
 * options/itemLabel/константы/loading-компоненты.
 *
 * @param registry - Реестр (см. {@link defineRegistry}).
 * @returns Массив имён источников.
 *
 * @example
 * ```ts
 * getDataSourceNames(registry); // ['LOAN_TYPES', 'GENDERS', 'CURRENT_YEAR', ...]
 * ```
 */
export function getDataSourceNames(registry: ComponentRegistry): string[] {
  return registry.names().filter((n) => registry.get(n)?.type === 'dataSource');
}

/**
 * Имена функций реестра (`reg.fn`) — то, что валидно в `$fn(...)`: форматтеры/компараторы/itemLabel/
 * обработчики. Отдельно от {@link getDataSourceNames}, поэтому `validateFormSchema` ловит перепутанные
 * `$fn`/`$dataSource`.
 *
 * @param registry - Реестр (см. {@link defineRegistry}).
 * @returns Массив имён функций.
 */
export function getFnNames(registry: ComponentRegistry): string[] {
  return registry.names().filter((n) => registry.get(n)?.type === 'fn');
}

/**
 * Известные ключи локализации сервиса реестра (`reg.locale` с каталогом) — то, что валидно в
 * `$locale(...)`. `undefined`, если сервис не зарегистрирован или задан голым резолвером без `keys`
 * (тогда `validateFormSchema` мягко пропускает проверку ключей, как для `$model`-путей).
 *
 * @param registry - Реестр (см. {@link defineRegistry}).
 * @returns Массив ключей либо `undefined`.
 */
export function getLocaleKeys(registry: ComponentRegistry): readonly string[] | undefined {
  return registry.getLocale?.()?.keys;
}

/** Определение `operatorOp` из базовой мета-схемы (escape-hatch оператор-строки на месте значения). */
function operatorOpDefinition(): Record<string, unknown> {
  const defs = (metaSchema as { definitions: Record<string, unknown> }).definitions;
  return defs.operatorOp as Record<string, unknown>;
}

/**
 * Рекурсивно вырезает `x-*`-ключи (`x-doc`/`x-runtimeProps`/`x-registryName`) из схемы. Нужно перед
 * компиляцией ajv: в strict-режиме ajv бросает `unknown keyword: "x-doc"`. Удачно — это машинная
 * гарантия, что валидатор DSL физически не видит doc-метаданные.
 *
 * @param schema - Любой JSON-совместимый узел (объект/массив/скаляр).
 * @returns Глубокая копия без `x-*`-ключей.
 */
export function stripDocExtensions<T>(schema: T): T {
  return deepStripDocExtensions(schema) as T;
}

function deepStripDocExtensions(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(deepStripDocExtensions);
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (k.startsWith('x-')) continue;
      out[k] = deepStripDocExtensions(v);
    }
    return out;
  }
  return value;
}

/**
 * Рекурсивно оборачивает КАЖДЫЙ проп схемы в `anyOf: [<честный тип>, operatorOp]`, чтобы автор
 * схемы формы не дублировал escape-hatch руками: оператор-строка (`"$dataSource(LOAN_TYPES)"`,
 * `"$fn(fmt)"`) допустима на месте любого значения componentProps. Спускается во вложенные
 * `properties` и `items`; сам объект в `anyOf` не оборачивается (componentProps — всегда объект).
 * Ссылается на `#/definitions/operatorOp` — определение подставляет {@link toComponentPropsValidatorSchema}.
 *
 * @param schema - JSON Schema (обычно после {@link stripDocExtensions}).
 * @returns Копия схемы с обёрнутыми пропами.
 */
export function allowOperatorStrings<T>(schema: T): T {
  return wrapPropsWithOperator(schema) as T;
}

function wrapPropsWithOperator(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(wrapPropsWithOperator);
  if (value === null || typeof value !== 'object') return value;
  const node = value as Record<string, unknown>;
  const out: Record<string, unknown> = { ...node };
  if (
    node.properties !== null &&
    typeof node.properties === 'object' &&
    !Array.isArray(node.properties)
  ) {
    const props: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node.properties as Record<string, unknown>)) {
      props[k] = { anyOf: [wrapPropsWithOperator(v), { $ref: '#/definitions/operatorOp' }] };
    }
    out.properties = props;
  }
  if (node.items !== undefined) {
    out.items = wrapPropsWithOperator(node.items);
  }
  return out;
}

/**
 * Превращает схему `componentProps` компонента ({@link ComponentPropsSchema}) в самодостаточную
 * ajv-схему: {@link stripDocExtensions} (снять `x-*`) → {@link allowOperatorStrings} (обернуть пропы
 * в `anyOf` с operatorOp) → добавить `definitions.operatorOp`, чтобы `$ref` резолвился при
 * standalone-компиляции. Используется фазой (d) `validateFormSchema` и IDE-веткой
 * {@link buildFormSchemaMetaSchema}.
 *
 * @param propsSchema - Полная схема componentProps (враппер + вариант; уже прошедшая mergeFieldPropsSchema).
 * @returns JSON-схема, готовая к `ajv.compile`.
 */
export function toComponentPropsValidatorSchema(
  propsSchema: ComponentPropsSchema
): Record<string, unknown> {
  const stripped = stripDocExtensions(propsSchema) as Record<string, unknown>;
  const wrapped = allowOperatorStrings(stripped) as Record<string, unknown>;
  const existingDefs = (wrapped.definitions as Record<string, unknown> | undefined) ?? {};
  return {
    ...wrapped,
    definitions: { ...existingDefs, operatorOp: operatorOpDefinition() },
  };
}

/** Опции {@link buildFormSchemaMetaSchema}. */
export interface BuildFormSchemaMetaSchemaOptions {
  /** Имена компонентов реестра — сужают `$component(...)` до enum. */
  componentNames?: string[];
  /**
   * Карта регистр-имя → схема componentProps. НОВОЕ необязательное поле: если задано, в `fieldNode`/
   * `containerNode` добавляются `allOf`-ветки `if/then` (по одной на компонент) для IDE-подсветки
   * componentProps через `$schema`. Реальную проверку делает рекурсивный обход в `validateFormSchema`
   * (§ Props-компаньоны: `if/then` структурно недостижим для вложенных нод, годится только для IDE).
   */
  propSchemas?: Record<string, ComponentPropsSchema>;
}

/**
 * Конкретная мета-схема: базовая + (если заданы `componentNames`) сужение `$component(...)` до
 * enum допустимых значений (`["$component(Input)", "$component(Select)", …]`). `$dataSource`-имена
 * JSON Schema'й не покрыть (вложены в произвольный componentProps) — их проверяет рекурсивный обход
 * в `validateFormSchema`.
 *
 * enum, а не regex-`pattern`: ajv перечисляет допустимые имена в тексте ошибки, IDE даёт
 * автодополнение по значениям, а имена не нужно экранировать под regex (напр. `$fieldWrapper`).
 *
 * Если задан `propSchemas`, в узлы, несущие `component`, добавляются `if/then`-ветки для IDE-подсветки
 * componentProps. В `if` обязателен `required: ['component']` — иначе нода без `component` (напр.
 * array-нода) вакуумно проходит `if` и получает чужой `then`.
 *
 * @example
 * ```ts
 * const schema = buildFormSchemaMetaSchema({ componentNames: getComponentNames(registry) });
 * ```
 */
export function buildFormSchemaMetaSchema(
  opts?: BuildFormSchemaMetaSchemaOptions
): Record<string, unknown> {
  const schema = JSON.parse(JSON.stringify(metaSchema)) as {
    definitions: Record<string, { pattern?: string; enum?: string[]; allOf?: unknown[] }>;
  };
  const names = opts?.componentNames;
  if (names && names.length > 0) {
    const op = schema.definitions.componentOp;
    delete op.pattern;
    op.enum = names.map((n) => `$component(${n})`);
  }
  // Теги `$html(...)` известны статически (whitelist), поэтому enum ставится всегда — IDE даёт
  // автодополнение по тегам, а опечатка (`$html(dvi)`) подсвечивается прямо в редакторе.
  const htmlOp = schema.definitions.htmlOp;
  delete htmlOp.pattern;
  htmlOp.enum = [...ALLOWED_HTML_TAGS].map((t) => `$html(${t})`);
  const propSchemas = opts?.propSchemas;
  if (propSchemas && Object.keys(propSchemas).length > 0) {
    const branches = Object.entries(propSchemas).map(([name, ps]) => ({
      if: {
        required: ['component'],
        properties: { component: { const: `$component(${name})` } },
      },
      then: {
        properties: { componentProps: toComponentPropsValidatorSchema(ps) },
      },
    }));
    for (const def of ['fieldNode', 'containerNode'] as const) {
      const target = schema.definitions[def];
      target.allOf = [...(target.allOf ?? []), ...branches];
    }
  }
  return schema as unknown as Record<string, unknown>;
}
