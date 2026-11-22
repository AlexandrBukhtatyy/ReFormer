// @reformer-form-build 5df59756e47583d9 собран сервером ReFormer из form.intent.json: форму меняют через сервер (form_build; в guided — form_start, затем form_edit), а не этот файл — правка руками отсоединит его от сборки, guided её отменит
/**
 * Валидация формы «Оформление заказа» — правила над МОДЕЛЬЮ, не в схеме разметки.
 * Подключение: createForm({ …, validation: formValidation }).
 */
import { applyEach, defineValidation, validate, validateAsync, validateWhen } from '@reformer/core/validation';
import { email, futureDate, integer, max, maxLength, min, minAge, minLength, pattern, required } from '@reformer/core/validators';
import type { OformlenieZakazaShape, ItemsItem, RecipientsItem } from './model';

/** Правила строки массива `items`: пути — от элемента. */
const itemsRowRules = defineValidation<ItemsItem>(({ model }) => {
  validate(model.$.title, [required({ code: 'items.title.required' })]);
  validate(model.$.quantity, [required({ code: 'items.quantity.required' }), integer({ code: 'items.quantity.integer' }), min(1, { code: 'items.quantity.min' }), max(99, { code: 'items.quantity.max' })]);
  validate(model.$.price, [required({ code: 'items.price.required' }), min(0, { code: 'items.price.min' })]);
});

/** Правила строки массива `recipients`: пути — от элемента. */
const recipientsRowRules = defineValidation<RecipientsItem>(({ model }) => {
  validate(model.$.email, [required({ code: 'recipients.email.required' }), email({ code: 'recipients.email.email' })]);
});

export const formValidation = defineValidation<OformlenieZakazaShape>(({ model, cross }) => {
  validate(model.$.customerType, [required({ code: 'customerType.required' })]);
  validate(model.$.contact.lastName, [required({ code: 'contact.lastName.required' }), minLength(2, { code: 'contact.lastName.minLength' })]);
  validate(model.$.contact.firstName, [required({ code: 'contact.firstName.required' }), minLength(2, { code: 'contact.firstName.minLength' })]);
  validate(model.$.email, [required({ code: 'email.required' }), email({ code: 'email.email' })]);
  validate(model.$.phone, [required({ code: 'phone.required' }), pattern(/^\+7 \(\d{3}\) \d{3}-\d{2}-\d{2}$/, { code: 'phone.pattern' })]);
  validateWhen(() => model.customerType === "person", () => {
    validate(model.$.birthDate, [required({ code: 'birthDate.required' }), minAge(18, { code: 'birthDate.minAge' })]);
  });
  validateWhen(() => model.customerType === "company", () => {
    validate(model.$.company.name, [required({ code: 'company.name.required' })]);
  });
  validateWhen(() => model.customerType === "company", () => {
    validate(model.$.company.inn, [required({ code: 'company.inn.required' }), pattern(/^\d{10}$/, { code: 'company.inn.pattern' })]);
  });
  validate(model.$.deliveryMethod, [required({ code: 'deliveryMethod.required' })]);
  validateWhen(() => model.deliveryMethod !== "pickup", () => {
    validate(model.$.deliveryAddress.city, [required({ code: 'deliveryAddress.city.required' })]);
  });
  validateWhen(() => !model.billingSame, () => {
    validate(model.$.billingAddress.city, [required({ code: 'billingAddress.city.required' })]);
  });
  validateWhen(() => model.deliveryMethod !== "pickup", () => {
    validate(model.$.deliveryAddress.street, [required({ code: 'deliveryAddress.street.required' })]);
  });
  validateWhen(() => !model.billingSame, () => {
    validate(model.$.billingAddress.street, [required({ code: 'billingAddress.street.required' })]);
  });
  validateWhen(() => model.deliveryMethod !== "pickup", () => {
    validate(model.$.deliveryAddress.house, [required({ code: 'deliveryAddress.house.required' })]);
  });
  validateWhen(() => !model.billingSame, () => {
    validate(model.$.billingAddress.house, [required({ code: 'billingAddress.house.required' })]);
  });
  validateWhen(() => model.deliveryMethod === "courier", () => {
    validate(model.$.deliveryDate, [required({ code: 'deliveryDate.required' }), futureDate({ code: 'deliveryDate.futureDate' })]);
  });
  validateAsync(model.$.promoCode, [async (value) => { if (!value) return null; await new Promise((resolve) => setTimeout(resolve, 300)); return (!value || value === "SALE10" || value === "SALE20") ? null : { code: 'promoCode.async' }; }]);
  validateWhen(() => model.customerType === "company", () => {
    validate(model.$.discount, [min(0, { code: 'discount.min' }), max(30, { code: 'discount.max' })]);
  });
  cross(model.$.total, (values) => ((values.total <= 100000) ? null : { code: 'total.warning', severity: 'warning' }));
  validate(model.$.paymentMethod, [required({ code: 'paymentMethod.required' })]);
  cross(model.$.paymentMethod, (values) => ((values.paymentMethod !== "invoice" || values.customerType === "company") ? null : { code: 'paymentMethod.cross' }));
  validate(model.$.receiptEmail, [email({ code: 'receiptEmail.email' })]);
  validate(model.$.comment, [maxLength(500, { code: 'comment.maxLength' })]);
  validate(model.$.agreeTerms, [required({ code: 'agreeTerms.required' })]);
  validate(model.$.items, [minLength(1, { code: 'items.minLength' }), maxLength(10, { code: 'items.maxLength' })]);
  cross(model.$.company.inn, (values) => ((values.customerType !== "company" || !/^\d{10}$/.test(String(values.company.inn)) || ((2 * Number(String(values.company.inn).charAt(0)) + 4 * Number(String(values.company.inn).charAt(1)) + 10 * Number(String(values.company.inn).charAt(2)) + 3 * Number(String(values.company.inn).charAt(3)) + 5 * Number(String(values.company.inn).charAt(4)) + 9 * Number(String(values.company.inn).charAt(5)) + 4 * Number(String(values.company.inn).charAt(6)) + 6 * Number(String(values.company.inn).charAt(7)) + 8 * Number(String(values.company.inn).charAt(8))) % 11) % 10 === Number(String(values.company.inn).charAt(9))) ? null : { code: 'company.inn.cross' }));
  applyEach(model.$.items, itemsRowRules);
  applyEach(model.$.recipients, recipientsRowRules);
});
