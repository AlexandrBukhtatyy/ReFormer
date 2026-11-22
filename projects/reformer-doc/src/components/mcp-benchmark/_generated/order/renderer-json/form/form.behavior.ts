// @reformer-form-build 3aaeafd984317a1e собран сервером ReFormer из form.intent.json: форму меняют через сервер (form_build; в guided — form_start, затем form_edit), а не этот файл — правка руками отсоединит его от сборки, guided её отменит
/**
 * Поведение формы «Оформление заказа» — связи над моделью и правила узлов схемы.
 * Скрытие узла НЕ убирает поле из модели: чтобы оно перестало валидироваться,
 * рядом нужен enableWhen.
 */
import { defineFormBehavior, aggregateInto, applyEach, compute, copyFrom, disableWhen, enableWhen, exclusiveFlag, hideWhen, onChange, onComponentEvent, resetWhen, syncFields, transformValue } from '@reformer/core/behaviors';
import { validateModel } from '@reformer/core/validation';
import { formValidation } from './form.validation';
import { submitOrder } from './api';
import type { OformlenieZakazaShape } from './model';

export const formBehavior = defineFormBehavior<OformlenieZakazaShape>(({ model, schema }) => {
  disableWhen(model.$.deliveryAddress.city, () => model.deliveryMethod === "pickup", {"resetOnDisable":true});
  disableWhen(model.$.deliveryAddress.street, () => model.deliveryMethod === "pickup", {"resetOnDisable":true});
  disableWhen(model.$.deliveryAddress.house, () => model.deliveryMethod === "pickup", {"resetOnDisable":true});
  resetWhen(model.$.deliveryDate, () => model.deliveryMethod !== "courier");
  transformValue(model.$.promoCode, (value) => String(value).toUpperCase());
  enableWhen(model.$.discount, () => model.customerType === "company", {"resetOnDisable":true});
  compute(model.$.total, () => Math.round(model.subtotal * (1 - (model.discount ?? 0) / 100) * 100) / 100);
  onChange(model.$.customerType, () => { if (model.customerType === "person" && model.paymentMethod === "invoice") model.paymentMethod = "card"; });
  syncFields(model.$.receiptEmail, model.$.email);
  applyEach(model.$.items, defineFormBehavior(({ model: item }) => {
    compute(item.$.lineTotal, () => (Number(item.quantity) || 0) * (Number(item.price) || 0));
  }));
  exclusiveFlag(model.$.recipients, (row) => row.$.primary);
  aggregateInto(model.$.recipients, (rows) => rows.length === 0 || rows.some((row) => row.primary) ? [] : [{ index: 0, patch: { primary: true } }]);
  compute(model.$.subtotal, () => Number(model.items.map((_3) => (Number(_3.quantity) || 0) * (Number(_3.price) || 0)).reduce((_1, _2) => _1 + _2, 0)));
  disableWhen(model.$.billingAddress.city, () => model.billingSame);
  disableWhen(model.$.billingAddress.street, () => model.billingSame);
  disableWhen(model.$.billingAddress.house, () => model.billingSame);
  copyFrom(model.$.deliveryAddress.city, model.$.billingAddress.city, { when: () => model.billingSame });
  copyFrom(model.$.deliveryAddress.street, model.$.billingAddress.street, { when: () => model.billingSame });
  copyFrom(model.$.deliveryAddress.house, model.$.billingAddress.house, { when: () => model.billingSame });

  // Видимость узлов схемы — по `selector`.
  hideWhen(schema.node('birthDate'), () => !(model.customerType === "person"));
  hideWhen(schema.node('company.name'), () => !(model.customerType === "company"));
  hideWhen(schema.node('company.inn'), () => !(model.customerType === "company"));
  hideWhen(schema.node('deliveryDate'), () => !(model.deliveryMethod === "courier"));

  // События компонентов, эффекты рендера и хуки узлов схемы — по `selector`.
  onComponentEvent(schema.node('submit'), 'onClick', async () => { if (await validateModel(model, formValidation, { touch: true })) await submitOrder(model.get()); });
});
