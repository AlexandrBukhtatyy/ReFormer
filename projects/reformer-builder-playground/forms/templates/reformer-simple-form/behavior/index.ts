// @reformer-generated 6ea42c83ba2b
// behavior/index.ts — поведение формы: связи над моделью и правила узлов схемы.
// Пока файл не правили руками, билдер перегенерирует его из правил формы; правленный не трогает.

import {
  computeFrom,
  defineFormBehavior,
  enableWhen,
  hideWhen,
  type BehaviorScope,
} from '@reformer/core/behaviors';
import type { ReformerSimpleForm } from '../types/reformer-simple-form';

/** Правила поведения формы. Функцией — чтобы сборка добавила к ним отправку (application/create.ts). */
export function behaviorRules({ model, schema }: BehaviorScope<ReformerSimpleForm>): void {
  // Связи над моделью
  computeFrom([model.$.lastName, model.$.firstName], model.$.fullName, (lastName, firstName) =>
    [lastName, firstName].filter(Boolean).join(' ')
  );
  enableWhen(model.$.references, () => model.hasReferences, { resetOnDisable: true });

  // Правила узлов схемы
  hideWhen(schema.node('references'), () => !model.hasReferences);
  // Условная видимость секций — раскомментируйте и впишите условие:
  // hideWhen(schema.node('personal-section'), () => /* TODO: условие для «Личные данные» */ false);
  // hideWhen(schema.node('contacts-section'), () => /* TODO: условие для «Контакты» */ false);
  // hideWhen(schema.node('extra-section'), () => /* TODO: условие для «Дополнительно» */ false);
}

export const formBehavior = defineFormBehavior<ReformerSimpleForm>(behaviorRules);
