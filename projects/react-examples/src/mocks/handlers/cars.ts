import { http, HttpResponse } from 'msw';
import { resolveCarModels } from '../resolvers';

export const handlers = [
  http.get('/api/v1/car-models', ({ request }) => {
    const url = new URL(request.url);
    const brand = url.searchParams.get('brand');
    const result = resolveCarModels(brand);
    return HttpResponse.json(result.body, { status: result.status });
  }),
];
