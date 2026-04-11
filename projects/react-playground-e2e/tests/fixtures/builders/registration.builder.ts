/**
 * Data Builder для простой формы регистрации
 * Паттерн Builder для создания тестовых данных с поддержкой модификаторов
 */

// ============================================================================
// Типы для Registration Builder
// ============================================================================

export interface RegistrationFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  birthDate?: string;
  gender?: 'male' | 'female' | 'other';
  acceptTerms: boolean;
  subscribeNewsletter?: boolean;
}

export interface LoginFormData {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface PasswordResetData {
  email: string;
  newPassword?: string;
  confirmNewPassword?: string;
  resetCode?: string;
}

export interface ProfileData {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  birthDate?: string;
  gender?: 'male' | 'female' | 'other';
  avatar?: string;
  bio?: string;
  city?: string;
  country?: string;
}

// ============================================================================
// Registration Builder
// ============================================================================

export const registrationBuilder = {
  // ==========================================================================
  // Базовые сценарии регистрации
  // ==========================================================================

  /**
   * Полная валидная регистрация
   */
  valid: (): RegistrationFormData => ({
    firstName: 'Иван',
    lastName: 'Иванов',
    email: 'ivan.ivanov@example.com',
    phone: '+7 (999) 123-45-67',
    password: 'SecurePass123!',
    confirmPassword: 'SecurePass123!',
    birthDate: '1990-05-15',
    gender: 'male',
    acceptTerms: true,
    subscribeNewsletter: false,
  }),

  /**
   * Минимальная валидная регистрация (только обязательные поля)
   */
  minimal: (): RegistrationFormData => ({
    firstName: 'Иван',
    lastName: 'Иванов',
    email: 'ivan@example.com',
    phone: '+7 (999) 123-45-67',
    password: 'SecurePass123!',
    confirmPassword: 'SecurePass123!',
    acceptTerms: true,
  }),

  /**
   * Регистрация с подпиской на рассылку
   */
  withNewsletter: (): RegistrationFormData => ({
    ...registrationBuilder.valid(),
    subscribeNewsletter: true,
  }),

  /**
   * Регистрация женщины
   */
  female: (): RegistrationFormData => ({
    firstName: 'Мария',
    lastName: 'Петрова',
    email: 'maria.petrova@example.com',
    phone: '+7 (999) 987-65-43',
    password: 'SecurePass123!',
    confirmPassword: 'SecurePass123!',
    birthDate: '1992-08-22',
    gender: 'female',
    acceptTerms: true,
    subscribeNewsletter: true,
  }),

  // ==========================================================================
  // Данные для логина
  // ==========================================================================

  /**
   * Валидный логин
   */
  loginValid: (): LoginFormData => ({
    email: 'ivan.ivanov@example.com',
    password: 'SecurePass123!',
    rememberMe: false,
  }),

  /**
   * Логин с запоминанием
   */
  loginRememberMe: (): LoginFormData => ({
    email: 'ivan.ivanov@example.com',
    password: 'SecurePass123!',
    rememberMe: true,
  }),

  // ==========================================================================
  // Данные для сброса пароля
  // ==========================================================================

  /**
   * Запрос на сброс пароля
   */
  passwordResetRequest: (): PasswordResetData => ({
    email: 'ivan.ivanov@example.com',
  }),

  /**
   * Полный сброс пароля с новым паролем
   */
  passwordResetComplete: (): PasswordResetData => ({
    email: 'ivan.ivanov@example.com',
    newPassword: 'NewSecurePass456!',
    confirmNewPassword: 'NewSecurePass456!',
    resetCode: '123456',
  }),

  // ==========================================================================
  // Данные профиля
  // ==========================================================================

  /**
   * Полный профиль
   */
  profile: (): ProfileData => ({
    firstName: 'Иван',
    lastName: 'Иванов',
    email: 'ivan.ivanov@example.com',
    phone: '+7 (999) 123-45-67',
    birthDate: '1990-05-15',
    gender: 'male',
    bio: 'Разработчик программного обеспечения',
    city: 'Москва',
    country: 'Россия',
  }),

  /**
   * Минимальный профиль
   */
  profileMinimal: (): ProfileData => ({
    firstName: 'Иван',
    lastName: 'Иванов',
    email: 'ivan.ivanov@example.com',
  }),

  // ==========================================================================
  // Модификаторы для негативных сценариев
  // ==========================================================================

  /**
   * Невалидный email
   */
  withInvalidEmail: <T extends { email?: string }>(base: T): T => ({
    ...base,
    email: 'invalid-email',
  }),

  /**
   * Пустой email
   */
  withEmptyEmail: <T extends { email?: string }>(base: T): T => ({
    ...base,
    email: '',
  }),

  /**
   * Невалидный телефон
   */
  withInvalidPhone: <T extends { phone?: string }>(base: T): T => ({
    ...base,
    phone: 'invalid',
  }),

  /**
   * Пустой телефон
   */
  withEmptyPhone: <T extends { phone?: string }>(base: T): T => ({
    ...base,
    phone: '',
  }),

  /**
   * Слабый пароль (без спецсимволов)
   */
  withWeakPassword: <T extends { password?: string; confirmPassword?: string }>(
    base: T
  ): T => ({
    ...base,
    password: 'weak',
    confirmPassword: 'weak',
  }),

  /**
   * Короткий пароль
   */
  withShortPassword: <
    T extends { password?: string; confirmPassword?: string },
  >(
    base: T
  ): T => ({
    ...base,
    password: '123',
    confirmPassword: '123',
  }),

  /**
   * Пароли не совпадают
   */
  withMismatchedPasswords: <
    T extends { password?: string; confirmPassword?: string },
  >(
    base: T
  ): T => ({
    ...base,
    password: 'SecurePass123!',
    confirmPassword: 'DifferentPass456!',
  }),

  /**
   * Пустой пароль
   */
  withEmptyPassword: <
    T extends { password?: string; confirmPassword?: string },
  >(
    base: T
  ): T => ({
    ...base,
    password: '',
    confirmPassword: '',
  }),

  /**
   * Пустое имя
   */
  withEmptyFirstName: <T extends { firstName?: string }>(base: T): T => ({
    ...base,
    firstName: '',
  }),

  /**
   * Пустая фамилия
   */
  withEmptyLastName: <T extends { lastName?: string }>(base: T): T => ({
    ...base,
    lastName: '',
  }),

  /**
   * Имя со спецсимволами
   */
  withSpecialCharsInName: <T extends { firstName?: string }>(base: T): T => ({
    ...base,
    firstName: 'Ivan<script>',
  }),

  /**
   * Слишком длинное имя
   */
  withTooLongName: <T extends { firstName?: string }>(base: T): T => ({
    ...base,
    firstName: 'A'.repeat(256),
  }),

  /**
   * Не принятые условия
   */
  withoutAcceptedTerms: <T extends { acceptTerms?: boolean }>(base: T): T => ({
    ...base,
    acceptTerms: false,
  }),

  /**
   * Возраст меньше 18 лет
   */
  withAgeUnder18: <T extends { birthDate?: string }>(base: T): T => ({
    ...base,
    birthDate: '2010-01-01',
  }),

  /**
   * Дата рождения в будущем
   */
  withFutureBirthDate: <T extends { birthDate?: string }>(base: T): T => ({
    ...base,
    birthDate: '2030-01-01',
  }),

  /**
   * Уже существующий email (для тестов уникальности)
   */
  withExistingEmail: <T extends { email?: string }>(base: T): T => ({
    ...base,
    email: 'existing.user@example.com',
  }),

  // ==========================================================================
  // SQL Injection и XSS тесты
  // ==========================================================================

  /**
   * SQL Injection попытка в email
   */
  withSqlInjectionEmail: <T extends { email?: string }>(base: T): T => ({
    ...base,
    email: "'; DROP TABLE users; --",
  }),

  /**
   * XSS попытка в имени
   */
  withXssInName: <T extends { firstName?: string }>(base: T): T => ({
    ...base,
    firstName: '<script>alert("XSS")</script>',
  }),

  // ==========================================================================
  // Граничные случаи
  // ==========================================================================

  /**
   * Минимально допустимый пароль
   */
  withMinimalPassword: <
    T extends { password?: string; confirmPassword?: string },
  >(
    base: T
  ): T => ({
    ...base,
    password: 'Pass123!',
    confirmPassword: 'Pass123!',
  }),

  /**
   * Максимально длинный допустимый пароль
   */
  withMaxPassword: <T extends { password?: string; confirmPassword?: string }>(
    base: T
  ): T => {
    const maxPassword = 'A'.repeat(64) + '1!';
    return {
      ...base,
      password: maxPassword,
      confirmPassword: maxPassword,
    };
  },

  /**
   * Email с поддоменом
   */
  withSubdomainEmail: <T extends { email?: string }>(base: T): T => ({
    ...base,
    email: 'user@mail.subdomain.example.com',
  }),

  /**
   * Email с плюсом (gmail style)
   */
  withPlusEmail: <T extends { email?: string }>(base: T): T => ({
    ...base,
    email: 'user+tag@example.com',
  }),

  // ==========================================================================
  // Утилиты для генерации уникальных данных
  // ==========================================================================

  /**
   * Генерация уникального email с timestamp
   */
  withUniqueEmail: <T extends { email?: string }>(base: T): T => ({
    ...base,
    email: `test.user.${Date.now()}@example.com`,
  }),

  /**
   * Генерация данных с уникальным телефоном
   */
  withUniquePhone: <T extends { phone?: string }>(base: T): T => {
    const randomDigits = Math.floor(Math.random() * 10000000)
      .toString()
      .padStart(7, '0');
    return {
      ...base,
      phone: `+7 (999) ${randomDigits.slice(0, 3)}-${randomDigits.slice(3, 5)}-${randomDigits.slice(5, 7)}`,
    };
  },
};

export type RegistrationBuilder = typeof registrationBuilder;
