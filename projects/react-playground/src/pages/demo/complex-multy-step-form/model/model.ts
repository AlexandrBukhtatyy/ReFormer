import { createModel, type FormModel } from '@reformer/core';
import type { CreditApplicationForm } from '../types/credit-application';
import { createInitialCreditApplication } from './initial-value';

/** Реактивная модель кредитной заявки — источник истины значений. */
export const createCreditApplicationModel = (): FormModel<CreditApplicationForm> =>
  createModel<CreditApplicationForm>(createInitialCreditApplication());
