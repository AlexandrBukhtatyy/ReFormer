/**
 * Скомпилированная схема формы — результат {@link compileSchema}.
 *
 * Авторское дерево ({@link FormSchemaNode}) описывает вид узла ключами: `model`, `item`, `part`,
 * `children`. Разбирать их по-своему раньше приходилось каждому, кто обходил дерево: сборке формы,
 * рендереру, конвертеру JSON. Компилятор разбирает дерево один раз, и все читают его итог: у
 * каждого узла явный вид (`kind`), нормализованная привязка к модели и идентификатор в своей
 * области.
 *
 * @group Schema
 * @module form/schema/compiled
 */

import type { Signal } from '@preact/signals-core';
import type {
  ComponentRef,
  FormSchemaNode,
  SchemaArrayControl,
  SchemaArrayHandle,
  SchemaGroupHandle,
  SchemaValueHandle,
} from '../types/schema-node';

/**
 * Идентификатор узла: `selector` автора, а у узла без него — позиционный путь от корня области
 * (`#/0/2`). Уникален в пределах области.
 *
 * @group Schema
 */
export type SchemaNodeId = string & { readonly __nodeId: true };

/**
 * Идентификатор области схемы: `#` — корень, `#/address` — подформа, `#/phones[3]` — строка
 * массива (в скобках — стабильный ключ строки, который не меняется при перестановке).
 *
 * @group Schema
 */
export type SchemaScopeId = string & { readonly __scopeId: true };

/** Ключи, общие для узлов всех видов, кроме текста. */
interface CompiledNodeBase {
  /** Идентификатор в области: `selector`, иначе позиционный путь. */
  readonly id: SchemaNodeId;
  /** Позиционный путь узла в области (`#/0/2`) — для сообщений об ошибках. */
  readonly path: string;
  /** `selector` автора: по нему узел адресуют поведение и шаги. */
  readonly selector: string | undefined;
  /** Область, которой принадлежит узел. */
  readonly scope: SchemaScopeId;
  /** Компонент узла как есть: ядро его не интерпретирует. */
  readonly component: ComponentRef | undefined;
  /** `componentProps` автора; без них — пустой объект. */
  readonly props: Readonly<Record<string, unknown>>;
  /** Авторский узел, из которого скомпилирован этот. */
  readonly source: FormSchemaNode;
}

/**
 * Поле: узел, привязанный к ручке значения — листу или массиву целиком.
 *
 * @group Schema
 */
export interface CompiledFieldNode extends CompiledNodeBase {
  readonly kind: 'field';
  /** Ручка значения `model.$.<лист | массив>`. */
  readonly handle: SchemaValueHandle;
  /** Поле создаётся отключённым. */
  readonly disabled: boolean;
}

/**
 * Массив под-форм: у каждой строки своя форма и своя область схемы.
 *
 * @group Schema
 */
export interface CompiledArrayNode extends CompiledNodeBase {
  readonly kind: 'array';
  /** Ручка массива `model.$.<массив>` — привязка фасадом нормализуется к ней. */
  readonly handle: SchemaArrayHandle;
  /** Фасад массива модели: длина, строки и мутации. */
  readonly control: SchemaArrayControl;
  /** Запасной шаблон нового элемента из узла; шаблон модели (`arrayOf`) главнее. */
  readonly initialValue: unknown;
  /**
   * Скомпилированная схема строки — одна на под-модель строки: сборка формы строки и рендерер
   * получают один и тот же объект.
   */
  row(rowModel: object): CompiledSchema;
}

/**
 * Подформа: часть схемы, подключённая к группе модели. Содержимое компилируется сразу, в своей
 * области.
 *
 * @group Schema
 */
export interface CompiledPartNode extends CompiledNodeBase {
  readonly kind: 'part';
  /** Ручка группы `model.$.<группа>`. */
  readonly handle: SchemaGroupHandle;
  /** Под-модель группы — ключ области подформы. */
  readonly model: object;
  /** Скомпилированное содержимое части. */
  readonly content: CompiledSchema;
}

/**
 * Контейнер: узел с детьми либо без привязки — секция, шаг визарда, html-тег. Без `component`
 * рендерер рисует только детей.
 *
 * @group Schema
 */
export interface CompiledContainerNode extends CompiledNodeBase {
  readonly kind: 'container';
  /** Дети в порядке следования: узлы и текст. */
  readonly children: readonly CompiledChild[];
}

/**
 * Часть текста: литерал, число или сигнал (его значение выводится и обновляется на месте).
 *
 * @group Schema
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SchemaTextPart = string | number | Signal<any>;

/**
 * Текст контейнера: подряд идущие текстовые дети автора, склеенные в один узел.
 *
 * @group Schema
 */
export interface CompiledTextNode {
  readonly kind: 'text';
  /** Позиционный путь первой части. */
  readonly id: SchemaNodeId;
  readonly parts: readonly SchemaTextPart[];
}

/**
 * Узел скомпилированной схемы: поле, массив под-форм, подформа или контейнер.
 *
 * @group Schema
 */
export type CompiledNode =
  | CompiledFieldNode
  | CompiledArrayNode
  | CompiledPartNode
  | CompiledContainerNode;

/**
 * Ребёнок контейнера: узел либо текст.
 *
 * @group Schema
 */
export type CompiledChild = CompiledNode | CompiledTextNode;

/**
 * Скомпилированная схема одной области: корня сборки, строки массива или подформы.
 *
 * @group Schema
 */
export interface CompiledSchema {
  /** Идентификатор области. */
  readonly scope: SchemaScopeId;
  /** Модель области: корень сборки, под-модель строки или группы; без модели — `undefined`. */
  readonly model: object | undefined;
  /** Корневой узел области. */
  readonly root: CompiledNode;
  /** Узлы этой области по идентификатору; узлы строк и подформ лежат в их схемах. */
  readonly nodes: ReadonlyMap<SchemaNodeId, CompiledNode>;
  /** Поля по ручке модели — этой области и её подформ (строки массивов — в их схемах). */
  readonly fields: ReadonlyMap<object, CompiledFieldNode>;
  /** Массивы под-форм по ручке модели — этой области и её подформ. */
  readonly arrays: ReadonlyMap<object, CompiledArrayNode>;
}
