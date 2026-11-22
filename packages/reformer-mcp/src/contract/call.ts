/**
 * Наблюдение за вызовами сервера: что вызвали, сколько ждали, чем кончилось.
 *
 * Им пользуются обе стороны: сервер — для журнала и учёта вызовов, клиент — для того же журнала
 * (`REFORMER_TRACE_FILE`) на своей стороне.
 *
 * @module @reformer/mcp/contract/call
 */

/** Завершившийся вызов сервера: инструмент, ресурс или промпт. */
export interface ReformerServerCall {
  readonly kind: 'tool' | 'resource' | 'prompt';
  readonly name: string;
  readonly arguments: unknown;
  /** Размер ответа, как его увидит клиент. У вызова, упавшего исключением, — 0. */
  readonly resultChars: number;
  /** Ответ с `isError` либо исключение. */
  readonly isError: boolean;
  /** Текст исключения; `null`, если вызов вернул ответ (пусть и с `isError`). */
  readonly protocolError: string | null;
  readonly durationMs: number;
  /**
   * Ответ как есть — для полной трассы замера (`REFORMER_TRACE_FULL`). У вызова, упавшего
   * исключением, ответа нет. Ссылка на уже собранный объект: наблюдателю без полной трассы она
   * ничего не стоит.
   */
  readonly result?: unknown;
}

/**
 * Выполнить вызов и сообщить о нём наблюдателю. Исключение пробрасывается дальше: SDK превращает
 * его в ошибку JSON-RPC, наблюдатель этого не меняет.
 */
export async function observeCall<Result>(
  onCall: (call: ReformerServerCall) => void,
  call: Pick<ReformerServerCall, 'kind' | 'name' | 'arguments'>,
  run: () => Result | Promise<Result>
): Promise<Result> {
  const startedAt = performance.now();
  try {
    const result = await run();
    onCall({
      ...call,
      result,
      resultChars: JSON.stringify(result)?.length ?? 0,
      isError: (result as { isError?: boolean } | null)?.isError === true,
      protocolError: null,
      durationMs: performance.now() - startedAt,
    });
    return result;
  } catch (error) {
    onCall({
      ...call,
      resultChars: 0,
      isError: true,
      protocolError: error instanceof Error ? error.message : String(error),
      durationMs: performance.now() - startedAt,
    });
    throw error;
  }
}

/** Ключ `_meta` ответа `run_script` со списком вложенных вызовов — его читает журнал вызовов. */
export const INNER_CALLS_META = 'reformer/innerCalls';
