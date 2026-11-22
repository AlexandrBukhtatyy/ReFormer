/**
 * Отмена прогона без нового исключения на каждый вызов.
 *
 * `AbortController.abort()` без причины создаёт `DOMException` со стеком — около 4 мкс в V8, — а
 * ядро отменяет прежний прогон на каждом прогоне живой валидации, каждом срабатывании `onChange` и
 * при снятии формы. Здесь причина одна на всё время работы: тот же `DOMException` с
 * `name: 'AbortError'`, по которому отмену узнают `fetch`, `isAbortError` и прикладной код.
 * Отличаются только идентичность объекта и стек — он указывает не на место отмены.
 *
 * @internal
 * @module model/abort
 */

let reason: unknown;

/** Отменить прогон контроллера; уже отменённый и отсутствующий — без действия. */
export function abortRun(controller: AbortController | null | undefined): void {
  if (controller == null || controller.signal.aborted) return;
  // Без DOMException в окружении — причина по умолчанию.
  reason ??=
    typeof DOMException === 'function'
      ? new DOMException('The operation was aborted.', 'AbortError')
      : undefined;
  controller.abort(reason);
}
