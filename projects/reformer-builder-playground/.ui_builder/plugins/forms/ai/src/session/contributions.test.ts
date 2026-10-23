import { afterEach, describe, expect, it, vi } from 'vitest';
import { createContributionSurface } from './contributions';
import {
  formToolOk,
  type FormAgentTool,
  type FormToolContext,
  type FormToolOutcome,
} from '@reformer/builder-plugin-api';
import { createToolRegistry } from '@reformer/builder-toolkit';
import type { ContributedTool, ContributedToolEntry } from '../tools/contributed-tools';
import type { AgentCommand } from '../tools/command-tools';

/** Встроенный набор режима — один инструмент, чтобы имена было с чем сталкивать. */
const builtin = createToolRegistry<FormToolContext, FormToolOutcome>([
  {
    name: 'get_form_outline',
    description: 'Outline.',
    inputSchema: { type: 'object', properties: {} },
    readOnly: true,
    run: () => formToolOk('outline'),
  } satisfies FormAgentTool,
]);

const pluginTool = (name: string, description = 'A plugin tool.'): ContributedTool => ({
  name,
  description,
  inputSchema: { type: 'object', properties: {} },
  readOnly: true,
  run: () => 'ok',
});

function surfaceOf(options: {
  tools?: readonly ContributedToolEntry[];
  commands?: readonly AgentCommand[];
  resources?: boolean;
}) {
  return createContributionSurface({
    agentCommands: () => options.commands ?? [],
    executeCommand: () => Promise.resolve(undefined),
    assistantTools: () => options.tools ?? [],
    hasResources: () => options.resources ?? false,
  });
}

const names = (registry: { list(): readonly { name: string }[] }): string[] =>
  registry.list().map((tool) => tool.name);

afterEach(() => {
  vi.restoreAllMocks();
});

describe('набор хода', () => {
  it('без вкладов — встроенный реестр как есть', () => {
    expect(surfaceOf({}).registryFor('structured', builtin)).toBe(builtin);
  });

  it('read_resource — только вместе с провайдерами ресурсов', () => {
    expect(names(surfaceOf({ resources: true }).registryFor('structured', builtin))).toEqual([
      'get_form_outline',
      'read_resource',
    ]);
  });

  it('порядок: встроенные, read_resource, инструменты плагинов, команды', () => {
    const surface = surfaceOf({
      resources: true,
      tools: [{ pluginId: 'reformer.files', value: pluginTool('list_source') }],
      commands: [{ id: 'files.save', agent: { description: 'Save.', schema: { type: 'object' } } }],
    });
    expect(names(surface.registryFor('files', builtin))).toEqual([
      'get_form_outline',
      'read_resource',
      'list_source',
      'files_save',
    ]);
  });

  it('имя, занятое встроенным или более ранним вкладом, — отказ name-taken', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const surface = surfaceOf({
      tools: [
        { pluginId: 'a', value: pluginTool('get_form_outline') },
        { pluginId: 'a', value: pluginTool('list_source') },
        { pluginId: 'b', value: pluginTool('list_source') },
      ],
    });
    expect(names(surface.registryFor('structured', builtin))).toEqual([
      'get_form_outline',
      'list_source',
    ]);
    expect(surface.dropped('structured').map((drop) => [drop.source, drop.code])).toEqual([
      ['a', 'name-taken'],
      ['b', 'name-taken'],
    ]);
  });

  it('переполнивший потолок отбрасывается, а меньший после него ещё входит', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    // Пять по ~530 символов входят, шестой — нет, а под маленький после них место остаётся.
    const fat = Array.from({ length: 6 }, (_, i) => ({
      pluginId: 'fat.plugin',
      value: pluginTool(`fat_${String(i)}`, 'x'.repeat(450)),
    }));
    const surface = surfaceOf({
      tools: [...fat, { pluginId: 'small.plugin', value: pluginTool('small', 'S.') }],
    });
    const list = names(surface.registryFor('structured', builtin));
    expect(list).toContain('small');
    expect(list).not.toContain('fat_5');
    expect(surface.dropped('structured').some((drop) => drop.code === 'over-budget')).toBe(true);
    expect(spy.mock.calls.flat().join(' ')).toContain('CONTRIBUTED_TOOL_SURFACE_BUDGET');
  });

  it('тот же состав — тот же реестр и ни одного повторного сообщения', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const tools = [{ pluginId: 'a', value: pluginTool('List') }];
    const surface = surfaceOf({ tools });
    const first = surface.registryFor('structured', builtin);
    const second = surface.registryFor('structured', builtin);
    expect(second).toBe(first);
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
