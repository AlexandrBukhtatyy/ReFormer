/**
 * M1: фабрика формы кредитной заявки.
 *
 * Архитектура M1: модель — источник истины значений; форма (ноды) держит UI/валидационное состояние
 * и ссылается на сигналы модели. Сборка идёт одним вызовом `createCoreForm`: он создаёт форму по
 * схеме, запускает декларативное поведение и собирает валидацию (`validateStep`/`validateAll`) —
 * ровно тот конфиг, который ждёт `FormWizard`.
 */

import { createCoreForm, type CoreForm, type FormValidationBundle } from '@reformer/core';
import type { CreditApplicationForm } from '../types/credit-application';
import { createCreditApplicationModel } from './model';
import { creditApplicationSchema } from './schema';
import { creditApplicationBehavior } from './behavior';
import { creditApplicationValidation } from './validation';

/**
 * Бандл кредитной заявки: модель, форма и собранная валидация визарда. `validation` здесь
 * обязательна — правила заданы в конфиге, а `FormWizard` требует `config` без `undefined`.
 */
export interface CreditApplicationFormM1 extends CoreForm<CreditApplicationForm> {
  validation: FormValidationBundle<CreditApplicationForm>;
}

/**
 * Создать модель + форму + валидацию кредитной заявки (M1).
 *
 * Вызывается ровно один раз на страницу — через `useFormBundle`, который держит бандл стабильным
 * между рендерами (в отличие от `useMemo`, чей кэш React вправе сбросить).
 */
export const createCreditApplicationFormM1 = (): CreditApplicationFormM1 => {
  const bundle = createCoreForm<CreditApplicationForm>({
    model: createCreditApplicationModel(),
    schema: creditApplicationSchema,
    behavior: creditApplicationBehavior,
    validation: creditApplicationValidation,
  });
  // Правила переданы выше, значит бандл их несёт — сужаем тип для `FormWizard`.
  return { ...bundle, validation: bundle.validation! };
};
