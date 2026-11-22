// validation/messages.ts — тексты замечаний формы: словарь «код замечания → текст» и язык формы.
// Ваш файл: пишется один раз и при регенерации не затирается.

import { defineIssueMessages, type FormLocale } from '@reformer/core/i18n';
import { ru } from '@reformer/core/locale/ru';

/**
 * Язык формы — тот, на котором написан словарь ниже. Страница задаёт его форме (`I18nProvider` в
 * ContactHexaForm.tsx): по нему склоняются тексты замечаний, пишутся единицы размера файла и
 * подписи кита (кнопки шагов). Так форма говорит по-русски при любой локали приложения.
 * `undefined` — форма говорит языком приложения: тогда его `I18nProvider` задаёт и склонения.
 */
export const formLocale: FormLocale | undefined = ru;

/**
 * Тексты замечаний формы. Правила (validation/*.ts) несут только код и параметры; строку по коду
 * даёт этот словарь — его подключает страница (`ValidationMessagesProvider` в ContactHexaForm.tsx).
 * Кода, которого здесь нет, словарь не касается: текст берётся из локали формы.
 *
 * Свой текст одному полю — дайте правилу свой код и добавьте запись под ним:
 * `required({ code: 'email.required' })` → `'email.required': 'Укажите email'`.
 * Параметры правила подставляются в текст: `{minLength}`, `{max}`.
 */
export const formMessages = defineIssueMessages({
  required: 'Обязательное поле',
  email: 'Введите корректный email',
});
