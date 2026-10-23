/**
 * Мост без стека ReFormer: то, что ассистент обязан уметь сам, какой бы стек форм ни стоял.
 *
 * Сценарии хода над формой ReFormer — в интеграции (`reformer/integration/assistant-bridge.test`):
 * там мост собран с настоящим стеком. Здесь — исходы, которые от стека не зависят.
 *
 * @module plugins/forms/ai/session/bridge.test
 */

import { describe, expect, it } from 'vitest';
import type { DocumentRef, FormAssistantStack } from '@reformer/builder-plugin-api';
import { createAgentBridge } from './bridge';
import type { AiAssistant } from '../plugin';
import { createFakeProvider } from '../providers/fake';
import { createProviderRegistry } from '../providers/registry';
import { createAiSession } from './session';
import { createFakeHost } from '../testing';

/** Мост с каналом к модели и заданными стеками. */
function harness(stacks: readonly FormAssistantStack[]) {
  const host = createFakeHost();
  const providers = createProviderRegistry();
  providers.register(createFakeProvider([{ text: 'Готово.' }]));
  const assistant: AiAssistant = {
    providers,
    loadConfig: () => Promise.resolve({ kind: 'anthropic' as const }),
    saveConfig: () => Promise.resolve(),
    clearConfig: () => Promise.resolve(),
    models: () => Promise.resolve([]),
    activate: () => Promise.reject(new Error('не нужно в тесте')),
    restore: () => Promise.resolve(null),
  };
  const session = createAiSession();
  const bridge = createAgentBridge({
    assistant,
    host,
    session,
    agentCommands: () => [],
    executeCommand: () => Promise.resolve(undefined),
    stacks: () => stacks,
  });
  return { host, session, bridge };
}

/** Стек, который берётся только за документы своего провайдера, а сеанс не открывает. */
function foreignStack(providerId: string, applied: DocumentRef[]): FormAssistantStack {
  return {
    id: 'test.foreign',
    applies: (document) => {
      applied.push(document);
      return document.providerId === providerId;
    },
    connect: () => {
      throw new Error('за чужой документ стек не подключают');
    },
  };
}

describe('мост без стека форм', () => {
  it('стеков нет — ход отвечает словами, что править нечем', async () => {
    const { host, session, bridge } = harness([]);
    host.openDocument('form.json', '{}');

    await bridge.send('добавь поле');

    expect(session.get().status).toBe('error');
    expect(session.get().error).toBe('turn.noStack');
    expect(host.writes).toEqual([]);
  });

  it('документ не взят ни одним стеком — «откройте форму», стек не подключается', async () => {
    const applied: DocumentRef[] = [];
    const { host, session, bridge } = harness([foreignStack('rjsf.form', applied)]);
    host.openDocument('notes.md', '# заметки');

    await bridge.send('добавь поле');

    expect(session.get().error).toBe('turn.noForm');
    // Документ, открытый текстом, провайдера не имеет: стек спрашивают по нему.
    expect(applied.map((document) => [document.id, document.kind])).toContainEqual([
      'notes.md',
      'text',
    ]);
  });

  it('подпись «Правит: …» без стека пуста: форму узнаёт только стек', () => {
    const { host, bridge } = harness([]);
    host.openDocument('form.json', '{}');

    expect(bridge.activeForm()).toBeNull();
  });
});
