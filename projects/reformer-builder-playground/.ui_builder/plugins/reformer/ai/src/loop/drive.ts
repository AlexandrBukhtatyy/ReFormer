/**
 * Привод хода: то, что одинаково у хода над черновиком схемы и у хода над файлами модуля.
 *
 * Ход любого режима — это поток провайдера плюс исполнение инструментов на стороне редактора.
 * Различаются они только тем, ЧТО правят инструменты и что остаётся после хода: черновик схемы
 * (`./loop`) или записи в рабочую копию (`./file-loop`). Очередь вызовов и разбор потока
 * провайдера в события панели от режима не зависят, и живут поэтому здесь — одной копией,
 * а не двумя, которые разошлись бы на первом же уроке живых прогонов.
 *
 * @module plugins/reformer/ai/loop/drive
 */

import type { ToolRegistry } from '@reformer/builder-toolkit';
import type {
  FormChangeOp,
  FormToolContext,
  FormToolError,
  FormToolOutcome,
} from '@reformer/builder-plugin-api';
import type { AiProvider, AiRequest, AiStop, AiToolDef, AiUsage } from '../providers/types';

/**
 * Чего стоил ход.
 *
 * Считается всегда, а не под флагом: цена хода — это число шагов, помноженное на размер контекста,
 * и обе величины растут молча. Без счётчика единственный сигнал «стало дороже» — счёт провайдера
 * или подвисшая панель, то есть обратная связь длиной в сутки.
 */
export interface TurnStats {
  /** Шагов «модель → инструмент → модель». */
  steps: number;
  inputTokens: number;
  /** Из них прочитано из кэша префикса. Ноль при работающем кэше — сигнал, что он не попадает. */
  cachedInputTokens: number;
  outputTokens: number;
  /**
   * Самый дорогой по входу шаг хода.
   *
   * Отдельно от суммы потому, что об окне модели говорит только пик: сумма растёт с каждым шагом и
   * у длинного исправного хода легко вдесятеро больше окна, а упирается запрос в окно ровно тем,
   * сколько весит ОДИН шаг. Это единственная цифра, по которой видно, хватает ли `num_ctx`.
   */
  peakStepInputTokens: number;
}

/** Событие хода, общее для обоих режимов: всё, кроме итога. */
export type TurnStepEvent =
  /** `start` — первый кусок нового блока ответа: см. `AiEvent`. */
  | { type: 'text'; text: string; start?: true }
  /** Рассуждение модели: показывается свёрнутым и в историю диалога не возвращается. */
  | { type: 'reasoning'; text: string; start?: true }
  | {
      type: 'tool';
      name: string;
      ok: boolean;
      ops?: readonly FormChangeOp[];
      error?: FormToolError;
      /** Инструмент только читает — его отказ форму не задевает. */
      readOnly?: true;
    };

/** Признак начала блока — дальше, только если он есть. */
const startOf = (event: { readonly start?: true }): { start?: true } =>
  event.start ? { start: true } : {};

/** Чем кончился поток провайдера — итог, который режим дополняет своим результатом. */
export interface StreamEnd {
  type: 'end';
  reason: 'complete' | 'aborted' | 'error';
  message?: string;
  stats: TurnStats;
  /** Чем кончился ход у канала: для журнала и для решения, стоит ли пробовать ещё раз. */
  stop?: AiStop;
}

/**
 * Инструменты для провайдера, исполняемые СТРОГО ПО ОЧЕРЕДИ.
 *
 * Вызовы ОДНОГО шага модель присылает пачкой, и SDK запускает их параллельно, не дожидаясь
 * предыдущего. Состояние хода при этом одно: без очереди каждый вызов читал его ДО того, как
 * предыдущий записал результат, и последний ответ затирал все остальные — «двенадцать полей в
 * три шага» превращались в мастер, где поля есть только на последнем шаге, причём журнал
 * изменений исправно перечислял все двенадцать. У файлового режима та же беда: две правки
 * одного файла читали бы один и тот же исходный текст.
 *
 * Очередь, а не блокировка на время всего шага: инструменты считают локально, без сети, поэтому
 * выстроить их в цепочку не стоит ничего, а промпт обещает модели ровно это — «правки идут по
 * порядку против формы, которая уже меняется».
 *
 * @param contextOf - Контекст вызова. Зовётся ВНУТРИ очереди — то есть после того, как предыдущий
 *   вызов записал свой результат: каждый следующий инструмент видит правку предыдущего.
 * @param after - Учесть исход вызова — тоже внутри очереди, до следующего вызова.
 */
export function queuedTools<C extends FormToolContext>(
  registry: ToolRegistry<C, FormToolOutcome>,
  contextOf: () => C,
  after?: (outcome: FormToolOutcome) => void
): AiToolDef[] {
  let queue: Promise<unknown> = Promise.resolve();
  return registry.list().map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
    readOnly: tool.readOnly,
    ...(tool.interactive === true ? { interactive: true } : {}),
    execute: (args) => {
      const started = queue.then(async () => {
        const outcome = await registry.invoke(tool.name, args, contextOf());
        after?.(outcome);
        return outcome;
      });
      // Хвост очереди не должен нести отказ: `invoke` не бросает, но отклонённый промис здесь
      // остановил бы все последующие вызовы хода.
      queue = started.catch(() => undefined);
      return started;
    },
  }));
}

/**
 * Провести поток провайдера и разложить его на события панели.
 *
 * Последнее событие — всегда `end`, даже поверх исключения канала: исход хода должен быть
 * объектом, а не «объектом или ничем», иначе каждый читатель обязан помнить про этот случай.
 */
export async function* streamTurn(
  provider: AiProvider,
  request: AiRequest,
  signal?: AbortSignal
): AsyncGenerator<TurnStepEvent | StreamEnd> {
  let reason: StreamEnd['reason'] = 'complete';
  let message: string | undefined;
  let stop: AiStop | undefined;
  const stats: TurnStats = {
    steps: 0,
    inputTokens: 0,
    cachedInputTokens: 0,
    outputTokens: 0,
    peakStepInputTokens: 0,
  };
  // Имя вызова известно из `tool_call`, а показать его нужно на `tool_result`. Карта живёт в
  // пределах хода: на уровне модуля два параллельных хода затирали бы записи друг друга.
  const callNames = new Map<string, string>();
  const readOnly = new Set(request.tools.filter((tool) => tool.readOnly).map((tool) => tool.name));

  try {
    for await (const event of provider.stream(request, signal)) {
      switch (event.type) {
        case 'delta':
          if (event.text) yield { type: 'text', text: event.text, ...startOf(event) };
          break;
        case 'reasoning':
          if (event.text) yield { type: 'reasoning', text: event.text, ...startOf(event) };
          break;
        case 'tool_result': {
          const name = callNames.get(event.id) ?? 'tool';
          yield {
            type: 'tool',
            name,
            ok: event.result.ok,
            ...(event.result.ops?.length ? { ops: event.result.ops } : {}),
            ...(event.result.error ? { error: event.result.error } : {}),
            ...(readOnly.has(name) ? { readOnly: true as const } : {}),
          };
          break;
        }
        case 'step_usage':
          addUsage(stats, event.usage);
          break;
        case 'error':
          reason = 'error';
          message = event.message;
          break;
        case 'done':
          if (event.reason !== 'complete') reason = event.reason;
          // Диагностика берётся даже у штатного завершения: именно там она и нужна — обрыв,
          // который канал не назвал обрывом, выглядит отсюда обычным концом хода.
          if (event.stop) stop = event.stop;
          break;
        // tool_call самостоятельного смысла для интерфейса не несёт: показывать нечего до
        // результата, а «вызывается…» без исхода только мигает в панели.
        case 'tool_call':
          callNames.set(event.id, event.name);
          break;
      }
    }
  } catch (e) {
    reason = 'error';
    message = e instanceof Error ? e.message : String(e);
  }

  yield {
    type: 'end',
    reason,
    ...(message ? { message } : {}),
    stats,
    ...(stop ? { stop } : {}),
  };
}

/**
 * Прибавить расход шага.
 *
 * Шаг считается по самому событию, а не по наличию цифр в нём: провайдер, не сообщающий usage,
 * всё равно сделал запрос, и терять его в счётчике значило бы отчитываться «ноль шагов» там, где
 * их было двадцать.
 */
function addUsage(stats: TurnStats, usage: AiUsage): void {
  stats.steps += 1;
  stats.inputTokens += usage.inputTokens ?? 0;
  stats.cachedInputTokens += usage.cachedInputTokens ?? 0;
  stats.outputTokens += usage.outputTokens ?? 0;
  stats.peakStepInputTokens = Math.max(stats.peakStepInputTokens, usage.inputTokens ?? 0);
}
