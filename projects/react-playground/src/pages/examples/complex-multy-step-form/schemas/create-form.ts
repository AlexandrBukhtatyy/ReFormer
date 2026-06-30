/**
 * M1: фабрика формы кредитной заявки.
 *
 * Архитектура M1: модель — источник истины значений; форма (ноды) держит UI/валидационное состояние
 * и ссылается на сигналы модели. Валидация/навигация по шагам остаются на легаси-инфраструктуре
 * (`FormWizard` + `validateForm` + `ValidationSchemaFn`): contextual-валидаторы читают значения через
 * proxy формы → а под M1 ноды формы привязаны к сигналам модели, поэтому легаси-движок работает.
 * Поведение — декларативная схема `creditApplicationBehavior`, передаётся в `createForm({ behavior })`.
 */

import { createForm, type FormProxy } from '@reformer/core';
import type { FormModel } from '@reformer/core';
import type { CreditApplicationForm } from '../types/credit-application';
import { createCreditApplicationModel } from './model';
import { creditApplicationSchema } from './schema';
import { creditApplicationBehavior } from './behavior';

export interface CreditApplicationFormM1 {
  /** Реактивная модель (источник истины значений). */
  model: FormModel<CreditApplicationForm>;
  /** Форма (ноды) для рендера/валидации/навигации. */
  form: FormProxy<CreditApplicationForm>;
}

/**
 * Создать модель + форму кредитной заявки (M1).
 * Поведение запускается внутри `createForm` (после построения нод и реестра сигнал→нода).
 */
export const createCreditApplicationFormM1 = (): CreditApplicationFormM1 => {
  const model = createCreditApplicationModel();
  const form = createForm<CreditApplicationForm>({
    model,
    schema: creditApplicationSchema(model),
    behavior: creditApplicationBehavior,
  });
  return { model, form };
};
