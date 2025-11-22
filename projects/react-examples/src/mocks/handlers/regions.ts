import { http, HttpResponse } from 'msw';
import type { Option } from '../../pages/examples/complex-multy-step-form/types/option';

const regionsByCountry: Record<string, Option[]> = {
  RU: [
    { value: 'moscow', label: 'Москва' },
    { value: 'spb', label: 'Санкт-Петербург' },
    { value: 'ekaterinburg', label: 'Екатеринбург' },
    { value: 'kazan', label: 'Казань' },
    { value: 'novosibirsk', label: 'Новосибирск' },
  ],
  KZ: [
    { value: 'almaty', label: 'Алматы' },
    { value: 'astana', label: 'Нур-Султан' },
    { value: 'shymkent', label: 'Шымкент' },
  ],
};

export const handlers = [
  // GET /api/v1/regions - Получение списка регионов
  http.get('/api/v1/regions', () => {
    // Возвращаем все регионы России по умолчанию
    return HttpResponse.json(regionsByCountry['RU'] || []);
  }),
];
