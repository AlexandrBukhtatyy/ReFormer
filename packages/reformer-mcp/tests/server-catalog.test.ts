/**
 * Каталог инструментов сервера: список и диспетчер, общие для Node и браузерного воркера.
 *
 * Здесь фиксируется, что видит клиент под Node — имена, порядок, ответы, — и чем от него отличается
 * профиль браузера. С 7.0 форму создаёт один путь (intent → `form_build`), а легаси удалено:
 * `generate_form` и алиасы `validate_json_schema`/`check_behaviors` — неизвестные имена.
 */

import { describe, expect, it } from 'vitest';
import { createToolCatalog } from '../src/core/server/tool-catalog';
import { chooseApiTool } from '../src/core/tools/choose-api';
import { cliKnowledge } from '../src/platform/cli/knowledge';

/** Справочные инструменты: одни и те же в обоих профилях. */
const REFERENCE_TOOLS = [
  'get_context',
  'choose_api',
  'get_symbol_docs',
  'find_recipe',
  'search_docs',
  'list_symbols',
  'validate_form',
];

/** Порядок `tools/list` под Node — клиенты видят инструменты именно так. */
const NODE_TOOLS = [...REFERENCE_TOOLS, 'plan_form', 'form_build', 'report_issue'];

/** Воркер: справочный канал — без инструментов, которые пишут в проект. */
const BROWSER_TOOLS = REFERENCE_TOOLS;

/** Удалены в 7.0: `generate_form`, и давно заменённые `validate_form` алиасы. */
const REMOVED_TOOLS = ['generate_form', 'validate_json_schema', 'check_behaviors'];

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

  it('легаси 6.x — неизвестные имена', async () => {
    for (const name of REMOVED_TOOLS) {
      await expect(catalog.call(name, {}), name).rejects.toThrow(`Unknown tool: ${name}`);
    }
  });

  it('неизвестный инструмент и debug без флага — ошибка', async () => {
    await expect(catalog.call('no_such_tool', {})).rejects.toThrow('Unknown tool: no_such_tool');
    await expect(catalog.call('debug', {})).rejects.toThrow('Unknown tool: debug');
  });

  it('plan_form — спека и каталог формы, без description', () => {
    const plan = catalog.list().find((tool) => tool.name === 'plan_form');
    expect(Object.keys(plan?.inputSchema.properties ?? {})).toEqual(['specPath', 'dir', 'target']);
    expect(plan?.inputSchema.required).toEqual(['specPath']);
  });

  it('form_build — каталог и грамматика', () => {
    const build = catalog.list().find((tool) => tool.name === 'form_build');
    expect(Object.keys(build?.inputSchema.properties ?? {})).toEqual(['dir', 'grammar']);
  });
});

describe('каталог инструментов — профиль browser', () => {
  const catalog = createToolCatalog(cliKnowledge, { profile: 'browser', debug: true });

  it('без инструментов диска и debug, даже по флагу', () => {
    expect(names(catalog)).toEqual(BROWSER_TOOLS);
  });

  it('form_build не вызывается: записывать форму там некуда', async () => {
    await expect(catalog.call('form_build', {})).rejects.toThrow('Unknown tool: form_build');
  });

  it('report_issue не вызывается: отчёт в памяти воркера пропал бы', async () => {
    await expect(catalog.call('report_issue', { error: 'x', solution: 'y' })).rejects.toThrow(
      'Unknown tool: report_issue'
    );
  });

  it('plan_form не вызывается: черновик пишется в проект, а его тут нет', async () => {
    await expect(catalog.call('plan_form', { description: 'x' })).rejects.toThrow(
      'Unknown tool: plan_form'
    );
  });

  it('легаси 6.x — неизвестные имена', async () => {
    for (const name of REMOVED_TOOLS) {
      await expect(catalog.call(name, {}), name).rejects.toThrow(`Unknown tool: ${name}`);
    }
  });
});
