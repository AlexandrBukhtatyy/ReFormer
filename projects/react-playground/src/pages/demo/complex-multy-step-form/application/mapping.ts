/**
 * Ответ сервера → модель и поля формы.
 */

import type { FormModel, FormProxy } from '@reformer/core';
import type { CreditApplicationForm } from '../types/credit-application';
import type { CreditApplicationData } from './load';

/**
 * Записать загруженную заявку в модель и раздать справочники полям.
 *
 * Загруженные значения становятся точкой отсчёта модели: форма не считается изменённой, а
 * `model.reset()` возвращает к ним.
 */
export function applyCreditApplication(
  target: { model: FormModel<CreditApplicationForm>; form: FormProxy<CreditApplicationForm> },
  { application, dictionaries }: CreditApplicationData
): void {
  const { model, form } = target;
  model.patch(application);
  model.captureInitial();

  // Справочники — следующим тактом: строки массивов к этому моменту уже построены.
  queueMicrotask(() => {
    form.registrationAddress.city.updateComponentProps({ options: dictionaries.cities });
    form.residenceAddress.city.updateComponentProps({ options: dictionaries.cities });
    form.properties.forEach((property) => {
      property.type.updateComponentProps({ options: dictionaries.propertyTypes });
    });
    form.existingLoans.forEach((existingLoan) => {
      existingLoan.bank.updateComponentProps({ options: dictionaries.banks });
    });
  });
}
