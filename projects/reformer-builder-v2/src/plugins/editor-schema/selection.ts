/**
 * Выделение на канвасе: множественное и часть модели правки, а не состояния вида.
 *
 * Разница не терминологическая. Состояние вида (`viewState` редактора) — прокрутка и свёрнутые
 * ветки: его теряют без последствий. Выделение участвует в операциях (после вставки оно
 * переезжает на `focus`), входит в снимок отмены и читается командами. Положи его в `viewState` —
 * и появится вторая его копия, расходящаяся с первой на первой же отмене.
 *
 * Отсюда весь модуль: чистые функции над списком адресов, без React, без стора и без DOM.
 * Держит их {@link './session'.SchemaSession} вместе с моделью — одним снимком на двоих.
 *
 * ## Почему список, а не множество
 *
 * Порядок значим дважды: последний выбранный служит якорем для расширения диапазона
 * (Shift), а первый — целью операций, которым нужен один узел. `Set` пришлось бы
 * сопровождать отдельным якорем, то есть тем же порядком, только сбоку.
 *
 * @module plugins/editor-schema/selection
 */

import type { NodeId } from './host';

/** Как щелчок меняет выделение. */
export type SelectMode =
  /** Обычный щелчок: выделен только этот узел. */
  | 'replace'
  /** Ctrl/Cmd: добавить или убрать один узел, остальные не трогать. */
  | 'toggle'
  /** Shift: от якоря до узла включительно, в порядке обхода канваса. */
  | 'range';

/** Пустое выделение — одна замороженная ссылка вместо нового массива на каждый ответ. */
export const EMPTY_SELECTION: readonly NodeId[] = Object.freeze([]);

/** Выделен ли узел. */
export function isSelected(selection: readonly NodeId[], id: NodeId): boolean {
  return selection.includes(id);
}

/**
 * Якорь расширения — последний добавленный узел.
 *
 * `undefined` при пустом выделении: расширять не от чего, и Shift-щелчок в этом случае
 * ведёт себя как обычный.
 */
export function anchorOf(selection: readonly NodeId[]): NodeId | undefined {
  return selection.length === 0 ? undefined : selection[selection.length - 1];
}

/**
 * Новое выделение после щелчка.
 *
 * `order` — адреса в порядке обхода канваса (сверху вниз, как их видит человек). Он нужен
 * только режиму `range` и намеренно приходит параметром: порядок принадлежит виду дерева,
 * а не выделению, и вычислять его здесь значило бы завести вторую развёртку модели.
 */
/**
 * Модификаторы щелчка в объёме, который решает режим выделения.
 *
 * Структурная форма, а не тип события: щелчок приходит и React-обработчиком (дерево, схема),
 * и нативным слушателем в фазе перехвата (живая форма, где событие обязано быть погашено
 * до того, как дойдёт до самой формы). Оба вида события совпадают по этим трём полям.
 */
export interface SelectModifiers {
  readonly shiftKey: boolean;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
}

/**
 * Модификаторы щелчка → режим выделения.
 *
 * Shift сильнее Ctrl: диапазон важнее добавления. Правило одно на все три вида конструктора —
 * разойдись копии, один и тот же щелчок выделял бы по-разному в дереве и в форме.
 */
export function selectModeOf(event: SelectModifiers): SelectMode {
  if (event.shiftKey) return 'range';
  return event.ctrlKey || event.metaKey ? 'toggle' : 'replace';
}

export function selectNode(
  selection: readonly NodeId[],
  id: NodeId,
  mode: SelectMode,
  order: readonly NodeId[] = EMPTY_SELECTION
): readonly NodeId[] {
  if (mode === 'toggle') {
    return isSelected(selection, id)
      ? selection.filter((existing) => existing !== id)
      : [...selection, id];
  }

  if (mode === 'range') {
    const anchor = anchorOf(selection);
    const from = anchor === undefined ? -1 : order.indexOf(anchor);
    const to = order.indexOf(id);
    // Якоря или цели нет в развёртке (ветку свернули, узел исчез) — расширять не от чего.
    if (from < 0 || to < 0) return [id];
    const [lo, hi] = from <= to ? [from, to] : [to, from];
    return order.slice(lo, hi + 1);
  }

  return [id];
}

/**
 * Выделение после операции правки.
 *
 * `focus` знает только сама операция: узел мог сместиться, родиться или исчезнуть вместе
 * с родителем. Переезд СБРАСЫВАЕТ множественное выделение до одного узла — и это верно
 * по смыслу: после вставки человек смотрит на вставленное, а не на то, что было выбрано
 * до неё.
 *
 * Без `focus` (операция не назвала цели) выделение сохраняется, но чистится от адресов,
 * которых в модели больше нет.
 */
export function selectionAfterApply(
  selection: readonly NodeId[],
  focus: NodeId | undefined,
  alive: (id: NodeId) => boolean
): readonly NodeId[] {
  if (focus !== undefined) return [focus];
  return pruneSelection(selection, alive);
}

/**
 * Убирает из выделения адреса, которых в модели нет.
 *
 * Возвращает ТУ ЖЕ ссылку, если убирать нечего: снимок состояния сравнивается по ссылке,
 * и новый массив с тем же содержимым означал бы лишнюю перерисовку канваса на каждую правку.
 */
export function pruneSelection(
  selection: readonly NodeId[],
  alive: (id: NodeId) => boolean
): readonly NodeId[] {
  const kept = selection.filter(alive);
  return kept.length === selection.length ? selection : kept;
}

/** Одинаковы ли два выделения (по содержимому и порядку). */
export function selectionEquals(a: readonly NodeId[], b: readonly NodeId[]): boolean {
  return a === b || (a.length === b.length && a.every((id, i) => id === b[i]));
}
