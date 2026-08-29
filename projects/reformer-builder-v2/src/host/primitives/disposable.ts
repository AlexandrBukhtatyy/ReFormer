/**
 * Освобождение ресурса — общий примитив для всех реестров.
 *
 * Каждая регистрация возвращает `Disposable`, и это не украшение: на нём держится снятие
 * вкладов при выключении плагина. Плагин складывает всё в `subscriptions` своего контекста,
 * а рантайм освобождает их сам — без этого выключение плагина оставляло бы его панели
 * и команды в реестрах навсегда.
 *
 * @module host/primitives/disposable
 */

/** Что-то, что умеет освободить занятое. Повторный вызов обязан быть безвредным. */
export interface Disposable {
  dispose(): void;
}

/**
 * Оборачивает функцию в {@link Disposable} с защитой от повторного вызова.
 *
 * Идемпотентность здесь несущая: реестр может освободить подписку сам (например, при
 * замене вклада), а владелец потом вызовет `dispose()` ещё раз из своего списка.
 */
export function toDisposable(fn: () => void): Disposable {
  let done = false;
  return {
    dispose() {
      if (done) return;
      done = true;
      fn();
    },
  };
}

/** Освобождает набор подписок. Ошибка одной не мешает остальным. */
export function disposeAll(items: readonly Disposable[]): void {
  const errors: unknown[] = [];
  for (const item of items) {
    try {
      item.dispose();
    } catch (err) {
      errors.push(err);
    }
  }
  if (errors.length === 1) throw errors[0];
  if (errors.length > 1) throw new AggregateError(errors, 'ошибки при освобождении подписок');
}
