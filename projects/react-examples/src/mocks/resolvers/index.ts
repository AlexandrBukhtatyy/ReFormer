// Общие резолверы для MSW handlers и Vite plugin
// Содержат логику обработки запросов без зависимости от MSW

import { regionsByCountry } from '../data/regions';
import { citiesByRegion } from '../data/cities';
import { brands, cars } from '../data/cars';
import { MOCK_DICTIONARIES, type DictionariesResponse } from '../data/dictionaries';
import { MOCK_APPLICATIONS } from '../data/credit-applications';
import type { Option } from '../../pages/examples/complex-multy-step-form/types/option';
import type { CreditApplicationForm } from '../../pages/examples/complex-multy-step-form/types/credit-application';

export interface ResolverResult<T> {
  status: number;
  body: T;
}

// GET /api/v1/regions
export function resolveRegions(): ResolverResult<Option[]> {
  return {
    status: 200,
    body: regionsByCountry['RU'] || [],
  };
}

// GET /api/v1/cities?region={region}
export function resolveCities(region: string | null): ResolverResult<Option[]> {
  const foundedCities = region && citiesByRegion[region.toLowerCase()];
  return {
    status: 200,
    body: foundedCities || [],
  };
}

// GET /api/v1/car-models?brand={brand}
export function resolveCarModels(brand: string | null): ResolverResult<Option[]> {
  const brandLower = brand?.toLowerCase();
  const foundedBrand = brands.find((b) => brandLower && b.toLowerCase().includes(brandLower));
  const foundedCars = foundedBrand && cars[foundedBrand];
  return {
    status: 200,
    body: foundedCars || [],
  };
}

// GET /api/v1/dictionaries
export function resolveDictionaries(): ResolverResult<DictionariesResponse> {
  return {
    status: 200,
    body: MOCK_DICTIONARIES,
  };
}

// GET /api/v1/credit-applications/:id
export function resolveCreditApplication(
  id: string
): ResolverResult<Partial<CreditApplicationForm> | null> {
  const application = MOCK_APPLICATIONS[id];
  if (!application) {
    return { status: 404, body: null };
  }
  return { status: 200, body: application };
}

interface CreateApplicationResult {
  success: boolean;
  id: string;
  message: string;
}

// POST /api/v1/credit-applications
export function createCreditApplication(data: unknown): ResolverResult<CreateApplicationResult> {
  const newId = String(Date.now());
  MOCK_APPLICATIONS[newId] = data as typeof MOCK_APPLICATIONS[string];
  return {
    status: 201,
    body: {
      success: true,
      id: newId,
      message: 'Заявка успешно сохранена',
    },
  };
}
