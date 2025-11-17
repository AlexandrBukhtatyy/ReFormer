import { http, HttpResponse } from 'msw';
import type { Option } from '../../pages/examples/complex-multy-step-form/types/option';

const citiesByRegion: Record<string, Option[]> = {
  moscow: [
    { value: 'moscow_center', label: 'Центральный округ' },
    { value: 'moscow_north', label: 'Северный округ' },
    { value: 'moscow_south', label: 'Южный округ' },
  ],
  spb: [
    { value: 'spb_center', label: 'Центральный район' },
    { value: 'spb_nevsky', label: 'Невский район' },
    { value: 'spb_vasilievsky', label: 'Василеостровский район' },
  ],
};

export const handlers = [
  http.get('/cities', ({ request }) => {
    const url = new URL(request.url);
    const region = url.searchParams.get('region');
    const foundedRegion = region && citiesByRegion[region?.toLocaleLowerCase()];

    if (!foundedRegion) {
      return new HttpResponse(null, { status: 404 });
    }

    return HttpResponse.json(foundedRegion);
  }),
];
