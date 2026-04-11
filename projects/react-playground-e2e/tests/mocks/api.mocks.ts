import { type Page, type Route } from '@playwright/test';
import {
  MOCK_CREDIT_APPLICATION_1,
  MOCK_CREDIT_APPLICATION_2,
  MOCK_EMPTY_APPLICATION,
} from './credit-application.mock';
import {
  MOCK_DICTIONARIES,
  MOCK_REGIONS,
  MOCK_CITIES,
  MOCK_CAR_MODELS,
} from './dictionaries.mock';

// ============================================================================
// Types
// ============================================================================

export interface MockApiOptions {
  /** Delay in ms before responding (default: 100) */
  delay?: number;
  /** Simulate error responses */
  simulateError?: boolean;
  /** Error status code (default: 500) */
  errorStatus?: number;
  /** Application ID to load (default: '1') */
  applicationId?: string;
}

// ============================================================================
// Individual API Mocks
// ============================================================================

/**
 * Mock for loading credit application by ID
 * GET /api/v1/credit-applications/{id}
 */
export async function mockCreditApplicationApi(page: Page, options?: MockApiOptions) {
  const { delay = 100, simulateError = false, errorStatus = 500 } = options ?? {};

  await page.route('**/api/v1/credit-applications/**', async (route: Route) => {
    const url = route.request().url();
    const idMatch = url.match(/credit-applications\/(\d+)/);
    const applicationId = idMatch?.[1] ?? '1';

    // Simulate network delay
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    if (simulateError) {
      return route.fulfill({
        status: errorStatus,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' }),
      });
    }

    // Select mock data based on ID
    let mockData;
    switch (applicationId) {
      case '1':
        mockData = MOCK_CREDIT_APPLICATION_1;
        break;
      case '2':
        mockData = MOCK_CREDIT_APPLICATION_2;
        break;
      default:
        mockData = MOCK_EMPTY_APPLICATION;
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockData),
    });
  });
}

/**
 * Mock for dictionaries (banks, cities, property types)
 * GET /api/v1/dictionaries
 */
export async function mockDictionariesApi(page: Page, options?: MockApiOptions) {
  const { delay = 100, simulateError = false, errorStatus = 500 } = options ?? {};

  await page.route('**/api/v1/dictionaries', async (route: Route) => {
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    if (simulateError) {
      return route.fulfill({
        status: errorStatus,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Failed to load dictionaries' }),
      });
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_DICTIONARIES),
    });
  });
}

/**
 * Mock for regions list
 * GET /api/v1/regions
 */
export async function mockRegionsApi(page: Page, options?: MockApiOptions) {
  const { delay = 50, simulateError = false, errorStatus = 500 } = options ?? {};

  await page.route('**/api/v1/regions', async (route: Route) => {
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    if (simulateError) {
      return route.fulfill({
        status: errorStatus,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Failed to load regions' }),
      });
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_REGIONS),
    });
  });
}

/**
 * Mock for cities by region
 * GET /api/v1/cities?region={region}
 */
export async function mockCitiesApi(page: Page, options?: MockApiOptions) {
  const { delay = 50, simulateError = false, errorStatus = 500 } = options ?? {};

  await page.route('**/api/v1/cities**', async (route: Route) => {
    const url = new URL(route.request().url());
    const region = url.searchParams.get('region') ?? '';

    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    if (simulateError) {
      return route.fulfill({
        status: errorStatus,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Failed to load cities' }),
      });
    }

    const cities = MOCK_CITIES[region] ?? MOCK_CITIES['moscow_region'];

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(cities),
    });
  });
}

/**
 * Mock for car models by brand
 * GET /api/v1/car-models?brand={brand}
 */
export async function mockCarModelsApi(page: Page, options?: MockApiOptions) {
  const { delay = 50, simulateError = false, errorStatus = 500 } = options ?? {};

  await page.route('**/api/v1/car-models**', async (route: Route) => {
    const url = new URL(route.request().url());
    const brand = url.searchParams.get('brand')?.toLowerCase() ?? '';

    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    if (simulateError) {
      return route.fulfill({
        status: errorStatus,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Failed to load car models' }),
      });
    }

    const models = MOCK_CAR_MODELS[brand] ?? [];

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(models),
    });
  });
}

/**
 * Mock for submitting credit application
 * POST /api/v1/credit-applications
 */
export async function mockSubmitApplicationApi(page: Page, options?: MockApiOptions) {
  const { delay = 200, simulateError = false, errorStatus = 500 } = options ?? {};

  await page.route('**/api/v1/credit-applications', async (route: Route) => {
    if (route.request().method() !== 'POST') {
      return route.continue();
    }

    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    if (simulateError) {
      return route.fulfill({
        status: errorStatus,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Failed to submit application' }),
      });
    }

    return route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'APP-' + Date.now(),
        status: 'submitted',
        message: 'Application submitted successfully',
      }),
    });
  });
}

// ============================================================================
// Combined Mock Function
// ============================================================================

/**
 * Setup all API mocks at once
 */
export async function mockAllApis(page: Page, options?: MockApiOptions) {
  await Promise.all([
    mockCreditApplicationApi(page, options),
    mockDictionariesApi(page, options),
    mockRegionsApi(page, options),
    mockCitiesApi(page, options),
    mockCarModelsApi(page, options),
    mockSubmitApplicationApi(page, options),
  ]);
}

/**
 * Setup mocks for happy path testing (fast, no errors)
 */
export async function mockAllApisForHappyPath(page: Page) {
  await mockAllApis(page, { delay: 50 });
}

/**
 * Setup mocks with errors for error handling tests
 */
export async function mockAllApisWithErrors(page: Page, options?: { errorStatus?: number }) {
  await mockAllApis(page, {
    delay: 50,
    simulateError: true,
    errorStatus: options?.errorStatus ?? 500,
  });
}

/**
 * Setup mocks with slow responses for loading state tests
 */
export async function mockAllApisWithDelay(page: Page, delayMs: number = 2000) {
  await mockAllApis(page, { delay: delayMs });
}
