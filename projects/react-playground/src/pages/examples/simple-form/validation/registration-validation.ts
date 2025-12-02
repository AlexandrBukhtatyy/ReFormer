/**
 * Валидация формы регистрации
 * Включает синхронную и асинхронную валидацию
 */

import { type FieldPath } from '@reformer/core';
import { required, email, minLength, pattern, validate, validateAsync } from 'reformer/validators';
import type { RegistrationFormData } from '../RegistrationForm';

/**
 * Основная валидация формы регистрации
 */
export const registrationValidation = (path: FieldPath<RegistrationFormData>) => {
  // Username - только латиница, цифры, подчеркивания, 3-20 символов
  required(path.username, { message: 'Имя пользователя обязательно' });
  minLength(path.username, 3, { message: 'Минимум 3 символа' });
  pattern(path.username, /^[a-zA-Z0-9_]{3,20}$/, {
    message: 'Только латиница, цифры и подчеркивания (3-20 символов)',
  });

  // Async валидация уникальности username
  validateAsync(path.username, async (value) => {
    if (!value || value.length < 3) return null;

    // Задержка для имитации сетевого запроса
    await new Promise((resolve) => setTimeout(resolve, 500));

    const response = await fetch(`/api/v1/auth/check-username?username=${encodeURIComponent(value)}`);
    const result = await response.json();

    if (!result.available) {
      return { code: 'username-taken', message: result.message || 'Имя пользователя занято' };
    }

    return null;
  }, { debounce: 500 });

  // Email валидация
  required(path.email, { message: 'Email обязателен' });
  email(path.email, { message: 'Некорректный email' });

  // Async валидация уникальности email
  validateAsync(path.email, async (value) => {
    if (!value || !value.includes('@')) return null;

    await new Promise((resolve) => setTimeout(resolve, 500));

    const response = await fetch(`/api/v1/auth/check-email?email=${encodeURIComponent(value)}`);
    const result = await response.json();

    if (!result.available) {
      return { code: 'email-taken', message: result.message || 'Email уже зарегистрирован' };
    }

    return null;
  }, { debounce: 500 });

  // Password - минимум 8 символов, должен содержать заглавные, строчные и цифры
  required(path.password, { message: 'Пароль обязателен' });
  minLength(path.password, 8, { message: 'Минимум 8 символов' });

  validate(path.password, (value) => {
    const hasUpperCase = /[A-Z]/.test(value);
    const hasLowerCase = /[a-z]/.test(value);
    const hasDigit = /\d/.test(value);

    if (!hasUpperCase || !hasLowerCase || !hasDigit) {
      return {
        code: 'weak-password',
        message: 'Пароль должен содержать заглавные, строчные буквы и цифры',
      };
    }

    return null;
  });

  // Confirm Password - обязательно
  required(path.confirmPassword, { message: 'Подтвердите пароль' });

  // Валидация совпадения паролей
  validate(path.confirmPassword, (value, ctx) => {
    const passwordValue = ctx.form.password.value.value;

    if (value && passwordValue && value !== passwordValue) {
      return {
        code: 'passwords-mismatch',
        message: 'Пароли не совпадают',
      };
    }

    return null;
  });

  // Full Name
  required(path.fullName, { message: 'Полное имя обязательно' });
  minLength(path.fullName, 2, { message: 'Минимум 2 символа' });

  // Phone - должен соответствовать маске
  required(path.phone, { message: 'Телефон обязателен' });
  pattern(path.phone, /^\+7 \(\d{3}\) \d{3}-\d{2}-\d{2}$/, {
    message: 'Введите телефон в формате +7 (999) 123-45-67',
  });

  // Captcha
  required(path.captcha, { message: 'Введите captcha' });
  validate(path.captcha, (value) => {
    if (value !== 'ABC123') {
      return {
        code: 'invalid-captcha',
        message: 'Неверная captcha. Попробуйте ABC123',
      };
    }
    return null;
  });

  // Accept Terms
  validate(path.acceptTerms, (value) => {
    if (!value) {
      return {
        code: 'terms-required',
        message: 'Необходимо принять условия использования',
      };
    }
    return null;
  });
};
