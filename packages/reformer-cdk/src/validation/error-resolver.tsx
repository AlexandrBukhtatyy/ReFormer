/**
 * Резолвер сообщений валидации (точка i18n).
 *
 * `useFormField` отображает не `error.message` напрямую, а результат резолвера. По умолчанию резолвер
 * отдаёт `error.message ?? error.code` — обратная совместимость (поведение не меняется, пока валидаторы
 * несут готовые сообщения). Чтобы включить i18n, оберни форму в {@link ValidationMessagesProvider} с
 * резолвером из таблицы (`createMessageResolver(table)`): тогда валидаторы могут нести только `code`+`params`,
 * а тексты (RU/EN/…) живут в таблице и меняются без правки схемы валидации.
 *
 * @module reformer-cdk/validation/error-resolver
 */

import { createContext, useContext, type ReactNode } from 'react';
import type { ValidationError } from '@reformer/core';

/** Преобразует ошибку валидации в отображаемую строку. */
export type ValidationErrorResolver = (error: ValidationError) => string;

/** Таблица `code → (params) => message`. */
export type ValidationMessageTable = Record<string, (params?: Record<string, unknown>) => string>;

/**
 * Дефолтный резолвер: отдаёт `error.message`, а если оно пустое — `error.code`. Применяется, когда
 * форма не обёрнута в {@link ValidationMessagesProvider}. Обеспечивает обратную совместимость:
 * пока валидаторы несут готовые тексты в `message`, отображение не меняется.
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

const ResolverContext = createContext<ValidationErrorResolver>(defaultErrorResolver);

/**
 * Провайдер резолвера сообщений валидации (i18n) для поддерева формы. Все `useFormField` внутри
 * начинают отображать не `error.message`, а результат переданного `resolver`. Оберните форму
 * резолвером из {@link createMessageResolver}, чтобы включить локализацию по кодам ошибок.
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
 * Возвращает текущий резолвер сообщений из контекста. Если форма не обёрнута в
 * {@link ValidationMessagesProvider}, вернётся {@link defaultErrorResolver}. Используется
 * внутри `useFormField` для преобразования {@link ValidationError} в отображаемую строку;
 * вызывайте напрямую, если строите собственный рендер ошибок.
 *
 * @returns Активный {@link ValidationErrorResolver} (или дефолтный, если провайдера нет).
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
  return useContext(ResolverContext);
}
