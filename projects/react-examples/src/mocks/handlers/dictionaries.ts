import { http, HttpResponse } from 'msw';
import { resolveDictionaries } from '../resolvers';

export { type DictionariesResponse } from '../data/dictionaries';

export const handlers = [
  http.get('/api/v1/dictionaries', () => {
    const result = resolveDictionaries();
    return HttpResponse.json(result.body, { status: result.status });
  }),
];
