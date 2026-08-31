/**
 * API функции для домена кредитных заявок
 *
 * Эндпоинты согласно спецификации:
 * - GET  /api/v1/credit-applications/{id} - Получение заявки
 * - POST /api/v1/credit-applications       - Создание заявки
 * - GET  /api/v1/dictionaries              - Справочники
 * - GET  /api/v1/regions                   - Список регионов
 * - GET  /api/v1/cities?region={region}    - Города по региону
 * - GET  /api/v1/car-models?brand={brand}  - Модели авто по марке
 */

export { fetchCreditApplication } from './fetch-credit-application';
export { submitCreditApplication } from './submit-credit-application';
export { fetchDictionaries, type DictionariesResponse } from './fetch-dictionaries';
export { fetchRegions } from './fetch-regions';
export { fetchCities } from './fetch-cities';
export { fetchCarModels } from './fetch-car-models';
