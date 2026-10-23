/**
 * Попытка хода любого стека: поток модели, очередь вызовов и затравка.
 *
 * Что видит модель — промпт, затравку формы, контекст инструментов — даёт попытка стека
 * (`FormTurn`); ассистент кладёт рядом то, что от стека не зависит: какая форма активна и какие
 * ресурсы плагинов есть. Порядок затравки один для всех стеков и режимов: активная форма, данные
 * формы, ресурсы.
 *
 * @module plugins/reformer/ai/loop/run-turn
 */

import type {
  FormToolContext,
  FormToolOutcome,
  FormTurn,
  FormTurnScope,
} from '@reformer/builder-plugin-api';
import type { ToolRegistry } from '@reformer/builder-toolkit';
import type { AiMessage, AiProvider } from '../providers/types';
import { queuedTools, streamTurn, type StreamEnd, type TurnStepEvent } from './drive';

/** Форма хода: что сказать модели о том, какую форму она правит. */
export interface ActiveForm {
  /** Путь документа формы от корня проекта. */
  readonly path: string;
  /** Путь формы прошлого хода — если с тех пор пользователь переключился на другую. */
  readonly previousPath?: string;
}

/**
 * Строки затравки об активной форме — общие для всех стеков и режимов.
 *
 * История диалога общая на все формы, а ход правит форму активной вкладки. Без этих строк модель,
 * которой пользователь между ходами открыл другую форму, продолжала прошлую: била по адресам узлов
 * или путям файлов той формы, получала отказы и отвечала «готово» — форма на экране не менялась.
 */
export function activeFormLines(form: ActiveForm): string {
  const lines = [`Active form: ${form.path}`];
  if (form.previousPath !== undefined && form.previousPath !== form.path) {
    lines.push(
      `The user switched to this form from ${form.previousPath}. Earlier messages are about ` +
        'that form: node addresses and file paths from them do not apply here.'
    );
  }
  return lines.join('\n');
}

/** Настройки попытки. */
export interface RunTurnOptions {
  readonly provider: AiProvider;
  /** Инструменты попытки — режима стека вместе с вкладами плагинов. */
  readonly registry: ToolRegistry<FormToolContext, FormToolOutcome>;
  /** Попытка стека: промпт, затравка формы, контекст инструментов. */
  readonly turn: FormTurn;
  /** История диалога, включая новое сообщение пользователя. */
  readonly messages: readonly AiMessage[];
  /** Предел шагов; по умолчанию его нет. */
  readonly maxSteps?: number;
  /** Потолок входных токенов на ход; по умолчанию его нет. */
  readonly maxInputTokens?: number;
  readonly signal?: AbortSignal;
  /** Ход для инструментов ассистента и плагинов — `FormToolContext.turn`. */
  readonly scope?: FormTurnScope;
  /** Каталог ресурсов плагинов — в хвост затравки; пусто — провайдеров нет. */
  readonly resourceSeed?: string;
  /** Какую форму правит ход — первой строкой затравки. */
  readonly activeForm?: ActiveForm;
}

/**
 * Провести одну попытку хода.
 *
 * Затравка — сообщением пользователя в хвосте диалога, а не системным: содержимое формы — данные
 * пользователя, а промпт обещает, что инструкции приходят только из него и из реплик человека.
 * В хвосте всё, что выше, остаётся неизменным и потому кэшируемым префиксом. Пустая затравка
 * сообщения не даёт.
 *
 * @returns Поток событий; последнее — `end`, даже поверх исключения канала.
 */
export async function* runTurn(opts: RunTurnOptions): AsyncGenerator<TurnStepEvent | StreamEnd> {
  const { turn } = opts;
  // Контекст читается внутри очереди привода, а исход учитывается там же — до следующего вызова.
  const tools = queuedTools(
    opts.registry,
    () => ({ ...turn.context(), ...(opts.scope ? { turn: opts.scope } : {}) }),
    turn.accept === undefined ? undefined : (outcome) => turn.accept?.(outcome)
  );
  const seed = [
    opts.activeForm ? activeFormLines(opts.activeForm) : '',
    await turn.seed(),
    opts.resourceSeed ?? '',
  ]
    .filter(Boolean)
    .join('\n\n');
  yield* streamTurn(
    opts.provider,
    {
      system: turn.system(),
      messages: seed === '' ? opts.messages : [...opts.messages, { role: 'user', content: seed }],
      tools,
      ...(opts.maxSteps !== undefined ? { maxSteps: opts.maxSteps } : {}),
      ...(opts.maxInputTokens !== undefined ? { maxInputTokens: opts.maxInputTokens } : {}),
    },
    opts.signal
  );
}
