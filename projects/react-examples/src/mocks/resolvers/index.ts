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
