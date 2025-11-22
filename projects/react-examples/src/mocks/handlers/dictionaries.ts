/**
 * MSW handler для справочников
 * GET /api/v1/dictionaries
 */

import { http, HttpResponse } from 'msw';

export interface DictionariesResponse {
  banks: Array<{ value: string; label: string }>;
  cities: Array<{ value: string; label: string }>;
  propertyTypes: Array<{ value: string; label: string }>;
}

const MOCK_DICTIONARIES: DictionariesResponse = {
  banks: [
    { value: 'sberbank', label: 'Сбербанк' },
    { value: 'vtb', label: 'ВТБ' },
    { value: 'alfabank', label: 'Альфа-Банк' },
    { value: 'tinkoff', label: 'Тинькофф' },
    { value: 'gazprombank', label: 'Газпромбанк' },
    { value: 'raiffeisen', label: 'Райффайзенбанк' },
    { value: 'rosbank', label: 'Росбанк' },
    { value: 'sovcombank', label: 'Совкомбанк' },
  ],
  cities: [
    { value: 'moscow', label: 'Москва' },
    { value: 'spb', label: 'Санкт-Петербург' },
    { value: 'novosibirsk', label: 'Новосибирск' },
    { value: 'ekaterinburg', label: 'Екатеринбург' },
    { value: 'kazan', label: 'Казань' },
    { value: 'nn', label: 'Нижний Новгород' },
    { value: 'chelyabinsk', label: 'Челябинск' },
    { value: 'samara', label: 'Самара' },
    { value: 'omsk', label: 'Омск' },
    { value: 'rostov', label: 'Ростов-на-Дону' },
  ],
  propertyTypes: [
    { value: 'apartment', label: 'Квартира' },
    { value: 'house', label: 'Дом' },
    { value: 'car', label: 'Автомобиль' },
    { value: 'land', label: 'Земельный участок' },
  ],
};

export const handlers = [
  // GET /api/v1/dictionaries - Получение справочников
  http.get('/api/v1/dictionaries', () => {
    return HttpResponse.json(MOCK_DICTIONARIES);
  }),
];
