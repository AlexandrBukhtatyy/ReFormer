/**
 * Перевод документа JSON-схемы прежнего формата (v1) в формат 2.
 *
 * Что меняется:
 * - ключи привязки: у поля `value` → `model`, у массива `array` → `model`;
 * - шаги визарда переезжают из `componentProps.steps` в `children` узла;
 * - документ получает `format: 2`.
 *
 * Всё остальное — `selector`, `$nodeId`, `wrapper`, `componentProps`, тексты, порядок узлов —
 * сохраняется как есть. Имя компонента визарда функция не меняет: на какой компонент оно
 * указывает, решает реестр приложения, то есть код, а не данные.
 *
 * Чистая функция: ни React, ни реестр, ни модель ей не нужны — вызывается при чтении документа
 * из сети, кэша или с диска.
 *
 * @module reformer/renderer-json/migrate
 */

import { isModelOp, isComponentOp, isHtmlOp, parseOperator } from './operators';
import { isJsonStepRef } from './compose';
import { schemaFormatOf, type JsonFormSchema } from './types/json-schema';

/** Опции {@link migrateJsonSchema}. */
export interface MigrateJsonSchemaOptions {
  /**
   * Имена компонентов реестра, чьи `componentProps.steps` — шаги: они переносятся в `children`.
   * По умолчанию — {@link DEFAULT_STEP_HOSTS}.
   */
  stepHosts?: readonly string[];
}

/**
 * Имена компонентов-визардов по умолчанию: под ними `componentProps.steps` — шаги.
 *
 * @example
 * ```ts
 * migrateJsonSchema(document, { stepHosts: [...DEFAULT_STEP_HOSTS, 'MyWizard'] });
 * ```
 */
export const DEFAULT_STEP_HOSTS: readonly string[] = ['Wizard', 'RendererFormWizard', 'FormWizard'];

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/** Похож ли объект на узел v1: несёт оператор в `value`, `array` или `component`. */
const looksLikeNode = (value: Json): boolean =>
  isModelOp(value.value) ||
  isModelOp(value.array) ||
  isComponentOp(value.component) ||
  isHtmlOp(value.component);

/**
 * Перевести документ JSON-схемы v1 в формат 2. Документ формата 2 возвращается как есть.
 *
 * @typeParam T - Форма данных модели.
 * @param schema - Документ схемы прежнего либо нового формата.
 * @param options - {@link MigrateJsonSchemaOptions}: имена компонентов-визардов.
 * @returns Документ формата 2. Аргумент не мутируется.
 *
 * @example
 * ```ts
 * import { migrateJsonSchema } from '@reformer/renderer-json';
 *
 * const schema = migrateJsonSchema(await loadSchema(id)); // сохранённый документ любого формата
 * const bundle = createForm({ model, schema, registry });
 * ```
 */
export function migrateJsonSchema<T = unknown>(
  schema: unknown,
  options: MigrateJsonSchemaOptions = {}
): JsonFormSchema<T> {
  if (schemaFormatOf(schema) === 2) return schema as JsonFormSchema<T>;
  const stepHosts = new Set(options.stepHosts ?? DEFAULT_STEP_HOSTS);

  /** Значение пропса: вложенный узел, массив, объект либо литерал. */
  const migratePropValue = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(migratePropValue);
    if (!isObject(value)) return value;
    if (looksLikeNode(value)) return migrateNode(value);
    const out: Json = {};
    for (const [key, child] of Object.entries(value)) out[key] = migratePropValue(child);
    return out;
  };

  const migrateProps = (props: unknown): unknown => {
    if (!isObject(props)) return props;
    const out: Json = {};
    for (const [key, value] of Object.entries(props)) out[key] = migratePropValue(value);
    return out;
  };

  /** Ребёнок или шаг: узел переводится, текст и ссылка на файл шага остаются как есть. */
  const migrateChild = (child: unknown): unknown =>
    isObject(child) && !isJsonStepRef(child) ? migrateNode(child) : child;

  const migrateNode = (node: Json): Json => {
    const out: Json = {};
    const isArray = isModelOp(node.array) && isObject(node.item);
    const hostName = parseOperator(node.component)?.arg;
    const props = node.componentProps;
    // Шаги — только у компонента-визарда: у прочих `steps` — обычный проп.
    const steps =
      !isArray && hostName !== undefined && stepHosts.has(hostName) && isObject(props)
        ? props.steps
        : undefined;
    const movesSteps = Array.isArray(steps);

    for (const [key, value] of Object.entries(node)) {
      if (key === 'array' && isArray) {
        out.model = value;
      } else if (key === 'value' && !isArray && isModelOp(value)) {
        out.model = value;
      } else if (key === 'item' && isArray) {
        const item = value as Json;
        out.item = isObject(item.$template)
          ? { ...item, $template: migrateNode(item.$template) }
          : item;
      } else if (key === 'wrapper') {
        out.wrapper = isObject(value) ? migrateNode(value) : value;
      } else if (key === 'children') {
        out.children = Array.isArray(value) ? value.map(migrateChild) : value;
      } else if (key === 'componentProps') {
        const migrated = migrateProps(value) as Json;
        if (movesSteps) {
          const rest: Json = { ...migrated };
          delete rest.steps;
          if (Object.keys(rest).length > 0) out.componentProps = rest;
        } else {
          out.componentProps = migrated;
        }
      } else {
        out[key] = value;
      }
    }

    if (movesSteps) {
      const existing = Array.isArray(out.children) ? (out.children as unknown[]) : [];
      out.children = [...existing, ...(steps as unknown[]).map(migrateChild)];
    }
    return out;
  };

  const source = schema as Json;
  const { root, ...rest } = source;
  const head: Json = {};
  // `format` встаёт сразу после `$schema` — так документ читается сверху вниз.
  if ('$schema' in rest) head.$schema = rest.$schema;
  head.format = 2;
  return {
    ...head,
    ...rest,
    format: 2,
    root: migrateNode(root as Json),
  } as unknown as JsonFormSchema<T>;
}
