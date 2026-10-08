/**
 * Сборка кредитной заявки — одна на все способы реализации.
 *
 * Варианты отличаются только тем, что передают сверху: JSON-вариант — документ схемы и реестр,
 * renderer-варианты — `setup` со связкой узлов (`application/renderer.ts`).
 */

import { createForm, type CreateFormConfig } from '@reformer/core';
import { creditApplicationBehavior } from '../behavior';
import { createCreditApplicationModel } from '../model/model';
import { creditApplicationSchema } from '../schema/form';
import type { CreditApplicationForm } from '../types/credit-application';
import { creditApplicationValidation } from '../validation/form';

type Overrides = Pick<CreateFormConfig<CreditApplicationForm>, 'schema' | 'registry' | 'setup'>;

export const createCreditApplication = (overrides: Overrides = {}) =>
  createForm<CreditApplicationForm>({
    model: createCreditApplicationModel(),
    schema: creditApplicationSchema,
    behavior: creditApplicationBehavior,
    validation: creditApplicationValidation,
    ...overrides,
  });
