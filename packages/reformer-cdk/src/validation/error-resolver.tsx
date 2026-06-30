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

/** Дефолт: готовое сообщение, иначе код (обратная совместимость). */
export const defaultErrorResolver: ValidationErrorResolver = (error) => error.message || error.code;

/**
 * Резолвер из таблицы кодов: текст берётся по `code` (с `params`), иначе fallback на `message`, затем `code`.
 * Для i18n валидаторы опускают `message` и несут `code`+`params`, а тексты — в таблице.
 */
export function createMessageResolver(table: ValidationMessageTable): ValidationErrorResolver {
  return (error) => table[error.code]?.(error.params) ?? (error.message || error.code);
}

const ResolverContext = createContext<ValidationErrorResolver>(defaultErrorResolver);

/** Провайдер резолвера сообщений валидации (i18n) для поддерева формы. */
export function ValidationMessagesProvider(props: {
  resolver: ValidationErrorResolver;
  children: ReactNode;
}): ReactNode {
  return (
    <ResolverContext.Provider value={props.resolver}>{props.children}</ResolverContext.Provider>
  );
}

/** Текущий резолвер из контекста (дефолтный, если провайдера нет). */
export function useValidationErrorResolver(): ValidationErrorResolver {
  return useContext(ResolverContext);
}
