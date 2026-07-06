/**
 * Мост preact-сигналов → React для компонента {@link I18n}. `@reformer/core/signals` не имеет
 * React-интеграции, поэтому подписка на сигнал делается вручную через `useSyncExternalStore` + `effect`
 * (тот же паттерн, что `useFieldValueAndDisabled` в `@reformer/renderer-react`).
 *
 * Значения `values` компонента `I18n` могут быть сигналами (`$model(...)` → `signalAt`) или литералами.
 * Хук разворачивает их в обычные значения и перерендеривает при изменении любого сигнала.
 *
 * @module reformer/renderer-json/locale/use-signal-value
 */

import { useCallback, useRef, useSyncExternalStore } from 'react';
import { Signal, effect } from '@reformer/core/signals';
import type { LocaleParams } from './locale-service';

/**
 * Разворачивает значения-сигналы в обычные (читает `.value`), литералы отдаёт как есть. Если сигналов
 * не было — возвращает исходный объект (стабильная ссылка). Pure — тестируется без DOM.
 */
export function unwrapSignalValues(values?: LocaleParams): LocaleParams | undefined {
  if (!values) return values;
  let hasSignal = false;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(values)) {
    const v = values[key];
    if (v instanceof Signal) {
      out[key] = (v as Signal<unknown>).value;
      hasSignal = true;
    } else {
      out[key] = v;
    }
  }
  return hasSignal ? out : values;
}

/** Собирает сигналы из `values` (для подписки). */
function collectSignals(values?: LocaleParams): Array<Signal<unknown>> {
  const out: Array<Signal<unknown>> = [];
  if (values) {
    for (const key of Object.keys(values)) {
      const v = values[key];
      if (v instanceof Signal) out.push(v as Signal<unknown>);
    }
  }
  return out;
}

/** Поверхностное сравнение записей (для стабильности снапшота `useSyncExternalStore`). */
function shallowEqualRecord(a?: LocaleParams, b?: LocaleParams): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (const k of ka) if (a[k] !== b[k]) return false;
  return true;
}

/**
 * Реактивно разворачивает `values`-сигналы. Перерендер компонента при изменении любого сигнала;
 * литералы проходят как есть. Снапшот кэшируется (стабильная ссылка при неизменных значениях) —
 * иначе `useSyncExternalStore` зациклится.
 *
 * @param values - Параметры сообщения (сигналы и/или литералы).
 * @returns Развёрнутые значения для передачи в `LocaleService.resolve/render`.
 */
export function useSignalValues(values?: LocaleParams): LocaleParams | undefined {
  const snapRef = useRef<LocaleParams | undefined>(undefined);

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const signals = collectSignals(values);
      if (signals.length === 0) return () => {};
      let first = true;
      return effect(() => {
        for (const s of signals) void s.value; // зависимости эффекта
        if (first) {
          first = false;
          return;
        }
        onStoreChange();
      });
    },
    [values]
  );

  const getSnapshot = useCallback((): LocaleParams | undefined => {
    const next = unwrapSignalValues(values);
    if (shallowEqualRecord(snapRef.current, next)) return snapRef.current;
    snapRef.current = next;
    return next;
  }, [values]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
