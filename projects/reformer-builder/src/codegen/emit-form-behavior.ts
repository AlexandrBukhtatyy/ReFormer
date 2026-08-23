/**
 * Эмиттер `form.behavior.ts` (user-owned) — пустое реактивное поведение модели с примером.
 *
 * Пример оформлен блоком-заменой, а не россыпью закомментированных строк внутри тела, и это
 * вынужденно: тело обязано остаться `() => {}`. Деструктуризация `({ model })` при пустом теле —
 * ошибка TS6133 под `noUnusedParameters`, то есть файл, который мы отдаём пользователю, не
 * собрался бы в его проекте. Пример поэтому показывает объявление целиком — вместе с импортом
 * операторов, без которого раскомментированные строки дают «compute is not defined».
 *
 * Границы `ПРИМЕР ↓` / `конец примера` — не украшение: по ним тест вырезает блок, раскомментирует
 * и компилирует настоящим `tsc`. Закомментированный код не проверяется ничем и гниёт молча —
 * прежний пример дожил до сих пор с четырьмя ошибками сразу (аргумент у `compute`, `.value` на
 * значении модели, стрелка вместо `{ when }` у `copyFrom`, отсутствующий `model` в области
 * видимости).
 *
 * @module reformer-builder/codegen/emit-form-behavior
 */

import type { Names } from './naming';

export function emitFormBehavior(n: Names): string {
  return `// form.behavior.ts — реактивное поведение модели (вычисляемые поля, enableWhen, copyFrom).
// МОК: заготовка — реализуйте по необходимости. Пишется один раз.

import { defineFormBehavior } from '@reformer/core/behaviors';
import type { ${n.TypeName} } from './types';

export const formBehavior = defineFormBehavior<${n.TypeName}>(() => {});

// --- ПРИМЕР ↓ замените объявление выше на такое и оставьте нужные строки ---------------
// import { defineFormBehavior, compute, computeFrom, copyFrom, enableWhen } from '@reformer/core/behaviors';
//
// export const formBehavior = defineFormBehavior<${n.TypeName}>(({ model }) => {
//   // model.field — ЗНАЧЕНИЕ поля, model.$.field — его сигнал. Операторы принимают сигналы.
//   compute(model.$.total, () => (model.price ?? 0) * (model.qty ?? 0));
//   computeFrom([model.$.price, model.$.qty], model.$.total, (price, qty) => price * qty);
//   enableWhen(model.$.city, () => model.country !== null);
//   copyFrom(model.$.shippingAddress, model.$.billingAddress, { when: () => model.sameAddress });
// });
// --- конец примера ---------------------------------------------------------------------
`;
}
