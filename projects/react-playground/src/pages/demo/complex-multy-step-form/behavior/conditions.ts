import { enableWhen, hideWhen, type BehaviorScope } from '@reformer/core/behaviors';
import {
  isBusinessLoan,
  isCarLoan,
  isEmployed,
  isMortgage,
  isSelfEmployed,
  isUnemployed,
  livesElsewhere,
} from '../model/predicates';
import type { CreditApplicationForm } from '../types/credit-application';

/**
 * Условные секции: включение полей и видимость секции — рядом.
 *
 * Видимость (`hideWhen`) исполняет рендерер; в варианте «React руками» те же условия из
 * `model/predicates.ts` читает JSX шагов.
 */
export function conditions({ model, schema }: BehaviorScope<CreditApplicationForm>): void {
  const mortgage = () => isMortgage(model.loanType);
  const carLoan = () => isCarLoan(model.loanType);
  const businessLoan = () => isBusinessLoan(model.loanType);
  const employed = () => isEmployed(model.employmentStatus);
  const selfEmployed = () => isSelfEmployed(model.employmentStatus);
  const unemployed = () => isUnemployed(model.employmentStatus);
  const separateResidence = () => livesElsewhere(model.sameAsRegistration);

  enableWhen([model.$.propertyValue, model.$.initialPayment], mortgage, {
    resetOnDisable: true,
  });
  hideWhen(schema.node('mortgage-section'), () => !mortgage());

  enableWhen([model.$.carBrand, model.$.carModel, model.$.carYear, model.$.carPrice], carLoan, {
    resetOnDisable: true,
  });
  hideWhen(schema.node('car-section'), () => !carLoan());

  enableWhen(
    [
      model.$.companyName,
      model.$.companyInn,
      model.$.companyPhone,
      model.$.companyAddress,
      model.$.position,
    ],
    employed,
    { resetOnDisable: true }
  );
  hideWhen(schema.node('employer-section'), () => !employed());

  // Бизнес-поля стоят в схеме дважды: на шаге «Кредит» (бизнес-кредит) и на шаге «Работа»
  // (самозанятый). Поля одни и те же — включает их статус занятости.
  enableWhen([model.$.businessType, model.$.businessInn, model.$.businessActivity], selfEmployed, {
    resetOnDisable: true,
  });
  hideWhen(schema.node('loan-business-section'), () => !businessLoan());
  hideWhen(schema.node('business-section'), () => !selfEmployed());

  hideWhen(schema.node('income-section'), unemployed);
  hideWhen(schema.node('unemployed-warning'), () => !unemployed());

  // Адрес проживания — группа: без сброса, значение копируется из адреса регистрации.
  enableWhen(model.$.residenceAddress, separateResidence);
  hideWhen(schema.node('residence-address-section'), () => !separateResidence());

  hideWhen(schema.node('properties-array'), () => !model.hasProperty);
  hideWhen(schema.node('existing-loans-array'), () => !model.hasExistingLoans);
  hideWhen(schema.node('co-borrowers-array'), () => !model.hasCoBorrower);
}
