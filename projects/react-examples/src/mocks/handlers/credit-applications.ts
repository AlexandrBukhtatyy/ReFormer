import { http, HttpResponse } from 'msw';
import { resolveCreditApplication, createCreditApplication } from '../resolvers';

export const handlers = [
  http.get('/api/v1/credit-applications/:id', ({ params }) => {
    const { id } = params;
    const result = resolveCreditApplication(String(id));
    if (result.status === 404) {
      return new HttpResponse(null, { status: 404 });
    }
    return HttpResponse.json(result.body, { status: result.status });
  }),

  http.post('/api/v1/credit-applications', async ({ request }) => {
    const body = await request.json();
    const result = createCreditApplication(body);
    return HttpResponse.json(result.body, { status: result.status });
  }),
];
