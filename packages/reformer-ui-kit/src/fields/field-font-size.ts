/**
 * Размер шрифта поля — его выпадающему списку.
 *
 * Список поля рисуется в портале: в документе он лежит в `body`, а не под полем, и размер
 * шрифта поля не наследует. Пока каждый пункт сам задавал свои 14px, поле, сжатое классом
 * на триггере (`text-[12px]` в панели свойств), раскрывало список крупнее самого себя.
 *
 * Поэтому список сам находит своё поле и берёт у него вычисленный размер. Поле находится
 * по `aria-controls`: Radix и `useAutocomplete` уже связывают им поле с тем, что оно
 * раскрывает, — второй связи для этого заводить незачем. Пункты, поле поиска и служебные
 * строки размер не задают и наследуют его от списка; высота строки идёт следом сама,
 * потому что у `text-sm` она задана отношением, а не длиной.
 *
 * У самого списка при этом стоит `text-sm` — размер на случай, когда поле не нашлось:
 * портал унёс список в другой документ или за границу теневого дерева.
 */

/** Поле, раскрывающее этот список: то, чей `aria-controls` называет его `id`. */
function controllingField(list: HTMLElement): Element | null {
  if (list.id === '') return null;
  const root = list.getRootNode() as ParentNode;
  // Значение в кавычках: в адресах React есть двоеточия, а экранировать остаётся только
  // кавычку и обратную черту.
  const id = list.id.replace(/["\\]/g, '\\$&');
  return root.querySelector(`[aria-controls~="${id}"]`);
}

/**
 * Ref-колбэк выпадающего списка: при появлении список берёт размер шрифта своего поля.
 *
 * Ссылка стабильна, поэтому React зовёт её один раз на появление, а закрытый список Radix
 * размонтирует — каждое открытие меряет поле заново. Размер, заданный списку явно через
 * `style`, не трогается.
 */
export function followFieldFontSize(list: HTMLElement | null): void {
  if (list === null || list.style.fontSize !== '') return;
  const field = controllingField(list);
  if (field === null) return;
  const fontSize = field.ownerDocument.defaultView?.getComputedStyle(field).fontSize;
  if (fontSize !== undefined && fontSize !== '') list.style.fontSize = fontSize;
}
