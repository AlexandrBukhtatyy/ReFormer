/**
 * Mock данные пользователей для проверки уникальности
 */

export interface User {
  id: string;
  username: string;
  email: string;
  fullName: string;
  phone: string;
  createdAt: string;
}

// Существующие пользователи (для проверки уникальности)
export const EXISTING_USERS: User[] = [
  {
    id: '1',
    username: 'johndoe',
    email: 'john@example.com',
    fullName: 'John Doe',
    phone: '+7 (999) 123-45-67',
    createdAt: '2024-01-01T00:00:00Z',
  },
  {
    id: '2',
    username: 'janedoe',
    email: 'jane@example.com',
    fullName: 'Jane Doe',
    phone: '+7 (999) 765-43-21',
    createdAt: '2024-01-02T00:00:00Z',
  },
  {
    id: '3',
    username: 'admin',
    email: 'admin@example.com',
    fullName: 'Admin User',
    phone: '+7 (999) 000-00-00',
    createdAt: '2024-01-01T00:00:00Z',
  },
];

// Правильная captcha для тестирования
export const VALID_CAPTCHA = 'ABC123';

/** Данные, которыми предзаполняется форма регистрации при переходе по приглашению. */
export interface RegistrationPrefill {
  username: string;
  email: string;
  fullName: string;
  phone: string;
}

/**
 * Приглашения → префилл формы. Код `RF-BROKEN` намеренно отсутствует: по нему эндпоинт отдаёт 404,
 * и это единственный способ увидеть в примере состояние ошибки AsyncBoundary с кнопкой «Повторить».
 */
export const INVITE_PREFILLS: Record<string, RegistrationPrefill> = {
  'RF-2026': {
    username: 'newuser',
    email: 'new@example.com',
    fullName: 'Новый Пользователь',
    phone: '+7 (999) 111-22-33',
  },
};

// Хранилище зарегистрированных пользователей
export const REGISTERED_USERS: User[] = [...EXISTING_USERS];
