/**
 * Behavior-схема JSON-варианта кредитной заявки — тонкая обёртка.
 *
 * Вся visibility/navigation/submit/lifecycle/загрузка данных живёт в едином
 * `createCreditApplicationRenderBehavior` (renderer-вариант) и переиспользуется здесь —
 * одна behavior-схема на оба типа рендера.
 *
 * JSON-схема статична и не выражает рантайм-сущности (FormProxy, конфиг валидации), поэтому
 * единственное, что добавляет JSON-вариант, — инъекция `form` + валидации в wizard через `onInit`
 * (build-time hook, до первого рендера). Валидацию фабрика формы собирает сама и передаёт третьим
 * аргументом — здесь её остаётся только донести до узла.
 */

import { onInit, type RenderBehaviorFn } from '@reformer/renderer-react';
import type { FormProxy, FormModel, FormValidationBundle } from '@reformer/core';
import type { CreditApplicationForm } from '../complex-multy-step-form/types/credit-application';
import { makeCreditValidationConfig } from '../complex-multy-step-form/schemas/validation';
import { createCreditApplicationRenderBehavior } from '../complex-multy-step-form-renderer/render-behavior';

export function createCreditApplicationJsonRenderBehavior(
  form: FormProxy<CreditApplicationForm>,
  model: FormModel<CreditApplicationForm>,
  validation?: FormValidationBundle<CreditApplicationForm>
): RenderBehaviorFn<CreditApplicationForm> {
  return (schema) => {
    // JSON-схема не знает про FormProxy/валидацию — инъектим их в wizard до первого рендера.
    // `validation` приходит из фабрики формы; запасной путь (сборка из модели) оставлен для
    // вызовов, где форму собирают без фабрики.
    onInit(schema.node('wizard'), () => {
      schema.node('wizard').patchProps({
        form,
        ...(validation ?? makeCreditValidationConfig(model)),
      });
    });

    // Вся visibility/navigation/submit/lifecycle/загрузка данных — из единого shared-поведения.
    createCreditApplicationRenderBehavior(form)(schema);
  };
}
