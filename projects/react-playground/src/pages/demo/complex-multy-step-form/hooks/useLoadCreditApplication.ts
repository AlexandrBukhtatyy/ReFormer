/**
 * Загрузка данных кредитной заявки.
 *
 * Состоянием загрузки владеет `AsyncBoundary` (self-managed режим): он вызывает
 * `loadCreditApplication` с `AbortSignal`, сам ведёт `loading`/`ready`/`error`,
 * отменяет устаревшие запросы и даёт кнопку повтора. Здесь остаются только две
 * чистые части — «сходить в сеть» и «разложить ответ по форме».
 */

import type { FormProxy } from '@reformer/core';
import type { CreditApplicationForm } from '../types/credit-application';
import { fetchCreditApplication, fetchDictionaries, type DictionariesResponse } from '../api';
import type { Property } from '../components/nested-forms/Property/PropertyForm';
import type { ExistingLoan } from '../components/nested-forms/ExistingLoan/ExistingLoanForm';

// ============================================================================
// Типы
// ============================================================================

/** Всё, что нужно экрану заявки: сама заявка + справочники. */
export interface CreditApplicationBundle {
  application: Partial<CreditApplicationForm>;
  dictionaries: DictionariesResponse;
}

// ============================================================================
// Загрузка
// ============================================================================

/**
 * Загрузить заявку и справочники как одну единицу.
 *
 * Оба запроса идут параллельно, и падение любого одинаково фатально для экрана —
 * поэтому это один `load`, а не два независимых состояния.
 *
 * @param applicationId - идентификатор заявки
 * @param signal - сигнал отмены от AsyncBoundary
 */
export async function loadCreditApplication(
  applicationId: string,
  signal?: AbortSignal
): Promise<CreditApplicationBundle> {
  const [applicationResponse, dictionariesResponse] = await Promise.all([
    fetchCreditApplication(applicationId, signal),
    fetchDictionaries(signal),
  ]);

  // Разные сообщения: пользователь должен понимать, что именно не загрузилось.
  if (applicationResponse?.status !== 200) throw new Error('Ошибка загрузки заявки');
  if (dictionariesResponse?.status !== 200) throw new Error('Ошибка загрузки справочников');

  return {
    application: applicationResponse.data,
    dictionaries: dictionariesResponse.data,
  };
}

// ============================================================================
// Раскладка ответа по форме
// ============================================================================

/**
 * Заполнить форму данными сервера и обновить динамические справочники.
 *
 * @param form - корневой FormProxy заявки
 * @param bundle - результат {@link loadCreditApplication}
 */
export function applyCreditApplication(
  form: FormProxy<CreditApplicationForm>,
  { application, dictionaries }: CreditApplicationBundle
): void {
  // patchValue рекурсивно заполняет вложенные формы и массивы, принимая Partial<T>.
  form.patchValue(application);

  // updateComponentProps откладываем: вызванный в том же такте, что и patchValue,
  // он попадает в ещё не отработавшие реактивные эффекты и preact бросает «Cycle detected».
  queueMicrotask(() => {
    form.registrationAddress.city.updateComponentProps({ options: dictionaries.cities });
    form.residenceAddress?.city.updateComponentProps({ options: dictionaries.cities });

    // forEach отдаёт GroupNode элементов массива, а не их значения.
    form.properties?.forEach((propertyNode: FormProxy<Property>) => {
      propertyNode.type.updateComponentProps({ options: dictionaries.propertyTypes });
    });

    form.existingLoans?.forEach((loanNode: FormProxy<ExistingLoan>) => {
      loanNode.bank.updateComponentProps({ options: dictionaries.banks });
    });
  });
}
