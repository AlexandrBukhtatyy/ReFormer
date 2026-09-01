/**
 * Подсветка живой формы — правилами CSS, а не правкой DOM.
 *
 * Класс-токен узла уже стоит на элементе, поэтому подсветка выражается одним селектором
 * на адрес. Обходить чужой DOM и вешать классы руками нельзя вдвойне: поверхность пересоздаёт
 * элементы на каждое изменение значения (навешанное исчезло бы), и это чужое поддерево — его
 * рисует другой React-корень.
 *
 * Приём тот же, что у подсветки в панели превью, и контур тоже `outline`, а не рамка
 * псевдоэлементом. В первой версии билдера рамку рисовали через `::after` именно потому,
 * что `outline` уезжал под соседа у позиционированных обёрток кита, — но в панели превью v2
 * `outline` работает на этом же ките, то есть довод перестал подтверждаться. Если на плотных
 * раскладках контур всё-таки поедет, запасной путь известен: `::after` плюс `position: relative`
 * на узле, ценой того, что узел становится containing block.
 *
 * ## Область обязательна
 *
 * Правила пишутся под `[data-rb-live="<scope>"]`, потому что подсветок на экране может быть две:
 * живой вид в теле редактора и панель превью того же документа. Без области они подсвечивали бы
 * друг друга — и выделение, снятое в одном месте, оставалось бы гореть в другом.
 *
 * @module plugins/editor-schema/live/live-style
 */

import { encodeNodeToken, EMPTY_CLASS } from '@/lib/form-model/node-token';
import { NODE_ID_PATTERN } from '@/lib/form-model/node-id';
import type { NodeId } from '@/sdk';

export interface LiveStyleInput {
  /** Значение `data-rb-live` корня живого вида. Санируется вызывающим. */
  readonly scope: string;
  readonly selection: readonly NodeId[];
  /** Узел под курсором; `null` — курсор вне формы или модификатор не зажат. */
  readonly hover: NodeId | null;
  /** Идёт перетаскивание: пустые контейнеры показываются заметнее. */
  readonly dragging: boolean;
}

/** Активный узел: тот, к которому относятся клавиши и инспектор. */
const ACTIVE = 'outline: 2px solid var(--color-ring, #6366f1); outline-offset: 2px;';
/** Прочие выделенные: видно, что они в наборе, но глаз ведёт активный. */
const SELECTED = 'outline: 1px solid var(--color-ring, #6366f1); outline-offset: 2px;';
/** Наведение: пунктир — обещание, а не состояние. */
const HOVER = 'outline: 1px dashed var(--color-ring, #6366f1); outline-offset: 1px;';

/**
 * Габарит пустого контейнера.
 *
 * Контейнер без детей схлопывается в ноль пикселей: его не видно и в него нельзя ни попасть
 * курсором, ни бросить. Класс ставит аннотация схемы — правило под него до сих пор не было
 * написано ни разу, то есть механизм существовал, а эффекта не давал.
 */
const EMPTY = 'min-height: 1.5rem; min-width: 4rem;';
const EMPTY_IDLE = 'outline: 1px dashed var(--color-border, #d4d4d8); outline-offset: -1px;';
const EMPTY_DRAGGING = 'outline: 1px dashed var(--color-ring, #6366f1); outline-offset: -1px;';

/** Селектор узла внутри области. `null` — адрес не той формы, и в таблицу стилей он не поедет. */
function ruleFor(scope: string, id: NodeId, body: string): string | null {
  // Форма адреса проверяется ПЕРЕД склейкой: `NodeId` — обычная строка, а она уходит в CSS.
  if (!NODE_ID_PATTERN.test(id)) return null;
  return `[data-rb-live="${scope}"] .${encodeNodeToken(id)} { ${body} }`;
}

/**
 * Все правила живого вида, кроме наведения.
 *
 * Наведение вынесено отдельно ({@link hoverCss}) не для красоты: курсор двигается десятки раз
 * в секунду, и пересобирать из-за него правила выделения значило бы перезаписывать таблицу
 * стилей на каждое движение мыши.
 */
export function liveCss(input: LiveStyleInput): string {
  const { scope, selection, dragging } = input;
  const rules: string[] = [
    `[data-rb-live="${scope}"] .${EMPTY_CLASS} { ${EMPTY} ${dragging ? EMPTY_DRAGGING : EMPTY_IDLE} }`,
  ];

  // Активен последний выбранный: им же командует клавиатура, и подсветка обязана совпадать
  // с тем, что показывает инспектор.
  const active = selection.at(-1) ?? null;
  for (const id of selection) {
    if (id === active) continue;
    const rule = ruleFor(scope, id, SELECTED);
    if (rule !== null) rules.push(rule);
  }
  if (active !== null) {
    const rule = ruleFor(scope, active, ACTIVE);
    if (rule !== null) rules.push(rule);
  }

  return rules.join('\n');
}

/** Правило наведения; пустая строка — наводить не на что. */
export function hoverCss(scope: string, id: NodeId | null): string {
  if (id === null) return '';
  return ruleFor(scope, id, HOVER) ?? '';
}
