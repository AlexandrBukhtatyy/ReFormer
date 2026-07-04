// data-sources.ts — static option dictionaries + async loaders (dataSources).
// Mock async loaders imitate GET /api/v1/cities?region= and GET /api/v1/car-models?brand=.
import type { Option } from './types';

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export const REGION_OPTIONS: Option[] = [
  { value: 'moscow', label: 'Москва' },
  { value: 'spb', label: 'Санкт-Петербург' },
  { value: 'novosibirsk', label: 'Новосибирская область' },
  { value: 'ekaterinburg', label: 'Свердловская область' },
  { value: 'kazan', label: 'Республика Татарстан' },
];

const CITIES_BY_REGION: Record<string, Option[]> = {
  moscow: [
    { value: 'moscow', label: 'Москва' },
    { value: 'zelenograd', label: 'Зеленоград' },
    { value: 'khimki', label: 'Химки' },
  ],
  spb: [
    { value: 'spb', label: 'Санкт-Петербург' },
    { value: 'pushkin', label: 'Пушкин' },
    { value: 'kolpino', label: 'Колпино' },
  ],
  novosibirsk: [
    { value: 'novosibirsk', label: 'Новосибирск' },
    { value: 'berdsk', label: 'Бердск' },
  ],
  ekaterinburg: [
    { value: 'ekaterinburg', label: 'Екатеринбург' },
    { value: 'nizhny-tagil', label: 'Нижний Тагил' },
  ],
  kazan: [
    { value: 'kazan', label: 'Казань' },
    { value: 'naberezhnye-chelny', label: 'Набережные Челны' },
  ],
};

const MODELS_BY_BRAND: Record<string, Option[]> = {
  toyota: [
    { value: 'camry', label: 'Camry' },
    { value: 'corolla', label: 'Corolla' },
    { value: 'rav4', label: 'RAV4' },
  ],
  kia: [
    { value: 'rio', label: 'Rio' },
    { value: 'sportage', label: 'Sportage' },
    { value: 'k5', label: 'K5' },
  ],
  lada: [
    { value: 'vesta', label: 'Vesta' },
    { value: 'granta', label: 'Granta' },
    { value: 'niva', label: 'Niva' },
  ],
  bmw: [
    { value: '3-series', label: '3 series' },
    { value: '5-series', label: '5 series' },
    { value: 'x5', label: 'X5' },
  ],
};

/** GET /api/v1/cities?region={region} — mock */
export async function fetchCitiesByRegion(
  region: string,
  opts?: { signal?: AbortSignal }
): Promise<Option[]> {
  await delay(300);
  if (opts?.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  return CITIES_BY_REGION[region] ?? [];
}

/** GET /api/v1/car-models?brand={brand} — mock (key by lowercased brand) */
export async function fetchCarModels(
  brand: string,
  opts?: { signal?: AbortSignal }
): Promise<Option[]> {
  await delay(300);
  if (opts?.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  return MODELS_BY_BRAND[brand.trim().toLowerCase()] ?? [];
}
