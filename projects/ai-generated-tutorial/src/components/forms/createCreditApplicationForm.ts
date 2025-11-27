import { createForm } from 'reformer';
import type { CreditApplicationForm } from '@/types/credit-application.types';
import { creditApplicationSchema } from '@/schemas/credit-application.schema';
import { creditApplicationBehaviors } from '@/schemas/behaviors/credit-application.behaviors';
import { creditApplicationValidation } from '@/schemas/validators/credit-application.validators';

export const createCreditApplicationForm = () => {
  return createForm<CreditApplicationForm>({
    form: creditApplicationSchema,
    behavior: creditApplicationBehaviors,
    validation: creditApplicationValidation,
  });
};
