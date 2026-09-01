/**
 * Изоляция стилей плагина: чужой CSS применяется только к поддереву плагина.
 *
 * Плагин по умолчанию своего CSS не имеет и пользуется классами оболочки и токенами кита —
 * это рекомендуемый путь, и он выражается отсутствием поля `styles` в манифесте. Модуль
 * нужен второму случаю: плагин везёт стороннее оформление, и без ограничения оно перекрасит
 * оболочку. В v1 та же проблема уже решена для чужих дизайн-систем — их правила ограничены
 * поддеревом превью, потому что собственные ресеты китов ломают вид билдера.
 *
 * ## Почему CSSOM, а не обёртка текста в `@scope`
 *
 * Обёртка — операция над строкой, разбор не нужен, и именно поэтому она соблазнительна.
 * Спайк в настоящем Chromium показал, что она **не изолирует**: непарная `}` закрывает
 * `@scope` досрочно и всё после неё становится глобальным; `@keyframes`, `@font-face`
 * и `@counter-style` проходят насквозь и регистрируются глобально; `@property` на чужой
 * токен убивает наследование во всём документе; `html`/`body`/`:root` никогда не совпадают
 * и молча выбрасываются — то есть ресет плагина теряется целиком. Подробности и таблица —
 * в `docs/plugin-and-shell.md`.
 *
 * Отдельный парсер CSS при этом не нужен: он уже есть в браузере. `new CSSStyleSheet()`
 * с `replaceSync()` даёт разобранное дерево правил, по которому можно ходить и которое
 * можно править. Спека сама выбрасывает `@import` и `@charset` при `replaceSync` — то есть
 * самый опасный вид «утечки наружу» закрыт до нас.
 *
 * ## Отличие от v1, принятое ЯВНО
 *
 * Функция переписывания селекторов v1 (`scope-kit-css.ts`) **намеренно оставляет классовые
 * селекторы глобальными**: там ограничивается кит, компоненты которого рисуют выпадающие
 * списки порталом в `document.body`, и завёрнутый в скоуп `.ant-select-dropdown` остался бы
 * без стилей. Логика та: «в оболочке нет ни одного `.ant-*`, значит они и так никуда не текут».
 *
 * Здесь нужно **обратное**, и это не вкусовщина: у плагина каталога нет никакого «своего»
 * пространства имён классов. Он вправе назвать класс `.panel`, `.button` или `.dark` — то есть
 * ровно так, как называются классы оболочки, — и оставленный глобальным класс перекрасит её.
 * Поэтому здесь под контейнер уходит **каждый** селектор, включая классы и идентификаторы.
 *
 * Цена названа честно: **портал плагина обязан лежать внутри его контейнера**. Узел, ушедший
 * в `document.body`, окажется без стилей плагина. Это то же ограничение, что у скоупа токенов
 * оболочки, и лечится оно тем же — контейнером портала внутри элемента со скоупом,
 * а не отменой изоляции.
 *
 * ## Контейнер — атрибут, а не класс
 *
 * В контракте записан класс `.rb-plugin-<id>`. Так делать нельзя: идентификатор плагина
 * допускает точку (`^[a-zA-Z0-9][a-zA-Z0-9._-]*$`, см. `./manifest`), и `.rb-plugin-acme.forms`
 * разбирается как ДВА класса — то есть селектор молча перестаёт совпадать с чем бы то ни было.
 * Атрибут `[data-rb-plugin="acme.forms"]` этой ловушки не имеет: значение — строка, а не
 * идентификатор.
 *
 * @module host/plugin/styles
 */

import { toDisposable, type Disposable } from '@/shell/platform/primitives/disposable';
import type { PluginProblem } from './manifest';

/** Атрибут контейнера плагина. Его ставит тот, кто рисует поддерево плагина. */
export const PLUGIN_SCOPE_ATTRIBUTE = 'data-rb-plugin';

/** Селектор контейнера плагина. */
export function pluginScopeSelector(pluginId: string): string {
  const value = pluginId.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `[${PLUGIN_SCOPE_ATTRIBUTE}="${value}"]`;
}

/**
 * Пространство имён для переименованных at-правил.
 *
 * Небезопасные для идентификатора знаки (точка) заменяются: имя `@keyframes` — идентификатор,
 * а не строка, и точка в нём невыразима.
 */
export function pluginNamespace(pluginId: string): string {
  return `rb-${pluginId.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
}

/** Селектор целиком — корень документа. */
const ROOT_ONLY = /^(html|body|:root)$/;
/** Селектор начинается с корня документа, дальше комбинатор или уточнение. */
const ROOT_HEAD = /^(html|body|:root)(?=[\s>+~:.[])/;

/**
 * Переписывает один селектор под контейнер.
 *
 * `html`/`body`/`:root` **заменяются** контейнером, а не выбрасываются: их наследуемые
 * свойства (шрифт, цвет, размер) обязаны достаться поддереву, иначе типографика плагина
 * теряется целиком — та самая регрессия, из-за которой отвергнута обёртка в `@scope`.
 *
 * Селектор, уже начинающийся с контейнера, не переписывается второй раз: иначе повторный
 * проход по той же таблице удваивал бы вложенность.
 */
export function scopeSelector(selector: string, scope: string): string {
  const value = selector.trim();
  if (value === '') return selector;
  if (value === scope || value.startsWith(`${scope} `) || value.startsWith(`${scope}:`)) {
    return value;
  }
  if (ROOT_ONLY.test(value)) return scope;
  const head = ROOT_HEAD.exec(value);
  if (head !== null) return scope + value.slice(head[1].length);
  // Всё остальное — включая классы и идентификаторы: см. «Отличие от v1» в шапке модуля.
  return `${scope} ${value}`;
}

/**
 * Разбивает список селекторов по запятым верхнего уровня.
 *
 * `selectorText.split(',')` неверен: запятая живёт внутри `:is(a, b)` и внутри строк
 * в атрибутных селекторах, и наивное деление разорвало бы такой селектор пополам.
 */
function splitSelectors(selectorText: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let current = '';
  for (let index = 0; index < selectorText.length; index += 1) {
    const char = selectorText[index];
    if (quote !== null) {
      current += char;
      if (char === '\\') {
        index += 1;
        if (index < selectorText.length) current += selectorText[index];
      } else if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      current += char;
      continue;
    }
    if (char === '(' || char === '[') depth += 1;
    else if (char === ')' || char === ']') depth -= 1;
    else if (char === ',' && depth === 0) {
      parts.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  parts.push(current);
  return parts;
}

/** Свойства, в значениях которых встречаются имена переименованных at-правил. */
const NAME_BEARING_PROPERTIES: readonly string[] = [
  'animation-name',
  'animation',
  'font-family',
  'font',
  'list-style-type',
  'list-style',
];

/** Замена имени целым словом: `spin` в `spin-fast` трогать нельзя. */
function renameInValue(value: string, renames: ReadonlyMap<string, string>): string {
  if (renames.size === 0 || value === '') return value;
  return value.replace(/[A-Za-z_-][A-Za-z0-9_-]*/g, (word) => renames.get(word) ?? word);
}

interface Renames {
  /** Старое имя → новое. Общая карта на `@keyframes`, `@font-face` и `@counter-style`. */
  readonly names: Map<string, string>;
}

type Grouping = CSSStyleSheet | CSSGroupingRule;

function rulesOf(container: Grouping): CSSRuleList {
  return container.cssRules;
}

/**
 * Убирает опасное и переименовывает именованное.
 *
 * `@property` вырезается безусловно: объявление на чужой токен меняет его тип и начальное
 * значение **во всём документе**, то есть три строки плагина ломают тему оболочки. Переписать
 * его нельзя — пользовательские свойства наследуются и границ не знают, в этом их смысл.
 *
 * `@keyframes`, `@font-face` и `@counter-style` переименовываются, а не вырезаются: они
 * регистрируются глобально по имени, и плагин с `@keyframes spin` переопределил бы анимацию
 * оболочки. Вместе с именем переписываются и ссылки на него — иначе изоляция чинила бы
 * оболочку ценой поломки плагина.
 */
function sanitize(container: Grouping, namespace: string, renames: Renames): void {
  const rules = rulesOf(container);
  for (let index = rules.length - 1; index >= 0; index -= 1) {
    const rule = rules[index];
    const kind = rule.constructor.name;

    if (kind === 'CSSPropertyRule') {
      container.deleteRule(index);
      continue;
    }
    if (kind === 'CSSKeyframesRule') {
      const keyframes = rule as CSSKeyframesRule;
      const renamed = `${namespace}--${keyframes.name}`;
      renames.names.set(keyframes.name, renamed);
      keyframes.name = renamed;
      continue;
    }
    if (kind === 'CSSCounterStyleRule') {
      const counter = rule as CSSCounterStyleRule;
      const renamed = `${namespace}--${counter.name}`;
      renames.names.set(counter.name, renamed);
      counter.name = renamed;
      continue;
    }
    if (kind === 'CSSFontFaceRule') {
      const face = rule as CSSFontFaceRule;
      const family = face.style
        .getPropertyValue('font-family')
        .trim()
        .replace(/^["']|["']$/g, '');
      if (family !== '') {
        const renamed = `${namespace}--${family.replace(/[^A-Za-z0-9_-]/g, '_')}`;
        renames.names.set(family, renamed);
        face.style.setProperty('font-family', `"${renamed}"`);
      }
      continue;
    }
    // Группирующие правила (`@media`, `@supports`, `@layer`, `@container`) и вложенность.
    if ('cssRules' in rule) sanitize(rule as CSSGroupingRule, namespace, renames);
  }
}

/**
 * Переписывает селекторы и ссылки на переименованное.
 *
 * `nested` несёт правило из контракта: селекторы правил, **вложенных** в другое правило,
 * не трогаются. Родитель уже ограничен контейнером, а `&` от переписывания стал бы
 * невалидным — то есть попытка «изолировать надёжнее» сломала бы вложенный блок.
 */
function rewrite(container: Grouping, scope: string, renames: Renames, nested: boolean): void {
  const rules = rulesOf(container);
  for (let index = 0; index < rules.length; index += 1) {
    const rule = rules[index];
    const kind = rule.constructor.name;

    if (kind === 'CSSStyleRule') {
      const styleRule = rule as CSSStyleRule;
      if (!nested) {
        const scoped = splitSelectors(styleRule.selectorText).map((part) =>
          scopeSelector(part, scope)
        );
        // Дубли схлопываются: `html, body` после замены дают контейнер дважды.
        const unique = [...new Set(scoped)];
        styleRule.selectorText = unique.join(', ');
      }
      rewriteReferences(styleRule.style, renames);
      if ('cssRules' in styleRule) rewrite(styleRule as CSSGroupingRule, scope, renames, true);
      continue;
    }
    if (kind === 'CSSKeyframesRule') {
      const keyframes = rule as CSSKeyframesRule;
      for (const frame of Array.from(keyframes.cssRules)) {
        rewriteReferences((frame as CSSKeyframeRule).style, renames);
      }
      continue;
    }
    if ('cssRules' in rule) rewrite(rule as CSSGroupingRule, scope, renames, nested);
  }
}

function rewriteReferences(style: CSSStyleDeclaration, renames: Renames): void {
  for (const property of NAME_BEARING_PROPERTIES) {
    const value = style.getPropertyValue(property);
    if (value === '') continue;
    const next = renameInValue(value, renames.names);
    if (next !== value) style.setProperty(property, next, style.getPropertyPriority(property));
  }
}

/**
 * Проверка при установке: непарная скобка.
 *
 * Текст оборачивается в `@scope` и разбирается. Лишняя `}` закрывает обёртку досрочно,
 * и всё, что за ней, всплывает на верхний уровень — то есть правил становится больше одного.
 *
 * Честное ограничение: лишняя `}` в самом конце файла отбрасывается разбором молча и здесь
 * не ловится. Это безопасный случай — за ней ничего нет, вытечь нечему.
 */
export function hasUnbalancedBraces(css: string): boolean {
  const probe = new CSSStyleSheet();
  probe.replaceSync(`@scope {\n${css}\n}`);
  return probe.cssRules.length !== 1;
}

export type PreparePluginStylesResult =
  | { readonly ok: true; readonly sheet: CSSStyleSheet }
  | { readonly ok: false; readonly problem: PluginProblem };

/**
 * Готовит таблицу стилей плагина: разбор, санитайзинг, переписывание селекторов.
 *
 * Отделено от установки, потому что проверяемо отдельно и потому что список плагинов вправе
 * показать «стили не приняты и почему» до того, как что-то попало в документ.
 */
export function preparePluginStyles(css: string, pluginId: string): PreparePluginStylesResult {
  if (hasUnbalancedBraces(css)) {
    return {
      ok: false,
      problem: {
        code: 'styles-invalid',
        message:
          'в таблице стилей непарная «}»: за ней правила перестают быть ограниченными плагином',
      },
    };
  }

  const sheet = new CSSStyleSheet();
  try {
    sheet.replaceSync(css);
  } catch (error) {
    return {
      ok: false,
      problem: {
        code: 'styles-invalid',
        message: `таблица стилей не разбирается: ${error instanceof Error ? error.message : String(error)}`,
        cause: error,
      },
    };
  }

  const renames: Renames = { names: new Map() };
  sanitize(sheet, pluginNamespace(pluginId), renames);
  rewrite(sheet, pluginScopeSelector(pluginId), renames, false);
  return { ok: true, sheet };
}

export type InstallPluginStylesResult =
  | { readonly ok: true; readonly sheet: CSSStyleSheet; readonly subscription: Disposable }
  | { readonly ok: false; readonly problem: PluginProblem };

/**
 * Устанавливает стили плагина в документ. `dispose()` снимает их.
 *
 * Снятие обязано быть настоящим: выключение плагина, оставившее его CSS в документе,
 * означало бы, что «выключено» и «включено» выглядят одинаково.
 *
 * Документ передаётся параметром, а не берётся из окружения: так модуль проверяем
 * на отдельном документе, не пачкая тот, в котором идёт прогон.
 */
export function installPluginStyles(
  css: string,
  pluginId: string,
  target: Document = document
): InstallPluginStylesResult {
  const prepared = preparePluginStyles(css, pluginId);
  if (!prepared.ok) return prepared;
  const { sheet } = prepared;
  target.adoptedStyleSheets = [...target.adoptedStyleSheets, sheet];
  return {
    ok: true,
    sheet,
    subscription: toDisposable(() => {
      target.adoptedStyleSheets = target.adoptedStyleSheets.filter((entry) => entry !== sheet);
    }),
  };
}
