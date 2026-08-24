/**
 * Справочники формы: статические наборы опций + асинхронные загрузчики.
 *
 * Асинхронные загрузчики принимают `{ signal }`, потому что вызываются из
 * `onChange(..., { debounce })`, который отменяет устаревший вызов через `AbortSignal`.
 * Реальные эндпоинты (`/api/v1/regions`, `/api/v1/cities`, `/api/v1/car-models`,
 * `/api/v1/dictionaries`) в этом примере заменены mock-функциями с задержкой.
 */

import type { Option } from './types';

export const LOAN_TYPE_OPTIONS: Option[] = [
  { value: 'consumer', label: 'Потребительский' },
  { value: 'mortgage', label: 'Ипотека' },
  { value: 'car', label: 'Автокредит' },
  { value: 'business', label: 'Бизнес' },
  { value: 'refinance', label: 'Рефинансирование' },
];

export const GENDER_OPTIONS: Option[] = [
  { value: 'male', label: 'Мужской' },
  { value: 'female', label: 'Женский' },
];

export const EMPLOYMENT_STATUS_OPTIONS: Option[] = [
  { value: 'employed', label: 'Работа по найму' },
  { value: 'selfEmployed', label: 'ИП / самозанятый' },
  { value: 'unemployed', label: 'Не работаю' },
  { value: 'retired', label: 'Пенсионер' },
  { value: 'student', label: 'Студент' },
];

export const MARITAL_STATUS_OPTIONS: Option[] = [
  { value: 'single', label: 'Не женат / не замужем' },
  { value: 'married', label: 'В браке' },
  { value: 'divorced', label: 'В разводе' },
  { value: 'widowed', label: 'Вдовец / вдова' },
];

export const EDUCATION_OPTIONS: Option[] = [
  { value: 'secondary', label: 'Среднее' },
  { value: 'specialized', label: 'Среднее специальное' },
  { value: 'higher', label: 'Высшее' },
  { value: 'postgraduate', label: 'Учёная степень' },
];

export const PROPERTY_TYPE_OPTIONS: Option[] = [
  { value: 'apartment', label: 'Квартира' },
  { value: 'house', label: 'Дом' },
  { value: 'land', label: 'Земельный участок' },
  { value: 'car', label: 'Автомобиль' },
  { value: 'other', label: 'Иное' },
];

/** Справочники, приходящие с сервера одним запросом. */
export type CreditDictionaries = {
  regions: Option[];
  banks: Option[];
  propertyTypes: Option[];
};

const REGIONS: Option[] = [
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

const CAR_MODELS_BY_BRAND: Record<string, Option[]> = {
  toyota: [
    { value: 'camry', label: 'Camry' },
    { value: 'corolla', label: 'Corolla' },
    { value: 'rav4', label: 'RAV4' },
  ],
  kia: [
    { value: 'rio', label: 'Rio' },
    { value: 'sportage', label: 'Sportage' },
    { value: 'ceed', label: "Cee'd" },
  ],
  lada: [
    { value: 'vesta', label: 'Vesta' },
    { value: 'granta', label: 'Granta' },
    { value: 'niva', label: 'Niva' },
  ],
  bmw: [
    { value: 'x3', label: 'X3' },
    { value: 'x5', label: 'X5' },
    { value: '3-series', label: '3 series' },
  ],
};

const BANKS: Option[] = [
  { value: 'sberbank', label: 'Сбербанк' },
  { value: 'vtb', label: 'ВТБ' },
  { value: 'alfa', label: 'Альфа-Банк' },
  { value: 'tinkoff', label: 'Т-Банк' },
];

/** Сетевая задержка mock-слоя (спека: 2 секунды на реальных эндпоинтах, здесь короче). */
const NETWORK_DELAY_MS = 400;

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new DOMException('Aborted', 'AbortError'));
      },
      { once: true }
    );
  });
}

/** GET /api/v1/regions */
export async function fetchRegions(opts?: { signal?: AbortSignal }): Promise<Option[]> {
  await delay(NETWORK_DELAY_MS, opts?.signal);
  return REGIONS;
}

/** GET /api/v1/cities?region={region} */
export async function fetchCitiesByRegion(
  region: string,
  opts?: { signal?: AbortSignal }
): Promise<Option[]> {
  await delay(NETWORK_DELAY_MS, opts?.signal);
  return CITIES_BY_REGION[region] ?? [];
}

/** GET /api/v1/car-models?brand={brand} */
export async function fetchCarModels(
  brand: string,
  opts?: { signal?: AbortSignal }
): Promise<Option[]> {
  await delay(NETWORK_DELAY_MS, opts?.signal);
  return CAR_MODELS_BY_BRAND[brand.trim().toLowerCase()] ?? [];
}

/** GET /api/v1/dictionaries */
export async function fetchDictionaries(opts?: {
  signal?: AbortSignal;
}): Promise<CreditDictionaries> {
  await delay(NETWORK_DELAY_MS, opts?.signal);
  return { regions: REGIONS, banks: BANKS, propertyTypes: PROPERTY_TYPE_OPTIONS };
}
