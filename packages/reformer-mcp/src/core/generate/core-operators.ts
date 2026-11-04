/**
 * Операторы ядра из его индекса: фабрики правил `@reformer/core/validators` и имена всех
 * операторов `./validators`, `./validation`, `./behaviors`.
 *
 * Источник — `llms-index.json` установленного `@reformer/core`, тот же индекс, что у справочных
 * инструментов (см. `core/index/merge.ts`). Своей таблицы у сервера нет: новая фабрика ядра
 * попадает в грамматику `form_build` и в проверки без правки MCP, а грамматика называет ровно те
 * правила, что есть в установленной версии ядра.
 *
 * Из индекса берётся всё: список фабрик (сигнатура `…): Rule<…>`), образец вызова (первый вызов в
 * `@example`) и группа (тег `@appliesTo` фабрики; без тега — тип значения из `Rule<T>`). Подписи
 * групп — презентация грамматики, они здесь.
 *
 * Чего здесь нет: ключей `kind` поведения и ключей правила intent (`operator-catalog.ts`). Это язык
 * intent — за каждым ключом стоит печать в генераторе, и оператор ядра, прочитанный в рантайме,
 * сервер всё равно не напечатал бы.
 *
 * @module reformer-mcp/core/generate/core-operators
 */

import type { IndexedSymbol, MergedIndex } from '../index/types.js';

/** Фабрика правила ядра. */
export interface CoreRule {
  /** Имя фабрики: `minAge`. */
  name: string;
  /** Как записать правило в `rules`: `minAge(18)`, `required`. */
  call: string;
  /** Какие значения проверяет: `any`, `text`, `number`, `date`, `file` — или своё значение ядра. */
  group: string;
}

export interface CoreOperators {
  /** Индекс ядра найден. `false` — сверять не с чем: имена правил идут в код как есть. */
  readonly found: boolean;
  /** Фабрики правил в порядке грамматики: по группам, внутри группы — по имени. */
  readonly rules: ReadonlyMap<string, CoreRule>;
  /** Значения из `./validators`, `./validation`, `./behaviors`: свой оператор так называться не может. */
  readonly names: ReadonlySet<string>;
}

export const NO_CORE_OPERATORS: CoreOperators = {
  found: false,
  rules: new Map(),
  names: new Set(),
};

const CORE_PACKAGE = '@reformer/core';
const OPERATOR_ENTRIES = ['./validators', './validation', './behaviors'];

/** Группы в порядке грамматики и их подписи; у `any` подписи нет — это правила для любого поля. */
const GROUP_LABELS: ReadonlyArray<[string, string]> = [
  ['any', ''],
  ['text', 'строки и списки'],
  ['number', 'числа'],
  ['date', 'даты'],
  ['file', 'файлы'],
];

const flat = (text: string): string => text.replace(/\s+/g, ' ').trim();

/**
 * Содержимое скобок, открытых в `text[open]`, с учётом вложенных скобок и строк.
 * `null` — скобка не закрыта.
 */
function enclosed(text: string, open: number): string | null {
  let depth = 0;
  let quote: string | null = null;
  for (let i = open; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      if (c === '\\') i++;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') quote = c;
    else if (c === '(' || c === '[' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '}') {
      depth--;
      if (depth === 0) return text.slice(open + 1, i);
    }
  }
  return null;
}

/** Аргументы верхнего уровня через запятую: `a, { b, c }` → `['a', '{ b, c }']`. */
function splitArgs(text: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      if (c === '\\') i++;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') quote = c;
    else if (c === '(' || c === '[' || c === '{' || c === '<') depth++;
    else if (c === ')' || c === ']' || c === '}' || c === '>') depth--;
    else if (c === ',' && depth === 0) {
      out.push(text.slice(start, i).trim());
      start = i + 1;
    }
  }
  const last = text.slice(start).trim();
  if (last) out.push(last);
  return out;
}

/** Параметры сигнатуры: `[имя, тип, обязателен]`. */
function signatureParams(symbol: IndexedSymbol): Array<[string, string, boolean]> {
  const signature = flat(symbol.signature);
  const at = signature.indexOf(`${symbol.name}`);
  const open = signature.indexOf('(', at);
  const inner = open < 0 ? null : enclosed(signature, open);
  if (!inner) return [];
  return splitArgs(inner).map((param) => {
    const match = /^([\w$]+)(\?)?\s*:\s*(.*?)(?:\s*=.*)?$/.exec(param);
    if (!match) return [param, 'unknown', true];
    return [match[1], match[3], !match[2] && !param.includes('=')];
  });
}

/** Тип значения правила: `…): Rule<number | null | undefined>` → `number | null | undefined`. */
function ruleValueType(symbol: IndexedSymbol): string | null {
  return /\):\s*Rule<(.*)>$/.exec(flat(symbol.signature))?.[1] ?? null;
}

/** Группа по типу значения — когда у фабрики нет тега `@appliesTo`. */
function groupOfType(type: string): string {
  const parts = type
    .split('|')
    .map((part) => part.trim())
    .filter((part) => part !== 'null' && part !== 'undefined');
  if (parts.includes('Date')) return 'date';
  if (parts.length > 0 && parts.every((part) => part === 'number')) return 'number';
  if (parts.length > 0 && parts.every((part) => part === 'string')) return 'text';
  return 'any';
}

/** Заглушка аргумента по типу параметра, когда в примере вызова нет. */
function placeholder(name: string, type: string): string {
  if (type === 'number') return 'n';
  if (type === 'Date') return 'new Date(…)';
  if (type === 'RegExp') return '/re/';
  if (type === 'string') return "'…'";
  return name;
}

/**
 * Образец вызова: обязательные аргументы первого вызова в `@example` (`minAge(18, { code })` →
 * `minAge(18)`), без обязательных аргументов — голое имя. Нет вызова в примере — заглушки по
 * сигнатуре (`maxAge(n)`).
 */
function callOf(symbol: IndexedSymbol): string {
  const required = signatureParams(symbol).filter(([, , isRequired]) => isRequired);
  if (required.length === 0) return symbol.name;

  const example = symbol.example ?? '';
  const head = new RegExp(`(?<![\\w$.])${symbol.name}\\(`).exec(example);
  const inner = head ? enclosed(example, head.index + symbol.name.length) : null;
  const args = inner === null ? [] : splitArgs(inner);
  const shown =
    args.length >= required.length
      ? args.slice(0, required.length)
      : required.map(([name, type]) => placeholder(name, type));
  return `${symbol.name}(${shown.join(', ')})`;
}

/** Порядок группы в грамматике; незнакомые группы — после известных, по алфавиту. */
const groupRank = (group: string): number => {
  const rank = GROUP_LABELS.findIndex(([id]) => id === group);
  return rank < 0 ? GROUP_LABELS.length : rank;
};

/** Операторы ядра из слитого индекса. Нет индекса ядра — {@link NO_CORE_OPERATORS}. */
export function coreOperatorsFromIndex(index: MergedIndex): CoreOperators {
  const core = index.symbols.filter((symbol) => symbol.package === CORE_PACKAGE);
  const inEntries = (symbol: IndexedSymbol, entries: readonly string[]) =>
    (symbol.entries ?? []).some((entry) => entries.includes(entry));

  const rules: CoreRule[] = [];
  for (const symbol of core) {
    if (symbol.kind !== 'function' || !inEntries(symbol, ['./validators'])) continue;
    const type = ruleValueType(symbol);
    if (type === null) continue; // помощник (`isFileLike`), а не фабрика правила
    rules.push({
      name: symbol.name,
      call: callOf(symbol),
      group: symbol.appliesTo?.trim() || groupOfType(type),
    });
  }
  if (rules.length === 0) return NO_CORE_OPERATORS;

  rules.sort(
    (a, b) =>
      groupRank(a.group) - groupRank(b.group) ||
      a.group.localeCompare(b.group) ||
      a.name.localeCompare(b.name)
  );
  const names = core
    .filter((symbol) => symbol.kind !== 'interface' && symbol.kind !== 'type')
    .filter((symbol) => inEntries(symbol, OPERATOR_ENTRIES))
    .map((symbol) => symbol.name);

  return {
    found: true,
    rules: new Map(rules.map((rule) => [rule.name, rule])),
    names: new Set(names),
  };
}

/** Правила ядра одной строкой по группам — для грамматики: `required; числа: min(18) max(100)`. */
export function renderRuleList(core: CoreOperators): string {
  const groups = new Map<string, string[]>();
  for (const rule of core.rules.values()) {
    groups.set(rule.group, [...(groups.get(rule.group) ?? []), rule.call]);
  }
  return [...groups]
    .map(([group, calls]) => {
      const label = GROUP_LABELS.find(([id]) => id === group)?.[1] ?? group;
      return label ? `${label}: ${calls.join(' ')}` : calls.join(' ');
    })
    .join('; ');
}
