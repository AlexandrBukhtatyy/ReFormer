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
  // Одна формулировка у обеих границ: пример показывает диапазон, а не два отдельных правила.
  'numberField.min': 'Значение — от 1 до 100',
  'numberField.max': 'Значение — от 1 до 100',
  'dateField.required': 'Дата обязательна',
  'dateField.pastDate': 'Дата не может быть в будущем',
  'isDateField.required': 'Дата обязательна',
  'isDateField.isDate': 'Введите корректную дату',
  'minDateField.minDate': 'Дата не может быть раньше 01.01.2020',
  'maxDateField.maxDate': 'Дата не может быть позже сегодня',
  'futureDateField.futureDate': 'Дата должна быть в будущем',
  'minAgeField.minAge': 'Минимальный возраст — 18 лет',
  'maxAgeField.maxAge': 'Максимальный возраст — 65 лет',
  'customField.required': 'Пароль обязателен',
});
