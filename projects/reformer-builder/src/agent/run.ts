/**
 * Запуск хода агента из интерфейса: связывает панель, активную вкладку и цикл.
 *
 * Единственное место, где ассистент читает `editorStore`. Ядро (`agent/core`) стора не знает —
 * так оно остаётся тестируемым, а правила «что считать текущей формой» живут в одном файле.
 *
 * @module reformer-builder/agent/run
 */

import { activeTab, editorStore } from '../store';
import { createEditorToolRegistry } from './core';
import { hasChanges } from './core/changeset';
import { runAgentTurn } from './core/loop';
import { agentSessionActions, agentSessionStore } from './session';
import type { AiMessage, AiProvider } from './providers/types';

/** Реестр строится один раз: каталог и схемы аргументов статичны в пределах сессии. */
let registry: ReturnType<typeof createEditorToolRegistry> | null = null;

function toolRegistry() {
  return (registry ??= createEditorToolRegistry());
}

/** Сколько последних реплик уходит в модель. Дальше диалог придётся сжимать (вне текущего этапа). */
const HISTORY_LIMIT = 10;

/** История диалога для модели — из уже показанных реплик, чтобы контекст совпадал с видимым. */
function historyFor(): AiMessage[] {
  return agentSessionStore
    .getState()
    .entries.filter((e) => e.text.trim().length > 0)
    .slice(-HISTORY_LIMIT)
    .map((e) => ({ role: e.role, content: e.text }));
}

/** Управление текущим ходом: позволяет остановить его кнопкой. */
let current: AbortController | null = null;

/** Идёт ли ход прямо сейчас. */
export function isTurnRunning(): boolean {
  return current !== null;
}

/** Прервать текущий ход. Уже применённые к черновику правки сохраняются для предпросмотра. */
export function abortTurn(): void {
  current?.abort();
}

/**
 * Провести ход агента по сообщению пользователя.
 *
 * @param text - Сообщение пользователя.
 * @param provider - Канал к модели.
 */
export async function sendMessage(text: string, provider: AiProvider): Promise<void> {
  const message = text.trim();
  if (!message || current) return;

  const tab = activeTab(editorStore.getState());
  if (!tab || tab.kind !== 'form') {
    agentSessionActions.startTurn(message);
    agentSessionActions.finishTurn(
      null,
      'Откройте форму — ассистент правит схему активной вкладки.'
    );
    return;
  }

  agentSessionActions.startTurn(message);
  const messages = historyFor();
  const controller = new AbortController();
  current = controller;

  try {
    for await (const event of runAgentTurn({
      provider,
      registry: toolRegistry(),
      base: tab.schema,
      messages,
      signal: controller.signal,
    })) {
      switch (event.type) {
        case 'text':
          agentSessionActions.appendText(event.text);
          break;
        case 'tool':
          agentSessionActions.logTool({
            name: event.name,
            ok: event.ok,
            ...(event.op ? { summary: event.op.summary } : {}),
            ...(event.error ? { error: event.error.message } : {}),
          });
          break;
        case 'done':
          agentSessionActions.finishTurn(
            hasChanges(event.changeSet) ? event.changeSet : null,
            event.reason === 'error' ? (event.message ?? 'Ход прервался ошибкой.') : undefined
          );
          break;
      }
    }
  } finally {
    current = null;
  }
}
