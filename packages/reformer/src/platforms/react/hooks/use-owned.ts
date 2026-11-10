/**
 * Экземпляр, которым владеет компонент: создаётся один раз, снимается при размонтировании.
 *
 * Общая основа {@link useFormBundle} (сборка формы) и {@link useStore} (стор приложения).
 *
 * Фабрика вызывается РОВНО один раз — ленивым инициализатором `useState`. `useMemo` для этого не
 * годится: React вправе сбросить его кэш и пересоздать экземпляр, потеряв состояние.
 *
 * ## Снятие
 *
 * Снятие откладывается на микрозадачу и отменяется, если эффект запустился снова. StrictMode в
 * разработке (и Fast Refresh) размонтирует эффекты и тут же монтирует их над ТЕМ ЖЕ экземпляром:
 * синхронный `dispose()` в очистке снял бы реакции живого экземпляра, а вернуть их нечем. Настоящее
 * размонтирование повторного запуска не даёт, и экземпляр снимается сразу после коммита.
 *
 * Очистка эффектов в React — не всегда размонтирование: скрытый `<Activity>` снимает эффекты и
 * хранит состояние. Если экземпляр успели снять, а эффект запустился снова (поддерево показали),
 * хук создаёт новый той же фабрикой: снятый не оживает, а мёртвый хуже свежего.
 *
 * @module platforms/react/hooks/use-owned
 */

import { useEffect, useRef, useState } from 'react';

/**
 * Создать экземпляр один раз и снять его при размонтировании.
 *
 * @param factory - Фабрика экземпляра. Вызывается один раз (и повторно — только после снятия).
 * @param start - Что запустить на монтирование (например, живую проверку формы). Берётся с первого
 *   рендера. Возвращённая функция вызывается в очистке эффекта.
 * @internal
 */
export function useOwned<T extends { dispose?(): void }>(
  factory: () => T,
  start?: (instance: T) => (() => void) | undefined
): T {
  const [instance, setInstance] = useState(factory);
  // Фабрика первого рендера: ею же создаётся замена снятого экземпляра. Новая фабрика на
  // ререндере экземпляр не пересоздаёт.
  const [build] = useState(() => factory);
  const [arm] = useState(() => start);
  /** Снятие, заказанное последней очисткой; повторный запуск эффекта над тем же экземпляром его отменяет. */
  const pending = useRef<{ instance: T; cancelled: boolean; done: boolean } | null>(null);

  useEffect(() => {
    const previous = pending.current;
    if (previous?.instance === instance && previous.done) {
      // Экземпляр уже сняли, а эффект запустился снова — поддерево показали после скрытия. Замена
      // ставится из колбэка, как ответ внешней системы, а не телом эффекта: синхронный setState
      // здесь — лишний каскадный рендер. Если поддерево успели скрыть раньше, замена отменяется,
      // а билет остаётся — следующий показ попробует снова.
      let live = true;
      queueMicrotask(() => {
        if (live) setInstance(build());
      });
      return () => {
        live = false;
      };
    }
    pending.current = null;
    if (previous?.instance === instance) previous.cancelled = true;
    const stop = arm?.(instance);
    return () => {
      stop?.();
      const disposal = { instance, cancelled: false, done: false };
      pending.current = disposal;
      queueMicrotask(() => {
        if (disposal.cancelled) return;
        instance.dispose?.();
        disposal.done = true;
      });
    };
  }, [instance, build, arm]);

  return instance;
}
