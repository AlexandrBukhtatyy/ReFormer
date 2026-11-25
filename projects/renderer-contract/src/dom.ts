/**
 * Действия пользователя и чтение DOM — одинаково для трёх стеков.
 *
 * @module renderer-contract/dom
 */

/** Элемент по `data-testid`; `null` — такого нет. */
export function byTestId<E extends Element = HTMLElement>(root: ParentNode, id: string): E | null {
  return root.querySelector<E>(`[data-testid="${id}"]`);
}

/** Элемент по `data-testid`; нет такого — ошибка с перечнем тех, что есть. */
export function getByTestId<E extends Element = HTMLElement>(root: ParentNode, id: string): E {
  const found = byTestId<E>(root, id);
  if (found === null) {
    throw new Error(`Нет элемента data-testid="${id}". Есть: ${testIds(root).join(', ') || '—'}`);
  }
  return found;
}

/** Все `data-testid` поддерева в порядке документа. */
export function testIds(root: ParentNode): string[] {
  return Array.from(root.querySelectorAll('[data-testid]')).map(
    (element) => element.getAttribute('data-testid') ?? ''
  );
}

/** Первый элемент по селектору; нет такого — ошибка. */
export function get<E extends Element = HTMLElement>(root: ParentNode, selector: string): E {
  const found = root.querySelector<E>(selector);
  if (found === null) throw new Error(`Нет элемента по селектору ${selector}`);
  return found;
}

/** Все элементы по селектору в порядке документа. */
export function all<E extends Element = HTMLElement>(root: ParentNode, selector: string): E[] {
  return Array.from(root.querySelectorAll<E>(selector));
}

/**
 * Ввести текст в поле. Значение пишется сеттером прототипа, а не свойством элемента: React
 * подменяет свойство `value` на элементе и запись через него за ввод пользователя не считает.
 */
export function typeInto(input: HTMLInputElement, text: string): void {
  const setter = Object.getOwnPropertyDescriptor(
    Object.getPrototypeOf(input) as object,
    'value'
  )?.set;
  if (setter) setter.call(input, text);
  else input.value = text;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

/**
 * Увести фокус с элемента. `blur` не всплывает — его слушают Vue и Angular на самом элементе;
 * React слушает всплывающий `focusout`.
 */
export function blur(element: HTMLElement): void {
  element.dispatchEvent(new FocusEvent('blur'));
  element.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
}

/** Кликнуть по элементу. */
export function click(element: Element): void {
  (element as HTMLElement).click();
}

/**
 * Разметка элемента без служебных узлов-комментариев: ими Vue и Angular отмечают места условных
 * и повторяемых участков, React комментариев не оставляет. Годится для поддерева из HTML-узлов и
 * текста; у компонента кита разметка может включать его собственный хост-элемент.
 */
export function cleanHtml(element: Element): string {
  const copy = element.cloneNode(true) as Element;
  const walker = copy.ownerDocument.createTreeWalker(copy, 128 /* NodeFilter.SHOW_COMMENT */);
  const comments: Node[] = [];
  while (walker.nextNode()) comments.push(walker.currentNode);
  for (const comment of comments) comment.parentNode?.removeChild(comment);
  return copy.outerHTML;
}

/** Текст элемента: соседние текстовые узлы слиты, пробелы по краям сохранены. */
export function textOf(element: Element): string {
  return element.textContent ?? '';
}
