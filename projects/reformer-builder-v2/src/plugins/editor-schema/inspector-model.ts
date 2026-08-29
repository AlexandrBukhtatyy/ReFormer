/**
 * Модель инспектора: какие свойства показывать у выделенного узла и чем их править.
 *
 * Отбор свойств — целиком дело каталога: инспектор показывает то, что кит объявил
 * в `propsSchema`, разложенное по секциям `x-doc.group` (`lib/catalog/widgets`). Своего
 * списка полей у инспектора нет и быть не может — иначе он показывал бы у компонента
 * то, чего компонент не принимает, и не показывал бы того, что принимает.
 *
 * ## Виджет ↔ редактор
 *
 * Каталог называет ВИД свойства (`boolean`, `enum`, `className`), инспектор выбирает
 * элемент управления. Отображение одностороннее и намеренно грубое в этом срезе:
 * специализированные редакторы (словарь классов Tailwind, пикер значков, источник данных)
 * — отдельные работы, а до них честнее показать значение только на чтение, чем дать
 * править его текстом и испортить.
 *
 * ## Значение читается из узла, а не из умолчания
 *
 * Умолчание каталога показывается подсказкой, но не подставляется в значение: свойство,
 * которого в `componentProps` нет, и свойство, равное умолчанию, — разные состояния схемы,
 * и склеить их значило бы записывать в файл то, чего человек не писал.
 *
 * @module plugins/editor-schema/inspector-model
 */

import type { JsonFormSchema, JsonNode } from '@reformer/renderer-json';
import { inspectorGroups } from '@/lib/catalog/widgets';
import type { CatalogEntry, InspectorProp, InspectorWidget, PropGroup } from '@/lib/catalog/types';
import { textChildIndex } from '@/lib/form-model/mutate';
import { canAcceptChildren, kindOf, type NodeKind } from '@/lib/form-model/node-kind';
import { componentOf, modelOf } from '@/lib/form-model/node-ref';
import { indexNodes } from './node-index';
import { nodeTitle } from './canvas-tree';
import type { NodeId } from './host';

/**
 * Элемент управления инспектора.
 *
 * `readonly` — не «запрещено править», а «нечем править ЗДЕСЬ»: значение показывается,
 * а правится пока в JSON. Отдельный вид нужен, чтобы это состояние было видно на экране,
 * а не выглядело сломанным полем ввода.
 */
export type InspectorEditor = 'text' | 'checkbox' | 'number' | 'select' | 'readonly';

/** Поле инспектора: свойство каталога вместе с текущим значением узла. */
export interface InspectorField {
  readonly key: string;
  readonly label: string;
  readonly editor: InspectorEditor;
  readonly group: PropGroup;
  readonly description?: string;
  /** Умолчание каталога. Показывается подсказкой, в значение не подставляется. */
  readonly fallback?: unknown;
  readonly options?: readonly (string | number)[];
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
  /** Текущее значение из `componentProps`; `undefined` — свойство не задано. */
  readonly value: unknown;
}

/** Секция инспектора — группа каталога вместе со своими полями. */
export interface InspectorSection {
  readonly group: PropGroup;
  readonly fields: readonly InspectorField[];
}

/**
 * Текстовое содержимое узла — то, что лежит среди детей строкой.
 *
 * Отдельно от секций свойств, и это не оформление: текст живёт в `children`, а не
 * в `componentProps`, и правится своей операцией. Показать его полем каталога значило бы
 * записать в файл проп, которого у компонента нет.
 */
export interface InspectorText {
  /** Текущее содержимое; пустая строка — текстовой части нет вовсе. */
  readonly value: string;
  /**
   * Правится ли здесь.
   *
   * `false` при НЕСКОЛЬКИХ текстовых частях: домен правит ровно одну, и какая из трёх имелась
   * в виду, инспектор не знает. Тогда содержимое показывается, а правится в JSON — то же
   * различие, что у `readonly`-полей.
   */
  readonly editable: boolean;
}

/** Всё, что инспектор знает о выделенном узле. */
export interface InspectorModel {
  readonly nodeId: NodeId;
  readonly title: string;
  readonly kind: NodeKind;
  /** Каталожное имя узла или `null`, если компонента у узла нет. */
  readonly component: string | null;
  /**
   * Нашлась ли запись каталога.
   *
   * `false` означает «компонент не из активного кита» — секций не будет, и это состояние
   * надо показать словами: пустой инспектор у выделенного узла читается как поломка.
   */
  readonly known: boolean;
  /** Привязка к модели формы без обёртки `$model(...)`; `null` — не задана. */
  readonly binding: string | null;
  /** Привязывается ли узел к модели вообще (поле и массив — да, контейнер — нет). */
  readonly bindable: boolean;
  /**
   * Текстовое содержимое; `null` — узел его не принимает.
   *
   * Принимают те же узлы, что принимают вложенные компоненты: текст и узел лежат в `children`
   * на равных, и разводить два ответа на один вопрос «бывают ли здесь дети» незачем.
   */
  readonly text: InspectorText | null;
  readonly sections: readonly InspectorSection[];
}

/** Виджет каталога → элемент управления инспектора. Обоснование грубости — в шапке модуля. */
export function editorFor(widget: InspectorWidget): InspectorEditor {
  switch (widget) {
    case 'boolean':
      return 'checkbox';
    case 'number':
      return 'number';
    case 'enum':
      return 'select';
    case 'text':
    case 'className':
    case 'icon':
      return 'text';
    default:
      // `readonly` и `dataSource`: значение показывается, правится в JSON.
      return 'readonly';
  }
}

/**
 * Модель инспектора для выделения.
 *
 * `null` — выделения нет или оно ведёт в несуществующий узел. Множественное выделение
 * инспектор не показывает: правка «всем сразу» — отдельная работа со своими правилами
 * (что делать с разными значениями одного ключа), и притворяться, что он правит первый
 * узел, значило бы менять не то, на что смотрят.
 */
export function inspectorModelFor(
  schema: JsonFormSchema,
  catalog: readonly CatalogEntry[],
  selection: readonly NodeId[]
): InspectorModel | null {
  if (selection.length !== 1) return null;
  const entry = indexNodes(schema).find(selection[0]);
  if (!entry) return null;
  return inspectorModelOf(entry.node, entry.id, catalog);
}

/** Та же модель для уже найденного узла — отдельно, чтобы тест не собирал схему ради узла. */
export function inspectorModelOf(
  node: JsonNode,
  nodeId: NodeId,
  catalog: readonly CatalogEntry[]
): InspectorModel {
  const component = componentOf(node) ?? null;
  const record = component === null ? undefined : catalog.find((e) => e.name === component);
  const props = (node as { componentProps?: Record<string, unknown> }).componentProps ?? {};
  const kind = kindOf(node);

  const sections = record
    ? inspectorGroups(record.propsSchema)
        .map((group) => ({
          group: group.group,
          fields: group.props.map((prop) => toField(prop, props)),
        }))
        .filter((section) => section.fields.length > 0)
    : [];

  return {
    nodeId,
    title: nodeTitle(node),
    kind,
    component,
    known: record !== undefined,
    binding: modelOf(node) ?? null,
    bindable: kind !== 'container',
    text: textOf(node),
    sections,
  };
}

/**
 * Текстовое содержимое узла для инспектора.
 *
 * `null` у того, кто детей не принимает: у поля ввода текстовой части не бывает, и пустое
 * поле рядом с его пропсами читалось бы как «сюда можно», хотя нельзя.
 */
function textOf(node: JsonNode): InspectorText | null {
  if (!canAcceptChildren(node)) return null;
  const at = textChildIndex(node);
  if (at === null) return { value: joinTextParts(node), editable: false };
  const kids = (node as { children?: readonly unknown[] }).children;
  return { value: at < 0 ? '' : String(kids?.[at] ?? ''), editable: true };
}

/** Все текстовые части подряд — только чтобы показать, что именно правится в JSON. */
function joinTextParts(node: JsonNode): string {
  const kids = (node as { children?: readonly unknown[] }).children;
  if (!Array.isArray(kids)) return '';
  return kids.filter((kid) => typeof kid === 'string' || typeof kid === 'number').join('');
}

function toField(prop: InspectorProp, props: Record<string, unknown>): InspectorField {
  return {
    key: prop.key,
    label: prop.label,
    editor: editorFor(prop.widget),
    group: prop.group,
    description: prop.description,
    fallback: prop.default,
    options: prop.options,
    min: prop.min,
    max: prop.max,
    step: prop.step,
    value: props[prop.key],
  };
}
