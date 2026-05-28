/**
 * Валидация формы регистрации (sync + async).
 */

import { type FieldPath, type Validator, type AsyncValidator } from '@reformer/core';
import {
  required,
  email,
  minLength,
  pattern,
  validate,
  validateAsync,
} from '@reformer/core/validators';
import type { RegistrationFormData } from '../RegistrationForm';

const checkUsernameAvailable: AsyncValidator<RegistrationFormData, string | undefined> = async (
  value
) => {
  if (!value || value.length < 3) return null;

  await new Promise((resolve) => setTimeout(resolve, 500));

  const response = await fetch(`/api/v1/auth/check-username?username=${encodeURIComponent(value)}`);
  const result = await response.json();

  if (!result.available) {
    return {
      code: 'username-taken',
      message: result.message || 'Имя пользователя занято',
    };
  }
  return null;
};

const checkEmailAvailable: AsyncValidator<RegistrationFormData, string | undefined> = async (
  value
) => {
  if (!value || !value.includes('@')) return null;

  await new Promise((resolve) => setTimeout(resolve, 500));

  const response = await fetch(`/api/v1/auth/check-email?email=${encodeURIComponent(value)}`);
  const result = await response.json();

  if (!result.available) {
    return {
      code: 'email-taken',
      message: result.message || 'Email уже зарегистрирован',
    };
  }
  return null;
};

const validatePasswordStrength: Validator<RegistrationFormData, string | undefined> = (value) => {
  if (!value) return null;
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
};

const validatePasswordsMatch: Validator<RegistrationFormData, string | undefined> = (
  value,
  _control,
  root
) => {
  const passwordValue = root.password.value.value;
  if (value && passwordValue && value !== passwordValue) {
    return {
      code: 'passwords-mismatch',
      message: 'Пароли не совпадают',
    };
  }
  return null;
};

const validateCaptchaCode: Validator<RegistrationFormData, string | undefined> = (value) => {
  if (value !== 'ABC123') {
    return {
      code: 'invalid-captcha',
      message: 'Неверная captcha. Попробуйте ABC123',
    };
  }
  return null;
};

const validateTermsAccepted: Validator<RegistrationFormData, boolean | undefined> = (value) => {
  if (!value) {
    return {
      code: 'terms-required',
      message: 'Необходимо принять условия использования',
    };
  }
  return null;
};

export const registrationValidation = (path: FieldPath<RegistrationFormData>) => {
  // Username — латиница, цифры, подчёркивания, 3-20 символов
  validate(path.username, required({ message: 'Имя пользователя обязательно' }));
  validate(path.username, minLength(3, { message: 'Минимум 3 символа' }));
  validate(
    path.username,
    pattern(/^[a-zA-Z0-9_]{3,20}$/, {
      message: 'Только латиница, цифры и подчеркивания (3-20 символов)',
    })
  );
  validateAsync(path.username, checkUsernameAvailable, { debounce: 500 });

  // Email
  validate(path.email, required({ message: 'Email обязателен' }));
  validate(path.email, email({ message: 'Некорректный email' }));
  validateAsync(path.email, checkEmailAvailable, { debounce: 500 });

  // Password
  validate(path.password, required({ message: 'Пароль обязателен' }));
  validate(path.password, minLength(8, { message: 'Минимум 8 символов' }));
  validate(path.password, validatePasswordStrength);

  // Confirm Password
  validate(path.confirmPassword, required({ message: 'Подтвердите пароль' }));
  validate(path.confirmPassword, validatePasswordsMatch);

  // Full Name
  validate(path.fullName, required({ message: 'Полное имя обязательно' }));
  validate(path.fullName, minLength(2, { message: 'Минимум 2 символа' }));

  // Phone — формат маски
  validate(path.phone, required({ message: 'Телефон обязателен' }));
  validate(
    path.phone,
    pattern(/^\+7 \(\d{3}\) \d{3}-\d{2}-\d{2}$/, {
      message: 'Введите телефон в формате +7 (999) 123-45-67',
    })
  );

  // Captcha
  validate(path.captcha, required({ message: 'Введите captcha' }));
  validate(path.captcha, validateCaptchaCode);

  // Accept Terms
  validate(path.acceptTerms, validateTermsAccepted);
};
