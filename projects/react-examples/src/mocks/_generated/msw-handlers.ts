/**
 * AUTO-GENERATED FILE - DO NOT EDIT
 * Generated from OpenAPI spec via scripts/generate-mocks.ts
 */

import { http, HttpResponse } from 'msw';
import * as resolvers from '../resolvers';

export const handlers = [
  http.get('/api/v1/regions', () => {
    const result = resolvers.getRegions();
    if (result.status === 404) {
      return new HttpResponse(null, { status: 404 });
    }
    return HttpResponse.json(result.body, { status: result.status });
  }),

  http.get('/api/v1/cities', ({ request }) => {
    const url = new URL(request.url);
    const region = url.searchParams.get('region');
    const result = resolvers.getCities(region);
    if (result.status === 404) {
      return new HttpResponse(null, { status: 404 });
    }
    return HttpResponse.json(result.body, { status: result.status });
  }),

  http.get('/api/v1/car-models', ({ request }) => {
    const url = new URL(request.url);
    const brand = url.searchParams.get('brand');
    const result = resolvers.getCarModels(brand);
    if (result.status === 404) {
      return new HttpResponse(null, { status: 404 });
    }
    return HttpResponse.json(result.body, { status: result.status });
  }),

  http.get('/api/v1/dictionaries', () => {
    const result = resolvers.getDictionaries();
    if (result.status === 404) {
      return new HttpResponse(null, { status: 404 });
    }
    return HttpResponse.json(result.body, { status: result.status });
  }),

  http.get('/api/v1/credit-applications/:id', ({ params, request }) => {
    const { id } = params;
    const result = resolvers.getCreditApplication(id);
    if (result.status === 404) {
      return new HttpResponse(null, { status: 404 });
    }
    return HttpResponse.json(result.body, { status: result.status });
  }),

  http.post('/api/v1/credit-applications', async ({ request }) => {
    const body = await request.json();
    const result = resolvers.createCreditApplication(body);
    if (result.status === 404) {
      return new HttpResponse(null, { status: 404 });
    }
    return HttpResponse.json(result.body, { status: result.status });
  }),

  http.get('/api/v1/auth/check-username', ({ request }) => {
    const url = new URL(request.url);
    const username = url.searchParams.get('username');
    const result = resolvers.checkUsernameAvailability(username);
    if (result.status === 404) {
      return new HttpResponse(null, { status: 404 });
    }
    return HttpResponse.json(result.body, { status: result.status });
  }),

  http.get('/api/v1/auth/check-email', ({ request }) => {
    const url = new URL(request.url);
    const email = url.searchParams.get('email');
    const result = resolvers.checkEmailAvailability(email);
    if (result.status === 404) {
      return new HttpResponse(null, { status: 404 });
    }
    return HttpResponse.json(result.body, { status: result.status });
  }),

  http.post('/api/v1/auth/validate-captcha', async ({ request }) => {
    const body = await request.json();
    const result = resolvers.validateCaptcha(body);
    if (result.status === 404) {
      return new HttpResponse(null, { status: 404 });
    }
    return HttpResponse.json(result.body, { status: result.status });
  }),

  http.post('/api/v1/auth/register', async ({ request }) => {
    const body = await request.json();
    const result = resolvers.registerUser(body);
    if (result.status === 404) {
      return new HttpResponse(null, { status: 404 });
    }
    return HttpResponse.json(result.body, { status: result.status });
  })
];
