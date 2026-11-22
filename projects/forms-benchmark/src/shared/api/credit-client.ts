/**
 * API кредитной заявки поверх общего «сервера» (`request`): счётчики `__bench.api.calls` по
 * имени эндпоинта, латентность и `flush()` — как у регистрации (BENCH-CONTRACT §5).
 *
 * Что делает клиент сам (реализация НЕ добавляет своих debounce и кэша):
 * - `getCarModels` и `verifySmsCode` — debounce 300 мс по значению + кэш (`debouncedByKey`):
 *   вызов, вытесненный новым значением, отвечает `undefined` — «устарело», опции/ошибку не трогать;
 * - `getCities` — кэш по региону (повторный выбор региона и перемонтирование шага запроса не дают);
 * - пустой регион/марка — пустой список без запроса.
 *
 * При старте реализация вызывает `getDictionaries()` и `getRegions()` по одному разу (параллельно,
 * вместе с `getApplication` при `?application=1`); готовность страницы их не ждёт.
 */
import { request } from './server';
import { apiInspect } from './client';
import { debouncedByKey } from './debounce';
import {
  CAR_MODELS_BY_BRAND,
  CITIES_BY_REGION,
  CREDIT_APPLICATIONS,
  DICTIONARIES,
  REGIONS,
  SMS_VALID_CODE,
  type CreditDictionaries,
} from './credit-fixtures';
import {
  computeCredit,
  type CreditPayload,
  type CreditValues,
  type Option,
} from '../domain/credit';
import { CREDIT_SUBMIT_MESSAGE } from '../messages/credit';

export type { CreditDictionaries };

export interface SubmitApplicationResult {
  id: string;
  message: string;
}

const copyOptions = (options: readonly Option[] | undefined): Option[] =>
  (options ?? []).map((o) => ({ ...o }));

const citiesCache = new Map<string, Promise<Option[]>>();
const brandKey = (brand: string) => brand.trim().toLowerCase();

export const creditApi = {
  /** Endpoint `dictionaries`: банки и типы имущества (`properties[].type`). */
  getDictionaries(): Promise<CreditDictionaries> {
    return request('dictionaries', () => structuredClone(DICTIONARIES));
  },

  /** Endpoint `regions`: опции `registrationAddress.region` и `residenceAddress.region`. */
  getRegions(): Promise<Option[]> {
    return request('regions', () => copyOptions(REGIONS));
  },

  /** Endpoint `cities`: опции города региона; кэш по региону, `''` — `[]` без запроса. */
  getCities(region: string): Promise<Option[]> {
    if (!region) return Promise.resolve([]);
    let pending = citiesCache.get(region);
    if (!pending) {
      pending = request('cities', () => copyOptions(CITIES_BY_REGION[region]));
      citiesCache.set(region, pending);
      pending.catch(() => citiesCache.delete(region));
    }
    return pending;
  },

  /**
   * Endpoint `car-models`: опции `carModel` по марке (без учёта регистра и пробелов по краям).
   * Debounce 300 мс + кэш; `undefined` — вызов вытеснен более поздней маркой.
   */
  getCarModels: debouncedByKey<string, Option[]>(brandKey, (brand) =>
    brandKey(brand)
      ? request('car-models', () => copyOptions(CAR_MODELS_BY_BRAND[brandKey(brand)]))
      : Promise.resolve([])
  ),

  /**
   * Endpoint `application`: сохранённая заявка (есть только `'1'`) — полные значения формы,
   * вычисляемые посчитаны. Неизвестный id — отказ. Отметка `bench:prefill` — момент доставки.
   */
  getApplication(id: string): Promise<CreditValues> {
    return request('application', () => {
      const stored = CREDIT_APPLICATIONS[id];
      if (!stored) throw new Error(`Заявка с ID "${id}" не найдена`);
      const input = structuredClone(stored);
      return { ...input, ...computeCredit(input) };
    }).then((data) => {
      performance.mark('bench:prefill');
      return data;
    });
  },

  /**
   * Endpoint `sms-verify`: `true` — код верный. Debounce 300 мс + кэш; `undefined` — вытеснен.
   * Вызывается, только когда код прошёл синхронные правила (6 цифр).
   */
  verifySmsCode: debouncedByKey<string, boolean>(
    (code) => code,
    (code) => request('sms-verify', () => code === SMS_VALID_CODE)
  ),

  /** Endpoint `submit-application`: payload — строго `toCreditPayload(values)`. */
  submitApplication(payload: CreditPayload): Promise<SubmitApplicationResult> {
    return request('submit-application', () => {
      apiInspect.submissions.push(structuredClone(payload));
      return { id: `a${apiInspect.submissions.length}`, message: CREDIT_SUBMIT_MESSAGE };
    });
  },
};
