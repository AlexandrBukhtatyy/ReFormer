/**
 * Справочники и асинхронные загрузчики опций (мок эндпоинтов
 * GET /api/insurance/dictionaries и GET /api/insurance/car-models/{brand}).
 */
import { TRAVEL_DESTINATIONS, type Option, type TravelDestination } from './types';

export const delay = (ms: number, signal?: AbortSignal): Promise<void> =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    });
  });

export interface Dictionaries {
  carBrands: Option[];
  regions: Option[];
  countries: Option<TravelDestination>[];
}

const DICTIONARIES: Dictionaries = {
  carBrands: [
    { value: 'toyota', label: 'Toyota' },
    { value: 'bmw', label: 'BMW' },
    { value: 'kia', label: 'Kia' },
    { value: 'lada', label: 'Lada' },
  ],
  regions: [
    { value: 'moscow', label: 'Москва' },
    { value: 'spb', label: 'Санкт-Петербург' },
  ],
  countries: TRAVEL_DESTINATIONS,
};

const CAR_MODELS: Record<string, Option[]> = {
  toyota: [
    { value: 'camry', label: 'Camry' },
    { value: 'corolla', label: 'Corolla' },
    { value: 'rav4', label: 'RAV4' },
  ],
  bmw: [
    { value: '3-series', label: '3 Series' },
    { value: '5-series', label: '5 Series' },
    { value: 'x5', label: 'X5' },
  ],
  kia: [
    { value: 'rio', label: 'Rio' },
    { value: 'sportage', label: 'Sportage' },
  ],
  lada: [
    { value: 'vesta', label: 'Vesta' },
    { value: 'granta', label: 'Granta' },
  ],
};

export async function loadDictionaries(): Promise<Dictionaries> {
  await delay(300);
  return DICTIONARIES;
}

export async function loadCarModels(brand: string, signal?: AbortSignal): Promise<Option[]> {
  await delay(300, signal);
  return CAR_MODELS[brand] ?? [];
}
