// data-sources.ts — field options + async loaders (dataSources).
// Async loaders mock the spec endpoints (/api/v1/regions, /cities, /car-models) with a small delay.

import type { Option } from './types';

const delay = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(t);
      reject(new DOMException('Aborted', 'AbortError'));
    });
  });

// ── Static reference dictionaries ────────────────────────────────────────────
export const REGION_OPTIONS: Option[] = [
  { value: 'moscow', label: 'Москва' },
  { value: 'spb', label: 'Санкт-Петербург' },
  { value: 'novosibirsk', label: 'Новосибирская область' },
  { value: 'sverdlovsk', label: 'Свердловская область' },
  { value: 'tatarstan', label: 'Республика Татарстан' },
];

const CITIES_BY_REGION: Record<string, Option[]> = {
  moscow: [
    { value: 'moscow', label: 'Москва' },
    { value: 'zelenograd', label: 'Зеленоград' },
  ],
  spb: [
    { value: 'spb', label: 'Санкт-Петербург' },
    { value: 'pushkin', label: 'Пушкин' },
  ],
  novosibirsk: [
    { value: 'novosibirsk', label: 'Новосибирск' },
    { value: 'berdsk', label: 'Бердск' },
  ],
  sverdlovsk: [
    { value: 'ekaterinburg', label: 'Екатеринбург' },
    { value: 'nizhny-tagil', label: 'Нижний Тагил' },
  ],
  tatarstan: [
    { value: 'kazan', label: 'Казань' },
    { value: 'naberezhnye-chelny', label: 'Набережные Челны' },
  ],
};

const CAR_MODELS_BY_BRAND: Record<string, Option[]> = {
  toyota: [
    { value: 'camry', label: 'Camry' },
    { value: 'corolla', label: 'Corolla' },
    { value: 'rav4', label: 'RAV4' },
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

export const BANK_OPTIONS: Option[] = [
  { value: 'sberbank', label: 'Сбербанк' },
  { value: 'vtb', label: 'ВТБ' },
  { value: 'alfabank', label: 'Альфа-Банк' },
  { value: 'tinkoff', label: 'Т-Банк' },
];

// ── Async loaders (mock GET /api/v1/...) ─────────────────────────────────────
export async function fetchRegions(opts?: { signal?: AbortSignal }): Promise<Option[]> {
  await delay(300, opts?.signal);
  return REGION_OPTIONS;
}

export async function fetchCitiesByRegion(
  region: string,
  opts?: { signal?: AbortSignal }
): Promise<Option[]> {
  await delay(300, opts?.signal);
  return CITIES_BY_REGION[region] ?? [];
}

export async function fetchCarModelsByBrand(
  brand: string,
  opts?: { signal?: AbortSignal }
): Promise<Option[]> {
  await delay(300, opts?.signal);
  const key = brand.trim().toLowerCase();
  return CAR_MODELS_BY_BRAND[key] ?? [];
}
