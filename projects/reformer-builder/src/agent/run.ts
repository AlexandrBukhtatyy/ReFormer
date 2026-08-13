/**
 * Запуск хода агента из интерфейса: связывает панель, активную вкладку и цикл.
 *
 * Единственное место, где ассистент читает `editorStore`. Ядро (`agent/core`) стора не знает —
 * так оно остаётся тестируемым, а правила «что считать текущей формой» живут в одном файле.
 *
 * @module reformer-builder/agent/run
 */

import { activeTab, editorStore } from '../store';
import { applyChangeSet } from './apply';
import { createEditorToolRegistry } from './core';
import { hasChanges, type ChangeSet } from './core/changeset';
import { runAgentTurn, type TurnEvent } from './core/loop';
import { agentSessionActions, agentSessionStore } from './session';
import type { AiMessage, AiProvider } from './providers/types';

/** Исход хода, каким его сообщает цикл. */
type TurnReason = Extract<TurnEvent, { type: 'done' }>['reason'];

/** Реестр строится один раз: каталог и схемы аргументов статичны в пределах сессии. */
let registry: ReturnType<typeof createEditorToolRegistry> | null = null;

function toolRegistry() {
  return (registry ??= createEditorToolRegistry());
}

/** Сколько последних реплик уходит в модель. Дальше диалог придётся сжимать (вне текущего этапа). */
const HISTORY_LIMIT = 10;

/**
 * Сколько вызовов инструментов перечислять в сводке молчаливого хода. Сводка нужна как напоминание
 * «что уже сделано», а не как полный журнал: он и так виден в панели.
 */
const TOOLS_IN_SUMMARY = 12;

/**
 * Реплика ассистента для модели. Ход, в котором модель не сказала ни слова, а только звала
 * инструменты, — не пустой: он изменил форму. Такие ходы бывают у моделей, которые в tool-режиме
 * молчат до последнего шага, и обрываются на пределе шагов, так и не дойдя до текста. Если отдать
 * их как пустоту, следующий ход не знает, что уже сделано, и начинает форму заново.
 */
function assistantContent(entry: {
  text: string;
  tools: readonly { name: string; summary?: string }[];
}): string {
  if (entry.text.trim().length > 0) return entry.text;
  const done = entry.tools
    .slice(0, TOOLS_IN_SUMMARY)
    .map((t) => t.summary ?? t.name)
    .join('; ');
  const rest = entry.tools.length - Math.min(entry.tools.length, TOOLS_IN_SUMMARY);
  return `(без комментария; сделано: ${done}${rest > 0 ? ` и ещё ${rest}` : ''})`;
}

/** История диалога для модели — из уже показанных реплик, чтобы контекст совпадал с видимым. */
function historyFor(): AiMessage[] {
  return agentSessionStore
    .getState()
    .entries.filter((e) => e.text.trim().length > 0 || e.tools.length > 0)
    .slice(-HISTORY_LIMIT)
    .map((e) => ({
      role: e.role,
      content: e.role === 'assistant' ? assistantContent(e) : e.text,
    }));
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

  // Снимок берётся ДО хода: он же станет точкой восстановления на реплике пользователя.
  agentSessionActions.startTurn(message, tab.schema);
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
        case 'reasoning':
          agentSessionActions.appendReasoning(event.text);
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
          finish(event.changeSet, event.reason, event.message);
          break;
      }
    }
  } finally {
    current = null;
  }
}

/**
 * Завершить ход: правки уходят в форму сразу.
 *
 * Подтверждать каждый ход кнопкой не нужно — отменить его можно и после: у реплики пользователя
 * есть снимок формы, и «Восстановить» возвращает всё, как было. Это дешевле для внимания: обычный
 * исход не требует решения, а редкий — требует.
 *
 * Исключение — конфликт: форму правили руками, пока шёл ход. Молча перезаписать чужую правку
 * нельзя, а потерять работу ассистента жалко, поэтому такой набор изменений остаётся ждать
 * решения — единственный случай, когда кнопка появляется.
 */
function finish(changeSet: ChangeSet, reason: TurnReason, message?: string): void {
  const error = reason === 'error' ? (message ?? 'Ход прервался ошибкой.') : undefined;
  if (!hasChanges(changeSet)) {
    agentSessionActions.finishTurn(null, error);
    return;
  }

  const outcome = applyChangeSet(changeSet);
  if (outcome.status === 'applied') {
    agentSessionActions.finishTurn(null, error);
    return;
  }
  if (outcome.status === 'conflict') {
    agentSessionActions.setConflict(true);
    agentSessionActions.finishTurn(changeSet, error);
    return;
  }
  // Невалидный результат или форма закрыта: правки не применены, и об этом надо сказать прямо —
  // иначе ход выглядит успешным, а форма осталась прежней.
  agentSessionActions.finishTurn(
    changeSet,
    error ??
      (outcome.status === 'invalid'
        ? `Правки не применены — они сделали бы форму невалидной: ${outcome.errors.slice(0, 2).join('; ')}`
        : 'Правки не применены: форма закрыта.')
  );
}
