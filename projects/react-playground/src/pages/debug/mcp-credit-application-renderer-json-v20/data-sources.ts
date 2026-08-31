// data-sources.ts — field options (constants) + async loaders (data sources).
// These values are bound to `$dataSource(NAME)` names in registry.ts.
// Reused across all render targets.

import type { FormProxy } from '@reformer/core';
import type { CoBorrower, ExistingLoan, Property, SelectOption } from './types';

// ---- Static option dictionaries -----------------------------------------

export const LOAN_TYPES: SelectOption[] = [
  { value: 'consumer', label: 'Потребительский' },
  { value: 'mortgage', label: 'Ипотека' },
  { value: 'car', label: 'Автокредит' },
  { value: 'business', label: 'Бизнес' },
  { value: 'refinancing', label: 'Рефинансирование' },
];

export const GENDERS: SelectOption[] = [
  { value: 'male', label: 'Мужской' },
  { value: 'female', label: 'Женский' },
];

export const EMPLOYMENT_STATUSES: SelectOption[] = [
  { value: 'employed', label: 'Работа по найму' },
  { value: 'selfEmployed', label: 'Индивидуальный предприниматель' },
  { value: 'unemployed', label: 'Не работаю' },
  { value: 'retired', label: 'Пенсионер' },
  { value: 'student', label: 'Студент' },
];

export const MARITAL_STATUSES: SelectOption[] = [
  { value: 'single', label: 'Холост / Не замужем' },
  { value: 'married', label: 'В браке' },
  { value: 'divorced', label: 'В разводе' },
  { value: 'widowed', label: 'Вдовец / Вдова' },
];

export const EDUCATION_LEVELS: SelectOption[] = [
  { value: 'secondary', label: 'Среднее' },
  { value: 'specialized', label: 'Среднее специальное' },
  { value: 'higher', label: 'Высшее' },
  { value: 'postgraduate', label: 'Послевузовское' },
];

export const PROPERTY_TYPES: SelectOption[] = [
  { value: 'apartment', label: 'Квартира' },
  { value: 'house', label: 'Дом' },
  { value: 'land', label: 'Земельный участок' },
  { value: 'commercial', label: 'Коммерческая недвижимость' },
  { value: 'garage', label: 'Гараж' },
];

export const REGIONS: SelectOption[] = [
  { value: 'moscow', label: 'Москва' },
  { value: 'spb', label: 'Санкт-Петербург' },
  { value: 'novosibirsk', label: 'Новосибирская область' },
  { value: 'ekaterinburg', label: 'Свердловская область' },
];

/** Max car production year — динамический лимит (текущий год + 1). */
export const CURRENT_YEAR_PLUS_ONE = new Date().getFullYear() + 1;

// ---- Async loaders (dynamic dependent options) --------------------------

const CITY_DB: Record<string, SelectOption[]> = {
  moscow: [
    { value: 'moscow', label: 'Москва' },
    { value: 'zelenograd', label: 'Зеленоград' },
  ],
  spb: [
    { value: 'spb', label: 'Санкт-Петербург' },
    { value: 'pushkin', label: 'Пушкин' },
  ],
  novosibirsk: [{ value: 'novosibirsk', label: 'Новосибирск' }],
  ekaterinburg: [{ value: 'ekaterinburg', label: 'Екатеринбург' }],
};

const CAR_MODEL_DB: Record<string, SelectOption[]> = {
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

/** GET /api/v1/cities?region= — mock async loader with delay + abort support. */
export async function loadCities(region: string, signal?: AbortSignal): Promise<SelectOption[]> {
  await delay(300, signal);
  return CITY_DB[region] ?? [];
}

/** GET /api/v1/car-models?brand= — mock async loader with delay + abort support. */
export async function loadCarModels(brand: string, signal?: AbortSignal): Promise<SelectOption[]> {
  await delay(300, signal);
  return CAR_MODEL_DB[brand.trim().toLowerCase()] ?? [];
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const id = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(id);
      reject(new DOMException('Aborted', 'AbortError'));
    });
  });
}

// ---- FormArray item-label functions -------------------------------------

export const PROPERTY_ITEM_LABEL = (_control: FormProxy<Property>, index: number): string =>
  `Имущество #${index + 1}`;

export const LOAN_ITEM_LABEL = (_control: FormProxy<ExistingLoan>, index: number): string =>
  `Кредит #${index + 1}`;

export const CO_BORROWER_ITEM_LABEL = (_control: FormProxy<CoBorrower>, index: number): string =>
  `Созаемщик #${index + 1}`;
