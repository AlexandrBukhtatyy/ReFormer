/**
 * Свойства без служебных: `react-markdown` передаёт компонентам узел разбора (`node`),
 * а он не является атрибутом DOM — уйдя в разметку, он даёт предупреждение React про
 * неизвестный проп на каждый элемент документа.
 *
 * Отдельной функцией, а не деструктуризацией с отбрасыванием: переменная, объявленная
 * ради того, чтобы её не использовать, — ровно то, что справедливо запрещает линтер.
 *
 * @module plugins/editor-markdown/ui/props
 */

export function withoutProps<T extends object, K extends keyof T>(
  props: T,
  drop: readonly K[]
): Omit<T, K> {
  const rest: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    if ((drop as readonly (string | number | symbol)[]).includes(key)) continue;
    rest[key] = value;
  }
  return rest as Omit<T, K>;
}
