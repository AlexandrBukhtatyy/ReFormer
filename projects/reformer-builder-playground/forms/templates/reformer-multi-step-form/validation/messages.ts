// validation/messages.ts — тексты замечаний формы: словарь «код замечания → текст».
// Ваш файл: пишется один раз и при регенерации не затирается.

import { defineIssueMessages } from '@reformer/core/i18n';

/**
 * Тексты замечаний формы. Правила (validation/*.ts) несут только код и параметры; строку по коду
 * даёт этот словарь — его подключает страница (`ValidationMessagesProvider` в ReformerMultiStepForm.tsx).
 * Кода, которого здесь нет, словарь не касается: текст берётся из локали приложения.
 *
 * Свой текст одному полю — дайте правилу свой код и добавьте запись под ним:
 * `required({ code: 'email.required' })` → `'email.required': 'Укажите email'`.
 * Параметры правила подставляются в текст: `{minLength}`, `{max}`.
 */
export const formMessages = defineIssueMessages({
  required: 'Обязательное поле',
  date_future: 'Дата не может быть в будущем',
  phone: 'Введите корректный номер телефона',
  email: 'Введите корректный email',
  maxLength:
    'Не больше {maxLength, plural, one{# символа} few{# символов} many{# символов} other{# символа}}',
  min: 'Не меньше {min}',
  max: 'Не больше {max}',
  maxFiles:
    'Не больше {maxFiles, plural, one{# файла} few{# файлов} many{# файлов} other{# файла}}',
  maxFileSize: 'Файл {fileName} больше {maxFileSize}',
});
