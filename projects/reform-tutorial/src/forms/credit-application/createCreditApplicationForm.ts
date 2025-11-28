import { createForm } from 'reformer';
import { creditApplicationSchema } from './schemas/credit-application.schema';
import type { CreditApplicationForm } from './types/credit-application.types';

export const createCreditApplicationForm = () => {
  return createForm<CreditApplicationForm>(creditApplicationSchema);
};
