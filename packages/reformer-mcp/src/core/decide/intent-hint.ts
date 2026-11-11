/**
 * Как оператор библиотеки записывается в `form.intent.json`.
 *
 * `choose_api` и `get_context` отвечают именами API ядра (`validateWhen`, `hideWhen`), а форму с 7.0
 * агент пишет на языке intent. Без перевода ответ вёл к ручному коду: агент получал `validateWhen` и
 * не знал, что в intent это ключ `when` строки валидации (аудит 2026-11, A9). Перевод строится по
 * тем же таблицам, по которым генератор печатает intent (`operator-catalog.ts`).
 *
 * @module reformer-mcp/core/decide/intent-hint
 */

import type { CoreOperators } from '../generate/core-operators.js';
import { MODEL_BEHAVIOR_KINDS, NODE_BEHAVIOR_KINDS } from '../generate/operator-catalog.js';

/** Операторы, у которых в intent свой ключ, а не `kind`. */
const KEYED: Readonly<Record<string, string>> = {
  hideWhen:
    '`"visibility":[{"selector":"<node>","condition":"<hide while true>"}]`; on core — a JSX condition',
  validate: 'a `validation` row with `"rules"`',
  validateWhen: 'a `validation` row with `"when":"<condition>"`',
  validateAsync: 'a `validation` row with `"async"` (grammar section `async`)',
  cross: 'a `validation` row with `"cross"` (grammar section `cross`)',
  applyEach: '`"each":"<array>"` in a validation row or a behavior record (section `arrays`)',
  apply: 'a dotted target: `"group.field"`',
  arrayOf: 'an `arrays` record (grammar section `arrays`)',
  FormWizard: 'a `FormWizard` root of `layoutRoot` with `step` children (grammar section `wizard`)',
  FormFlowConfig:
    'the steps of the `FormWizard` root: each step `selector` keys its rules, the build writes `form.flow.ts` (section `wizard`)',
  defineRegistry: '`"optionsSource":"NAME"` on the field plus a `dataSources` record',
};

/**
 * Запись оператора в intent; `null` — оператора в языке intent нет (свой код: секция `operators`).
 *
 * @param core - Фабрики правил ядра: `required`, `min`, … пишутся в `rules` строки валидации.
 */
export function intentHintFor(symbol: string, core?: CoreOperators): string | null {
  if ((MODEL_BEHAVIOR_KINDS as readonly string[]).includes(symbol)) {
    return `a \`behavior\` record \`{"kind":"${symbol}",…}\` (grammar: base, section \`behavior\`)`;
  }
  if ((NODE_BEHAVIOR_KINDS as readonly string[]).includes(symbol)) {
    return `a \`behavior\` record \`{"kind":"${symbol}","selector":"<node>",…}\` (section \`nodes\`; not printed on core)`;
  }
  const keyed = KEYED[symbol];
  if (keyed) return keyed;
  const rule = core?.rules.get(symbol);
  if (rule) return `\`"rules":["${rule.call}"]\` in a \`validation\` row`;
  return null;
}
