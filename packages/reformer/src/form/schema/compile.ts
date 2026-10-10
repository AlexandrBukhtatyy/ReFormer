/**
 * Компилятор схемы формы: авторское дерево → {@link CompiledSchema}.
 *
 * Вид узла определяют ключи и значение привязки (порядок проверок важен — ручка массива тоже
 * ручка значения, поэтому массив под-форм узнаётся раньше поля):
 *
 * | Вид              | Узел автора                                  |
 * | ---------------- | -------------------------------------------- |
 * | массив под-форм  | `item` + привязка к массиву (ручка либо фасад) |
 * | подформа         | `part` + привязка к группе (ручка либо под-модель) |
 * | поле             | привязка — ручка значения (лист либо массив целиком) |
 * | контейнер        | всё остальное: `children`, `component`       |
 *
 * Вложенные узлы читаются только из `children` и из поддерева `part`; в `componentProps` и под
 * произвольными ключами компилятор не заглядывает. Строки массивов компилируются при первом
 * обращении (`row`), подформы — сразу.
 *
 * @group Schema
 * @module form/schema/compile
 */

import {
  containerNodeOf,
  isModelContainerSignal,
  isValueSignal,
} from '../../model/model-signals-proxy';
import {
  arrayHandleOf,
  groupHandleOf,
  isModelFacade,
  modelOf,
} from '../../model/model-value-proxy';
import { schemaSubtree } from '../schema-subtree';
import { rowKeyOf } from './row-key';
import type {
  FormSchemaNode,
  SchemaArrayControl,
  SchemaArrayHandle,
  SchemaGroupHandle,
  SchemaValueHandle,
} from '../types/schema-node';
import type {
  CompiledArrayNode,
  CompiledChild,
  CompiledContainerNode,
  CompiledFieldNode,
  CompiledNode,
  CompiledPartNode,
  CompiledSchema,
  SchemaNodeId,
  SchemaScopeId,
  SchemaTextPart,
} from './compiled';

/* eslint-disable @typescript-eslint/no-explicit-any */

const AT = '[@reformer/core] compileSchema';

/** Ключи узла, которые читает ядро или рендерер. */
const NODE_KEYS = new Set([
  'model',
  'item',
  'part',
  'children',
  'component',
  'componentProps',
  'selector',
  'disabled',
  'initialValue',
]);

/** Чем заменить ключ узла, который раньше что-то значил. */
const KEY_HINTS: Record<string, string> = {
  value: 'привязка поля — `model: model.$.<поле>`',
  array: 'привязка массива под-форм — `model: model.$.<массив>`',
};

const EMPTY_PROPS: Readonly<Record<string, unknown>> = Object.freeze({});

/** Узлы, которые выдал компилятор, — их отличает {@link isCompiledNode}. */
const compiledNodes = new WeakSet<object>();

/**
 * Узел скомпилированной схемы, а не авторский узел?
 *
 * @param value - Что угодно.
 * @returns `true` для узла, выданного {@link compileSchema}.
 *
 * @example
 * ```typescript
 * isCompiledNode(compileSchema(tree, model).root); // true
 * isCompiledNode(tree); // false
 * ```
 *
 * @group Schema
 */
export function isCompiledNode(value: unknown): value is CompiledNode {
  return value !== null && typeof value === 'object' && compiledNodes.has(value);
}

/** Опции {@link compileSchema}. */
export interface CompileSchemaOptions {
  /** Идентификатор области дерева; по умолчанию корень `#`. */
  readonly scope?: SchemaScopeId;
}

/** Состояние компиляции одной области. */
interface ScopeContext {
  readonly scope: SchemaScopeId;
  /** Путь модели области (`phones.0`); пути групп и массивов внутри неё пишутся относительно. */
  readonly basePath: string | undefined;
  readonly nodes: Map<SchemaNodeId, CompiledNode>;
  readonly fields: Map<object, CompiledFieldNode>;
  readonly arrays: Map<object, CompiledArrayNode>;
  /** Позиции узлов по `selector` — для сообщения о повторе. */
  readonly selectorPaths: Map<string, string>;
  /** Узлы на пути от корня: узел внутри самого себя — цикл. */
  readonly ancestors: Set<object>;
  /** Ключи узлов, которые компилятор не читает (общие для области и её подформ). */
  readonly unknownKeys: Set<string>;
}

/** Путь модели контейнера (`phones.0.address`); для не-ручки — `undefined`. */
function modelPathOf(handle: unknown): string | undefined {
  return containerNodeOf(handle)?.path;
}

/** Путь контейнера относительно модели области — часть идентификатора вложенной области. */
function relativePath(handle: unknown, context: ScopeContext, fallback: string): string {
  const path = modelPathOf(handle);
  if (path === undefined) return fallback;
  const base = context.basePath;
  if (base === undefined || base === '') return path;
  return path.startsWith(`${base}.`) ? path.slice(base.length + 1) : path;
}

/** Ребёнок-текст: литерал, число или сигнал (включая ручку массива целиком). */
function isTextPart(child: unknown): child is SchemaTextPart {
  return typeof child === 'string' || typeof child === 'number' || isValueSignal(child);
}

/** Ребёнок, которого нет: условная вставка `cond && узел` и пустые места. */
function isEmptyChild(child: unknown): boolean {
  return child === null || child === undefined || typeof child === 'boolean';
}

function warn(message: string): void {
  if (process.env.NODE_ENV !== 'production' && typeof console !== 'undefined') {
    console.warn(message);
  }
}

/** Общие ключи узла любого вида. */
function baseOf(
  node: Record<string, unknown>,
  path: string,
  context: ScopeContext
): {
  id: SchemaNodeId;
  path: string;
  selector: string | undefined;
  scope: SchemaScopeId;
  component: CompiledNode['component'];
  props: Readonly<Record<string, unknown>>;
  source: FormSchemaNode;
} {
  const selector =
    typeof node.selector === 'string' && node.selector !== '' ? node.selector : undefined;
  if (selector !== undefined) {
    const previous = context.selectorPaths.get(selector);
    if (previous !== undefined) {
      throw new Error(
        `${AT}: в области «${context.scope}» селектор «${selector}» повторяется — узлы ` +
          `${previous} и ${path}. По \`selector\` узел адресуют поведение и шаги, поэтому в ` +
          'области он уникален. Дайте узлам разные селекторы; в строках массива и подформах ' +
          'селекторы живут в своих областях и с корнем не пересекаются.'
      );
    }
    context.selectorPaths.set(selector, path);
  }
  return {
    id: (selector ?? path) as SchemaNodeId,
    path,
    selector,
    scope: context.scope,
    component: node.component as CompiledNode['component'],
    props: (node.componentProps as Record<string, unknown> | undefined) ?? EMPTY_PROPS,
    source: node as FormSchemaNode,
  };
}

/** Зарегистрировать узел: в индекс области и в набор скомпилированных. */
function register<N extends CompiledNode>(node: N, context: ScopeContext): N {
  compiledNodes.add(node);
  context.nodes.set(node.id, node);
  return node;
}

/** Узел-контейнер: дети — узлы и текст. */
function compileContainer(
  node: Record<string, unknown>,
  path: string,
  context: ScopeContext
): CompiledContainerNode {
  const base = baseOf(node, path, context);
  const children: CompiledChild[] = [];
  const raw = node.children;
  if (Array.isArray(raw)) {
    let text: { id: SchemaNodeId; parts: SchemaTextPart[] } | null = null;
    for (let index = 0; index < raw.length; index++) {
      const child: unknown = raw[index];
      const childPath = `${path}/${index}`;
      if (isEmptyChild(child)) continue;
      if (isTextPart(child)) {
        // Подряд идущие части склеиваются в один текст.
        if (text === null) {
          text = { id: childPath as SchemaNodeId, parts: [] };
          children.push({ kind: 'text', id: text.id, parts: text.parts });
        }
        text.parts.push(child);
        continue;
      }
      text = null;
      if (typeof child !== 'object' || isModelContainerSignal(child) || isModelFacade(child)) {
        warn(
          `${AT}: ребёнок ${childPath} — не узел и не текст (группа модели, под-модель либо ` +
            'значение другого типа); он пропущен. Текст — строка, число или сигнал; группу ' +
            'подключают узлом `{ model: model.$.<группа>, part }`.'
        );
        continue;
      }
      children.push(compileNode(child as object, childPath, context));
    }
  }
  return register({ ...base, kind: 'container', children }, context);
}

/** Узел дерева области любого вида. */
function compileNode(raw: object, path: string, context: ScopeContext): CompiledNode {
  if (context.ancestors.has(raw)) {
    throw new Error(`${AT}: узел ${path} содержит сам себя — дерево схемы зациклено.`);
  }
  context.ancestors.add(raw);
  try {
    return compileKnown(raw as Record<string, unknown>, path, context);
  } finally {
    context.ancestors.delete(raw);
  }
}

function compileKnown(
  node: Record<string, unknown>,
  path: string,
  context: ScopeContext
): CompiledNode {
  if (process.env.NODE_ENV !== 'production') {
    for (const key of Object.keys(node)) if (!NODE_KEYS.has(key)) context.unknownKeys.add(key);
  }

  // Массив под-форм: { model: model.$.<массив>, item: (model) => узел }.
  if (typeof node.item === 'function') {
    const handle = arrayHandleOf(node.model) as SchemaArrayHandle | undefined;
    if (handle) return compileArray(node, handle, path, context);
    warn(
      `${AT}: у узла с \`item\` привязка — не массив модели (узел ${path}); он стал ` +
        'контейнером без строк. Ожидается `model: model.$.<массив>`; начальное значение поля ' +
        'должно быть массивом, а не `null`.'
    );
    return compileContainer(node, path, context);
  }

  // Подформа: { model: model.$.<группа>, part: (model) => узел }.
  if (typeof node.part === 'function') {
    const handle = groupHandleOf(node.model) as SchemaGroupHandle | undefined;
    if (handle) return compilePart(node, handle, path, context);
    warn(
      `${AT}: у узла с \`part\` привязка — не группа модели (узел ${path}); он стал ` +
        'контейнером. Ожидается `model: model.$.<группа>`.'
    );
    return compileContainer(node, path, context);
  }

  // Поле — узел с ручкой значения: лист ИЛИ массив целиком (мультивыбор, теги, файлы).
  if (isValueSignal(node.model)) {
    const handle = node.model as SchemaValueHandle;
    const field: CompiledFieldNode = register(
      { ...baseOf(node, path, context), kind: 'field', handle, disabled: node.disabled === true },
      context
    );
    context.fields.set(handle, field);
    return field;
  }

  if (node.model != null) {
    // Частые причины: `model: model.<path>` (value-фасад) вместо `model: model.$.<path>` либо
    // группа без `part`.
    warn(
      `${AT}: привязка узла не распознана (узел ${path}) — он не стал полем. Ожидается ` +
        '`model: model.$.<path>` (лист или массив); проверьте, что не передан ' +
        '`model: model.<path>` (value-фасад) или группа без `part`.'
    );
  }
  return compileContainer(node, path, context);
}

function compileArray(
  node: Record<string, unknown>,
  handle: SchemaArrayHandle,
  path: string,
  context: ScopeContext
): CompiledArrayNode {
  const item = node.item as (rowModel: any) => FormSchemaNode;
  const arrayPath = relativePath(handle, context, path);
  const scopePrefix = `${context.scope}/${arrayPath}`;
  const rows = new WeakMap<object, CompiledSchema>();
  const array: CompiledArrayNode = register(
    {
      ...baseOf(node, path, context),
      kind: 'array',
      handle,
      control: modelOf(handle as unknown as { peek(): unknown[] }) as unknown as SchemaArrayControl,
      initialValue: node.initialValue,
      row(rowModel) {
        let row = rows.get(rowModel);
        if (!row) {
          row = compileScope(
            schemaSubtree(item, rowModel),
            rowModel,
            `${scopePrefix}[${rowKeyOf(rowModel)}]` as SchemaScopeId
          );
          rows.set(rowModel, row);
        }
        return row;
      },
    },
    context
  );
  context.arrays.set(handle, array);
  return array;
}

function compilePart(
  node: Record<string, unknown>,
  handle: SchemaGroupHandle,
  path: string,
  context: ScopeContext
): CompiledPartNode {
  const base = baseOf(node, path, context);
  const subModel = modelOf(handle as unknown as { peek(): object }) as object;
  const scope = `${context.scope}/${relativePath(handle, context, path)}` as SchemaScopeId;
  // Отдельной формы у части нет: её поля и массивы принадлежат этой же сборке.
  const content = compileScopeWith(
    schemaSubtree(node.part as (subModel: any) => FormSchemaNode, subModel),
    subModel,
    scope,
    context.unknownKeys
  );
  for (const [key, field] of content.fields) context.fields.set(key, field);
  for (const [key, array] of content.arrays) context.arrays.set(key, array);
  return register({ ...base, kind: 'part', handle, model: subModel, content }, context);
}

/** Компиляция области; ключи без смысла копятся в `unknownKeys` родителя. */
function compileScopeWith(
  tree: unknown,
  model: object | undefined,
  scope: SchemaScopeId,
  unknownKeys: Set<string>
): CompiledSchema {
  if (tree === null || typeof tree !== 'object') {
    throw new Error(`${AT}: корень области «${scope}» — не узел схемы: ${String(tree)}.`);
  }
  const modelRoot = model !== undefined ? (model as { $?: unknown }).$ : undefined;
  const context: ScopeContext = {
    scope,
    basePath: modelPathOf(modelRoot),
    nodes: new Map(),
    fields: new Map(),
    arrays: new Map(),
    selectorPaths: new Map(),
    ancestors: new Set(),
    unknownKeys,
  };
  const root = compileNode(tree, '#', context);
  return {
    scope,
    model,
    root,
    nodes: context.nodes,
    fields: context.fields,
    arrays: context.arrays,
  };
}

/** Компиляция области с предупреждением о непрочитанных ключах. */
function compileScope(
  tree: unknown,
  model: object | undefined,
  scope: SchemaScopeId
): CompiledSchema {
  const unknownKeys = new Set<string>();
  const compiled = compileScopeWith(tree, model, scope, unknownKeys);
  if (unknownKeys.size > 0) warnUnknownNodeKeys(unknownKeys);
  return compiled;
}

/** Dev-предупреждение о ключах узлов, которые компилятор не читает. */
function warnUnknownNodeKeys(unknownKeys: ReadonlySet<string>): void {
  const keys = [...unknownKeys];
  const hints = keys
    .filter((key) => key in KEY_HINTS)
    .map((key) => `\`${key}\`: ${KEY_HINTS[key]}`);
  warn(
    `${AT}: у узлов схемы есть ключи, которые сборка не читает: ` +
      `${keys.map((key) => `\`${key}\``).join(', ')}. Узел описывают \`model\`, \`item\`, ` +
      '`part`, `children`, `component`, `componentProps`, `selector`, `disabled` и ' +
      '`initialValue`; вложенные узлы читаются только из `children`.' +
      (hints.length > 0 ? ` ${hints.join('; ')}.` : '')
  );
}

/**
 * Скомпилировать дерево схемы: вид каждого узла, нормализованные привязки, идентификаторы и
 * индексы области.
 *
 * Повтор `selector` в одной области — исключение с путями обоих узлов. Неизвестный ключ узла и
 * нераспознанная привязка — предупреждения в dev; такой узел становится контейнером.
 *
 * @param tree - Корень авторского дерева ({@link FormSchemaNode}).
 * @param model - Модель области (корень сборки, под-модель строки либо группы); без неё пути
 *   вложенных областей строятся по позиции узла.
 * @param options - {@link CompileSchemaOptions}.
 * @returns {@link CompiledSchema} области.
 * @throws Error при повторе `selector` в области и при зацикленном дереве.
 *
 * @example
 * ```typescript
 * const model = createModel({ email: '', phones: [{ number: '' }] });
 * const compiled = compileSchema(
 *   {
 *     children: [
 *       { selector: 'email', model: model.$.email, component: Input },
 *       { model: model.$.phones, item: (row) => ({ model: row.$.number, component: Input }) },
 *     ],
 *   },
 *   model
 * );
 *
 * compiled.nodes.get('email' as SchemaNodeId)?.kind; // 'field'
 * compiled.fields.get(model.$.email)?.component; // Input
 * compiled.arrays.get(model.$.phones)?.row(model.phones.at(0)!).scope; // '#/phones[0]'
 * ```
 *
 * @group Schema
 */
export function compileSchema(
  tree: FormSchemaNode,
  model?: object,
  options?: CompileSchemaOptions
): CompiledSchema {
  return compileScope(tree, model, options?.scope ?? ('#' as SchemaScopeId));
}

/* eslint-enable @typescript-eslint/no-explicit-any */
