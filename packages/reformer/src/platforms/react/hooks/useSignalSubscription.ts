import { useCallback, useRef } from 'react';
import { useSyncExternalStore } from 'use-sync-external-store/shim';
import { effect, type Signal } from '@preact/signals-core';
import { shallowEqual } from '../../../model/scope';

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
  /**
   * Сравнивать объект поверхностно: новый объект с теми же значениями (`updateComponentProps`
   * теми же пропсами) снапшот не меняет.
   */
  useShallowObjectEqual?: boolean;
}

/**
 * Хук для подписки на набор сигналов с кешированием.
 *
 * Подписка — только на сигналы из `configs`: их смена пересобирает снапшот. Остальные сигналы
 * `signals` в снапшот попадают значением на момент сборки и сами компонент не будят.
 * @internal
 */
/**
 * Обработчик снимка с подпиской по прочитанному: чтение поля запоминает его ключ. Снимок — `Proxy`
 * над объектом текущих значений: одна аллокация на снимок, а копия (`{ ...snapshot }`),
 * `Object.keys` и сравнение в тестах видят обычные поля объекта.
 */
function trackingHandler(used: Set<string>): ProxyHandler<Record<string, unknown>> {
  return {
    get(target, key) {
      if (typeof key === 'string') used.add(key);
      return target[key as string];
    },
  };
}

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
  subscriptionKey?: unknown,
  /**
   * Подписка по прочитанному: компонент перерисовывается, только когда изменился ключ, который он
   * читал. Снимок — ключи сигналов (`buildSnapshot` не зовётся), поля — геттеры; изменённый
   * непрочитанный ключ обновляется в том же снимке, и первое чтение потом видит свежее значение.
   * Режим постоянен на всё время жизни хука.
   */
  tracked = false
): TSnapshot {
  // `__key` — ключ подписки, для которого собран снапшот: при пустом `configs` сравнение значений
  // смену ключа не заметит, и наружу ушёл бы снапшот прежнего контрола.
  type CacheType = ExtractSignalValues<TSignals> & {
    __snapshot: TSnapshot | null;
    __key?: unknown;
    /** Прочитанные ключи — у подписки по прочитанному. */
    __used: Set<string>;
    /** Текущие значения — цель снимков подписки по прочитанному, только ключи сигналов. */
    __values?: Record<string, unknown>;
    __handler?: ProxyHandler<Record<string, unknown>>;
  };

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
    cacheRef.current = { ...initialValues, __snapshot: null, __used: new Set() } as CacheType;
  }

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      let isFirstRun = true;

      const dispose = effect(() => {
        const currentSignals = signalsRef.current;
        // Подписка — только на сигналы из configs: сигнал вне них снапшот всё равно не
        // пересобирает, а будил бы effect впустую.
        //
        // Чтение — ВЫЗОВОМ `valueOf()`, а не выражением `void signal?.value`. Terser с
        // `pure_getters: "strict"` (умолчание webpack и Docusaurus) считает чтение через `?.`
        // чистым и выбрасывает его: effect оставался без единой зависимости, и в production-сборке
        // потребителя компонент не узнавал о замечаниях, касании, доступности — значения нод
        // были верны, интерфейс стоял (ReFormer-34j). Вызов метода минификатор не выбрасывает,
        // а `valueOf()` читает тот же отслеживаемый `value`.
        for (const { key } of configsRef.current) {
          currentSignals[key]?.valueOf();
        }

        if (isFirstRun) {
          isFirstRun = false;
          return;
        }

        onStoreChange();
      });

      return dispose;
    },
    // subscriptionKey намеренно не читается в теле — он здесь КЛЮЧ ИДЕНТИЧНОСТИ подписки (см. JSDoc
    // параметра). Убрать его (как предлагает автофикс) значит получить subscribe, созданный один раз
    // навсегда: подмена контрола на другой узел перестанет пересоздавать effect. Тот же приём ниже
    // у getSnapshot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      const { key, useShallowArrayEqual: useArrayEqual, useShallowObjectEqual } = config;
      const currentValue = (currentValues as Record<string, unknown>)[key];
      const cachedValue = (cache as Record<string, unknown>)[key];

      if (tracked) {
        const same =
          useShallowObjectEqual || useArrayEqual
            ? shallowEqual(cachedValue, currentValue)
            : cachedValue === currentValue;
        if (same) continue;
        // Непрочитанный ключ меняется в том же снимке: перерисовывать не из-за чего.
        (cache as Record<string, unknown>)[key] = currentValue;
        if (cache.__values) cache.__values[key] = currentValue;
        if (cache.__used.has(key)) hasChanged = true;
        continue;
      }

      if (useShallowObjectEqual) {
        if (!shallowEqual(cachedValue, currentValue)) {
          hasChanged = true;
          break;
        }
      } else if (useArrayEqual) {
        if (!shallowEqual(cachedValue, currentValue)) {
          hasChanged = true;
          break;
        }
      } else if (cachedValue !== currentValue) {
        hasChanged = true;
        break;
      }
    }

    if (!hasChanged && cache.__snapshot && cache.__key === subscriptionKey) {
      return cache.__snapshot;
    }

    if (tracked) {
      const values = (cache.__values ??= {});
      for (const key in currentSignals) {
        const value = (currentValues as Record<string, unknown>)[key];
        (cache as Record<string, unknown>)[key] = value;
        values[key] = value;
      }
      cache.__key = subscriptionKey;
      cache.__handler ??= trackingHandler(cache.__used);
      // Цель у снимков общая: непрочитанное поле, изменённое без перерисовки, первое чтение увидит
      // свежим и в прежнем снимке.
      cache.__snapshot = new Proxy(values, cache.__handler) as TSnapshot;
      return cache.__snapshot;
    }

    // Обновляем кеш
    for (const key in currentSignals) {
      (cache as Record<string, unknown>)[key] = (currentValues as Record<string, unknown>)[key];
    }

    cache.__key = subscriptionKey;
    cache.__snapshot = buildSnapshotRef.current(currentValues);
    return cache.__snapshot;
  }, [subscriptionKey, tracked]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
