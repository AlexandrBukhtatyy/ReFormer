/**
 * Tool `choose_api` — какой оператор ReFormer решает это требование.
 *
 * Ниша, которой не закрывают остальные инструменты: `search_docs` отвечает «где про это
 * написано», `get_symbol_docs` — «как устроен вот этот символ», а здесь вопрос «какой из двух
 * похожих». Замерено на корпусе eval: девять задач не берутся с первой формулировки, и в
 * каждой срабатывает только последний запрос, буквально равный имени символа — то есть
 * агенту не хватает решения, а не текста.
 *
 * Ответ детерминированный (таблица правил в decide/api-decision.ts) и дополняется фактами из
 * индекса: сигнатура, канонический пример и — что важнее всего — анти-паттерн, если
 * документация прямо предупреждает об этой подмене.
 */

import { chooseApi, type DecisionRule } from '../decide/api-decision.js';
import { findOneSymbol } from '../index/symbols.js';
import { getMergedIndex } from '../index/loader.js';
import { searchSymbols, renderSymbolHits } from '../index/search.js';
import type { IndexedAntiPattern } from '../index/types.js';

export const chooseApiToolDefinition = {
  name: 'choose_api',
  description:
    'Pick the right ReFormer operator for a requirement, stated in your own words ("field B is only available when A is filled", "shipping address copies billing", "clear the field when the parent choice changes"). Answers the question the docs search cannot: which of two similar operators applies — computeFrom vs copyFrom, copyFrom vs syncFields, enableWhen vs hideWhen, resetWhen vs enableWhen, validateWhen vs enableWhen, and resetWhen vs onChange (a predicate that holds vs the bare fact that a field changed — including clearing an array, which uses onChange + .clear(), never resetValue). Returns the recommended symbol with its signature, a canonical example, why it fits, the alternatives it is commonly confused with, and any anti-pattern the docs record for that choice. Deterministic — same requirement, same answer.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      requirement: {
        type: 'string',
        description:
          'One requirement in plain words, Russian or English. E.g. "поле B доступно только когда A заполнено", "total = price * quantity", "confirmPassword must match password".',
      },
      target: {
        type: 'string',
        description:
          'Optional stack hint: "core" | "renderer-react" | "renderer-json". Narrows the fallback search when no rule matches.',
      },
    },
    required: ['requirement'],
  },
};

export interface ChooseApiArgs {
  requirement: string;
  target?: string;
}

/** `core` → `@reformer/core`; неизвестное значение игнорируем. */
function resolveTarget(target: string | undefined): string | undefined {
  if (!target) return undefined;
  const map: Record<string, string> = {
    core: '@reformer/core',
    'renderer-react': '@reformer/renderer-react',
    'renderer-json': '@reformer/renderer-json',
    cdk: '@reformer/cdk',
    'ui-kit': '@reformer/ui-kit',
  };
  return map[target] ?? undefined;
}

/**
 * Анти-паттерн, относящийся к символу. Документация записывает подмены прямо
 * («❌ resetWhen вместо enableWhen для disable-сценария»), и для выбора API это ценнее любого
 * описания: оно называет ту самую ошибку, которую агент собирается совершить.
 */
function antiPatternsFor(symbol: string): IndexedAntiPattern[] {
  const out: IndexedAntiPattern[] = [];
  const re = new RegExp(`\\b${symbol}\\b`);
  for (const topic of getMergedIndex().topics) {
    for (const ap of topic.antiPatterns) {
      const haystack = [ap.why, ap.correctNote, ap.bad, ap.correct, ap.note]
        .filter(Boolean)
        .join('\n');
      if (re.test(haystack)) out.push(ap);
    }
  }
  return out.slice(0, 2);
}

async function renderChoice(rule: DecisionRule, requirement: string): Promise<string> {
  const sym = await findOneSymbol(rule.recommend);
  const lines: string[] = [];

  lines.push(`# choose_api: \`${rule.recommend}\``);
  lines.push('');
  lines.push(`**Requirement:** ${requirement}`);
  lines.push(`**Reads as:** ${rule.intent}`);
  lines.push('');
  lines.push(`**Why \`${rule.recommend}\`:** ${rule.because}`);
  lines.push('');

  if (sym) {
    lines.push(`**Package:** \`${sym.package}\``);
    lines.push('');
    lines.push('## Signature');
    lines.push('```typescript');
    lines.push(sym.signature);
    lines.push('```');
    const example = sym.tags.find((t) => t.tag === 'example');
    if (example) {
      lines.push('');
      lines.push('## Example');
      lines.push(example.text.trim());
    }
  } else {
    // Символа нет в индексе — правило устарело. Молчать нельзя: агент напишет несуществующий API.
    lines.push(
      `> ⚠️ \`${rule.recommend}\` не найден в индексе установленных пакетов. ` +
        `Возможно, правило устарело или пакет не установлен — проверьте \`list_symbols\`.`
    );
  }

  if (rule.alternatives && rule.alternatives.length > 0) {
    lines.push('');
    lines.push('## Not this one when');
    for (const alt of rule.alternatives) {
      lines.push(`- \`${alt.symbol}\` — ${alt.when}`);
    }
  }

  const antiPatterns = antiPatternsFor(rule.recommend);
  if (antiPatterns.length > 0) {
    lines.push('');
    lines.push('## Anti-patterns recorded for this choice');
    for (const ap of antiPatterns) {
      if (ap.why) lines.push(`- ❌ ${ap.why}`);
      if (ap.correctNote) lines.push(`  ✅ ${ap.correctNote}`);
      if (!ap.why && ap.note) lines.push(`- ${ap.note.split('\n')[0]}`);
    }
  }

  return lines.join('\n');
}

export async function chooseApiTool(
  args: ChooseApiArgs
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const requirement = typeof args.requirement === 'string' ? args.requirement.trim() : '';
  if (!requirement) {
    return text(
      'Argument "requirement" is required: state ONE requirement in plain words, e.g. "поле B доступно только когда A заполнено".'
    );
  }

  const choices = chooseApi(requirement);

  if (choices.length === 0) {
    // Правило не сработало — не выдумываем, а честно уходим в поиск по символам.
    const pkg = resolveTarget(args.target);
    const hits = searchSymbols(requirement, pkg, 5);
    if (hits.length === 0) {
      return text(
        `No decision rule matched "${requirement}", and no symbol looks close.\n\n` +
          'Try `search_docs` with the same words, or restate the requirement as one concrete ' +
          'behaviour ("value is derived from…", "field becomes unavailable when…").'
      );
    }
    return text(
      `No decision rule matched "${requirement}" — falling back to symbol search.\n\n` +
        `## Candidates\n${renderSymbolHits(hits)}\n\n` +
        '_Restate the requirement as one concrete behaviour to get a decision instead of candidates._'
    );
  }

  const [best, ...rest] = choices;
  let body = await renderChoice(best.rule, requirement);

  // Второе правило показываем, только если оно совпало не слабее: иначе это шум.
  const runnerUp = rest.find((c) => c.matches >= best.matches);
  if (runnerUp) {
    body +=
      `\n\n---\n\n> Требование читается и как «${runnerUp.rule.intent}» — тогда это ` +
      `\`${runnerUp.rule.recommend}\`: ${runnerUp.rule.because}`;
  }

  return text(body);
}

function text(message: string): { content: Array<{ type: 'text'; text: string }> } {
  return { content: [{ type: 'text', text: message }] };
}
