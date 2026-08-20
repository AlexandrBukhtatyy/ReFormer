import { useCallback, useRef } from 'react';
import { useSyncExternalStore } from 'use-sync-external-store/shim';
import { effect, type Signal } from '@preact/signals-core';

/**
 * Shallow сравнение массивов по содержимому
 * @internal
 */
function shallowArrayEqual<T>(a: T[], b: T[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/** @internal */
export type SignalMap = Record<string, Signal<unknown>>;

/** @internal */
export type ExtractSignalValues<T extends SignalMap> = {
  [K in keyof T]: T[K] extends Signal<infer V> ? V : never;
};

/** @internal */
export interface SignalConfig<K extends string> {
  key: K;
  useShallowArrayEqual?: boolean;
}

/**
 * Хук для подписки на набор сигналов с кешированием
 * @internal
 */
export function useSignalSubscription<
  TSignals extends SignalMap,
  TSnapshot extends ExtractSignalValues<TSignals>,
>(
  signals: TSignals,
  configs: SignalConfig<Extract<keyof TSignals, string>>[],
  buildSnapshot: (values: ExtractSignalValues<TSignals>) => TSnapshot,
  /**
   * Стабильная идентичность подписки (обычно сам узел-контрол). subscribe/getSnapshot
   * пересоздаются ТОЛЬКО при её смене, а не на каждом рендере — как у useFormControlValue,
   * который ключует по `[control]`. Это убирает per-render churn (dispose+recreate preact-effect),
   * сохраняя реактивность при подмене контрола на другой узел.
   */
  subscriptionKey?: unknown
): TSnapshot {
  type CacheType = ExtractSignalValues<TSignals> & { __snapshot: TSnapshot | null };

  const cacheRef = useRef<CacheType | null>(null);

  // Держим актуальные signals/configs/buildSnapshot в ref-ах, чтобы subscribe/getSnapshot,
  // ключуемые по subscriptionKey (а не по свежему объекту signals), всегда читали актуальные
  // данные.
  //
  // Раньше subscribe зависел от `[signals]`, а signals — свежий объектный литерал на каждом
  // рендере вызывающего хука (useFieldControl/useArrayControl), поэтому useSyncExternalStore
  // переподписывался (dispose+recreate preact-effect) на КАЖДЫЙ commit — напрасная работа,
  // масштабирующаяся с числом полей. Сами Signal-инстансы стабильны (readonly-свойства узла),
  // так что чтение через ref всегда видит те же сигналы.
  const signalsRef = useRef(signals);
  signalsRef.current = signals;
  const configsRef = useRef(configs);
  configsRef.current = configs;
  const buildSnapshotRef = useRef(buildSnapshot);
  buildSnapshotRef.current = buildSnapshot;

  // Инициализируем кеш при первом рендере
  if (cacheRef.current === null) {
    const initialValues = {} as ExtractSignalValues<TSignals>;
    for (const key in signals) {
      (initialValues as Record<string, unknown>)[key] = signals[key].value;
    }
    cacheRef.current = { ...initialValues, __snapshot: null } as CacheType;
  }

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      let isFirstRun = true;

      const dispose = effect(() => {
        const currentSignals = signalsRef.current;
        // Читаем все сигналы для отслеживания
        for (const key in currentSignals) {
          void currentSignals[key].value;
        }

        if (isFirstRun) {
          isFirstRun = false;
          return;
        }

        onStoreChange();
      });

      return dispose;
    },
    [subscriptionKey]
  );

  const getSnapshot = useCallback((): TSnapshot => {
    const cache = cacheRef.current!;
    const currentSignals = signalsRef.current;

    // Собираем текущие значения
    const currentValues = {} as ExtractSignalValues<TSignals>;
    for (const key in currentSignals) {
      (currentValues as Record<string, unknown>)[key] = currentSignals[key].value;
    }

    // Проверяем изменения
    let hasChanged = false;
    for (const config of configsRef.current) {
      const { key, useShallowArrayEqual: useArrayEqual } = config;
      const currentValue = (currentValues as Record<string, unknown>)[key];
      const cachedValue = (cache as Record<string, unknown>)[key];

      if (useArrayEqual) {
        if (!shallowArrayEqual(cachedValue as unknown[], currentValue as unknown[])) {
          hasChanged = true;
          break;
        }
      } else if (cachedValue !== currentValue) {
        hasChanged = true;
        break;
      }
    }

    if (!hasChanged && cache.__snapshot) {
      return cache.__snapshot;
    }

    // Обновляем кеш
    for (const key in currentSignals) {
      (cache as Record<string, unknown>)[key] = (currentValues as Record<string, unknown>)[key];
    }

    cache.__snapshot = buildSnapshotRef.current(currentValues);
    return cache.__snapshot;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscriptionKey]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
