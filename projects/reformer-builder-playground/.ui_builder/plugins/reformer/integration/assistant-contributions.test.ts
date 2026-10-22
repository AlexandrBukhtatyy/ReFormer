/**
 * Вклады плагинов в ассистента — в СОБРАННОМ приложении, а не в каждом плагине по отдельности.
 *
 * Плагин файлов и ассистент друг о друге не знают: их связывают только точки SDK и адрес
 * команды `ai.attach`. Порознь каждый покрыт своими тестами; здесь проверяется, что сумма
 * сходится — файлы вносят ресурсы `source:` и `list_source`, ассистент принимает их в набор хода
 * без отказов, а пункт меню «Прикрепить к ассистенту» появляется, хотя файлы активируются РАНЬШЕ
 * ассистента и его команды в момент своей активации не видят.
 *
 * @module plugins/reformer/integration/assistant-contributions.test
 */

import { describe, expect, it, vi } from 'vitest';
import {
  ASSISTANT_ATTACH_COMMAND_ID,
  AssistantResourcePoint,
  AssistantToolPoint,
  MenuPoint,
} from '@reformer/builder-plugin-api/internal';
import { stubHostCapabilities } from '@/application/composer/testing';
import { createCommandRegistry } from '@/shell/platform/primitives/command';
import { createEventBus } from '@/shell/platform/primitives/event';
import { createExtensionRegistry } from '@/shell/platform/primitives/extension-point';
import { createServiceRegistry } from '@/shell/platform/primitives/service';
import { createPluginRegistry } from '@/shell/platform/plugin/registry';
import { createMemoryStorageBackend } from '@/shell/platform/plugin/storage';
import { createContributionSurface } from '../ai/src/session/contributions';
import { createResourceRouter } from '../ai/src/session/resources';
import { createEditorToolRegistry } from '../ai/src/tools';
import { createFileToolRegistry } from '../ai/src/tools/files';
import { reformerApplication } from './application';

/** Собранное приложение над закрытым проектом — как сразу после запуска. */
async function assembled() {
  const services = createServiceRegistry();
  stubHostCapabilities(services);
  const extensions = createExtensionRegistry();
  const commands = createCommandRegistry();
  const plugins = createPluginRegistry({
    services,
    extensions,
    commands,
    events: createEventBus(),
    storage: createMemoryStorageBackend(),
    onError: vi.fn(),
  });
  for (const composed of await reformerApplication().load()) {
    plugins.register(composed.plugin, composed.provides);
  }
  plugins.activateAll();
  return { extensions, commands };
}

describe('вклады плагинов в ассистента', () => {
  it('файлы вносят ресурсы source: и инструмент list_source', async () => {
    const { extensions } = await assembled();

    const resources = extensions.get(AssistantResourcePoint);
    expect(resources.map((c) => [c.pluginId, c.value.scheme])).toContainEqual([
      'reformer.files',
      'source',
    ]);
    const tools = extensions.get(AssistantToolPoint);
    expect(tools.map((c) => [c.pluginId, c.value.name])).toContainEqual([
      'reformer.files',
      'list_source',
    ]);
  });

  it('ассистент принимает их в набор хода обоих режимов без отказов', async () => {
    const { extensions, commands } = await assembled();
    const router = createResourceRouter(() => extensions.get(AssistantResourcePoint));
    const surface = createContributionSurface({
      agentCommands: () => commands.agentCommands(),
      executeCommand: (id, args) => commands.execute(id, args),
      assistantTools: () => extensions.get(AssistantToolPoint),
      hasResources: () => router.schemes().length > 0,
    });

    for (const [mode, builtin] of [
      ['structured', createEditorToolRegistry()],
      ['files', createFileToolRegistry()],
    ] as const) {
      const names = surface
        .registryFor(mode, builtin)
        .list()
        .map((tool) => tool.name);
      expect(names).toEqual(expect.arrayContaining(['read_resource', 'list_source']));
      expect(surface.dropped(mode)).toEqual([]);
    }
    expect(router.schemes()).toEqual(['source']);
    expect(router.catalog()).toContain('source:<path>');
  });

  it('пункт «Прикрепить к ассистенту» есть, хотя файлы активируются раньше ассистента', async () => {
    const { extensions, commands } = await assembled();

    expect(commands.get(ASSISTANT_ATTACH_COMMAND_ID)).toBeDefined();
    expect(extensions.get(MenuPoint).map((c) => c.id)).toContain('files.context.attachToAssistant');
  });
});
