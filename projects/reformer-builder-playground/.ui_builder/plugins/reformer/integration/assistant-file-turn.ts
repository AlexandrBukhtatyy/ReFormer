/**
 * Ход режима файлов без моста — для тестов цикла и замеров: попытка стека ReFormer над модулем
 * формы (`stack/files-mode`), проведённая общим циклом ассистента (`loop/run-turn`).
 *
 * В отличие от хода над черновиком (`./assistant-turn`), после хода не остаётся набора изменений: каждая
 * принятая запись уже лежит в рабочей копии. Итог хода — журнал записанных файлов, по нему
 * ассистент собирает отмену, а стек нормализует схемы.
 *
 * @module plugins/reformer/integration/assistant-file-turn
 */

import type { CatalogEntry } from '../core/catalog';
import type { FileToolContext, FileTurn } from '../ai/src/files/turn';
import type { TurnScope } from '../ai/src/model/types';
import type { ValidateFormSchema } from '../ai/src/model/validate';
import type { AiMessage, AiProvider, AiStop } from '../ai/src/providers/types';
import type { ToolRegistry } from '../ai/src/tools/registry';
import { createFilesTurn } from '../ai/src/stack/files-mode';
import type { TurnStats, TurnStepEvent } from '../ai/src/loop/drive';
import { runTurn, type ActiveForm } from '../ai/src/loop/run-turn';

export { fileSeed } from '../ai/src/stack/seed';

/** Настройки хода. */
export interface FileTurnRunOptions {
  provider: AiProvider;
  registry: ToolRegistry<FileToolContext>;
  /** Попытка хода: модуль, журнал, пометка записей. */
  turn: FileTurn;
  /** Каталог активного кита — словарь имён и материал промпта. */
  catalog: readonly CatalogEntry[];
  /** Проверка по мета-схеме — уже загруженная; на ней стоит гейт записи. */
  validateForm: ValidateFormSchema;
  /** История диалога, включая новое сообщение пользователя. */
  messages: readonly AiMessage[];
  maxSteps?: number;
  maxInputTokens?: number;
  signal?: AbortSignal;
  /** Переопределение системного промпта (тесты). */
  system?: string;
  /** Ход для инструментов плагинов и `read_resource` — см. `ToolContext.turn`. */
  scope?: TurnScope;
  /** Каталог ресурсов плагинов — в хвост затравки; пусто — провайдеров нет. */
  resourceSeed?: string;
  /** Какую форму правит ход — первой строкой затравки, см. `activeFormLines`. */
  activeForm?: ActiveForm;
}

/** Событие хода режима файлов. */
export type FileTurnEvent =
  | TurnStepEvent
  | {
      type: 'done';
      reason: 'complete' | 'aborted' | 'error';
      message?: string;
      stats: TurnStats;
      stop?: AiStop;
      /** Файлы, записанные за ход (обе попытки), — пути от корня модуля. */
      touched: readonly string[];
    };

/**
 * Провести один ход над файлами модуля.
 *
 * @returns Поток событий; последнее — `done` со списком записанных файлов.
 */
export async function* runFileTurn(opts: FileTurnRunOptions): AsyncGenerator<FileTurnEvent> {
  const { turn } = opts;
  for await (const event of runTurn({
    provider: opts.provider,
    registry: opts.registry,
    turn: createFilesTurn(turn, opts.catalog, opts.validateForm, opts.system),
    messages: opts.messages,
    ...(opts.maxSteps === undefined ? {} : { maxSteps: opts.maxSteps }),
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
      reason: event.reason,
      ...(event.message ? { message: event.message } : {}),
      stats: event.stats,
      ...(event.stop ? { stop: event.stop } : {}),
      touched: [...turn.journal.entries().values()].map((entry) => entry.rel),
    };
  }
}
