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
  http.get('/regions', ({ request }) => {
    const url = new URL(request.url);
    const country = url.searchParams.get('country');
    const foundedRegion = country && regionsByCountry[country?.toLocaleLowerCase()];

    if (!foundedRegion) {
      return new HttpResponse(null, { status: 404 });
    }

    return HttpResponse.json(foundedRegion);
  }),
];
