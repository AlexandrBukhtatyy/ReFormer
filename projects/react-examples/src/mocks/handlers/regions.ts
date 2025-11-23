import { http, HttpResponse } from 'msw';
import { resolveRegions } from '../resolvers';

export const handlers = [
  http.get('/api/v1/regions', () => {
    const result = resolveRegions();
    return HttpResponse.json(result.body, { status: result.status });
  }),
];
