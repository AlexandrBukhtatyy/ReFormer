/**
 * Сборка кредитной заявки — одна на обе ReFormer-реализации (как `application/create.ts`
 * эталонного демо): модель из начальных значений, поток шагов с правилами, стратегия
 * `afterFirstSubmit` с живой фазой шага после первого «Далее» (`liveAfterStep: 'change'`,
 * 13-multi-step.md, 33-validation-strategy.md); реализации добавляют схему (JSX — поля, JSON —
 * документ и реестр) и поведение.
 *
 * Старт страницы (BENCH-CONTRACT §8): справочники и заявка `?application=1` — параллельно, по
 * одному запросу; данные заявки — `initial` сборки (29-async-preload.md), поэтому форма
 * монтируется, когда они пришли. Справочники — сигналы: схема кладёт их в `componentProps`, нода
 * поля отдаёт значение и реактивно (32-async-options-loading.md). Отправка —
 * `bundle.submission.submit`; переход к шагу с ошибкой — опция потока (`./rules.ts`).
 */
import { useEffect, useState } from 'react';
import { arrayOf, createForm, type CreateFormConfig } from '@reformer/core';
import { signal, type ReadonlySignal } from '@reformer/core/signals';
import {
  CREDIT_INITIAL,
  emptyCoBorrower,
  emptyExistingLoan,
  emptyProperty,
  toCreditPayload,
  type CreditValues,
  type Option,
} from '../../../shared/domain/credit';
import { creditApi } from '../../../shared/api/credit-client';
import { serverConfig } from '../../../shared/api/server';
import { creditFlow } from './rules';
import './number-input';

/** Справочники формы: сигналы, их значение придёт после загрузки при старте страницы. */
export interface CreditDictionaries {
  regions: ReadonlySignal<Option[]>;
  propertyTypes: ReadonlySignal<Option[]>;
}

/** Начальные значения модели: массивы — `arrayOf(шаблон строки, строки)` для «Добавить». */
function creditInitial(values: CreditValues): CreditValues {
  const v = structuredClone(values);
  return {
    ...v,
    properties: arrayOf(emptyProperty, v.properties),
    existingLoans: arrayOf(emptyExistingLoan, v.existingLoans),
    coBorrowers: arrayOf(emptyCoBorrower, v.coBorrowers),
  };
}

export const createCreditForm = (
  initial: CreditValues,
  config: Pick<CreateFormConfig<CreditValues>, 'schema' | 'registry' | 'behavior'>
) =>
  createForm<CreditValues>({
    initial: creditInitial(initial),
    validation: { strategy: 'afterFirstSubmit', liveAfterStep: 'change' },
    flow: creditFlow,
    ...config,
  });

/**
 * Старт страницы: справочники (сигналы для `componentProps` схемы) и исходные значения. Загрузка —
 * по одному запросу на монтирование страницы, как у остальных реализаций.
 */
export function useCreditStart(): {
  dictionaries: CreditDictionaries;
  initial: CreditValues | null;
} {
  const application = serverConfig.application;
  const [dictionaries] = useState(() => ({
    regions: signal<Option[]>([]),
    propertyTypes: signal<Option[]>([]),
  }));
  const [initial, setInitial] = useState(application ? null : CREDIT_INITIAL);

  useEffect(() => {
    void creditApi.getRegions().then((options) => (dictionaries.regions.value = options));
    void creditApi
      .getDictionaries()
      .then((d) => (dictionaries.propertyTypes.value = d.propertyTypes));
    if (application) void creditApi.getApplication(application).then(setInitial);
  }, [dictionaries, application]);

  return { dictionaries, initial };
}

/** Обработчик отправки: канонический payload, текст подтверждения — из ответа. */
export const sendCredit = async (values: CreditValues): Promise<string> =>
  (await creditApi.submitApplication(toCreditPayload(values))).message;
