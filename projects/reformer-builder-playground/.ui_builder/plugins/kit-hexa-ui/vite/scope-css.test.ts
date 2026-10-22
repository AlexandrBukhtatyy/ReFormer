/**
 * Граница стилей HexaUI: правило на синтетике и сторож на настоящем CSS дизайн-системы.
 *
 * Сторож нужен потому, что правило держится на форме чужого пакета: HexaUI обновляется часто,
 * и новый голый селектор в `styles.css` или в CSS-модуле компонента (так появились шесть `h3`)
 * без него молча перекрасил бы приложение. Здесь после ограничения в настоящих таблицах не
 * должно остаться ни одного селектора без класса, который действует мимо контейнера.
 *
 * @module reformer/kit-hexa-ui/vite/scope-css.test
 */

import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import postcss from 'postcss';
import { describe, expect, it } from 'vitest';
import {
  HEXA_SCOPE,
  HEXA_SCOPE_ATTRIBUTE,
  hasClassOrId,
  scopeHexaCss,
  scopeInjectedCss,
  scopeSelector,
} from './scope-css.mjs';
import { hexaUiStyles } from './plugin.mjs';

const require = createRequire(import.meta.url);
// `package.json` HexaUI не экспортирует, а подпуть `design-system` — да: корень пакета на уровень выше.
const HEXA_ROOT = path.resolve(
  path.dirname(require.resolve('@kaspersky/hexa-ui/design-system')),
  '..'
);
const STYLES = path.join(HEXA_ROOT, 'design-system/global-style/styles.css');

/** Все CSS-модули HexaUI со `style-inject`. */
function injectedModules(): string[] {
  const found: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules') walk(full);
      } else if (entry.name.endsWith('.module.scss.js')) found.push(full);
    }
  };
  walk(HEXA_ROOT);
  return found;
}

/** Селекторы правил таблицы — кроме кадров `@keyframes`. */
function selectorsOf(css: string): string[] {
  const selectors: string[] = [];
  postcss.parse(css).walkRules((rule) => {
    const parent = rule.parent;
    if (parent?.type === 'atrule' && /keyframes$/i.test((parent as postcss.AtRule).name)) return;
    selectors.push(...rule.selectors);
  });
  return selectors;
}

/** Селектор, действующий мимо контейнера: без класса и без контейнера в начале. */
const leaks = (selectors: readonly string[]): string[] =>
  selectors.filter((selector) => !hasClassOrId(selector) && !selector.startsWith(HEXA_SCOPE));

describe('scopeSelector', () => {
  it.each([
    ['html', HEXA_SCOPE],
    ['body', HEXA_SCOPE],
    [':root', HEXA_SCOPE],
    ['html body', HEXA_SCOPE],
    ['*', `${HEXA_SCOPE} *`],
    ['*::before', `${HEXA_SCOPE} *::before`],
    ['h3', `${HEXA_SCOPE} h3`],
    ['a:hover', `${HEXA_SCOPE} a:hover`],
    ['input[type="number"]', `${HEXA_SCOPE} input[type="number"]`],
    ['[hidden]', `${HEXA_SCOPE} [hidden]`],
    ["[tabindex='-1']:focus", `${HEXA_SCOPE} [tabindex='-1']:focus`],
    ['::selection', `${HEXA_SCOPE} ::selection`],
    // Аргумент `:not` сужает, а не привязывает к киту: правило задело бы поля приложения.
    ['input:not(.ant-input)', `${HEXA_SCOPE} input:not(.ant-input)`],
    // Строка в атрибуте — не класс.
    ['a[href$=".pdf"]', `${HEXA_SCOPE} a[href$=".pdf"]`],
    ['html[dir="rtl"] p', `${HEXA_SCOPE}[dir="rtl"] p`],
  ])('%s → %s', (selector, expected) => {
    expect(scopeSelector(selector)).toBe(expected);
  });

  it.each([
    '.ant-btn',
    'a.ant-btn',
    '.anticon svg',
    '#root',
    ':root .ant-picker-range-wrapper',
    'body .ant-modal',
  ])('с классом или идентификатором — глобален: %s', (selector) => {
    // Классы дизайн-системы приложению не встречаются, а оверлеи antd живут в `document.body`.
    expect(scopeSelector(selector)).toBe(selector);
  });

  it('уже ограниченный селектор второй раз не переписывается', () => {
    const once = scopeSelector('h3');
    expect(scopeSelector(once)).toBe(once);
  });
});

describe('scopeHexaCss', () => {
  it('ограничивает правила и в группах, кадры анимаций не трогает, дубли схлопывает', () => {
    const css = [
      'html, body { width: 100%; }',
      '@media (max-width: 600px) { a { color: red; } .ant-col { flex: 1; } }',
      '@keyframes antFadeIn { from { opacity: 0; } to { opacity: 1; } }',
    ].join('\n');

    const scoped = scopeHexaCss(css);

    expect(scoped).toContain(`${HEXA_SCOPE} { width: 100%; }`);
    expect(scoped).toContain(`${HEXA_SCOPE} a { color: red; }`);
    expect(scoped).toContain('.ant-col { flex: 1; }');
    expect(scoped).toContain('from { opacity: 0; }');
    expect(scoped).toContain('@keyframes antFadeIn');
  });

  it('повторный проход ничего не меняет', () => {
    const once = scopeHexaCss('* { box-sizing: border-box; } h3 { font-size: 2em; }');
    expect(scopeHexaCss(once)).toBe(once);
  });
});

describe('настоящий CSS HexaUI', () => {
  it('styles.css: ни одного селектора мимо контейнера, классы — как были', () => {
    const css = readFileSync(STYLES, 'utf8');
    const before = selectorsOf(css);
    const after = selectorsOf(scopeHexaCss(css, { from: STYLES }));

    // Замер на 6.387: около сотни голых селекторов ресета — без ограничения все они глобальны.
    expect(leaks(before).length).toBeGreaterThan(50);
    expect(leaks(after)).toEqual([]);
    // Классовые правила не тронуты — оверлеи в `document.body` их видят.
    expect(after.filter(hasClassOrId)).toEqual(before.filter(hasClassOrId));
    // Решающее правило ресета — шрифт каждому элементу — живёт только внутри контейнера.
    expect(after).toContain(`${HEXA_SCOPE} *`);
  });

  it('CSS-модули компонентов: голые h3 из style-inject — внутри контейнера', () => {
    const modules = injectedModules();
    expect(modules.length).toBeGreaterThan(0);

    let rewritten = 0;
    for (const file of modules) {
      const code = readFileSync(file, 'utf8');
      // Форма модуля — `var css_xxx = "…"; styleInject(css_xxx)`. Сменись она, правило
      // перестало бы находить таблицу молча — поэтому форма проверяется явно.
      expect(code, file).toMatch(/\bvar\s+css_\w+\s*=\s*"/);
      const scoped = scopeInjectedCss(code) ?? code;
      if (scoped !== code) rewritten += 1;
      const css = JSON.parse(/\bvar\s+css_\w+\s*=\s*("(?:[^"\\\n]|\\.)*")/.exec(scoped)![1]);
      expect(leaks(selectorsOf(css)), file).toEqual([]);
    }
    // Шесть модулей с `h3` в 6.387 (Button, Dropdown, Accordion, HorizontalNav, …).
    expect(rewritten).toBeGreaterThan(0);
  });
});

describe('контейнер провайдера', () => {
  it('KitProvider ставит тот же атрибут, под который плагин ограничивает CSS', () => {
    // Провайдер импортирует HexaUI, а node-прогон его не грузит — сверяется текст модуля.
    const provider = readFileSync(path.join(import.meta.dirname, '../src/provider.tsx'), 'utf8');
    expect(provider).toContain(`export const HEXA_SCOPE_ATTRIBUTE = '${HEXA_SCOPE_ATTRIBUTE}';`);
  });
});

describe('hexaUiStyles', () => {
  type Transform = (code: string, id: string) => { code: string } | null;
  const transform = hexaUiStyles().transform as unknown as Transform;

  it('ограничивает styles.css HexaUI и не трогает чужой CSS', () => {
    const id = `${STYLES.replace(/\\/g, '/')}?direct`;
    expect(transform('h1 { margin: 0; }', id)?.code).toBe(`${HEXA_SCOPE} h1 { margin: 0; }`);
    expect(transform('h1 { margin: 0; }', '/app/src/app.css')).toBeNull();
  });

  it('предсборка dev: esbuild-плагин отдаёт CSS-модуль уже ограниченным', async () => {
    type OnLoad = (args: { path: string }) => Promise<{ contents: string }>;
    interface EsbuildPlugin {
      setup(build: { onLoad(options: unknown, callback: OnLoad): void }): void;
    }
    const config = (
      hexaUiStyles().config as unknown as () => {
        optimizeDeps: { include: string[]; esbuildOptions: { plugins: EsbuildPlugin[] } };
      }
    )();
    const [plugin] = config.optimizeDeps.esbuildOptions.plugins;
    let onLoad: OnLoad | undefined;
    plugin.setup({ onLoad: (_options, callback) => (onLoad = callback) });

    const button = injectedModules().find((file) => /[\\/]Button\.module\.scss\.js$/.test(file))!;
    const { contents } = await onLoad!({ path: button });

    expect(contents).toContain(`${HEXA_SCOPE} h3`);
    expect(config.optimizeDeps.include).toContain('@kaspersky/hexa-ui/design-system');
  });
});
