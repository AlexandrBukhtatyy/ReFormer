/**
 * Мелочи для работы с hast-узлами, которые react-markdown передаёт компонентам пропом `node`.
 * Через них `pre`-компонент достаёт исходный текст блока и его язык, не разбирая React-children.
 *
 * @module reformer-builder/canvas/markdown/hast-text
 */

import type { Element, ElementContent } from 'hast';

/** Весь текст поддерева (вложенные `span`/`text` собираются подряд, как в исходнике). */
export function hastText(node: ElementContent | null | undefined): string {
  if (!node) return '';
  if (node.type === 'text') return node.value;
  if (node.type === 'element') return node.children.map(hastText).join('');
  return '';
}

/** `className` узла одной строкой: в hast это массив, но встречается и строка. */
export function classNameOf(node: Element | null | undefined): string | null {
  const raw = node?.properties?.className;
  if (Array.isArray(raw)) return raw.join(' ');
  return typeof raw === 'string' ? raw : null;
}

/**
 * Копия пропсов без перечисленных полей. Нужна там, где пропсы уходят на DOM-элемент: сам
 * react-markdown подмешивает служебный `node`, а React ругается на неизвестный атрибут.
 */
export function withoutProps<T extends object, K extends keyof T>(
  props: T,
  keys: readonly K[]
): Omit<T, K> {
  const rest = { ...props } as Record<string, unknown>;
  for (const key of keys) delete rest[key as string];
  return rest as Omit<T, K>;
}

/** Первый дочерний элемент с указанным тегом (`pre` → его `code`). */
export function childElement(node: Element | null | undefined, tagName: string): Element | null {
  const found = node?.children.find((c) => c.type === 'element' && c.tagName === tagName);
  return (found as Element | undefined) ?? null;
}
