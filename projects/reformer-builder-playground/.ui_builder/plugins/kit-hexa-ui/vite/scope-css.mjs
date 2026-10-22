// @ts-check
/**
 * Граница стилей HexaUI в приложении: глобальные правила дизайн-системы — только внутри
 * провайдера кита.
 *
 * ## Что глобального приносит HexaUI
 *
 * `styles.css` HexaUI — скомпилированный antd 4 с ресетом: правила на `html`, `body`, `*`,
 * голые теги (`h1`–`h6`, `a`, `p`, `input`, `table`…), `[hidden]`, `::selection`. Стоят они вне
 * каскадных слоёв, поэтому бьют и `@layer base`, и утилиты Tailwind приложения независимо от
 * специфичности: подключённый как есть, CSS перекрашивает всё приложение. Вдобавок шесть
 * CSS-модулей компонентов (Button, Dropdown, Accordion, …) при импорте вставляют через
 * `style-inject` голое `h3 { … }`. Ни то ни другое при уходе со страницы не снимается.
 *
 * ## Правило
 *
 * Под контейнер провайдера (`[data-hexa-root]`, его ставит `KitProvider`) уходят ТОЛЬКО
 * селекторы без классов и идентификаторов:
 * - `html` / `body` / `:root` **заменяются** контейнером — их наследуемые свойства (шрифт, цвет,
 *   размер) обязаны достаться форме, иначе типографика кита теряется;
 * - `*`, голые теги, селекторы только из атрибутов и псевдо (`[hidden]`, `::selection`) —
 *   потомки контейнера.
 *
 * Селекторы с классом или идентификатором остаются глобальными: `.ant-*` и классы HexaUI
 * в приложении не встречаются, а оверлеи antd (`Modal`, `Drawer`, самостоятельный `Tooltip`)
 * рисуются порталом в `document.body` — ограниченные контейнером, они остались бы без стилей.
 * Это правило прежнего сборочного скоупа билдера v1 (`scope-kit-css.ts`, коммит `83e492115`).
 *
 * ## Специфичность не меняется
 *
 * Контейнер — `:where([data-hexa-root])`, у него нулевая специфичность. Префикс атрибутом (+0,1,0)
 * поменял бы исход ничьих: ресет `a { color }` стал бы сильнее `.ant-btn` на `<a class="ant-btn">`,
 * а правила antd — сильнее стилей styled-components HexaUI. Внутри контейнера каскад тот же, что
 * у HexaUI без изоляции.
 *
 * ## Почему не `@scope`, каскадные слои или Shadow DOM
 *
 * `@scope` не совпадает с `html`/`body`/`:root` (ресет теряется), его близость переставляет ничьи
 * antd и styled-components, в Safari 26.0–26.3 он не действует на `<input>`. Слой изолирует
 * приоритет, а не область: ниже `base` Tailwind ломает antd, выше — ресет перекрашивает
 * приложение. В теневой корень не попадает то, что HexaUI пишет в `document.head` из JS.
 *
 * @module reformer/kit-hexa-ui/vite/scope-css
 */

import postcss from 'postcss';

/** Атрибут контейнера: его ставит `KitProvider` (`src/provider.tsx`). */
export const HEXA_SCOPE_ATTRIBUTE = 'data-hexa-root';

/** Селектор контейнера — нулевой специфичности, см. шапку модуля. */
export const HEXA_SCOPE = `:where([${HEXA_SCOPE_ATTRIBUTE}])`;

/** Селектор целиком — корень документа. */
const ROOT_ONLY = /^(?:html\s+body|html|body|:root)$/;

/** Селектор начинается с корня документа, дальше комбинатор или уточнение. */
const ROOT_HEAD = /^(?:html|body|:root)(?=[\s>+~:[])/;

/**
 * Есть ли в селекторе класс или идентификатор — вне аргументов псевдоклассов и атрибутов.
 *
 * `input:not(.ant-input)` класса НЕ несёт: аргумент `:not` сужает, а не привязывает к ките,
 * и такое правило задело бы поля приложения. Строки в атрибутах (`[href$=".pdf"]`) — тоже не класс.
 */
export function hasClassOrId(selector) {
  let depth = 0;
  let quote = '';
  for (let index = 0; index < selector.length; index += 1) {
    const char = selector[index];
    if (quote !== '') {
      if (char === '\\') index += 1;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === '"' || char === "'") quote = char;
    else if (char === '\\') index += 1;
    else if (char === '(' || char === '[') depth += 1;
    else if (char === ')' || char === ']') depth -= 1;
    else if (depth === 0 && (char === '.' || char === '#')) return true;
  }
  return false;
}

/**
 * Переписывает один селектор под контейнер `scope`; селектор с классом или идентификатором
 * возвращается как есть. Уже ограниченный селектор второй раз не переписывается.
 *
 * @param {string} selector
 * @param {string} [scope]
 * @returns {string}
 */
export function scopeSelector(selector, scope = HEXA_SCOPE) {
  const value = selector.trim();
  if (value === '' || value.startsWith(scope) || hasClassOrId(value)) return selector;
  if (ROOT_ONLY.test(value)) return scope;
  const head = ROOT_HEAD.exec(value);
  if (head !== null) return scope + value.slice(head[0].length);
  return `${scope} ${value}`;
}

/** @param {string} scope @returns {import('postcss').Plugin} */
function scopePlugin(scope) {
  return {
    postcssPlugin: 'reformer-hexa-ui-scope',
    Once(root) {
      root.walkRules((rule) => {
        // Внутри `@keyframes` «селекторы» — проценты и `from`/`to`; их трогать нельзя.
        const parent = rule.parent;
        if (
          parent?.type === 'atrule' &&
          /keyframes$/i.test(/** @type {import('postcss').AtRule} */ (parent).name)
        ) {
          return;
        }
        const scoped = rule.selectors.map((part) => scopeSelector(part, scope));
        // Дубли схлопываются: `html, body` после замены дают контейнер дважды.
        rule.selectors = [...new Set(scoped)];
      });
    },
  };
}

/**
 * Таблица стилей HexaUI, ограниченная контейнером провайдера.
 *
 * @param {string} css
 * @param {{ readonly scope?: string; readonly from?: string }} [options]
 * @returns {string}
 */
export function scopeHexaCss(css, options = {}) {
  return postcss([scopePlugin(options.scope ?? HEXA_SCOPE)]).process(css, {
    from: options.from,
  }).css;
}

/**
 * Строка CSS в модуле `style-inject` (`*.module.scss.js` HexaUI): `var css_xxx = "…";`.
 * Литерал — JSON-строка, её пишет сборка HexaUI (`JSON.stringify`).
 */
const INJECTED_CSS = /(\bvar\s+css_\w+\s*=\s*)("(?:[^"\\\n]|\\.)*")/g;

/**
 * Модуль CSS-модуля HexaUI с той же границей стилей — голые `h3` и прочий ресет из `style-inject`.
 * Возвращает `null`, если переписывать нечего: модуль остаётся байт в байт.
 *
 * @param {string} code
 * @param {{ readonly scope?: string }} [options]
 * @returns {string | null}
 */
export function scopeInjectedCss(code, options = {}) {
  let changed = false;
  const next = code.replace(INJECTED_CSS, (whole, head, literal) => {
    /** @type {unknown} */
    let css;
    try {
      css = JSON.parse(literal);
    } catch {
      return whole;
    }
    if (typeof css !== 'string') return whole;
    const scoped = scopeHexaCss(css, options);
    if (scoped === css) return whole;
    changed = true;
    return head + JSON.stringify(scoped);
  });
  return changed ? next : null;
}
