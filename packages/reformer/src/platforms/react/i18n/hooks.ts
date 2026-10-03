/**
 * Хуки локализации.
 *
 * @module platforms/react/i18n/hooks
 */

import { useContext, useMemo } from 'react';
import type { ValidationError } from '../../../form/types/contracts';
import type { Messages } from '../../../i18n/locale';
import type { MessageValues } from '../../../i18n/message-format';
import { createI18n, translateBuiltin } from '../../../i18n/translator';
import { resolveValidationError } from '../../../i18n/validation-message';
import { I18nContext, type I18nContextValue } from './context';

/**
 * Активная локаль: перевод ключей приложения, форматирование чисел, дат и размеров, состояние
 * загрузки языка. Без провайдера — английский с пустым словарём.
 *
 * @example
 * ```tsx
 * function LangBadge() {
 *   const { code, pending, t } = useI18n();
 *   return <span aria-busy={pending}>{t('app.language')}: {code}</span>;
 * }
 * ```
 */
export function useI18n(): I18nContextValue {
  return useContext(I18nContext);
}

/**
 * Переводчик пакета: ищет ключ в локали провайдера, а при промахе берёт встроенную английскую
 * таблицу этого пакета. Так пакет говорит по-английски без провайдера и не зависит от того, знает
 * ли локаль его ключи. Тип ключа выводится из таблицы — опечатка в ключе не скомпилируется.
 *
 * `defaults` должен быть стабильной ссылкой (импорт JSON-модуля), иначе переводчик будет
 * пересоздаваться на каждый рендер.
 *
 * @param defaults - Встроенная английская таблица пакета.
 * @returns Функция `(ключ, значения?) => строка`; её идентичность меняется вместе с локалью.
 *
 * @example
 * ```tsx
 * import en from './locale/en.json';
 *
 * const useKitMessages = () => useMessages(en);
 *
 * function ClearButton() {
 *   const t = useKitMessages();
 *   return <button aria-label={t('kit.select.clear')} />;
 * }
 * ```
 */
export function useMessages<D extends Messages>(
  defaults: D
): (key: keyof D & string, values?: MessageValues) => string {
  const { locale } = useContext(I18nContext);
  return useMemo(
    () => (key: keyof D & string, values?: MessageValues) =>
      translateBuiltin(locale, defaults, key, values),
    [locale, defaults]
  );
}

/**
 * Резолвер текста ошибки валидации по активной локали: `messageKey` автора → явное `message` →
 * словарь локали по коду → встроенный английский → код. Идентичность функции меняется вместе с
 * локалью, поэтому показанные ошибки переводятся при смене языка без повторной валидации.
 *
 * `FormField` из `@reformer/cdk` использует его сам; вызывайте напрямую, если рисуете ошибки
 * своим компонентом.
 *
 * @example
 * ```tsx
 * function FieldErrors({ control }: { control: FieldNode<string> }) {
 *   const message = useValidationMessage();
 *   const { errors } = useFormControl(control);
 *   return <>{errors.map((error) => <span key={error.code}>{message(error)}</span>)}</>;
 * }
 * ```
 */
export function useValidationMessage(): (error: ValidationError) => string {
  const { locale } = useContext(I18nContext);
  return useMemo(() => {
    const i18n = createI18n(locale);
    return (error: ValidationError) => resolveValidationError(error, i18n);
  }, [locale]);
}
