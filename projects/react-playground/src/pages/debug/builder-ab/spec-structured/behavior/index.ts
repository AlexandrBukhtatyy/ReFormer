// @reformer-generated e294a595163f
// behavior/index.ts — поведение формы: связи над моделью и правила узлов схемы.
// Пока файл не правили руками, билдер перегенерирует его из правил формы; правленный не трогает.

import { defineFormBehavior, type BehaviorScope } from '@reformer/core/behaviors';
import type { CreditApplicationForm } from '../types/credit-application';

/** Правила поведения формы. Функцией — чтобы сборка добавила к ним отправку (application/create.ts). */
export function behaviorRules(_scope: BehaviorScope<CreditApplicationForm>): void {
  // Шаг «Основная информация о кредите»
  // Условная видимость секций — раскомментируйте и впишите условие:
  // hideWhen(schema.node('osnovnaya-informatsiya-o-kredite-section'), () => /* TODO: условие для «Основная информация о кредите» */ false);
  // Шаг «Персональные данные»
  // Условная видимость секций — раскомментируйте и впишите условие:
  // hideWhen(schema.node('personalnye-dannye-section'), () => /* TODO: условие для «Персональные данные» */ false);
  // Шаг «Контактная информация»
  // Условная видимость секций — раскомментируйте и впишите условие:
  // hideWhen(schema.node('kontaktnaya-informatsiya-section'), () => /* TODO: условие для «Контактная информация» */ false);
  // Шаг «Информация о занятости»
  // Условная видимость секций — раскомментируйте и впишите условие:
  // hideWhen(schema.node('informatsiya-o-zanyatosti-section'), () => /* TODO: условие для «Информация о занятости» */ false);
  // Шаг «Дополнительная информация»
  // Условная видимость секций — раскомментируйте и впишите условие:
  // hideWhen(schema.node('dopolnitelnaya-informatsiya-section'), () => /* TODO: условие для «Дополнительная информация» */ false);
  // Шаг «Подтверждение и согласия»
  // Условная видимость секций — раскомментируйте и впишите условие:
  // hideWhen(schema.node('podtverzhdenie-i-soglasiya-section'), () => /* TODO: условие для «Подтверждение и согласия» */ false);
}

export const formBehavior = defineFormBehavior<CreditApplicationForm>(behaviorRules);

// --- ПРИМЕР ↓ замените функцию выше на такую и оставьте нужные строки ------------------
// import {
//   compute,
//   computeFrom,
//   copyFrom,
//   defineFormBehavior,
//   enableWhen,
//   hideWhen,
//   type BehaviorScope,
// } from '@reformer/core/behaviors';
//
// export function behaviorRules({ model, schema }: BehaviorScope<CreditApplicationForm>): void {
//   // model.field — ЗНАЧЕНИЕ поля, model.$.field — его сигнал. Операторы принимают сигналы.
//   compute(model.$.total, () => (model.price ?? 0) * (model.qty ?? 0));
//   computeFrom([model.$.price, model.$.qty], model.$.total, (price, qty) => price * qty);
//   enableWhen(model.$.city, () => model.country !== null);
//   copyFrom(model.$.shippingAddress, model.$.billingAddress, { when: () => model.sameAddress });
//
//   // Правила узлов схемы — по `selector` узла. Скрытие узла не убирает поле из модели:
//   // чтобы оно перестало валидироваться, рядом нужен enableWhen.
//   hideWhen(schema.node('details-section'), () => !model.hasDetails);
// }
// --- конец примера ---------------------------------------------------------------------
