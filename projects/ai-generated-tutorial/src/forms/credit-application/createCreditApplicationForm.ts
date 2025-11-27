import { creditApplicationBehaviors } from './schemas/behaviors/credit-application.behaviors';
import { creditApplicationSchema } from './schemas/credit-application.schema';
import { creditApplicationValidation } from './schemas/validators/credit-application.validators';
import type { CreditApplicationForm } from './types/credit-application.types';
import { createForm } from 'reformer';

export const createCreditApplicationForm = () => {
  return createForm<CreditApplicationForm>({
    form: creditApplicationSchema,
    behavior: creditApplicationBehaviors,
    validation: creditApplicationValidation,
  });
};
