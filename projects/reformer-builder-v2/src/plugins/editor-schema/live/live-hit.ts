/**
 * От элемента DOM живой формы — к узлу схемы и обратно.
 *
 * ## Чем отличается от `nodeAt` превью
 *
 * Та функция отвечает на вопрос «какой узел», и этого хватает для выбора кликом. Живому виду
 * нужен ещё и ЭЛЕМЕНТ: по нему считается прямоугольник цели, а по прямоугольнику — зона броска
 * и место ручки перетаскивания. Общее у них — правило «как выглядит токен», и оно живёт
 * в домене (`@/lib/form-model/node-token`), а не копируется.
 *
 * ## Экземпляр под курсором, а не первый в документе
 *
 * Узел шаблона элемента массива нарисован столько раз, сколько в массиве элементов, и адрес
 * у всех один. Поэтому цель ищется ПОДЪЁМОМ от того элемента, куда пришло событие: он и есть
 * тот экземпляр, на который смотрит человек. {@link elementOf} ищет первое совпадение и годится
 * только там, где экземпляр не важен, — прокрутка к узлу и ответ «показан ли он сейчас».
 *
 * @module plugins/editor-schema/live/live-hit
 */

import { decodeNodeToken, encodeNodeToken, tokenFromClassName } from '@/lib/form-model/node-token';
import { NODE_ID_PATTERN } from '@/lib/form-model/node-id';
import type { NodeId } from '@/sdk';

/** Узел и тот его экземпляр, по которому попали. */
export interface LiveHit {
  readonly id: NodeId;
  readonly element: HTMLElement;
}

/** Класс элемента строкой: у SVG `className` — объект, а не строка. */
function classNameOf(element: Element): string {
  return typeof element.className === 'string' ? element.className : '';
}

/**
 * Ближайший помеченный предок цели — вместе с его элементом.
 *
 * Останов на `root` включительно: выше лежит оболочка билдера, и её токены (если бы такие
 * появились) относились бы к другому документу.
 */
export function hitAt(target: Element | null, root: Element): LiveHit | null {
  for (let node: Element | null = target; node !== null; node = node.parentElement) {
    const token = tokenFromClassName(classNameOf(node));
    const id = token === null ? null : decodeNodeToken(token);
    if (id !== null && node instanceof HTMLElement) return { id, element: node };
    if (node === root) break;
  }
  return null;
}

/**
 * Первый элемент узла в поддереве; `null` — узел сейчас не нарисован.
 *
 * `null` — законный и осмысленный ответ, а не сбой: узел может лежать на неактивном шаге
 * визарда или в свёрнутой части формы. Живой вид на этом ответе показывает объяснение.
 */
export function elementOf(root: ParentNode, id: NodeId): HTMLElement | null {
  // Адрес проверяется ПЕРЕД склейкой селектора: `NodeId` — это просто строка, а она уходит
  // в `querySelector`.
  if (!NODE_ID_PATTERN.test(id)) return null;
  const found = root.querySelector(`.${encodeNodeToken(id)}`);
  return found instanceof HTMLElement ? found : null;
}
