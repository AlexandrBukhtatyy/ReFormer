/**
 * Тексты замечаний страницы — словарь формы: правила несут код, строку по коду даёт словарь.
 * Подключён `ValidationMessagesProvider messages` на корне страницы.
 */
import { defineIssueMessages } from '@reformer/core/i18n';

export const imperativeHandlesMessages = defineIssueMessages({
  // Правила формы
  'email.required': 'Укажите email',
  'nickname.required': 'Укажите никнейм',
});
