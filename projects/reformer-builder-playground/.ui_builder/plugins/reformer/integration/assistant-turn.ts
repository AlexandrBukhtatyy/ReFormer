/**
 * Ход агента над схемой без моста — для тестов цикла и замеров: попытка стека ReFormer
 * (`stack/structured`), проведённая общим циклом ассистента (`loop/run-turn`), и набор изменений на
 * выходе. Живёт в интеграции: стек и ассистент — разные плагины, а ход собирает обе стороны.
 *
 * Цикл не трогает рабочую область. Он работает над копией схемы и возвращает {@link ChangeSet};
 * решение применить принимает пользователь, а применение — одна запись в буфер.
 *
 * @module plugins/reformer/integration/assistant-turn
 */

import type { JsonFormSchema } from '@reformer/renderer-json';
import type { CatalogEntry } from '../core/catalog';
import type { FormRules } from '../core/form-model';
import type { AiMessage, AiProvider, AiStop } from '../../forms/ai/src/providers/types';
import type { ChangeSet } from '../ai/src/model/changeset';
import type { TurnStats, TurnStepEvent } from '../../forms/ai/src/loop/drive';
import type { ToolRegistry } from '../ai/src/tools/registry';
import type { ValidateFormSchema } from '../ai/src/model/validate';
import type { TurnScope } from '../ai/src/model/types';
import { createSchemaTurn } from '../ai/src/stack/structured';
import { runTurn, type ActiveForm } from '../../forms/ai/src/loop/run-turn';

export type { TurnStats } from '../../forms/ai/src/loop/drive';
export { activeFormLines, type ActiveForm } from '../../forms/ai/src/loop/run-turn';

/**
 * Предел шагов «модель → инструмент → модель» за один ход — по умолчанию его НЕТ.
 *
 * Предел, выставленный «на всякий случай», обрывал работу на середине формы: мастер из трёх шагов
 * по шесть полей стоит поштучно около двадцати двух вызовов, и любое круглое число вроде двадцати
 * четырёх модель перебирала впритык. Недоделанная форма при этом выглядела как результат.
 *
 * Ход и без предела не бесконечен: его останавливают кнопка «Остановить» и таймаут потока. Задать
 * предел по-прежнему можно — через {@link AgentTurnOptions.maxSteps}.
 */
export const DEFAULT_MAX_STEPS = undefined;

/** Настройки хода. */
export interface AgentTurnOptions {
  provider: AiProvider;
  registry: ToolRegistry;
  /**
   * Каталог активного кита: словарь имён для инструментов и материал системного промпта.
   *
   * Входом хода, а не синглтоном модуля: кит переключают, и ход обязан идти против того каталога,
   * который действует СЕЙЧАС. См. `ToolContext.catalog`.
   */
  catalog: readonly CatalogEntry[];
  /**
   * Проверка по мета-схеме form-DSL — она уходит в `ToolContext` каждого вызова.
   *
   * Уже ЗАГРУЖЕННАЯ функция, а не заказ на загрузку: ход синхронен по инструментам, и ждать
   * сеть внутри вызова означало бы задерживать каждый шаг.
   */
  validateForm: ValidateFormSchema;
  /** Схема открытого документа на начало хода. */
  base: JsonFormSchema;
  /** Правила вкладки на начало хода — см. `SchemaTurnOptions.rules`. */
  baseRules?: FormRules;
  /** История диалога, включая новое сообщение пользователя. */
  messages: readonly AiMessage[];
  /** Предел шагов; по умолчанию его нет — см. {@link DEFAULT_MAX_STEPS}. */
  maxSteps?: number;
  /** Потолок входных токенов на ход; по умолчанию его нет. */
  maxInputTokens?: number;
  signal?: AbortSignal;
  /** Переопределение системного промпта (тесты). */
  system?: string;
  /** Ход для инструментов плагинов и `read_resource` — см. `ToolContext.turn`. */
  scope?: TurnScope;
  /** Каталог ресурсов плагинов — в ту же затравку, что карта формы; пусто — провайдеров нет. */
  resourceSeed?: string;
  /** Какую форму правит ход — первой строкой затравки, см. `activeFormLines`. */
  activeForm?: ActiveForm;
}

/** Событие хода для интерфейса. */
export type TurnEvent =
  | TurnStepEvent
  | {
      type: 'done';
      changeSet: ChangeSet;
      reason: 'complete' | 'aborted' | 'error';
      message?: string;
      stats: TurnStats;
      /** Чем кончился ход у канала: для журнала и для решения, стоит ли пробовать ещё раз. */
      stop?: AiStop;
    };

/**
 * Провести один ход агента.
 *
 * Инструменты исполняются здесь, а не в SDK провайдера: только так правки попадают в набор
 * изменений и проходят гейт качества.
 *
 * @returns Поток событий; последнее — `done` с накопленным {@link ChangeSet}.
 */
export async function* runAgentTurn(opts: AgentTurnOptions): AsyncGenerator<TurnEvent> {
  const turn = createSchemaTurn({
    base: opts.base,
    ...(opts.baseRules === undefined ? {} : { rules: opts.baseRules }),
    catalog: opts.catalog,
    validateForm: opts.validateForm,
    ...(opts.system === undefined ? {} : { system: opts.system }),
  });
  const maxSteps = opts.maxSteps ?? DEFAULT_MAX_STEPS;

  for await (const event of runTurn({
    provider: opts.provider,
    registry: opts.registry,
    turn,
    messages: opts.messages,
    ...(maxSteps === undefined ? {} : { maxSteps }),
    ...(opts.maxInputTokens === undefined ? {} : { maxInputTokens: opts.maxInputTokens }),
    ...(opts.signal === undefined ? {} : { signal: opts.signal }),
    ...(opts.scope === undefined ? {} : { scope: opts.scope }),
    ...(opts.resourceSeed === undefined ? {} : { resourceSeed: opts.resourceSeed }),
    ...(opts.activeForm === undefined ? {} : { activeForm: opts.activeForm }),
  })) {
    if (event.type !== 'end') {
      yield event;
      continue;
    }
    yield {
      type: 'done',
      changeSet: turn.result(),
      reason: event.reason,
      ...(event.message ? { message: event.message } : {}),
      stats: event.stats,
      ...(event.stop ? { stop: event.stop } : {}),
    };
  }
}
