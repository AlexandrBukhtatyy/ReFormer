/**
 * Кодек «узел ⇄ CSS-класс» для выбора узла кликом.
 *
 * Механизм из контракта Э8: в ЭФЕМЕРНУЮ копию схемы дописываются классы-токены, по которым
 * элемент DOM отображается обратно в узел. Отдельной карты «элемент → узел» не нужно —
 * токен доезжает до DOM сам, потому что рендерер отдаёт `className` корню компонента, блоку
 * поля и html-тегу.
 *
 * ## Отличие от v1: токеном служит `$nodeId`, а не путь
 *
 * В v1 кодировался путь узла (`['root','children',0]` → `rbnode-root__children__0`), и это тянуло
 * за собой экранирование сегментов, разбор индексов и правило «строка из одних цифр — не индекс».
 * Всё это существовало ровно потому, что у узла не было адреса. В v2 адрес есть: `$nodeId` —
 * восемь символов `[0-9a-z]`, то есть УЖЕ валидный хвост CSS-идентификатора. Кодек схлопывается
 * до приписывания префикса, а вместе со сложностью исчезает целый класс ошибок: путь после
 * вставки соседа смещался, идентификатор — нет.
 *
 * Цена названа честно: узел БЕЗ `$nodeId` токена не получает и кликом не выбирается. Появиться
 * такой узел может только у схемы, собранной мимо разбора (провайдер модели проставляет
 * идентификаторы всем). Ошибочно выбранный сосед был бы хуже невыбираемого узла.
 *
 * @module plugins/preview/node-token
 */

import { NODE_ID_PATTERN, type NodeId } from '@/lib/form-model/node-id';

/** Префикс класса-маркера, он же селектор хит-теста: `[class*="rbnode-"]`. */
export const NODE_CLASS_PREFIX = 'rbnode-';

/**
 * Класс контейнера без детей.
 *
 * Пустой контейнер схлопывается в ноль пикселей и становится недостижим курсором, поэтому
 * ему нужна минимальная высота. Класс намеренно ВНЕ префикса маркера, чтобы не попадать
 * в хит-тест: он про отрисовку, а не про адрес.
 */
export const EMPTY_CLASS = 'rb-empty';

/** Токен в строке классов; границы — пробел, начало или конец строки. */
const TOKEN_RE = new RegExp(`(?:^|\\s)(${NODE_CLASS_PREFIX}[0-9a-z]{8})(?:\\s|$)`);

/** Идентификатор узла → класс-токен. */
export function encodeNodeToken(id: NodeId): string {
  return `${NODE_CLASS_PREFIX}${id}`;
}

/**
 * Класс-токен → идентификатор узла; `null`, если строка токеном не является.
 *
 * Форма проверяется тем же выражением, что и сам идентификатор (`NODE_ID_PATTERN`): второе
 * представление о том, как выглядит адрес узла, разошлось бы с первым.
 */
export function decodeNodeToken(token: string): NodeId | null {
  if (!token.startsWith(NODE_CLASS_PREFIX)) return null;
  const id = token.slice(NODE_CLASS_PREFIX.length);
  return NODE_ID_PATTERN.test(id) ? id : null;
}

/** Первый токен-маркер в строке классов элемента либо `null`. */
export function tokenFromClassName(className: string): string | null {
  return TOKEN_RE.exec(className)?.[1] ?? null;
}

/**
 * Узел, которому принадлежит элемент DOM, — поиск вверх по предкам.
 *
 * Вверх, потому что клик приходит в самый глубокий элемент, а токен стоит на корне компонента:
 * между ними лежит вся внутренняя разметка контрола, у которой своего адреса нет.
 * Останов на `root` включительно — иначе поиск ушёл бы в оболочку и нашёл бы чужой токен.
 */
export function nodeAt(target: Element | null, root: Element): NodeId | null {
  for (let node: Element | null = target; node !== null; node = node.parentElement) {
    const className = typeof node.className === 'string' ? node.className : '';
    const token = tokenFromClassName(className);
    if (token !== null) {
      const id = decodeNodeToken(token);
      if (id !== null) return id;
    }
    if (node === root) break;
  }
  return null;
}
