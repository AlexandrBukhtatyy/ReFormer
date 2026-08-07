/**
 * PostCSS-плагин: ограничить ГЛОБАЛЬНЫЕ селекторы таблицы стилей кита поддеревом превью.
 *
 * Зачем. Кит со `styles.mode: 'standalone'` (CSS-in-JS дизайн-система со своим ресетом — например
 * Kaspersky HexaUI) приносит правила на `html`, `body`, `*`. Они применяются ко ВСЕМУ документу и
 * перекрашивают оболочку билдера: палитра, меню и инспектор начинают выглядеть иначе. Замер на
 * HexaUI: из 5465 правил глобальных всего 9, и решающее — одно, `* { font-family: … }`.
 *
 * Почему скоупим ТОЛЬКО глобальные, а не всё подряд. Компоненты antd/Radix рендерят выпадающие
 * списки и оверлеи ПОРТАЛОМ в `document.body`, то есть вне контейнера превью. Если завернуть в
 * скоуп все селекторы (`.ant-select-dropdown` и прочие), содержимое портала останется без стилей.
 * Классовые селекторы кита и так никуда не текут: в оболочке билдера нет ни `.ant-*`, ни `.kl6-*`,
 * ни хешей styled-components.
 *
 * Что делаем с каждым видом селектора:
 * - `html` / `body` / `:root` → сам контейнер: их НАСЛЕДУЕМЫЕ свойства (шрифт, цвет, размер) должны
 *   достаться поддереву превью, иначе кит потеряет свою типографику;
 * - `*` → потомки контейнера;
 * - голый тип (`button`, `input`) → потомки контейнера: это правила ресета, чужим кнопкам они не нужны;
 * - всё, где есть класс/id/атрибут → НЕ ТРОГАЕМ (см. про порталы выше).
 *
 * @module reformer-builder/vite-plugins/scope-kit-css
 */

import type { Plugin } from 'postcss';

/** Селектор целиком — корень документа. */
const ROOT_ONLY = /^(html|body|:root)$/;

/** Селектор начинается с корня документа, дальше комбинатор или уточнение. */
const ROOT_HEAD = /^(html|body|:root)(?=[\s>+~:.[])/;

/** Леворасположенный компонент — голый тип без класса/id/атрибута (`button`, `input[type=x]` — нет). */
const BARE_TYPE_HEAD = /^[a-zA-Z][a-zA-Z0-9-]*(?=$|[\s>+~,:])/;

/** Переписать один селектор под контейнер `scope`. */
export function scopeSelector(selector: string, scope: string): string {
  const s = selector.trim();
  if (!s) return selector;

  // `html`, `body`, `:root` — заменяем на контейнер, чтобы наследование сохранилось.
  if (ROOT_ONLY.test(s)) return scope;
  const head = ROOT_HEAD.exec(s);
  if (head) return scope + s.slice(head[1].length);

  // `*`, `*::before` — ограничиваем поддеревом.
  if (s === '*' || s.startsWith('*:') || s.startsWith('* ')) return `${scope} ${s}`;

  // Голый тип (`button`, `svg`) — правило ресета, ограничиваем поддеревом.
  if (BARE_TYPE_HEAD.test(s)) return `${scope} ${s}`;

  // Классы, id, атрибуты — оставляем глобальными: их содержимое живёт и в порталах.
  return s;
}

/**
 * @param scope CSS-селектор контейнера превью (напр. `.rb-kit-scope`)
 * @param match какие файлы обрабатывать (путь исходной CSS)
 */
export function scopeKitCss({ scope, match }: { scope: string; match: RegExp }): Plugin {
  return {
    postcssPlugin: 'reformer-scope-kit-css',
    Once(root, { result }) {
      const from = result.opts.from ?? '';
      if (!match.test(from.replace(/\\/g, '/'))) return;

      root.walkRules((rule) => {
        // Внутри `@keyframes` «селекторы» — это проценты и `from`/`to`; их трогать нельзя.
        const parent = rule.parent;
        if (parent && parent.type === 'atrule' && /keyframes$/.test(parent.name)) return;
        rule.selectors = rule.selectors.map((sel) => scopeSelector(sel, scope));
      });
    },
  };
}

export default scopeKitCss;
