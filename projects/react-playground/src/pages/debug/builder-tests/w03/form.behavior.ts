// @reformer-generated 868fa8041039
// form.behavior.ts — реактивное поведение модели (вычисляемые поля, enableWhen, copyFrom).
// МОК: заготовка, реализуйте по необходимости. Пишется один раз.

import { defineFormBehavior } from '@reformer/core/behaviors';
import type { W03Form } from './types';

export const formBehavior = defineFormBehavior<W03Form>(() => {});

// --- ПРИМЕР ↓ замените объявление выше на такое и оставьте нужные строки ---------------
// import { defineFormBehavior, compute, computeFrom, copyFrom, enableWhen } from '@reformer/core/behaviors';
//
// export const formBehavior = defineFormBehavior<W03Form>(({ model }) => {
//   // model.field — ЗНАЧЕНИЕ поля, model.$.field — его сигнал. Операторы принимают сигналы.
//   compute(model.$.total, () => (model.price ?? 0) * (model.qty ?? 0));
//   computeFrom([model.$.price, model.$.qty], model.$.total, (price, qty) => price * qty);
//   enableWhen(model.$.city, () => model.country !== null);
//   copyFrom(model.$.shippingAddress, model.$.billingAddress, { when: () => model.sameAddress });
// });
// --- конец примера ---------------------------------------------------------------------
