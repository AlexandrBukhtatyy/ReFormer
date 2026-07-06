/**
 * Реактивный компонент локализации `I18n` — rich-путь i18n (markdown/JSX + склонение с live-параметрами).
 *
 * Регистрируется как `$component(I18n)` и используется контейнер-узлом схемы:
 * ```jsonc
 * { "component": "$component(I18n)",
 *   "componentProps": { "id": "users.count", "values": { "count": "$model(userCount)" } } }
 * ```
 * `values.count` приходит сигналом (`$model` → `signalAt`); при его изменении и при смене языка
 * (`LocaleProvider`) текст перерисовывается вживую. Рендерит `render?()` (markdown/JSX) либо
 * `resolve()` (строка) — формат решает сам {@link LocaleService}, `as`-проп не нужен.
 *
 * @module reformer/renderer-json/locale/i18n
 */

import type { ReactNode } from 'react';
import type { LocaleParams } from './locale-service';
import { useLocale } from './locale-context';
import { useSignalValues } from './use-signal-value';

/** Props {@link I18n}. */
export interface I18nProps {
  /** Ключ сообщения в сервисе локализации. */
  id: string;
  /**
   * Параметры интерполяции/склонения. Значения могут быть сигналами (`$model(...)`) — тогда текст
   * обновляется при их изменении — или литералами.
   */
  values?: LocaleParams;
}

/**
 * Реактивный локализованный текст. Читает {@link LocaleService} из {@link LocaleProvider} (live-смена
 * языка) и разворачивает `values`-сигналы (live-обновление параметров). Если сервис умеет `render` —
 * рендерит rich-контент (markdown/JSX), иначе строку через `resolve`.
 *
 * @param props - {@link I18nProps} (`id` + опциональные `values`).
 * @returns Локализованный `ReactNode`.
 */
export function I18n({ id, values }: I18nProps): ReactNode {
  const service = useLocale();
  const resolved = useSignalValues(values);
  return service.render ? service.render(id, resolved) : service.resolve(id, resolved);
}
