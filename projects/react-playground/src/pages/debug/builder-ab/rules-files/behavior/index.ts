// @reformer-generated de7ab2646bc6
// behavior/index.ts — поведение формы: связи над моделью и правила узлов схемы.
// Пока файл не правили руками, билдер перегенерирует его из правил формы; правленный не трогает.

import {
  computeFrom,
  defineFormBehavior,
  enableWhen,
  hideWhen,
  type BehaviorScope,
} from '@reformer/core/behaviors';
import type { ReformerMultiStepForm } from '../types/reformer-multi-step-form';

/** Правила поведения формы. Функцией — чтобы сборка добавила к ним отправку (application/create.ts). */
export function behaviorRules({ model, schema }: BehaviorScope<ReformerMultiStepForm>): void {
  // Связи над моделью
  computeFrom([model.$.lastName, model.$.firstName], model.$.fullName, (lastName, firstName) =>
    [lastName, firstName].filter(Boolean).join(' ')
  );
  enableWhen(model.$.references, () => model.hasReferences);

  // Шаг «Данные»
  // Условная видимость секций — раскомментируйте и впишите условие:
  // hideWhen(schema.node('personal-step'), () => /* TODO: условие для «Данные» */ false);

  // Шаг «Контакты»
  // Условная видимость секций — раскомментируйте и впишите условие:
  // hideWhen(schema.node('contacts-step'), () => /* TODO: условие для «Контакты» */ false);

  // Шаг «Дополнительно»
  hideWhen(schema.node('references'), () => !model.hasReferences);

  // «Должность» видна, только когда заполнен город
  hideWhen(schema.node('position'), () => !model.city);
  // Условная видимость секций — раскомментируйте и впишите условие:
  // hideWhen(schema.node('extra-step'), () => /* TODO: условие для «Дополнительно» */ false);
}

export const formBehavior = defineFormBehavior<ReformerMultiStepForm>(behaviorRules);
