/**
 * Резолвер сообщений валидации.
 *
 * `useFormField` отображает не `error.message` напрямую, а результат резолвера. Откуда он берётся:
 *
 * - **по умолчанию — из локали.** Без своего провайдера текст даёт `useValidationMessage` из
 *   `@reformer/core/i18n`: `messageKey` автора правила → явное `message` → словарь активной
 *   локали по коду (`validation.<code>`) → встроенный английский → код. Язык задаёт
 *   `I18nProvider`; без него тексты английские;
 * - **{@link ValidationMessagesProvider} — полное переопределение.** Смонтированный провайдер
 *   заменяет резолвер целиком: локаль для ошибок в его поддереве больше не участвует. Таблица из
 *   {@link createMessageResolver} при этом по-прежнему важнее `error.message`.
 *
 * @module reformer-cdk/validation/error-resolver
 */

import { createContext, useContext, type ReactNode } from 'react';
import type { ValidationError } from '@reformer/core';
import { useValidationMessage } from '@reformer/core/i18n';

/** Преобразует ошибку валидации в отображаемую строку. */
export type ValidationErrorResolver = (error: ValidationError) => string;

/** Таблица `code → (params) => message`. */
export type ValidationMessageTable = Record<string, (params?: Record<string, unknown>) => string>;

/**
 * Простейший резолвер без локали: отдаёт `error.message`, а если оно пустое — `error.code`.
 * Резолвером по умолчанию больше не является (им стал резолвер по локали, см. шапку модуля);
 * оставлен как готовая функция для {@link ValidationMessagesProvider}, если локализация ошибок
 * не нужна вовсе.
 *
 * @example Прямое применение к ошибке
 * ```ts
 * import { defaultErrorResolver } from '@reformer/cdk';
 *
 * defaultErrorResolver({ code: 'required', message: 'Обязательно' }); // → 'Обязательно'
 * defaultErrorResolver({ code: 'required', message: '' });            // → 'required'
 * ```
 */
export const defaultErrorResolver: ValidationErrorResolver = (error) => error.message || error.code;

/**
 * Создаёт резолвер из таблицы кодов сообщений (точка i18n). Текст берётся по `error.code`
 * с подстановкой `error.params`; если кода нет в таблице — fallback на `error.message`, затем
 * на сам `error.code`. Позволяет валидаторам нести только `code`+`params`, а тексты (RU/EN/…)
 * держать в таблице и менять без правки схемы валидации.
 *
 * @param table - Таблица `code → (params) => message`.
 * @returns Резолвер {@link ValidationErrorResolver} для {@link ValidationMessagesProvider}.
 *
 * @example Таблица сообщений с подстановкой параметров
 * ```ts
 * import { createMessageResolver } from '@reformer/cdk';
 *
 * const resolve = createMessageResolver({
 *   required: () => 'Обязательное поле',
 *   minLength: (p) => `Минимум ${p?.minLength} символов`,
 * });
 *
 * resolve({ code: 'required', message: 'старое' });                        // → 'Обязательное поле'
 * resolve({ code: 'minLength', message: '', params: { minLength: 3 } });   // → 'Минимум 3 символов'
 * resolve({ code: 'pattern', message: 'Неверный формат' });               // → 'Неверный формат' (fallback)
 * ```
 *
 * @see {@link ValidationMessagesProvider} — как подключить резолвер к поддереву формы.
 */
export function createMessageResolver(table: ValidationMessageTable): ValidationErrorResolver {
  return (error) => table[error.code]?.(error.params) ?? (error.message || error.code);
}

/** `null` — провайдера нет: текст ошибки даёт резолвер по активной локали. */
const ResolverContext = createContext<ValidationErrorResolver | null>(null);

/**
 * Провайдер резолвера сообщений валидации для поддерева формы — полное переопределение. Все
 * `useFormField` внутри отображают результат переданного `resolver`, а резолвер по локали
 * (`I18nProvider`) для ошибок в этом поддереве отключается. Нужен, когда тексты ошибок берутся из
 * своего источника; для обычной локализации достаточно `I18nProvider` и словаря
 * `validation.<code>`.
 *
 * @param props.resolver - Резолвер {@link ValidationErrorResolver} (например, из `createMessageResolver`).
 * @param props.children - Поддерево формы, к которому применяется резолвер.
 *
 * @example Локализация всей формы через таблицу сообщений
 * ```tsx
 * import { ValidationMessagesProvider, createMessageResolver } from '@reformer/cdk';
 *
 * const ru = createMessageResolver({
 *   required: () => 'Обязательное поле',
 *   email: () => 'Введите корректный email',
 *   minLength: (p) => `Минимум ${p?.minLength} символов`,
 * });
 *
 * <ValidationMessagesProvider resolver={ru}>
 *   <MyForm />
 * </ValidationMessagesProvider>
 * ```
 *
 * @see {@link createMessageResolver} — построение резолвера из таблицы кодов.
 * @see {@link useValidationErrorResolver} — чтение текущего резолвера из контекста.
 */
export function ValidationMessagesProvider(props: {
  resolver: ValidationErrorResolver;
  children: ReactNode;
}): ReactNode {
  return (
    <ResolverContext.Provider value={props.resolver}>{props.children}</ResolverContext.Provider>
  );
}

/**
 * Возвращает текущий резолвер сообщений. Если форма обёрнута в {@link ValidationMessagesProvider}
 * — его резолвер; иначе резолвер по активной локали (`useValidationMessage` из
 * `@reformer/core/i18n`), идентичность которого меняется вместе с языком. Используется внутри
 * `useFormField` для преобразования {@link ValidationError} в отображаемую строку; вызывайте
 * напрямую, если строите собственный рендер ошибок.
 *
 * @returns Активный {@link ValidationErrorResolver}.
 *
 * @example Кастомный рендер ошибок с активным резолвером
 * ```tsx
 * import { useValidationErrorResolver } from '@reformer/cdk';
 * import { useFormControl } from '@reformer/core';
 *
 * function FieldErrors({ control }: { control: FieldNode<string> }) {
 *   const resolve = useValidationErrorResolver();
 *   const { errors } = useFormControl(control);
 *   return <>{errors.map((e) => <span key={e.code}>{resolve(e)}</span>)}</>;
 * }
 * ```
 */
export function useValidationErrorResolver(): ValidationErrorResolver {
  const explicit = useContext(ResolverContext);
  const byLocale = useValidationMessage();
  return explicit ?? byLocale;
}
