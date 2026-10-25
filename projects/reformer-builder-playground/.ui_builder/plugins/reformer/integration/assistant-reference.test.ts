/**
 * Справку по библиотеке стека ReFormer заменяет плагин-поставщик — в СОБРАННОМ приложении.
 *
 * Стек и поставщик друг о друге не знают: их связывает только идентификатор возможности
 * `reformer.ai-schema.reference` и форма контракта. Порознь покрыто каждое звено — выбор справки
 * (`ai/src/knowledge/builtin.test.ts`), инструмент (`ai/src/tools/reformer-docs.test.ts`), гейт
 * кода (`ai/src/tools/files/file-tools.test.ts`); здесь проверяется, что сумма сходится: служба,
 * зарегистрированная ЧУЖИМ плагином по своей копии контракта, отвечает за `ask_reformer` стека,
 * а без неё снова отвечает встроенная.
 *
 * @module plugins/reformer/integration/assistant-reference.test
 */

import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import {
  defineCapability,
  definePlugin,
  FormAssistantStackPoint,
  type FormAgentTool,
} from '@reformer/builder-plugin-api';
import { stubHostCapabilities } from '@/application/composer/testing';
import { createCommandRegistry } from '@/shell/platform/primitives/command';
import { createEventBus } from '@/shell/platform/primitives/event';
import { createExtensionRegistry } from '@/shell/platform/primitives/extension-point';
import { createServiceRegistry } from '@/shell/platform/primitives/service';
import { createPluginRegistry } from '@/shell/platform/plugin/registry';
import { createMemoryStorageBackend } from '@/shell/platform/plugin/storage';
import { AI_SCHEMA_PLUGIN_ID, type LibraryReferenceService } from '../ai/src';
import { reformerApplication } from './application';

// ── Копия контракта у поставщика ────────────────────────────────────────────
// Ровно то, что плагин-поставщик держит у себя вместо импорта стека (порядок подключения —
// `projects/reformer-builder/docs/assistant-and-merge.md`, «Своя справка по библиотеке»). Имена
// свои — совпадать обязаны идентификатор и форма.

interface ProviderCodeFinding {
  readonly code: string;
  readonly severity: 'error' | 'warning';
  readonly message: string;
  readonly line?: number;
  readonly suggestion?: string;
}

interface ProviderRequest {
  readonly signal?: AbortSignal;
}

interface ProviderReference {
  ask(
    question: string,
    request: ProviderRequest & { readonly maxChars: number }
  ): Promise<{ readonly text: string } | null>;
  checkCode?(
    code: string,
    request: ProviderRequest & { readonly path?: string }
  ): Promise<{ readonly findings: readonly ProviderCodeFinding[] } | null>;
}

const ProviderReferenceCapability = defineCapability<ProviderReference>({
  id: 'reformer.ai-schema.reference',
  version: '1.0.0',
});

// ─────────────────────────────────────────────────────────────────────────────

/** Идентификатор плагина-поставщика. */
const PROVIDER_ID = 'acme.reference';

const PROVIDER_ANSWER = 'Ответ справки поставщика.';

/** Плагин-поставщик: регистрирует справку по своей копии контракта. */
function providerPlugin(reference: ProviderReference) {
  return definePlugin({
    id: PROVIDER_ID,
    activate(ctx) {
      ctx.subscriptions.push(ctx.services.register(ProviderReferenceCapability, reference));
    },
  });
}

const PROVIDES = [
  { id: ProviderReferenceCapability.id, version: ProviderReferenceCapability.version },
];

/** Собранное приложение над закрытым проектом — как сразу после запуска. */
async function assembled() {
  const services = createServiceRegistry();
  stubHostCapabilities(services);
  const extensions = createExtensionRegistry();
  const plugins = createPluginRegistry({
    services,
    extensions,
    commands: createCommandRegistry(),
    events: createEventBus(),
    storage: createMemoryStorageBackend(),
    onError: vi.fn(),
  });
  for (const composed of await reformerApplication().load()) {
    plugins.register(composed.plugin, composed.provides);
  }
  return { extensions, plugins };
}

/** Спросить `ask_reformer` стека ReFormer — так, как его зовёт ассистент из набора хода. */
async function ask(extensions: ReturnType<typeof createExtensionRegistry>): Promise<string> {
  const stack = extensions
    .get(FormAssistantStackPoint)
    .find((contribution) => contribution.pluginId === AI_SCHEMA_PLUGIN_ID)?.value;
  if (stack === undefined) throw new Error('стек ReFormer не внёс себя в точку стеков');
  const session = stack.connect({ documentOf: () => null, writeText: () => Promise.resolve() });
  const tool = session.structured.tools.find(
    (slot): slot is FormAgentTool<never, never> =>
      typeof slot !== 'string' && slot.name === 'ask_reformer'
  );
  if (tool === undefined) throw new Error('в наборе стека нет ask_reformer');
  const outcome = await tool.run(
    { question: 'как объявить вычисляемое поле' } as never,
    {} as never
  );
  return outcome.text;
}

describe('справка стека ReFormer — заменяемая', () => {
  it('копия контракта у поставщика совпадает с контрактом стека', () => {
    expectTypeOf<ProviderReference>().toEqualTypeOf<LibraryReferenceService>();
    expect(ProviderReferenceCapability.id).toBe('reformer.ai-schema.reference');
  });

  it('поставщик, поднятый вместе со всеми, отвечает за ask_reformer', async () => {
    const { extensions, plugins } = await assembled();
    const provided = vi.fn(() => Promise.resolve({ text: PROVIDER_ANSWER }));
    plugins.register(providerPlugin({ ask: provided }), PROVIDES);
    plugins.activateAll();

    expect(await ask(extensions)).toBe(PROVIDER_ANSWER);
    expect(provided).toHaveBeenCalledOnce();
  });

  it('поставщик, поднятый ПОСЛЕ стека, тоже подхватывается, а снятый — уступает встроенной', async () => {
    const { extensions, plugins } = await assembled();
    plugins.activateAll();

    plugins.register(
      providerPlugin({ ask: () => Promise.resolve({ text: PROVIDER_ANSWER }) }),
      PROVIDES
    );
    expect(plugins.activate(PROVIDER_ID)).toBe(true);
    expect(await ask(extensions)).toBe(PROVIDER_ANSWER);

    // Встроенная справка отвечает своим корпусом либо, если он не собран, словами «недоступно» —
    // в любом случае не текстом поставщика.
    plugins.deactivate(PROVIDER_ID);
    expect(await ask(extensions)).not.toBe(PROVIDER_ANSWER);
  });
});
