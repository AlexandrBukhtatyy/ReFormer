/**
 * Тексты замечаний страницы — словарь формы: правила несут код, строку по коду даёт словарь.
 * Подключён `ValidationMessagesProvider messages` на корне страницы.
 */
import { defineIssueMessages } from '@reformer/core/i18n';

export const registrationMessages = defineIssueMessages({
  // Правила формы
  'weak-password': 'Нужны заглавные, строчные буквы и цифры',
  'invalid-captcha': 'Неверная captcha. Попробуйте ABC123',
  'terms-required': 'Необходимо принять условия',
  'passwords-mismatch': 'Пароли не совпадают',
  'username.required': 'Имя пользователя обязательно',
  'username.minLength': 'Минимум 3 символа',
  'username.pattern': 'Латиница, цифры, _ (3-20)',
  'email.required': 'Email обязателен',
  'email.email': 'Некорректный email',
  'password.required': 'Пароль обязателен',
  'password.minLength': 'Минимум 8 символов',
  'confirmPassword.required': 'Подтвердите пароль',
  'fullName.required': 'Полное имя обязательно',
  'fullName.minLength': 'Минимум 2 символа',
  'phone.required': 'Телефон обязателен',
  'phone.pattern': 'Формат +7 (999) 123-45-67',
  'captcha.required': 'Введите captcha',

  // Ответ сервера: его текст приходит параметром, без него — свой
  'username-taken': (params) => String(params.serverMessage || 'Имя занято'),
  'email-taken': (params) => String(params.serverMessage || 'Email занят'),
});
