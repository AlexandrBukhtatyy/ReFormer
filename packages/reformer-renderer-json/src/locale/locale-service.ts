/**
 * Сервис локализации для оператора `"$locale(key)"` — точка i18n JSON-схемы.
 *
 * Библиотека **formatter-agnostic**: определяет только интерфейс {@link LocaleService} и фабрики-
 * замыкания, а ICU (`intl-messageformat`), i18next, markdown-рендерер и т.п. подключает потребитель
 * своей реализацией сервиса. Никаких i18n-зависимостей у пакета нет.
 *
 * Два пути использования:
 * - **Строковый (статичный)** — `$locale(key)` и структурная форма `{ $locale, params }` в
 *   `componentProps`: `registry.getLocale()?.resolve(key, params) ?? key`. Строка запекается при
 *   конвертации и спредится в проп; signal/ReactNode в `label`/`placeholder` уронил бы компонент.
 *   Смена языка = новый сервис + пересборка дерева.
 * - **Реактивный (rich)** — компонент `Trans` + `LocaleProvider`: читает сервис из React-контекста
 *   на этапе рендера (live-переключение языка) и model-параметры из сигналов (live-обновление),
 *   рендерит `render?()` (markdown/JSX) либо `resolve()` (строка).
 *
 * Fallback-to-key (нет сервиса / нет ключа → сам ключ) — зеркало `defaultErrorResolver` из
 * `@reformer/cdk`: пропущенная локализация деградирует до ключа, а не роняет форму.
 *
 * @module reformer/renderer-json/locale
 */

import type { ReactNode } from 'react';

/** Параметры для интерполяции/склонения (ICU-values, i18next-values и т.п.). */
export type LocaleParams = Record<string, unknown>;

/** Резолвер ключа (+опциональные параметры) в строку. */
export type LocaleResolver = (key: string, params?: LocaleParams) => string;

/**
 * Сервис локализации в реестре / контексте. `resolve` обязателен (строковый путь); `render`
 * опционален (rich/markdown-путь через `Trans`/`RichText`); `keys` (если задан — напр., из каталога)
 * включает проверку опечаток ключей на этапе `validateFormSchema`.
 */
export interface LocaleService {
  /** Ключ (+params) → локализованная строка (при промахе — сам ключ). Для label/placeholder и fallback `Trans`. */
  resolve: LocaleResolver;
  /**
   * Ключ (+params) → rich-контент (markdown/JSX). Опционален. Используется `Trans`/`RichText`, когда
   * нужен не голый текст, а разметка. Реализуется потребителем (напр. через `react-markdown`).
   */
  render?(key: string, params?: LocaleParams): ReactNode;
  /** Множество известных ключей. Есть → `validate` ловит `unknown locale key`; нет → проверка мягко пропускается (как для `$model`). */
  keys?: readonly string[];
}

/** Дефолтный резолвер: отдаёт сам ключ (fallback-to-key). Применяется, когда сервис не зарегистрирован. */
export const defaultLocaleResolver: LocaleResolver = (key) => key;

/**
 * Строит {@link LocaleService} из каталога `ключ → строка`. Промах ключа → сам ключ (fallback-to-key,
 * зеркало `createMessageResolver` из `@reformer/cdk`). `keys` каталога включает validate-time проверку
 * опечаток. Смена языка — пересобрать сервис на другом каталоге и передать новый ref в `reg.locale`.
 *
 * @param catalog - Таблица `ключ → локализованная строка`.
 * @returns {@link LocaleService} для `reg.locale(...)`.
 *
 * @example
 * ```ts
 * import { defineRegistry } from '@reformer/renderer-json';
 * import { createLocaleResolver } from '@reformer/renderer-json';
 *
 * const registry = defineRegistry((reg) => {
 *   reg.locale(createLocaleResolver({
 *     'fields.email.label': 'Email',
 *     'fields.email.placeholder': 'you@example.com',
 *   }));
 * });
 * // В схеме: componentProps: { label: '$locale(fields.email.label)' }
 * // '$locale(fields.unknown)' при наличии каталога → ошибка на validateFormSchema.
 * ```
 */
export function createLocaleResolver(catalog: Record<string, string>): LocaleService {
  return { resolve: (key) => catalog[key] ?? key, keys: Object.keys(catalog) };
}

/**
 * Строит {@link LocaleService} из таблицы `ключ → (params) => строка` — 0-dependency вариант для
 * параметров и склонения без ICU (стиль `createMessageResolver` из `@reformer/cdk`). Промах ключа →
 * сам ключ. `keys` таблицы включает validate-time проверку опечаток.
 *
 * Для ICU-склонения по CLDR-правилам подключи `intl-messageformat` в СВОЁМ сервисе:
 * `reg.locale({ resolve: (k, p) => new IntlMessageFormat(catalog[k], lng).format(p) as string, keys })`.
 * Для markdown добавь `render` (напр. через `react-markdown`).
 *
 * @param table - Таблица `ключ → (params) => локализованная строка`.
 * @returns {@link LocaleService} для `reg.locale(...)` / `LocaleProvider`.
 *
 * @example
 * ```ts
 * import { createLocaleService } from '@reformer/renderer-json';
 *
 * const ru = createLocaleService({
 *   'fields.min': (p) => `Минимум ${p?.count} символов`,
 *   'users.count': (p) => {
 *     const n = Number(p?.count);
 *     const forms = ['пользователь', 'пользователя', 'пользователей'];
 *     const idx = n % 10 === 1 && n % 100 !== 11 ? 0 : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 1 : 2;
 *     return `${n} ${forms[idx]}`;
 *   },
 * });
 * ru.resolve('fields.min', { count: 3 }); // 'Минимум 3 символов'
 * ```
 */
export function createLocaleService(
  table: Record<string, (params?: LocaleParams) => string>
): LocaleService {
  return { resolve: (key, params) => table[key]?.(params) ?? key, keys: Object.keys(table) };
}
