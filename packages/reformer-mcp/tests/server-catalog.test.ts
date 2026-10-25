/**
 * Каталог инструментов сервера: тот же список и тот же диспетчер, что жили в `src/index.ts`.
 *
 * Каталог вынесен из Node-кода сервера, чтобы его же поднимал браузерный воркер. Здесь
 * фиксируется, что переезд ничего не поменял для клиента под Node — имена, порядок, скрытые, но
 * вызываемые инструменты, ответы, — и чем от него отличается профиль браузера.
 */

import { describe, expect, it } from 'vitest';
import { createToolCatalog } from '../src/core/server/tool-catalog';
import { chooseApiTool } from '../src/core/tools/choose-api';
import { planFormTool } from '../src/core/tools/generate-form';
import { cliKnowledge } from '../src/platform/cli/knowledge';

/** Порядок `tools/list` до переезда — клиенты видят инструменты именно так. */
const NODE_TOOLS = [
  'get_context',
  'choose_api',
  'get_symbol_docs',
  'find_recipe',
  'search_docs',
  'list_symbols',
  'validate_form',
  'plan_form',
  'generate_form',
  'report_issue',
];

const names = (catalog: ReturnType<typeof createToolCatalog>) =>
  catalog.list().map((tool) => tool.name);

describe('каталог инструментов — профиль node', () => {
  const catalog = createToolCatalog(cliKnowledge, { profile: 'node' });

  it('список и порядок — прежние', () => {
    expect(names(catalog)).toEqual(NODE_TOOLS);
  });

  it('debug — только по флагу и последним', () => {
    expect(names(createToolCatalog(cliKnowledge, { profile: 'node', debug: true }))).toEqual([
      ...NODE_TOOLS,
      'debug',
    ]);
  });

  it('вызов отвечает тем же, что сам инструмент', async () => {
    const args = { requirement: 'total = price * quantity' };
    expect(await catalog.call('choose_api', args)).toEqual(
      await chooseApiTool(args, cliKnowledge())
    );
  });

  it('скрытые инструменты не перечислены, но вызываются', async () => {
    expect(names(catalog)).not.toContain('check_behaviors');
    const result = await catalog.call('check_behaviors', {
      dependencies: [
        { target: 'a', reads: ['b'] },
        { target: 'b', reads: ['a'] },
      ],
    });
    expect(result.content.length).toBeGreaterThan(0);
  });

  it('неизвестный инструмент и debug без флага — ошибка', async () => {
    await expect(catalog.call('no_such_tool', {})).rejects.toThrow('Unknown tool: no_such_tool');
    await expect(catalog.call('debug', {})).rejects.toThrow('Unknown tool: debug');
  });
});

describe('каталог инструментов — профиль browser', () => {
  const catalog = createToolCatalog(cliKnowledge, { profile: 'browser', debug: true });

  it('без report_issue и debug, даже по флагу', () => {
    expect(names(catalog)).toEqual(NODE_TOOLS.filter((name) => name !== 'report_issue'));
  });

  it('report_issue не вызывается: отчёт в памяти воркера пропал бы', async () => {
    await expect(catalog.call('report_issue', { error: 'x', solution: 'y' })).rejects.toThrow(
      'Unknown tool: report_issue'
    );
  });

  it('plan_form — без specPath в схеме', () => {
    const plan = catalog.list().find((tool) => tool.name === 'plan_form');
    expect(Object.keys(plan?.inputSchema.properties ?? {})).toEqual(['description', 'target']);
  });

  it('plan_form отбрасывает specPath из аргументов и работает от описания', async () => {
    const description = 'Форма обратной связи: имя, email, сообщение';
    expect(await catalog.call('plan_form', { specPath: 'spec.md', description })).toEqual(
      await planFormTool({ description }, cliKnowledge())
    );
  });
});
