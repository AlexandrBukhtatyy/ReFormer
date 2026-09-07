/**
 * Изоляция стилей плагина — в настоящем браузере, потому что иначе никак.
 *
 * `new CSSStyleSheet()` с `replaceSync()` в окружении `node` не существует, а jsdom
 * конструируемых таблиц не реализует. Именно поэтому механизм и был отложен: проверить его
 * было нечем, а «написано и не проверено» здесь означало бы, что чужой CSS перекрашивает
 * оболочку, и узнаём мы об этом от пользователя.
 *
 * Проверяется поведение, а не форма: правило применилось или не применилось к настоящему
 * элементу в настоящем документе. Сравнение имён классов проверяло бы то же, что компилятор.
 *
 * @module shell/platform/plugin/styles.browser.test
 */

import { afterEach, describe, expect, it } from 'vitest';
import { parsePluginManifest } from './manifest';
import {
  PLUGIN_SCOPE_ATTRIBUTE,
  installPluginStyles,
  pluginNamespace,
  pluginScopeSelector,
  preparePluginStyles,
  scopeSelector,
} from './styles';

const PLUGIN_ID = 'acme.forms';

const cleanup: (() => void)[] = [];

afterEach(() => {
  while (cleanup.length > 0) cleanup.pop()?.();
});

/** Кусок разметки оболочки и такой же кусок внутри контейнера плагина — рядом, в одном документе. */
function stage(): { outside: HTMLElement; inside: HTMLElement; container: HTMLElement } {
  const host = document.createElement('div');
  host.innerHTML = `
    <div data-role="outside"><p>снаружи</p><span class="panel">панель снаружи</span></div>
    <div ${PLUGIN_SCOPE_ATTRIBUTE}="${PLUGIN_ID}" data-role="container">
      <div data-role="inside"><p>внутри</p><span class="panel">панель внутри</span></div>
    </div>
  `;
  document.body.append(host);
  cleanup.push(() => {
    host.remove();
  });
  return {
    outside: host.querySelector('[data-role="outside"]') as HTMLElement,
    inside: host.querySelector('[data-role="inside"]') as HTMLElement,
    container: host.querySelector('[data-role="container"]') as HTMLElement,
  };
}

/** Ставит стили оболочки обычным `<style>` — то есть так же, как они попадают в приложение. */
function shellStyles(css: string): void {
  const style = document.createElement('style');
  style.textContent = css;
  document.head.append(style);
  cleanup.push(() => {
    style.remove();
  });
}

function install(css: string): void {
  const result = installPluginStyles(css, PLUGIN_ID);
  if (!result.ok) throw new Error(`стили не приняты: ${result.problem.message}`);
  cleanup.push(() => {
    result.subscription.dispose();
  });
}

describe('scopeSelector', () => {
  const scope = pluginScopeSelector(PLUGIN_ID);

  it('корень документа ЗАМЕНЯЕТСЯ контейнером, а не выбрасывается', () => {
    // Выбрасывание — регрессия против v1: ресет и типографика плагина теряются целиком.
    expect(scopeSelector('html', scope)).toBe(scope);
    expect(scopeSelector(':root', scope)).toBe(scope);
    expect(scopeSelector('body.dark .x', scope)).toBe(`${scope}.dark .x`);
  });

  it('классы и идентификаторы тоже уходят под контейнер — в отличие от v1', () => {
    // v1 оставляет их глобальными ради порталов кита. Плагину каталога это не подходит:
    // он вправе назвать класс `.panel`, то есть ровно как оболочка.
    expect(scopeSelector('.panel', scope)).toBe(`${scope} .panel`);
    expect(scopeSelector('#tree', scope)).toBe(`${scope} #tree`);
  });

  it('уже ограниченный селектор не оборачивается второй раз', () => {
    expect(scopeSelector(`${scope} .panel`, scope)).toBe(`${scope} .panel`);
  });
});

describe('изоляция', () => {
  it('ресет плагина не меняет вид оболочки, но действует внутри него', () => {
    const { outside, inside, container } = stage();
    const outsideParagraph = outside.querySelector('p') as HTMLElement;
    const outsidePanel = outside.querySelector('.panel') as HTMLElement;
    const before = {
      paragraph: getComputedStyle(outsideParagraph).color,
      panel: getComputedStyle(outsidePanel).color,
      body: getComputedStyle(document.body).letterSpacing,
    };

    install(`
      html, body, :root { letter-spacing: 11px; }
      * { color: rgb(9, 9, 9); }
      p { color: rgb(8, 8, 8); }
      .panel { color: rgb(7, 7, 7); }
    `);

    // Оболочка не изменилась ни на одном из четырёх видов селектора.
    expect(getComputedStyle(outsideParagraph).color).toBe(before.paragraph);
    expect(getComputedStyle(outsidePanel).color).toBe(before.panel);
    expect(getComputedStyle(document.body).letterSpacing).toBe(before.body);

    // Внутри — подействовало всё, включая ресет на `html`/`body`/`:root`.
    expect(getComputedStyle(container).letterSpacing).toBe('11px');
    expect(getComputedStyle(inside.querySelector('p') as HTMLElement).color).toBe('rgb(8, 8, 8)');
    expect(getComputedStyle(inside.querySelector('.panel') as HTMLElement).color).toBe(
      'rgb(7, 7, 7)'
    );
  });

  it('токены оболочки достают внутрь изолированного плагина', () => {
    // Ради этого и отвергнут Shadow DOM: пользовательские свойства наследуются и пересекают
    // любую границу, поэтому изолированный плагин по-прежнему попадает в тему.
    shellStyles(`:root { --rb-test-accent: rgb(3, 33, 3); }`);
    const { inside } = stage();
    install(`p { color: var(--rb-test-accent); }`);

    expect(getComputedStyle(inside.querySelector('p') as HTMLElement).color).toBe('rgb(3, 33, 3)');
  });

  it('снятие стилей действительно снимает их', () => {
    const { inside } = stage();
    const paragraph = inside.querySelector('p') as HTMLElement;
    const before = getComputedStyle(paragraph).color;

    const result = installPluginStyles(`p { color: rgb(4, 44, 4); }`, PLUGIN_ID);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(getComputedStyle(paragraph).color).toBe('rgb(4, 44, 4)');

    result.subscription.dispose();
    // Выключенный плагин, чей CSS остался в документе, выглядел бы включённым.
    expect(getComputedStyle(paragraph).color).toBe(before);
    expect(document.adoptedStyleSheets).not.toContain(result.sheet);
  });
});

describe('санитайзинг', () => {
  it('`@property` вырезается: иначе три строки плагина ломают наследование токена', () => {
    shellStyles(`
      [data-role="outside"] { --rb-test-token: rgb(5, 55, 5); }
      [data-role="outside"] p { color: var(--rb-test-token, rgb(0, 0, 0)); }
    `);
    const { outside } = stage();
    const paragraph = outside.querySelector('p') as HTMLElement;
    expect(getComputedStyle(paragraph).color).toBe('rgb(5, 55, 5)');

    install(`
      @property --rb-test-token { syntax: '*'; inherits: false; }
      p { color: rgb(6, 66, 6); }
    `);

    // Правило зарегистрировалось бы глобально — областью действия у него документ, а не
    // таблица, — и потомок перестал бы наследовать токен. Проверяем следствие, а не наличие.
    expect(getComputedStyle(paragraph).color).toBe('rgb(5, 55, 5)');
  });

  it('`@keyframes` с именем оболочки её не переопределяет', () => {
    shellStyles(`
      @keyframes rb-test-blink { from { color: rgb(1, 11, 1); } to { color: rgb(1, 11, 1); } }
      [data-role="outside"] p { animation: rb-test-blink 10s linear infinite; }
    `);
    const { outside } = stage();
    const paragraph = outside.querySelector('p') as HTMLElement;

    install(`
      @keyframes rb-test-blink { from { color: rgb(2, 22, 2); } to { color: rgb(2, 22, 2); } }
      p { animation: rb-test-blink 10s linear infinite; }
    `);

    // Приёмка усилена именно этим случаем: правило «плагин со своим ресетом не меняет вид
    // оболочки» коллизию имён не поймало бы вовсе.
    expect(getComputedStyle(paragraph).color).toBe('rgb(1, 11, 1)');
  });

  it('своя анимация плагина продолжает работать под новым именем', () => {
    // Изоляция, чинящая оболочку ценой поломки плагина, — не изоляция, а запрет.
    const { inside } = stage();
    install(`
      @keyframes rb-test-blink { from { color: rgb(2, 22, 2); } to { color: rgb(2, 22, 2); } }
      p { animation: rb-test-blink 10s linear infinite; }
    `);

    expect(getComputedStyle(inside.querySelector('p') as HTMLElement).color).toBe('rgb(2, 22, 2)');
  });

  it('`@font-face` переименовывается вместе со ссылками на него', () => {
    // Семейство регистрируется глобально по имени так же, как анимация: плагин с
    // `@font-face { font-family: Inter }` подменил бы шрифт оболочки.
    const prepared = preparePluginStyles(
      `
        @font-face { font-family: 'Inter'; src: url(inter.woff2); }
        p { font-family: 'Inter', sans-serif; }
      `,
      PLUGIN_ID
    );
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    const renamed = `${pluginNamespace(PLUGIN_ID)}--Inter`;
    const face = prepared.sheet.cssRules[0] as CSSFontFaceRule;
    expect(face.style.getPropertyValue('font-family')).toContain(renamed);
    // Ссылка переписана — иначе изоляция чинила бы оболочку ценой шрифта плагина.
    const rule = prepared.sheet.cssRules[1] as CSSStyleRule;
    expect(rule.style.getPropertyValue('font-family')).toContain(renamed);
  });

  it('имена именованных at-правил уходят в пространство имён плагина', () => {
    const prepared = preparePluginStyles(
      `
        @keyframes blink { from { opacity: 0; } to { opacity: 1; } }
        @counter-style dots { system: cyclic; symbols: '·'; suffix: ' '; }
      `,
      PLUGIN_ID
    );
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    const names = Array.from(prepared.sheet.cssRules).map((rule) =>
      'name' in rule ? (rule as { name: string }).name : ''
    );
    const namespace = pluginNamespace(PLUGIN_ID);
    expect(names).toEqual([`${namespace}--blink`, `${namespace}--dots`]);
  });
});

describe('разбор', () => {
  it('непарная «}» отвергается с внятной причиной, а не молча делает CSS глобальным', () => {
    const result = preparePluginStyles(`.a { color: red; } } .b { color: blue; }`, PLUGIN_ID);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problem.code).toBe('styles-invalid');
    expect(result.problem.message).toContain('непарная');
  });

  it('вложенные правила не переписываются: `&` от переписывания стал бы невалидным', () => {
    const prepared = preparePluginStyles(`.a { color: red; & .b { color: blue; } }`, PLUGIN_ID);
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    const outer = prepared.sheet.cssRules[0] as CSSStyleRule;
    expect(outer.selectorText).toBe(`${pluginScopeSelector(PLUGIN_ID)} .a`);
    const innerRules = (outer as unknown as CSSGroupingRule).cssRules;
    expect((innerRules[0] as CSSStyleRule).selectorText).toBe('& .b');
  });

  it('дубли после переписывания схлопываются', () => {
    const prepared = preparePluginStyles(`html, body, :root { margin: 0; }`, PLUGIN_ID);
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    expect((prepared.sheet.cssRules[0] as CSSStyleRule).selectorText).toBe(
      pluginScopeSelector(PLUGIN_ID)
    );
  });

  it('запятая внутри `:is(...)` не рвёт селектор пополам', () => {
    const prepared = preparePluginStyles(`:is(.a, .b) p { color: red; }`, PLUGIN_ID);
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    const scope = pluginScopeSelector(PLUGIN_ID);
    expect((prepared.sheet.cssRules[0] as CSSStyleRule).selectorText).toBe(
      `${scope} :is(.a, .b) p`
    );
  });
});

describe('манифест', () => {
  it('идентификатор с точкой не годился бы в класс — потому контейнер задан атрибутом', () => {
    // `.rb-plugin-acme.forms` разбирается как ДВА класса и не совпадает ни с чем.
    expect(pluginScopeSelector('acme.forms')).toBe('[data-rb-plugin="acme.forms"]');
    const { container } = stage();
    expect(container.matches(pluginScopeSelector(PLUGIN_ID))).toBe(true);
  });

  it('объявленные стили попадают в разобранный манифест', () => {
    const parsed = parsePluginManifest(
      JSON.stringify({
        id: 'acme',
        apiVersion: '^1',
        main: 'main.js',
        styles: { file: 'styles.css', isolation: 'scoped' },
      }),
      'acme'
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.manifest.styles).toEqual({ file: 'styles.css', isolation: 'scoped' });
  });
});
