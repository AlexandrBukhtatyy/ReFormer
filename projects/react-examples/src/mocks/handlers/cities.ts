import { http, HttpResponse } from 'msw';
import { resolveCities } from '../resolvers';

export const handlers = [
  http.get('/api/v1/cities', ({ request }) => {
    const url = new URL(request.url);
    const region = url.searchParams.get('region');
    const result = resolveCities(region);
    return HttpResponse.json(result.body, { status: result.status });
  }),
];
