/**
 * Тексты замечаний формы «RegistrationForm»: правило несёт код, строку по коду даёт словарь.
 * Подключение: `<ValidationMessagesProvider messages={formMessages}>` (`@reformer/cdk`) над формой.
 */
import { defineIssueMessages } from '@reformer/core/i18n';

export const formMessages = defineIssueMessages({
  'username.required': 'Имя пользователя обязательно',
  'username.minLength': 'Минимум 3 символа',
  'username.pattern': 'Латиница, цифры, _ (3-20)',
  'username-taken': 'Имя пользователя уже занято',
  'email.required': 'Email обязателен',
  'email.email': 'Некорректный email',
  'email-taken': 'Email занят',
  'password.required': 'Пароль обязателен',
  'password.minLength': 'Минимум 8 символов',
  'weak-password': 'Нужны заглавные, строчные буквы и цифры',
  'confirmPassword.required': 'Подтвердите пароль',
  'passwords-mismatch': 'Пароли не совпадают',
  'fullName.required': 'Полное имя обязательно',
  'fullName.minLength': 'Минимум 2 символа',
  'phone.required': 'Телефон обязателен',
  'phone.pattern': 'Формат +7 (999) 123-45-67',
  'captcha.required': 'Введите captcha',
  'invalid-captcha': 'Неверная captcha. Попробуйте ABC123',
  'terms-required': 'Необходимо принять условия',
});
