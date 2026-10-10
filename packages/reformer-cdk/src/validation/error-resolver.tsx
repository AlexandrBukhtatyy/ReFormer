/**
 * Тексты замечаний валидации в поддереве формы.
 *
 * `useFormField` показывает не замечание, а строку резолвера. Откуда она берётся:
 *
 * - **по умолчанию — из локали.** Без своего провайдера текст даёт `useIssueMessage` из
 *   `@reformer/core/react`: словарь активной локали по коду (`validation.<code>`) → встроенный
 *   английский → сам код. Язык задаёт `I18nProvider`; без него тексты английские;
 * - **{@link ValidationMessagesProvider} с `messages`** — словарь формы (`defineIssueMessages` из
 *   `@reformer/core/i18n`). Его записи накладываются поверх словарей внешних провайдеров и
 *   локали: код, которого в словаре нет, по-прежнему получает текст оттуда;
 * - **{@link ValidationMessagesProvider} с `resolver`** — полное переопределение: для замечаний
 *   поддерева внешние провайдеры и локаль больше не участвуют (кроме `messages` этого же
 *   провайдера и вложенных в него).
 *
 * @module reformer-cdk/validation/error-resolver
 */

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { ValidationIssue } from '@reformer/core';
import type { IssueMessages } from '@reformer/core/i18n';
import { useIssueMessage } from '@reformer/core/react';

/** Преобразует замечание валидации в отображаемую строку. */
export type IssueMessageResolver = (issue: ValidationIssue) => string;

/** Что провайдеры выше по дереву передали вниз. */
interface MessagesLayer {
  /** Словарь формы — записи всех провайдеров до ближайшего `resolver`, ближний важнее. */
  readonly messages: IssueMessages | undefined;
  /** Ближайший полный резолвер; `null` — его нет, текст даёт локаль. */
  readonly resolver: IssueMessageResolver | null;
}

const ROOT_LAYER: MessagesLayer = { messages: undefined, resolver: null };

const MessagesContext = createContext<MessagesLayer>(ROOT_LAYER);

const hasOwn = (target: object, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(target, key);

/** Свойства {@link ValidationMessagesProvider}. */
export interface ValidationMessagesProviderProps {
  /**
   * Словарь формы: код замечания → шаблон либо функция. Накладывается поверх словарей внешних
   * провайдеров. Стабильная ссылка — константа модуля, иначе тексты пересчитываются на каждый
   * рендер.
   */
  messages?: IssueMessages;
  /**
   * Полный резолвер: тексты замечаний поддерева берутся только из него (и из `messages` этого
   * провайдера, если они заданы). Локаль и внешние провайдеры не участвуют.
   */
  resolver?: IssueMessageResolver;
  children: ReactNode;
}

/**
 * Тексты замечаний для поддерева формы: словарь формы поверх локали либо полный резолвер.
 *
 * @example Словарь формы — тексты полей поверх локали
 * ```tsx
 * import { defineIssueMessages } from '@reformer/core/i18n';
 * import { ValidationMessagesProvider } from '@reformer/cdk';
 *
 * const messages = defineIssueMessages({
 *   'phone.required': 'Укажите телефон',
 *   'password.minLength': 'Не меньше {minLength} символов',
 * });
 *
 * <ValidationMessagesProvider messages={messages}>
 *   <MyForm />
 * </ValidationMessagesProvider>
 * ```
 *
 * @example Полное переопределение — свой источник текстов
 * ```tsx
 * <ValidationMessagesProvider resolver={(issue) => translate(`errors.${issue.code}`, issue.params)}>
 *   <MyForm />
 * </ValidationMessagesProvider>
 * ```
 *
 * @see {@link useIssueMessageResolver} — чтение итогового резолвера.
 */
export function ValidationMessagesProvider(props: ValidationMessagesProviderProps): ReactNode {
  const parent = useContext(MessagesContext);
  const { messages, resolver } = props;
  const layer = useMemo<MessagesLayer>(() => {
    // Полный резолвер отсекает всё, что выше: под ним действуют только свои записи.
    if (resolver !== undefined) return { messages, resolver };
    if (messages === undefined) return parent;
    return {
      messages: parent.messages === undefined ? messages : { ...parent.messages, ...messages },
      resolver: parent.resolver,
    };
  }, [parent, messages, resolver]);

  return <MessagesContext.Provider value={layer}>{props.children}</MessagesContext.Provider>;
}

/**
 * Итоговый резолвер текстов замечаний: словарь формы от {@link ValidationMessagesProvider}, затем
 * ближайший полный `resolver`, а без него — локаль (`useIssueMessage` из `@reformer/core/react`).
 * Идентичность функции меняется вместе с языком и словарём. Используется внутри `useFormField`;
 * вызывайте напрямую, если рисуете замечания своим компонентом.
 *
 * @returns Активный {@link IssueMessageResolver}.
 *
 * @example Свой рендер замечаний поля
 * ```tsx
 * import { useIssueMessageResolver } from '@reformer/cdk';
 * import { useFormControl } from '@reformer/core/react';
 *
 * function FieldIssues({ control }: { control: FieldNode<string> }) {
 *   const resolve = useIssueMessageResolver();
 *   const { issues } = useFormControl(control);
 *   return <>{issues.map((issue) => <span key={issue.code}>{resolve(issue)}</span>)}</>;
 * }
 * ```
 */
export function useIssueMessageResolver(): IssueMessageResolver {
  const { messages, resolver } = useContext(MessagesContext);
  const byLocale = useIssueMessage(messages);
  return useMemo<IssueMessageResolver>(() => {
    if (resolver === null) return byLocale;
    // Запись словаря формы важнее полного резолвера; шаблон форматирует локаль.
    return (issue) =>
      messages !== undefined && hasOwn(messages, issue.code) ? byLocale(issue) : resolver(issue);
  }, [messages, resolver, byLocale]);
}
