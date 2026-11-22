/**
 * Предметная часть формы регистрации, общая для всех реализаций: начальные значения, константы
 * правил из спеки, канонический payload. Правила валидации каждая реализация выражает средствами
 * своей библиотеки — здесь только числа и выражения, которые спека задаёт явно.
 */
import { CAPTCHA_LENGTH } from '../api/captcha';
import type { RegistrationPayload } from '../api/client';

export interface RegistrationValues {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
  fullName: string;
  phone: string;
  captcha: string;
  acceptTerms: boolean;
}

export const REGISTRATION_INITIAL: RegistrationValues = {
  username: '',
  email: '',
  password: '',
  confirmPassword: '',
  fullName: '',
  phone: '',
  captcha: '',
  acceptTerms: false,
};

/** Порядок полей на экране — он же порядок testid в DOM-контракте. */
export const REGISTRATION_FIELDS = [
  'username',
  'email',
  'password',
  'confirmPassword',
  'fullName',
  'phone',
  'captcha',
  'acceptTerms',
] as const satisfies readonly (keyof RegistrationValues)[];

export const USERNAME_MIN = 3;
export const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,20}$/;
// Формат email проверяет штатный валидатор каждой библиотеки (yup.email, z.email, ajv format,
// email() ReFormer); тестовые данные выбраны так, чтобы все они давали одинаковый ответ.
export const PASSWORD_MIN = 8;
export const isStrongPassword = (v: string) => /[A-Z]/.test(v) && /[a-z]/.test(v) && /\d/.test(v);
export const FULL_NAME_MIN = 2;
export const PHONE_MASK = '+7 (999) 999-99-99';
export const PHONE_PATTERN = /^\+7 \(\d{3}\) \d{3}-\d{2}-\d{2}$/;
export { CAPTCHA_LENGTH };

export const REGISTRATION_LABELS: Record<keyof RegistrationValues, string> = {
  username: 'Имя пользователя',
  email: 'Email',
  password: 'Пароль',
  confirmPassword: 'Подтвердите пароль',
  fullName: 'Полное имя',
  phone: 'Телефон',
  captcha: 'Символы с картинки',
  acceptTerms: 'Я принимаю условия использования',
};

export const REGISTRATION_PLACEHOLDERS: Partial<Record<keyof RegistrationValues, string>> = {
  username: 'Логин (латиница)',
  email: 'your@email.com',
  password: 'Минимум 8 символов',
  confirmPassword: 'Повторите пароль',
  fullName: 'Иван Иванов',
  phone: '+7 (999) 123-45-67',
  captcha: 'Введите 6 символов с картинки',
};

/** Канонический payload `POST /api/v1/auth/register` — без confirmPassword, строки обрезаны. */
export function toRegistrationPayload(v: RegistrationValues): RegistrationPayload {
  return {
    username: v.username.trim(),
    email: v.email.trim(),
    password: v.password,
    fullName: v.fullName.trim(),
    phone: v.phone,
    captcha: v.captcha.trim().toUpperCase(),
    acceptTerms: Boolean(v.acceptTerms),
  };
}
