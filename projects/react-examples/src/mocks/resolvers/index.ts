/**
 * Общие резолверы для MSW handlers и Vite plugin
 * Содержат логику обработки запросов без зависимости от MSW
 *
 * JSDoc комментарии используются для генерации OpenAPI спецификации
 * через swagger-jsdoc, из которой генерируются handlers и routes
 */

import { regionsByCountry } from '../data/regions';
import { citiesByRegion } from '../data/cities';
import { brands, cars } from '../data/cars';
import { MOCK_DICTIONARIES, type DictionariesResponse } from '../data/dictionaries';
import { MOCK_APPLICATIONS } from '../data/credit-applications';
import { EXISTING_USERS, REGISTERED_USERS, VALID_CAPTCHA, type User } from '../data/users';
import type { Option } from '../../pages/examples/complex-multy-step-form/types/option';
import type { CreditApplicationForm } from '../../pages/examples/complex-multy-step-form/types/credit-application';

export interface ResolverResult<T> {
  status: number;
  body: T;
}

/**
 * @openapi
 * /api/v1/regions:
 *   get:
 *     operationId: getRegions
 *     summary: Получение списка регионов
 *     tags: [Regions]
 *     responses:
 *       200:
 *         description: Список регионов
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Option'
 */
export function getRegions(): ResolverResult<Option[]> {
  return {
    status: 200,
    body: regionsByCountry['RU'] || [],
  };
}

/**
 * @openapi
 * /api/v1/cities:
 *   get:
 *     operationId: getCities
 *     summary: Получение городов по региону
 *     tags: [Cities]
 *     parameters:
 *       - name: region
 *         in: query
 *         description: Код региона
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Список городов
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Option'
 */
export function getCities(region: string | null): ResolverResult<Option[]> {
  const foundedCities = region && citiesByRegion[region.toLowerCase()];
  return {
    status: 200,
    body: foundedCities || [],
  };
}

/**
 * @openapi
 * /api/v1/car-models:
 *   get:
 *     operationId: getCarModels
 *     summary: Получение моделей автомобилей по марке
 *     tags: [Cars]
 *     parameters:
 *       - name: brand
 *         in: query
 *         description: Марка автомобиля
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Список моделей
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Option'
 */
export function getCarModels(brand: string | null): ResolverResult<Option[]> {
  const brandLower = brand?.toLowerCase();
  const foundedBrand = brands.find((b) => brandLower && b.toLowerCase().includes(brandLower));
  const foundedCars = foundedBrand && cars[foundedBrand];
  return {
    status: 200,
    body: foundedCars || [],
  };
}

/**
 * @openapi
 * /api/v1/dictionaries:
 *   get:
 *     operationId: getDictionaries
 *     summary: Получение справочников
 *     tags: [Dictionaries]
 *     responses:
 *       200:
 *         description: Справочники
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DictionariesResponse'
 */
export function getDictionaries(): ResolverResult<DictionariesResponse> {
  return {
    status: 200,
    body: MOCK_DICTIONARIES,
  };
}

/**
 * @openapi
 * /api/v1/credit-applications/{id}:
 *   get:
 *     operationId: getCreditApplication
 *     summary: Получение заявки по ID
 *     tags: [CreditApplications]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: ID заявки
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Данные заявки
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CreditApplication'
 *       404:
 *         description: Заявка не найдена
 */
export function getCreditApplication(
  id: string
): ResolverResult<Partial<CreditApplicationForm> | null> {
  const application = MOCK_APPLICATIONS[id];
  if (!application) {
    return { status: 404, body: null };
  }
  return { status: 200, body: application };
}

/**
 * @openapi
 * /api/v1/credit-applications:
 *   post:
 *     operationId: createCreditApplication
 *     summary: Создание новой заявки
 *     tags: [CreditApplications]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreditApplication'
 *     responses:
 *       201:
 *         description: Заявка создана
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CreateApplicationResult'
 */
export interface CreateApplicationResult {
  success: boolean;
  id: string;
  message: string;
}

export function createCreditApplication(data: unknown): ResolverResult<CreateApplicationResult> {
  const newId = String(Date.now());
  MOCK_APPLICATIONS[newId] = data as typeof MOCK_APPLICATIONS[string];
  return {
    status: 201,
    body: {
      success: true,
      id: newId,
      message: 'Заявка успешно сохранена',
    },
  };
}

/**
 * @openapi
 * /api/v1/auth/check-username:
 *   get:
 *     operationId: checkUsernameAvailability
 *     summary: Проверка доступности username
 *     tags: [Auth]
 *     parameters:
 *       - name: username
 *         in: query
 *         required: true
 *         description: Username для проверки
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Результат проверки
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UsernameCheckResult'
 */
export interface UsernameCheckResult {
  available: boolean;
  message?: string;
}

export function checkUsernameAvailability(username: string): ResolverResult<UsernameCheckResult> {
  // Имитация задержки сети (300-800ms)
  const userExists = EXISTING_USERS.some(
    (u) => u.username.toLowerCase() === username.toLowerCase()
  );

  if (userExists) {
    return {
      status: 200,
      body: {
        available: false,
        message: 'Имя пользователя уже занято',
      },
    };
  }

  return {
    status: 200,
    body: {
      available: true,
      message: 'Имя пользователя доступно',
    },
  };
}

/**
 * @openapi
 * /api/v1/auth/check-email:
 *   get:
 *     operationId: checkEmailAvailability
 *     summary: Проверка доступности email
 *     tags: [Auth]
 *     parameters:
 *       - name: email
 *         in: query
 *         required: true
 *         description: Email для проверки
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Результат проверки
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EmailCheckResult'
 */
export interface EmailCheckResult {
  available: boolean;
  message?: string;
}

export function checkEmailAvailability(email: string): ResolverResult<EmailCheckResult> {
  const emailExists = EXISTING_USERS.some(
    (u) => u.email.toLowerCase() === email.toLowerCase()
  );

  if (emailExists) {
    return {
      status: 200,
      body: {
        available: false,
        message: 'Email уже зарегистрирован',
      },
    };
  }

  return {
    status: 200,
    body: {
      available: true,
      message: 'Email доступен',
    },
  };
}

/**
 * @openapi
 * /api/v1/auth/validate-captcha:
 *   post:
 *     operationId: validateCaptcha
 *     summary: Валидация captcha
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               captcha:
 *                 type: string
 *             required:
 *               - captcha
 *     responses:
 *       200:
 *         description: Результат валидации
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CaptchaValidationResult'
 */
export interface CaptchaValidationResult {
  valid: boolean;
  message?: string;
}

export function validateCaptcha(captcha: string): ResolverResult<CaptchaValidationResult> {
  if (captcha === VALID_CAPTCHA) {
    return {
      status: 200,
      body: {
        valid: true,
        message: 'Captcha верна',
      },
    };
  }

  return {
    status: 200,
    body: {
      valid: false,
      message: 'Неверная captcha',
    },
  };
}

/**
 * @openapi
 * /api/v1/auth/register:
 *   post:
 *     operationId: registerUser
 *     summary: Регистрация нового пользователя
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterUserRequest'
 *     responses:
 *       201:
 *         description: Пользователь зарегистрирован
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RegisterUserResult'
 *       400:
 *         description: Ошибка валидации
 */
export interface RegisterUserRequest {
  username: string;
  email: string;
  password: string;
  fullName: string;
  phone: string;
  captcha: string;
  acceptTerms: boolean;
}

export interface RegisterUserResult {
  success: boolean;
  userId?: string;
  message: string;
}

export function registerUser(data: RegisterUserRequest): ResolverResult<RegisterUserResult> {
  // Проверка captcha
  if (data.captcha !== VALID_CAPTCHA) {
    return {
      status: 400,
      body: {
        success: false,
        message: 'Неверная captcha',
      },
    };
  }

  // Проверка уникальности username
  const usernameExists = EXISTING_USERS.some(
    (u) => u.username.toLowerCase() === data.username.toLowerCase()
  );
  if (usernameExists) {
    return {
      status: 400,
      body: {
        success: false,
        message: 'Имя пользователя уже занято',
      },
    };
  }

  // Проверка уникальности email
  const emailExists = EXISTING_USERS.some(
    (u) => u.email.toLowerCase() === data.email.toLowerCase()
  );
  if (emailExists) {
    return {
      status: 400,
      body: {
        success: false,
        message: 'Email уже зарегистрирован',
      },
    };
  }

  // Создание нового пользователя
  const newUser: User = {
    id: String(Date.now()),
    username: data.username,
    email: data.email,
    fullName: data.fullName,
    phone: data.phone,
    createdAt: new Date().toISOString(),
  };

  REGISTERED_USERS.push(newUser);

  return {
    status: 201,
    body: {
      success: true,
      userId: newUser.id,
      message: 'Регистрация успешно завершена!',
    },
  };
}

/**
 * @openapi
 * components:
 *   schemas:
 *     Option:
 *       type: object
 *       properties:
 *         value:
 *           type: string
 *         label:
 *           type: string
 *       required:
 *         - value
 *         - label
 *
 *     DictionariesResponse:
 *       type: object
 *       properties:
 *         banks:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Option'
 *         cities:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Option'
 *         propertyTypes:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Option'
 *
 *     CreditApplication:
 *       type: object
 *       description: Форма кредитной заявки
 *
 *     CreateApplicationResult:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         id:
 *           type: string
 *         message:
 *           type: string
 */
