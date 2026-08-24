/**
 * Справочники формы: статические списки опций + асинхронные загрузчики.
 *
 * Всё, что уходит в `componentProps` как `'$dataSource(NAME)'`, регистрируется
 * из этого файла в `registry.ts`. Async-загрузчики дергает `form.behavior.ts`
 * через `onChange` (debounce + AbortSignal).
 */
import type { Option } from './types';

const NETWORK_DELAY = 400;

function delay<T>(value: T, signal?: AbortSignal, ms = NETWORK_DELAY): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => resolve(value), ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    });
  });
}

/** GET /api/v1/regions */
export const REGIONS: Option[] = [
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
    { value: 'troitsk', label: 'Троицк' },
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
  sverdlovsk: [
    { value: 'ekaterinburg', label: 'Екатеринбург' },
    { value: 'nizhny-tagil', label: 'Нижний Тагил' },
  ],
  tatarstan: [
    { value: 'kazan', label: 'Казань' },
    { value: 'naberezhnye-chelny', label: 'Набережные Челны' },
  ],
};

/** GET /api/v1/cities?region={region} */
export function loadCities(region: string, signal?: AbortSignal): Promise<Option[]> {
  return delay(CITIES_BY_REGION[region] ?? [], signal);
}

export const CAR_BRANDS: Option[] = [
  { value: 'toyota', label: 'Toyota' },
  { value: 'kia', label: 'Kia' },
  { value: 'lada', label: 'Lada' },
  { value: 'bmw', label: 'BMW' },
];

const MODELS_BY_BRAND: Record<string, Option[]> = {
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
  bmw: [
    { value: 'x5', label: 'X5' },
    { value: '3-series', label: '3 series' },
  ],
};

/** GET /api/v1/car-models?brand={brand} */
export function loadCarModels(brand: string, signal?: AbortSignal): Promise<Option[]> {
  return delay(MODELS_BY_BRAND[brand] ?? [], signal);
}

/** Динамический лимит из спеки: carYear.max = текущий год + 1. */
export const CURRENT_YEAR_PLUS_ONE = new Date().getFullYear() + 1;

/** Максимум кредита — не более 10 годовых доходов (динамический лимит спеки). */
export const MAX_LOAN_ABSOLUTE = 10_000_000;

export function maxLoanByIncome(totalIncome: number | null): number {
  if (!totalIncome || totalIncome <= 0) return MAX_LOAN_ABSOLUTE;
  return Math.min(MAX_LOAN_ABSOLUTE, Math.round(totalIncome * 12 * 10));
}

/** Максимальный срок — погашение до 70 лет. */
export function maxTermByAge(age: number | null): number {
  if (!age || age <= 0) return 240;
  return Math.max(6, Math.min(240, (70 - age) * 12));
}
