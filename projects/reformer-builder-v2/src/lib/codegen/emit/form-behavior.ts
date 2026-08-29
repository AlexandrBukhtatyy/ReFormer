/**
 * Эмиттер `form.behavior.ts` — реактивное поведение модели.
 *
 * Есть правила — печатаются они; нет — заготовка с примером. Пример оформлен блоком-заменой,
 * а не россыпью закомментированных строк внутри тела, и это вынужденно: тело обязано остаться
 * `() => {}`. Деструктуризация `({ model })` при пустом теле — ошибка `noUnusedParameters`,
 * то есть файл, который мы отдаём человеку, не собрался бы в его проекте.
 *
 * Границы `ПРИМЕР ↓` / `конец примера` — не украшение: по ним тест вырезает блок и проверяет
 * его отдельно. Закомментированный код не проверяется ничем и гниёт молча — прежний пример
 * дожил до переноса с четырьмя ошибками сразу.
 *
 * @module reformer-builder/lib/codegen/emit/form-behavior
 */

import { hasBehaviorRules } from '../../form-model/rules';
import type { EmitContext } from '../context';
import { formBehaviorFromRules } from './rules-bridge';

export function emitFormBehavior(ctx: EmitContext): string {
  if (hasBehaviorRules(ctx.rules)) return formBehaviorFromRules(ctx.rules, ctx.names);

  const { TypeName } = ctx.names;
  return `// form.behavior.ts — реактивное поведение модели (вычисляемые поля, enableWhen, copyFrom).
// МОК: заготовка, реализуйте по необходимости. Пишется один раз.

import { defineFormBehavior } from '@reformer/core/behaviors';
import type { ${TypeName} } from './types';

export const formBehavior = defineFormBehavior<${TypeName}>(() => {});

// --- ПРИМЕР ↓ замените объявление выше на такое и оставьте нужные строки ---------------
// import { defineFormBehavior, compute, computeFrom, copyFrom, enableWhen } from '@reformer/core/behaviors';
//
// export const formBehavior = defineFormBehavior<${TypeName}>(({ model }) => {
//   // model.field — ЗНАЧЕНИЕ поля, model.$.field — его сигнал. Операторы принимают сигналы.
//   compute(model.$.total, () => (model.price ?? 0) * (model.qty ?? 0));
//   computeFrom([model.$.price, model.$.qty], model.$.total, (price, qty) => price * qty);
//   enableWhen(model.$.city, () => model.country !== null);
//   copyFrom(model.$.shippingAddress, model.$.billingAddress, { when: () => model.sameAddress });
// });
// --- конец примера ---------------------------------------------------------------------
`;
}
