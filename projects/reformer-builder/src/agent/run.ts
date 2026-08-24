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
import { createChangeSet, hasChanges, type ChangeSet } from './core/changeset';
import { runAgentTurn, type TurnEvent, type TurnStats } from './core/loop';
import { loadProviderConfig } from './keys';
import { agentSessionActions, agentSessionStore } from './session';
import type { AiMessage, AiProvider, AiStop } from './providers/types';

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
 * Подсказка для второй попытки после обрыва на недописанном вызове.
 *
 * По-английски и в роли пользователя: инструкции модель устойчивее выполняет на английском (по той
 * же причине, что и системный промпт), но системным сообщением это быть не может — оно неизменно
 * весь ход и кэшируется. Про язык ответа сказано явно: без этой оговорки английская реплика в
 * конце диалога перетягивает ответ на английский, хотя пользователь писал по-русски.
 */
const CONTINUE_HINT =
  'Your previous answer was cut off before any edit was applied. Continue from the current ' +
  'state of the form and do that work now — in SMALL batches, a few nodes per call, and keep ' +
  "the thinking short. Reply in the same language as the user's own messages.";

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

/** Чем кончилась одна попытка: всё, что нужно, чтобы её закрыть или продолжить. */
interface TurnOutcome {
  changeSet: ChangeSet;
  reason: TurnReason;
  message?: string;
  stop?: AiStop;
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
  const controller = new AbortController();
  current = controller;

  try {
    const first = await runTurn(provider, tab.schema, tab.rules, historyFor(), controller.signal);
    const landed = land(first.changeSet);

    // Вторая попытка — только после обрыва на недописанном вызове и только одна: второй обрыв
    // означает, что задача не влезает в окно модели в принципе, и долбиться в него бессмысленно.
    if (!needsSecondPass(first, landed, controller.signal)) {
      closeTurn(first, landed);
      return;
    }

    // База берётся заново: правки первой попытки уже в форме, и второй ход должен идти от них —
    // это ровно то, что делает пользователь, когда пишет «продолжай».
    const next = activeTab(editorStore.getState());
    if (!next || next.kind !== 'form') {
      closeTurn(first, landed);
      return;
    }
    const second = await runTurn(
      provider,
      next.schema,
      next.rules,
      [...historyFor(), { role: 'user', content: CONTINUE_HINT }],
      controller.signal
    );
    closeTurn(second, land(second.changeSet));
  } finally {
    current = null;
  }
}

/**
 * Одна попытка: провести ход и разложить его события по ленте.
 *
 * Отделена от {@link sendMessage} потому, что попыток может быть две, а реплика в ленте у них
 * одна: `startTurn` здесь не вызывается, и вторая попытка дописывает ту же реплику ассистента.
 * Фантомного «продолжай» от имени пользователя в ленте быть не должно — он этого не писал.
 */
async function runTurn(
  provider: AiProvider,
  base: Parameters<typeof runAgentTurn>[0]['base'],
  baseRules: Parameters<typeof runAgentTurn>[0]['baseRules'],
  messages: AiMessage[],
  signal: AbortSignal
): Promise<TurnOutcome> {
  // Пределы хода читаются здесь, а не в канале: это свойства ХОДА, а не соединения с моделью, и
  // владеть ими должен цикл. Настройки лежат рядом с ключом только потому, что там их и задают.
  const { maxSteps, maxInputTokens } = loadProviderConfig() ?? {};
  // Значение по умолчанию на случай, если цикл почему-то не дошёл до `done`: штатно не бывает —
  // `runAgentTurn` выдаёт его даже поверх исключения, — но исход попытки должен быть объектом, а
  // не «объектом или undefined», иначе каждый читатель обязан помнить про этот случай.
  let outcome: TurnOutcome = { changeSet: createChangeSet(base, baseRules), reason: 'complete' };

  for await (const event of runAgentTurn({
    provider,
    registry: toolRegistry(),
    base,
    ...(baseRules ? { baseRules } : {}),
    messages,
    ...(maxSteps !== undefined ? { maxSteps } : {}),
    ...(maxInputTokens !== undefined ? { maxInputTokens } : {}),
    signal,
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
        report(event.stats, event.stop);
        outcome = {
          changeSet: event.changeSet,
          reason: event.reason,
          ...(event.message ? { message: event.message } : {}),
          ...(event.stop ? { stop: event.stop } : {}),
        };
        break;
    }
  }
  return outcome;
}

/**
 * Стоит ли пробовать ещё раз.
 *
 * Условие узкое намеренно: повтор осмыслен ровно там, где модель знала, что делать, и не успела
 * это выговорить, — недописанный вызов и пустой конец хода. Предел шагов, бюджет и фильтр
 * содержимого повтором не лечатся, а остановку кнопкой пользователь заказал сам.
 *
 * Попытка ровно одна, и это по конструкции — второй заход делается без цикла. Обрыв, повторённый
 * дважды, означает, что задача не влезает в окно модели, и третий заход только сожжёт время.
 */
function needsSecondPass(outcome: TurnOutcome, landed: Landing, signal: AbortSignal): boolean {
  if (signal.aborted || outcome.reason === 'aborted') return false;
  if (!outcome.stop?.truncatedCall && !outcome.stop?.emptyFinish) return false;
  // Застрявший набор ждёт решения пользователя: второй ход поверх неприменённых правок собирал бы
  // форму, которой на экране нет.
  return landed.status !== 'stuck';
}

/** Что стало с набором изменений. */
type Landing =
  | { status: 'applied' }
  /** Применять было нечего. */
  | { status: 'nothing' }
  /**
   * Набор остался ждать решения пользователя: конфликт, невалидность или закрытая форма.
   *
   * `note` есть не всегда, и это существенно: замечание переводит реплику в статус ошибки, а
   * конфликт ошибкой не является — это штатная развилка с кнопками «Применить/Отклонить», и
   * объясняет её предпросмотр изменений, а не красная строка.
   */
  | { status: 'stuck'; pending: ChangeSet; conflict: boolean; note?: string };

/**
 * Приземлить правки хода, не закрывая реплику.
 *
 * Отделено от {@link closeTurn} ради второй попытки: между попытками правки обязаны попасть в
 * форму (иначе продолжение пойдёт от старой схемы), а вот статус реплики менять рано — ход ещё
 * идёт, и промежуточное «готово» мигало бы в панели.
 */
function land(changeSet: ChangeSet): Landing {
  if (!hasChanges(changeSet)) return { status: 'nothing' };

  const outcome = applyChangeSet(changeSet);
  if (outcome.status === 'applied') return { status: 'applied' };
  // Конфликт замечания не получает намеренно: набор уходит в предпросмотр с кнопками решения, и
  // это не отказ, а развилка. Красная строка перевела бы реплику в статус ошибки.
  if (outcome.status === 'conflict') return { status: 'stuck', pending: changeSet, conflict: true };
  // Невалидный результат или форма закрыта: правки не применены, и об этом надо сказать прямо —
  // иначе ход выглядит успешным, а форма осталась прежней.
  return {
    status: 'stuck',
    pending: changeSet,
    conflict: false,
    note:
      outcome.status === 'invalid'
        ? `Правки не применены — они сделали бы форму невалидной: ${outcome.errors.slice(0, 2).join('; ')}`
        : 'Правки не применены: форма закрыта.',
  };
}

/**
 * Закрыть ход: перевести реплику в покой, ошибку или ожидание решения.
 *
 * Подтверждать каждый ход кнопкой не нужно — отменить его можно и после: у реплики пользователя
 * есть снимок формы, и «Восстановить» возвращает всё, как было. Это дешевле для внимания: обычный
 * исход не требует решения, а редкий — требует.
 */
function closeTurn(outcome: TurnOutcome, landed: Landing): void {
  const error =
    outcome.reason === 'error' ? (outcome.message ?? 'Ход прервался ошибкой.') : undefined;

  if (landed.status === 'stuck') {
    if (landed.conflict) agentSessionActions.setConflict(true);
    agentSessionActions.finishTurn(landed.pending, error ?? landed.note);
    return;
  }
  if (landed.status === 'nothing') {
    agentSessionActions.finishTurn(null, error ?? silentTurnNote());
    return;
  }
  agentSessionActions.finishTurn(null, error);
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
 *
 * Причина остановки и пик входа печатаются рядом не для полноты: без них тихий обрыв нечем было
 * отличить от законченной работы даже при открытой консоли, а пик — единственная цифра, по которой
 * видно, упёрся ли запрос в окно модели.
 */
function report(stats: TurnStats, stop?: AiStop): void {
  const tokens = stats.inputTokens
    ? `, вход ${stats.inputTokens} (из кэша ${stats.cachedInputTokens}, пик шага ${stats.peakStepInputTokens}), выход ${stats.outputTokens}`
    : '';
  const why = stop?.reason ? `, остановка ${stop.reason}${stop.raw ? ` (${stop.raw})` : ''}` : '';
  const cut = stop?.truncatedCall ? `, оборван вызов ${stop.truncatedCall}` : '';
  console.info(`[agent] ход: шагов ${stats.steps}${tokens}${why}${cut}`);
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
 *
 * Обе ветки называют одну и ту же починку. Раньше подсказку про окно контекста получал только ход
 * БЕЗ вызовов, а ход с вызовами — сухую констатацию: разница выглядела осмысленной, но чинятся эти
 * два исхода одинаково, и молчание во втором случае оставляло пользователя без единой зацепки.
 */
function silentTurnNote(): string | undefined {
  const last = agentSessionStore.getState().entries.at(-1);
  if (!last || last.role !== 'assistant') return undefined;
  if (last.text.trim().length > 0) return undefined;
  const fix =
    'Обычно это значит, что ответ ушёл в рассуждение и оборвался: у локальной модели поможет ' +
    'контекстное окно побольше (num_ctx / OLLAMA_CONTEXT_LENGTH), а задачу стоит разбить на ' +
    'части поменьше.';
  return last.tools.length > 0
    ? `Ассистент вызывал инструменты, но форму не изменил и ничего не ответил. ${fix}`
    : `Ассистент ничего не сделал и не ответил. ${fix}`;
}
