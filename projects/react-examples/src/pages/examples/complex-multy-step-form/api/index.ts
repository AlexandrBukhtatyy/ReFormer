/**
 * API функции для домена кредитных заявок
 *
 * Содержит функции для динамической загрузки данных:
 * - Регионы по странам
 * - Города по регионам
 * - Модели автомобилей по маркам
 */

export { fetchRegions } from './fetch-regions';
export { fetchCities } from './fetch-cities';
export { fetchCarModels } from './fetch-car-models';
