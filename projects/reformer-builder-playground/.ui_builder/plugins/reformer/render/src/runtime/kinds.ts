/**
 * Виды мест модели по схеме: какое значение держит каждое поле формы.
 *
 * ## Зачем отдельная сводка
 *
 * Перенос введённого в пересобранную форму (`./carry`) решает, годится ли прежнее значение новому
 * месту. Сравнивать для этого пару значений мало: у числа без нижней границы, даты, мультивыбора
 * и загрузки файлов начальное значение — `null`, а у комбобокса его объявляет `null` модуль формы.
 * Пара «`null` и введённое» ничего не говорит о том, одного ли они рода, — и введённое терялось
 * при первой же правке схемы. Вид поля известен схеме: его и спрашиваем.
 *
 * ## Правило вида — доменное
 *
 * «Какое значение у поля с таким контролом» решает синтез мока (`fieldKindOf`): тем же правилом
 * кодоген объявляет лист в `types/<форма>.ts` и печатает начальные значения. Здесь оно только
 * раскладывается по путям модели.
 *
 * ## Обход — как у синтеза начальных значений
 *
 * Пути берутся верхнего уровня: в шаблон строки массива (`item.$template`) обход не спускается —
 * пути там относительны строке, а массив переносится целиком. Первое объявление пути выигрывает:
 * два поля на один путь — одно значение модели (то же правило у `collectFieldDefaults`).
 *
 * ## Группа — то, что группой считает модель ядра
 *
 * Объект, кроме массива, даты и файла ({@link isGroup}). Дата и файл — значения ЛИСТА: модель
 * заводит под них один сигнал, а разбор по ключам положил бы на место даты пустой объект.
 *
 * @module plugins/reformer/render/runtime/kinds
 */

import {
  isArrayNode,
  isContainerNode,
  isFieldNode,
  parseOperator,
  type JsonContainerNode,
  type JsonFormSchema,
  type JsonNode,
} from '@reformer/renderer-json';
import { fieldKindOf, type FieldKind } from '../../../core/form-mock';
import { isNodeLike } from '../../../core/form-model';

/**
 * Группа полей глазами модели ядра: объект, но не массив, не дата и не файл.
 *
 * Правило одно на перенос введённого (`./carry`) и подгонку значений модуля (`./initial`): оба
 * решают, спускаться ли в значение по ключам, и разойтись с моделью не вправе ни один.
 */
export function isGroup(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  if (value instanceof Date) return false;
  // `File` — тоже `Blob`.
  if (typeof Blob !== 'undefined' && value instanceof Blob) return false;
  return true;
}

/** Вид места модели: массив формы (повторяющийся блок) либо лист с видом значения его поля. */
export type SlotKind = FieldKind | 'array';

/** Дот-путь модели → вид места. Пути без поля в схеме в сводку не входят. */
export type FieldKinds = ReadonlyMap<string, SlotKind>;

/** Виды мест модели по схеме формы. */
export function fieldKindsOf(schema: JsonFormSchema): FieldKinds {
  const out = new Map<string, SlotKind>();
  const declare = (model: unknown, kind: SlotKind): void => {
    const parsed = parseOperator(model);
    if (parsed?.op === 'model' && !out.has(parsed.arg)) out.set(parsed.arg, kind);
  };
  const visit = (node: JsonNode): void => {
    if (isArrayNode(node)) {
      declare(node.model, 'array');
      return;
    }
    if (isFieldNode(node)) {
      declare(node.model, fieldKindOf(node));
      return;
    }
    if (isContainerNode(node)) {
      // Шаги визарда — те же `children`.
      (node as JsonContainerNode).children?.forEach((child) => {
        if (isNodeLike(child)) visit(child);
      });
    }
  };
  if (isNodeLike(schema.root)) visit(schema.root);
  return out;
}

/**
 * Годится ли значение полю такого вида — то, что контрол этого вида сам кладёт в модель.
 *
 * Пустое значение (`null`) годится видам, у которых «не выбрано» и есть `null`: числу, дате,
 * списку выбранного, файлам и выбору из списка (комбобокс после очистки отдаёт `null`). Строке и
 * флажку — нет: их пустое значение — `''` и `false`.
 */
export function fitsKind(kind: SlotKind, value: unknown): boolean {
  switch (kind) {
    case 'array':
      return Array.isArray(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'string':
      return typeof value === 'string';
    case 'number':
      return value === null || typeof value === 'number';
    case 'date':
      return value === null || value instanceof Date;
    case 'dates':
      return (
        value === null || (Array.isArray(value) && value.every((item) => item instanceof Date))
      );
    case 'dateRange':
      // Сброшенное поле-кортеж модель хранит как `[]` — это тоже «период не выбран».
      return (
        value === null ||
        (Array.isArray(value) &&
          (value.length === 0 ||
            (value.length === 2 && value.every((item) => item instanceof Date))))
      );
    case 'multi':
    case 'file':
      return value === null || Array.isArray(value);
    case 'select':
      // Значение опции — скаляр: строка у кодогена, но свой источник вправе дать число или флаг.
      return (
        value === null ||
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean'
      );
  }
}
