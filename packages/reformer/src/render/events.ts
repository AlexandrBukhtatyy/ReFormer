/**
 * Обработчики `onComponentEvent` узла поверх его собственных пропсов.
 *
 * @module render/events
 */

/** Обработчики узла: имя пропа-события → колбэк поведения. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ComponentEvents = ReadonlyMap<string, (...args: any[]) => any>;

/**
 * Колбэки `onComponentEvent` для узла с привязкой — поля или массива. Колбэк добавляется к
 * обработчику, который уже стоит на событии (запись значения в форму, кнопки массива), а не
 * заменяет его: иначе правило поведения отключило бы ввод. Сначала свой обработчик узла, затем
 * колбэк; результат — колбэка.
 */
export function withComponentEvents(
  props: Record<string, unknown>,
  events: ComponentEvents | undefined
): Record<string, unknown> {
  if (!events || events.size === 0) return props;
  const composed = { ...props };
  events.forEach((handler, event) => {
    const own = composed[event];
    composed[event] =
      typeof own === 'function'
        ? (...args: unknown[]) => {
            (own as (...ownArgs: unknown[]) => unknown)(...args);
            return handler(...args);
          }
        : handler;
  });
  return composed;
}

/**
 * Колбэки `onComponentEvent` для контейнера: привязки у него нет, поэтому колбэк просто главнее
 * пропса схемы с тем же именем.
 */
export function overrideWithEvents(
  props: Readonly<Record<string, unknown>>,
  events: ComponentEvents | undefined
): Readonly<Record<string, unknown>> {
  if (!events || events.size === 0) return props;
  return { ...props, ...Object.fromEntries(events) };
}
