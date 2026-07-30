/**
 * Эмиттер `form.behavior.ts` (user-owned) — пустое реактивное поведение модели с примерами.
 *
 * @module reformer-builder/codegen/emit-form-behavior
 */

import type { Names } from './naming';

export function emitFormBehavior(n: Names): string {
  return `// form.behavior.ts — реактивное поведение модели (вычисляемые поля, enableWhen, copyFrom).
// МОК: заготовка — реализуйте по необходимости. Пишется один раз.

import { defineFormBehavior } from '@reformer/core/behaviors';
import type { ${n.TypeName} } from './types';

export const formBehavior = defineFormBehavior<${n.TypeName}>(() => {
  // Примеры (раскомментируйте и адаптируйте):
  // compute(model.$.total, (m) => (m.a ?? 0) + (m.b ?? 0));
  // enableWhen(model.$.city, () => model.country.value !== null);
  // copyFrom(model.$.billingAddress, model.$.shippingAddress, () => model.sameAddress.value === true);
});
`;
}
