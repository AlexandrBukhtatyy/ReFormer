/**
 * M1: фабрика формы кредитной заявки.
 *
 * Архитектура M1: модель — источник истины значений; форма (ноды) держит UI/валидационное состояние
 * и ссылается на сигналы модели. Валидация/навигация по шагам остаются на легаси-инфраструктуре
 * (`FormWizard` + `validateForm` + `ValidationSchemaFn`): contextual-валидаторы читают значения через
 * proxy формы → а под M1 ноды формы привязаны к сигналам модели, поэтому легаси-движок работает.
 * Behavior настраивается отдельно (`setupCreditApplicationBehavior`) на стороне компонента.
 */

import { createForm, type FormProxy } from '@reformer/core';
import type { FormModel } from '@reformer/core';
import type { CreditApplicationForm } from '../types/credit-application';
import { createCreditApplicationModel } from './model';
import { creditApplicationSchema } from './schema';

export interface CreditApplicationFormM1 {
  /** Реактивная модель (источник истины значений). */
  model: FormModel<CreditApplicationForm>;
  /** Форма (ноды) для рендера/валидации/навигации. */
  form: FormProxy<CreditApplicationForm>;
}

/**
 * Создать модель + форму кредитной заявки (M1).
 * Behavior подключается отдельно после создания (нужен реестр сигнал→нода из `createForm`).
 */
export const createCreditApplicationFormM1 = (): CreditApplicationFormM1 => {
  const model = createCreditApplicationModel();
  const form = createForm<CreditApplicationForm>({ model, schema: creditApplicationSchema(model) });
  return { model, form };
};
