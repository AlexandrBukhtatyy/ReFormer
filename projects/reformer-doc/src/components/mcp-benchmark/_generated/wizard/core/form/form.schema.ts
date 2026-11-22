// @reformer-form-build 6a34323060c21563 собран сервером ReFormer из form.intent.json: форму меняют через сервер (form_build; в guided — form_start, затем form_edit), а не этот файл — правка руками отсоединит его от сборки, guided её отменит
/**
 * Схема формы «Оформление заказа» — одно дерево узлов на все способы реализации.
 *
 * Узел привязан к модели ключом `model`: поле, массив под-форм (`item`) или подформа
 * (`part`). По этому дереву сборка `createForm` строит форму, а `FormRenderer` рисует
 * разметку. Кто рисует разметку сам, в JSX, берёт из схемы только поля.
 */
import type { FormModel, FormSchemaNode } from '@reformer/core';
import { Step } from '@reformer/cdk/form-wizard';
import {
  CheckboxWithLabel,
  FieldArray,
  FormWizard,
  Input,
  InputMask,
  InputNumber,
  RadioGroupOptions,
  SelectAsync,
  SelectMulti,
  Slider,
  SwitchWithLabel,
  Textarea,
} from '@reformer/ui-kit';
import type { OformlenieZakazaShape, ItemsItem, RecipientsItem } from './model';

/** Строка массива: пути — от элемента. Шаблон нового элемента объявлен в `model.ts`. */
const itemsRow = (model: FormModel<ItemsItem>): FormSchemaNode => ({
  component: 'div',
  children: [
    {
      selector: 'title',
      model: model.$.title,
      component: Input,
      componentProps: { label: 'Наименование', testId: 'items-title' },
    },
    {
      selector: 'quantity',
      model: model.$.quantity,
      component: InputNumber,
      componentProps: { label: 'Количество', testId: 'items-quantity' },
    },
    {
      selector: 'price',
      model: model.$.price,
      component: InputNumber,
      componentProps: { label: 'Цена', testId: 'items-price' },
    },
    {
      selector: 'lineTotal',
      model: model.$.lineTotal,
      component: InputNumber,
      componentProps: { readOnly: true, label: 'Сумма', testId: 'items-lineTotal' },
    },
  ],
});

/** Строка массива: пути — от элемента. Шаблон нового элемента объявлен в `model.ts`. */
const recipientsRow = (model: FormModel<RecipientsItem>): FormSchemaNode => ({
  component: 'div',
  children: [
    {
      selector: 'email',
      model: model.$.email,
      component: Input,
      componentProps: { label: 'Email получателя', testId: 'recipients-email' },
    },
    {
      selector: 'primary',
      model: model.$.primary,
      component: CheckboxWithLabel,
      componentProps: { label: 'Основной получатель', testId: 'recipients-primary' },
    },
  ],
});

export const formSchema = (model: FormModel<OformlenieZakazaShape>): FormSchemaNode => ({
  selector: 'wizard',
  component: FormWizard,
  componentProps: { submitLabel: 'Оформить заказ' },
  children: [
    {
      selector: 'pokupatel',
      component: Step,
      componentProps: { title: 'Покупатель' },
      children: [
        {
          selector: 'customerType',
          model: model.$.customerType,
          component: RadioGroupOptions,
          componentProps: {
            options: [
              { value: 'person', label: 'Физическое лицо' },
              { value: 'company', label: 'Юридическое лицо' },
            ],
            label: 'Тип покупателя',
            testId: 'customerType',
          },
        },
        {
          selector: 'contact.lastName',
          model: model.$.contact.lastName,
          component: Input,
          componentProps: { label: 'Фамилия', testId: 'contact-lastName' },
        },
        {
          selector: 'contact.firstName',
          model: model.$.contact.firstName,
          component: Input,
          componentProps: { label: 'Имя', testId: 'contact-firstName' },
        },
        {
          selector: 'email',
          model: model.$.email,
          component: Input,
          componentProps: { label: 'Email', testId: 'email' },
        },
        {
          selector: 'phone',
          model: model.$.phone,
          component: InputMask,
          componentProps: { label: 'Телефон', testId: 'phone' },
        },
        {
          selector: 'birthDate',
          model: model.$.birthDate,
          component: Input,
          componentProps: { type: 'date', label: 'Дата рождения', testId: 'birthDate' },
        },
      ],
    },
    {
      selector: 'company',
      component: Step,
      componentProps: { title: 'Компания' },
      children: [
        {
          selector: 'company.name',
          model: model.$.company.name,
          component: Input,
          componentProps: { label: 'Название организации', testId: 'company-name' },
        },
        {
          selector: 'company.inn',
          model: model.$.company.inn,
          component: Input,
          componentProps: { label: 'ИНН', testId: 'company-inn' },
        },
      ],
    },
    {
      selector: 'dostavka',
      component: Step,
      componentProps: { title: 'Доставка' },
      children: [
        {
          selector: 'deliveryMethod',
          model: model.$.deliveryMethod,
          component: SelectAsync,
          componentProps: {
            options: [
              { value: 'pickup', label: 'Самовывоз' },
              { value: 'courier', label: 'Курьер' },
              { value: 'post', label: 'Почта' },
            ],
            label: 'Способ получения',
            testId: 'deliveryMethod',
          },
        },
        {
          selector: 'deliveryAddress.city',
          model: model.$.deliveryAddress.city,
          component: Input,
          componentProps: { label: 'Город', testId: 'deliveryAddress-city' },
        },
        {
          selector: 'deliveryAddress.street',
          model: model.$.deliveryAddress.street,
          component: Input,
          componentProps: { label: 'Улица', testId: 'deliveryAddress-street' },
        },
        {
          selector: 'deliveryAddress.house',
          model: model.$.deliveryAddress.house,
          component: Input,
          componentProps: { label: 'Дом', testId: 'deliveryAddress-house' },
        },
        {
          selector: 'deliveryDate',
          model: model.$.deliveryDate,
          component: Input,
          componentProps: { type: 'date', label: 'Дата доставки', testId: 'deliveryDate' },
        },
        {
          selector: 'billingSame',
          model: model.$.billingSame,
          component: CheckboxWithLabel,
          componentProps: {
            label: 'Адрес для счёта совпадает с адресом доставки',
            testId: 'billingSame',
          },
        },
        {
          selector: 'billingAddress.city',
          model: model.$.billingAddress.city,
          component: Input,
          componentProps: { label: 'Город', testId: 'billingAddress-city' },
        },
        {
          selector: 'billingAddress.street',
          model: model.$.billingAddress.street,
          component: Input,
          componentProps: { label: 'Улица', testId: 'billingAddress-street' },
        },
        {
          selector: 'billingAddress.house',
          model: model.$.billingAddress.house,
          component: Input,
          componentProps: { label: 'Дом', testId: 'billingAddress-house' },
        },
      ],
    },
    {
      selector: 'tovary',
      component: Step,
      componentProps: { title: 'Товары' },
      children: [
        {
          selector: 'items',
          model: model.$.items,
          component: FieldArray,
          componentProps: { title: 'Товары', minItems: 1, maxItems: 10 },
          item: itemsRow,
        },
        {
          selector: 'subtotal',
          model: model.$.subtotal,
          disabled: true,
          component: InputNumber,
          componentProps: { readOnly: true, label: 'Сумма товаров', testId: 'subtotal' },
        },
      ],
    },
    {
      selector: 'oplata',
      component: Step,
      componentProps: { title: 'Оплата' },
      children: [
        {
          selector: 'promoCode',
          model: model.$.promoCode,
          component: Input,
          componentProps: { label: 'Промокод', testId: 'promoCode' },
        },
        {
          selector: 'discount',
          model: model.$.discount,
          component: Slider,
          componentProps: { label: 'Скидка, %', testId: 'discount' },
        },
        {
          selector: 'total',
          model: model.$.total,
          disabled: true,
          component: InputNumber,
          componentProps: { readOnly: true, label: 'Итого', testId: 'total' },
        },
        {
          selector: 'paymentMethod',
          model: model.$.paymentMethod,
          component: RadioGroupOptions,
          componentProps: {
            options: [
              { value: 'card', label: 'Картой онлайн' },
              { value: 'cash', label: 'При получении' },
              { value: 'invoice', label: 'По счёту' },
            ],
            label: 'Способ оплаты',
            testId: 'paymentMethod',
          },
        },
        {
          selector: 'receiptEmail',
          model: model.$.receiptEmail,
          component: Input,
          componentProps: { label: 'Email для чека', testId: 'receiptEmail' },
        },
        {
          selector: 'comment',
          model: model.$.comment,
          component: Textarea,
          componentProps: { label: 'Комментарий к заказу', testId: 'comment' },
        },
      ],
    },
    {
      selector: 'podtverzhdenie',
      component: Step,
      componentProps: { title: 'Подтверждение' },
      children: [
        {
          selector: 'recipients',
          model: model.$.recipients,
          component: FieldArray,
          componentProps: { title: 'Кому отправлять уведомления', minItems: 1 },
          item: recipientsRow,
        },
        {
          selector: 'agreeTerms',
          model: model.$.agreeTerms,
          component: CheckboxWithLabel,
          componentProps: { label: 'Согласен с условиями оферты', testId: 'agreeTerms' },
        },
        {
          selector: 'newsletter',
          model: model.$.newsletter,
          component: SwitchWithLabel,
          componentProps: { label: 'Получать новости и акции', testId: 'newsletter' },
        },
        {
          selector: 'sources',
          model: model.$.sources,
          component: SelectMulti,
          componentProps: {
            options: [
              { value: 'search', label: 'Поиск' },
              { value: 'friends', label: 'Друзья' },
              { value: 'ads', label: 'Реклама' },
              { value: 'other', label: 'Другое' },
            ],
            label: 'Как вы о нас узнали',
            testId: 'sources',
          },
        },
      ],
    },
  ],
});
