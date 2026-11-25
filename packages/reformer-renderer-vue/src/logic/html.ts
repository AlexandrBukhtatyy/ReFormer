/**
 * HTML-узел схемы (`component: 'div'`): пропсы документа формы написаны в диалекте React, а Vue
 * ждёт имена атрибутов DOM.
 *
 * Остальная логика узла — порядок слияния пропсов, ключи строк, склейка текста — общая для
 * рендереров и лежит в `@reformer/core/render`.
 *
 * @module renderer-vue/logic/html
 */

/** Имена пропсов React, у которых в DOM другое имя. */
const DOM_NAMES: Readonly<Record<string, string>> = {
  className: 'class',
  htmlFor: 'for',
};

/**
 * Пропсы HTML-узла под Vue: `className` → `class`, `htmlFor` → `for`. Остальное Vue понимает как
 * есть: `style` объектом, `data-*`, `aria-*`, обработчики `onClick`. Пропсы без таких имён
 * возвращаются той же ссылкой.
 */
export function toDomProps(props: Readonly<Record<string, unknown>>): Record<string, unknown> {
  let out: Record<string, unknown> | undefined;
  for (const from of Object.keys(DOM_NAMES)) {
    if (!(from in props)) continue;
    out ??= { ...props };
    const to = DOM_NAMES[from];
    if (out[to] === undefined) out[to] = out[from];
    delete out[from];
  }
  return out ?? (props as Record<string, unknown>);
}

/**
 * Объявляет ли компонент Vue проп с таким именем. Необъявленный проп Vue отдаёт атрибутом корневому
 * элементу компонента: служебное значение (`selector`) утекло бы в разметку.
 */
export function declaresProp(component: unknown, name: string): boolean {
  if (component == null || (typeof component !== 'function' && typeof component !== 'object')) {
    return false;
  }
  const declared = (component as { props?: unknown }).props;
  if (Array.isArray(declared)) return declared.includes(name);
  return declared != null && typeof declared === 'object' && name in declared;
}
