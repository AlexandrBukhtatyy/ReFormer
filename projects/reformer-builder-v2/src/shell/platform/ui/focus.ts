/**
 * Классификация фокуса — единственный источник поля `focus` в {@link WhenContext}.
 *
 * Зачем это отдельным модулем. Правило «сочетание пропускается, если фокус в поле ввода» —
 * то самое, из-за которого обработчик клавиш v1 не разбирается на части: там оно записано
 * десятком проверок `target instanceof HTMLInputElement` в разных местах, и каждая знает
 * свой набор исключений. Здесь ответ на вопрос «куда направлен фокус» даётся один раз
 * и целиком, а команды и панели читают уже результат.
 *
 * ## Разделение на пробу и разбор
 *
 * {@link classifyFocus} принимает не DOM-элемент, а {@link FocusProbe} — снятые с него
 * поля. Это не церемония: правило классификации проверяется в `node`, где DOM нет вовсе,
 * а всё, что осталось бы внутри функции с `instanceof HTMLElement`, проверить было бы нечем.
 * Обращение к DOM живёт в {@link probeFromElement} и сводится к четырём чтениям.
 *
 * ## Зона объявляется разметкой
 *
 * Оболочка не в состоянии отличить дерево ресурсов от канваса по тегам: и то и другое —
 * `div` с обработчиками. Поэтому область объявляет себя сама атрибутом
 * {@link FOCUS_ZONE_ATTRIBUTE}, а классификатор ищет ближайшего предка с ним. Плагину это
 * ничего не стоит и не требует от Host знания о том, что за поверхность он нарисовал.
 *
 * @module host/ui/focus
 */

import type { FocusTarget } from '../primitives/when-context';

/**
 * Атрибут, которым область объявляет свой вид фокуса: `data-focus-zone="canvas"`.
 *
 * Значения — те же, что у {@link FocusTarget}, кроме `editable`: текстовый ввод определяется
 * по самому элементу и объявления не требует. Незнакомое значение считается `panel` —
 * область интерфейса оболочки; это безопасная сторона, потому что на `panel` не висит
 * ни одного пропуска сочетаний.
 */
export const FOCUS_ZONE_ATTRIBUTE = 'data-focus-zone';

/**
 * Снятые с элемента поля, по которым определяется вид фокуса.
 *
 * Форма выбрана так, чтобы её мог собрать и тест: `tagName` в верхнем регистре, как в DOM,
 * `zone` — значение {@link FOCUS_ZONE_ATTRIBUTE} ближайшего предка, включая сам элемент.
 */
export interface FocusProbe {
  /** Имя тега в верхнем регистре: `INPUT`, `TEXTAREA`, `DIV`. */
  readonly tagName: string;
  /** Значение `type` для `INPUT`; для остальных — `null`. */
  readonly type: string | null;
  /** `contenteditable`, разрешённый браузером (в DOM — `HTMLElement.isContentEditable`). */
  readonly contentEditable: boolean;
  /** Значение {@link FOCUS_ZONE_ATTRIBUTE} ближайшего предка или `null`. */
  readonly zone: string | null;
}

/**
 * Типы `<input>`, которые полем ввода не являются.
 *
 * Список — перечисление исключений, а не наоборот: типов ввода много и они прибавляются
 * (`date`, `search`, `email`), и «всё, что не в списке, — ввод» ошибается в безопасную
 * сторону. Ошибиться наоборот значит пропустить сочетание в поле, где человек печатает.
 */
const NON_TEXT_INPUT_TYPES: ReadonlySet<string> = new Set([
  'button',
  'checkbox',
  'color',
  'file',
  'image',
  'radio',
  'range',
  'reset',
  'submit',
]);

const ZONE_TARGETS: ReadonlySet<string> = new Set(['canvas', 'tree', 'panel', 'editable']);

/**
 * Элементы, которые сами обрабатывают пробел и Enter.
 *
 * Разведены с `panel` не для красоты: охранное условие «не на кнопке» иначе невыразимо,
 * и в v1 именно оно держало обработчик клавиш нераздельным. Пробел на кнопке обязан
 * нажимать кнопку, а не уходить в команду холста.
 */
const CONTROL_TAGS: ReadonlySet<string> = new Set(['BUTTON', 'SELECT', 'OPTION', 'SUMMARY']);

/**
 * Куда направлен фокус.
 *
 * Порядок проверок несущий: элемент ввода побеждает зону. Поле поиска внутри канваса — это
 * `editable`, а не `canvas`, иначе стрелки, двигающие узел, начали бы двигать его во время
 * набора имени.
 *
 * `null` — фокуса нет ни на чём (например, на `body`) — даёт `none`.
 */
export function classifyFocus(probe: FocusProbe | null): FocusTarget {
  if (probe === null) return 'none';
  if (probe.contentEditable) return 'editable';

  const tag = probe.tagName.toUpperCase();
  if (tag === 'TEXTAREA') return 'editable';
  if (CONTROL_TAGS.has(tag)) return 'control';
  if (tag === 'INPUT') {
    const type = (probe.type ?? 'text').toLowerCase();
    return NON_TEXT_INPUT_TYPES.has(type) ? 'control' : 'editable';
  }

  if (probe.zone !== null) {
    return ZONE_TARGETS.has(probe.zone) ? (probe.zone as FocusTarget) : 'panel';
  }
  return 'none';
}

/**
 * Снимает пробу с элемента DOM. Единственное место модуля, которому нужен браузер.
 *
 * `closest` вместо ручного подъёма по `parentElement`: зона объявляется на контейнере
 * области, а фокус попадает на элемент внутри неё, иногда через несколько уровней.
 */
export function probeFromElement(element: Element | null): FocusProbe | null {
  if (element === null) return null;
  if (element.ownerDocument.body === element) return null;

  const zoneHost = element.closest(`[${FOCUS_ZONE_ATTRIBUTE}]`);
  return {
    tagName: element.tagName,
    type: element.getAttribute('type'),
    // `isContentEditable` есть только у HTMLElement; SVG и прочее сюда попадает как `false`.
    contentEditable: (element as Partial<HTMLElement>).isContentEditable === true,
    zone: zoneHost?.getAttribute(FOCUS_ZONE_ATTRIBUTE) ?? null,
  };
}
