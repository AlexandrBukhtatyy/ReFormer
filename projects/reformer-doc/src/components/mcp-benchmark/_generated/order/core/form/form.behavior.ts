// @reformer-form-build 98eb5c885a61615b собран сервером ReFormer из form.intent.json: форму меняют через сервер (form_build; в guided — form_start, затем form_edit), а не этот файл — правка руками отсоединит его от сборки, guided её отменит
/**
 * Поведение формы «Оформление заказа» — реактивные связи над моделью.
 */
import { defineFormBehavior, aggregateInto, applyEach, compute, copyFrom, disableWhen, enableWhen, exclusiveFlag, onChange, resetWhen, syncFields, transformValue } from '@reformer/core/behaviors';
import type { OformlenieZakazaShape } from './model';

export const formBehavior = defineFormBehavior<OformlenieZakazaShape>(({ model }) => {
  enableWhen(model.$.birthDate, () => model.customerType === "person");
  enableWhen(model.$.company.name, () => model.customerType === "company");
  enableWhen(model.$.company.inn, () => model.customerType === "company");
  disableWhen(model.$.deliveryAddress.city, () => model.deliveryMethod === "pickup", {"resetOnDisable":true});
  copyFrom(model.$.deliveryAddress.city, model.$.billingAddress.city, { when: () => model.billingSame });
  disableWhen(model.$.billingAddress.city, () => model.billingSame);
  disableWhen(model.$.deliveryAddress.street, () => model.deliveryMethod === "pickup", {"resetOnDisable":true});
  copyFrom(model.$.deliveryAddress.street, model.$.billingAddress.street, { when: () => model.billingSame });
  disableWhen(model.$.billingAddress.street, () => model.billingSame);
  disableWhen(model.$.deliveryAddress.house, () => model.deliveryMethod === "pickup", {"resetOnDisable":true});
  copyFrom(model.$.deliveryAddress.house, model.$.billingAddress.house, { when: () => model.billingSame });
  disableWhen(model.$.billingAddress.house, () => model.billingSame);
  enableWhen(model.$.deliveryDate, () => model.deliveryMethod === "courier");
  resetWhen(model.$.deliveryDate, () => model.deliveryMethod !== "courier");
  transformValue(model.$.promoCode, (value) => (value ?? "").toUpperCase());
  disableWhen(model.$.discount, () => model.customerType !== "company", {"resetOnDisable":true});
  compute(model.$.total, () => Math.round(model.subtotal * (100 - (model.discount ?? 0))) / 100);
  onChange(model.$.customerType, () => { if (model.customerType === "person" && model.paymentMethod === "invoice") model.paymentMethod = "card"; });
  syncFields(model.$.receiptEmail, model.$.email);
  applyEach(model.$.items, defineFormBehavior(({ model: item }) => {
    compute(item.$.lineTotal, () => (Number(item.quantity) || 0) * (Number(item.price) || 0));
  }));
  exclusiveFlag(model.$.recipients, (row) => row.$.primary);
  aggregateInto(model.$.recipients, (rows) => rows.length === 0 || rows.some((row) => row.primary) ? [] : [{ index: 0, patch: { primary: true } }]);
  compute(model.$.subtotal, () => model.items.map((_3) => (Number(_3.quantity) || 0) * (Number(_3.price) || 0)).reduce((_1, _2) => _1 + _2, 0));
});
