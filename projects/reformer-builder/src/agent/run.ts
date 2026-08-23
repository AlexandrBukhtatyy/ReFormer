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
import { runAgentTurn, type TurnEvent, type TurnStats } from './core/loop';
import { loadProviderConfig } from './keys';
import { agentSessionActions, agentSessionStore } from './session';
import type { AiMessage, AiProvider } from './providers/types';

/** Исход хода, каким его сообщает цикл. */
type TurnReason = Extract<TurnEvent, { type: 'done' }>['reason'];

/** Реестр строится один раз: каталог и схемы аргументов статичны в пределах сессии. */
let registry: ReturnType<typeof createEditorToolRegistry> | null = null;

function toolRegistry() {
  return (registry ??= createEditorToolRegistry());
}

/**
 * Сколько символов истории уходит в модель.
 *
 * Бюджет в символах, а не счёт реплик: длина реплики не ограничена ничем, и десять реплик — это и
 * пара килобайт, и пара десятков. Считать надо то, за что платим, а платим за объём.
 */
const HISTORY_BUDGET = 6000;

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
  const all = agentSessionStore
    .getState()
    .entries.filter((e) => e.text.trim().length > 0 || e.tools.length > 0)
    .map((e) => ({
      role: e.role,
      content: e.role === 'assistant' ? assistantContent(e) : e.text,
    }));

  // Набираем с конца: свежие реплики нужнее старых, а обрезать надо по началу диалога.
  const kept: AiMessage[] = [];
  let spent = 0;
  for (let i = all.length - 1; i >= 0; i--) {
    spent += all[i].content.length;
    // Последняя реплика проходит всегда: это сообщение, на которое агент и отвечает.
    if (spent > HISTORY_BUDGET && kept.length) break;
    kept.unshift(all[i]);
  }
  return kept;
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
  // Пределы хода читаются здесь, а не в канале: это свойства ХОДА, а не соединения с моделью, и
  // владеть ими должен цикл. Настройки лежат рядом с ключом только потому, что там их и задают.
  const { maxSteps, maxInputTokens } = loadProviderConfig() ?? {};
  const controller = new AbortController();
  current = controller;

  try {
    for await (const event of runAgentTurn({
      provider,
      registry: toolRegistry(),
      base: tab.schema,
      baseRules: tab.rules,
      messages,
      ...(maxSteps !== undefined ? { maxSteps } : {}),
      ...(maxInputTokens !== undefined ? { maxInputTokens } : {}),
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
            // Журнал панели — строка на ВЫЗОВ, а не на правку: пакетная вставка двенадцати полей
            // не должна превращать ленту в двенадцать одинаковых записей. Детали пакета видны в
            // предпросмотре изменений, где им и место.
            ...(event.ops?.length ? { summary: summaryOf(event.ops) } : {}),
            ...(event.error ? { error: event.error.message } : {}),
          });
          break;
        case 'done':
          report(event.stats);
          finish(event.changeSet, event.reason, event.message);
          break;
      }
    }
  } finally {
    current = null;
  }
}

/** Сколько правок пакета называть в журнале, прежде чем свернуть остаток в счёт. */
const OPS_IN_LOG = 3;

/** Одна строка журнала для вызова, принёсшего несколько правок. */
function summaryOf(ops: readonly { summary: string }[]): string {
  const shown = ops.slice(0, OPS_IN_LOG).map((o) => o.summary);
  const rest = ops.length - shown.length;
  return `${shown.join('; ')}${rest > 0 ? ` и ещё ${rest}` : ''}`;
}

/**
 * Напечатать, чего стоил ход.
 *
 * В консоль, а не в панель: цена хода — материал для того, кто настраивает агента, а пользователю
 * формы она ничего не говорит и только шумит в ленте. Шаги печатаются всегда, токены — только если
 * провайдер их сообщил (локальные серверы часто молчат, и «0 токенов» читалось бы как поломка).
 */
function report(stats: TurnStats): void {
  const tokens = stats.inputTokens
    ? `, вход ${stats.inputTokens} (из кэша ${stats.cachedInputTokens}), выход ${stats.outputTokens}`
    : '';
  console.info(`[agent] ход: шагов ${stats.steps}${tokens}`);
}

/**
 * Замечание к ходу, который не изменил форму и ничего не сказал.
 *
 * Такой ход выглядит как зависание: лента пуста, форма прежняя, ошибки нет. Наблюдалось вживую —
 * модель тратила весь вывод на рассуждение и обрывалась, не дойдя до первого вызова инструмента,
 * а пользователь видел ровно ничего.
 *
 * Ход, в котором модель ОТВЕТИЛА текстом, замечания не получает: «покажи, что в форме» — законный
 * вопрос, и форму он менять не обязан.
 */
function silentTurnNote(): string | undefined {
  const last = agentSessionStore.getState().entries.at(-1);
  if (!last || last.role !== 'assistant') return undefined;
  if (last.text.trim().length > 0) return undefined;
  return last.tools.length > 0
    ? 'Ассистент вызывал инструменты, но форму не изменил и ничего не ответил.'
    : 'Ассистент ничего не сделал и не ответил. Обычно это значит, что весь ответ ушёл в ' +
        'рассуждение: у локальной модели поможет контекстное окно побольше (num_ctx / ' +
        'OLLAMA_CONTEXT_LENGTH), а задачу стоит разбить на части поменьше.';
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
    agentSessionActions.finishTurn(null, error ?? silentTurnNote());
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
