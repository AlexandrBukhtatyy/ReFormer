import { createForm } from 'reformer';
import { creditApplicationSchema } from './schemas/credit-application';
import { creditApplicationBehaviors } from './schemas/behaviors/credit-application.behaviors';
import type { CreditApplicationForm } from './types/credit-application.types';

export const createCreditApplicationForm = () => {
  return createForm<CreditApplicationForm>({
    form: creditApplicationSchema,
    behavior: creditApplicationBehaviors,
  });
};
