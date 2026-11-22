/**
 * Тексты ошибок формы регистрации — из спеки `docs/specs/registration-form.md`, раздел
 * «Сообщения об ошибках». Ключ — `<поле>.<правило>`; порядок правил поля = порядок проверки.
 */
export const REGISTRATION_MESSAGES = {
  'username.required': 'Имя пользователя обязательно',
  'username.minLength': 'Минимум 3 символа',
  'username.pattern': 'Латиница, цифры, _ (3-20)',
  'username.taken': 'Имя уже занято',
  'email.required': 'Email обязателен',
  'email.email': 'Некорректный email',
  'email.taken': 'Email уже зарегистрирован',
  'password.required': 'Пароль обязателен',
  'password.minLength': 'Минимум 8 символов',
  'password.strength': 'Нужны заглавные, строчные буквы и цифры',
  'confirmPassword.required': 'Подтвердите пароль',
  'confirmPassword.match': 'Пароли не совпадают',
  'fullName.required': 'Полное имя обязательно',
  'fullName.minLength': 'Минимум 2 символа',
  'phone.required': 'Телефон обязателен',
  'phone.pattern': 'Формат +7 (999) 123-45-67',
  'captcha.required': 'Введите символы с картинки',
  'captcha.length': 'Нужно 6 символов',
  'captcha.invalid': 'Символы не совпадают с картинкой',
  'acceptTerms.required': 'Необходимо принять условия',
} as const;

export type RegistrationMessageKey = keyof typeof REGISTRATION_MESSAGES;

export const msg = (key: RegistrationMessageKey): string => REGISTRATION_MESSAGES[key];
