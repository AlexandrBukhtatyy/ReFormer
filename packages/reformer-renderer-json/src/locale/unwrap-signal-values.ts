/**
 * Параметры сообщения без сигналов — чистая часть моста «сигналы → слой представления». Подписку на
 * сигналы каждый слой делает по-своему (в React — хук `useSignalValues`), а разворачивание значений
 * у всех одно.
 *
 * @module reformer/renderer-json/locale/unwrap-signal-values
 */

import { isValueSignal } from '@reformer/core';
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
    if (isValueSignal(v)) {
      out[key] = v.value;
      hasSignal = true;
    } else {
      out[key] = v;
    }
  }
  return hasSignal ? out : values;
}
