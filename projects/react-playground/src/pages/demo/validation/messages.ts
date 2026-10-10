/**
 * Тексты замечаний страницы — словарь формы: правила несут код, строку по коду даёт словарь.
 * Подключён `ValidationMessagesProvider messages` на корне страницы.
 */
import { defineIssueMessages } from '@reformer/core/i18n';

export const validationExamplesMessages = defineIssueMessages({
  // Правила формы
  'too-short': 'Минимум 8 символов',
  'no-digit': 'Должна быть хотя бы одна цифра',
  'no-letter': 'Должна быть хотя бы одна буква',
  'requiredField.required': 'Это поле обязательно',
  'emailField.required': 'Email обязателен',
  'emailField.email': 'Введите корректный email',
  'minLengthField.required': 'Поле обязательно',
  'minLengthField.minLength': 'Минимум 5 символов',
  'maxLengthField.maxLength': 'Максимум 10 символов',
  'minField.required': 'Введите число',
  'minField.min': 'Минимум 10',
  'maxField.required': 'Введите число',
  'maxField.max': 'Максимум 100',
  'patternField.required': 'Поле обязательно',
  'patternField.pattern': 'Только буквы',
  'urlField.required': 'URL обязателен',
  'urlField.url': 'Введите корректный URL',
  'phoneField.required': 'Телефон обязателен',
  'phoneField.phone': 'Введите российский номер телефона',
  'numberField.required': 'Число обязательно',
  'numberField.isNumber': 'Должно быть числом',
  'numberField.integer': 'Только целое число',
  'numberField.min': 'Минимум 1',
  'numberField.max': 'Максимум 100',
  'dateField.required': 'Дата обязательна',
  'dateField.pastDate': 'Дата не может быть в будущем',
  'customField.required': 'Пароль обязателен',
});
