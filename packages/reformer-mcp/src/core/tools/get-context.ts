/**
 * Tool `get_context` — весь контекст под задачу одним вызовом.
 *
 * Ниша. Остальные инструменты отвечают каждый на свой узкий вопрос: `choose_api` — «какой
 * оператор», `search_docs` — «где про это написано», `get_symbol_docs` — «как устроен вот
 * этот символ». Агенту для следующего шага нужно всё сразу, и порознь это стоило 2-4
 * round-trip'ов. Здесь то же знание собирается за один вызов, дедуплицируется и режется по
 * бюджету — с приоритетом, а не пропорционально: при нехватке места выпадает «см. также»,
 * а не сигнатура.
 *
 * `maxTokens` существует потому, что у ответов инструментов раньше не было потолка вообще:
 * замерено `list_symbols({})` = 20 591 токен и крупный рецепт = 4 283. Одна неудачная
 * формулировка стоила больше, чем весь остальной диалог.
 */

import { buildContext } from '../context/builder.js';
import type { Knowledge } from '../knowledge.js';

export const getContextToolDefinition = {
  name: 'get_context',
  // Описание — тоже контекст: оно лежит в модели при каждом подключении. Держим коротким,
  // подробности — в reformer://docs/mcp. Для точечного вопроса «каким API» дешевле choose_api,
  // и это сказано прямо, чтобы модель не звала более дорогой инструмент по привычке.
  description:
    'Assembled context for one step of building a ReFormer form: operator + signature + one example + rules, anti-patterns and links, deduplicated and budgeted. For a single "which API" question choose_api is cheaper and sharper.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      task: { type: 'string', description: 'The task in plain words (Russian or English).' },
      topics: {
        type: 'array',
        items: { type: 'string' },
        description: 'Topic ids from reformer://catalog; inferred from the task when omitted.',
      },
      target: {
        type: 'string',
        description: 'core | cdk | ui-kit | renderer-react | renderer-json.',
      },
      profile: {
        type: 'string',
        description: 'minimal (~400 tok) | implementation (default, ~1000) | debug (~1800) | full.',
      },
      maxTokens: { type: 'number', description: 'Hard cap, overrides the profile.' },
    },
    required: ['task'],
  },
};

export interface GetContextArgs {
  task: string;
  topics?: string[];
  target?: string;
  profile?: string;
  maxTokens?: number;
}

export async function getContextTool(
  args: GetContextArgs,
  k: Knowledge
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const task = typeof args.task === 'string' ? args.task.trim() : '';
  if (!task) {
    return text(
      'Argument "task" is required: describe what you are building in plain words, e.g. "async check that email is not taken".'
    );
  }

  const built = await buildContext(k, {
    task,
    topics: Array.isArray(args.topics) ? args.topics : undefined,
    target: typeof args.target === 'string' ? args.target : undefined,
    profile: typeof args.profile === 'string' ? args.profile : undefined,
    maxTokens: typeof args.maxTokens === 'number' ? args.maxTokens : undefined,
  });

  if (!built.text.trim()) {
    return text(
      `# get_context: "${task}"\n\nNothing matched. Try \`search_docs\` with the same words, or ` +
        `state the task as one concrete behaviour ("value is derived from…", "field becomes unavailable when…").`
    );
  }

  // Урезание и выпавшие части — всегда видимо. Молча усечённый пример хуже отсутствующего:
  // агент допишет его сам и получит несуществующий API.
  const notes: string[] = [];
  if (built.dropped > 0) {
    notes.push(
      `${built.dropped} блок(ов) не поместились в бюджет ${built.profile} — поднимите \`maxTokens\` или возьмите \`profile: "full"\`.`
    );
  }
  if (built.truncated) notes.push('Часть блока обрезана по бюджету.');

  const header = `# get_context: "${task}" · profile \`${built.profile}\` · ~${built.tokens} tok`;
  const footer = notes.length > 0 ? `\n\n_${notes.join(' ')}_` : '';

  return text(`${header}\n\n${built.text}${footer}`);
}

function text(message: string): { content: Array<{ type: 'text'; text: string }> } {
  return { content: [{ type: 'text', text: message }] };
}
