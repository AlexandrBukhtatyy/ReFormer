// @reformer-form-build 3e68db9fa0d096ce собран сервером ReFormer из form.intent.json: форму меняют через сервер (form_build; в guided — form_start, затем form_edit), а не этот файл — правка руками отсоединит его от сборки, guided её отменит
/**
 * Модель формы «Оформление заказа» — источник истины для всех остальных файлов.
 * Валидация, поведение и схема ссылаются на ЭТИ пути; менять их надо здесь.
 */
import { arrayOf, createModel } from '@reformer/core';

export type ItemsItem = {
  /** Наименование */
  title: string;
  /** Количество */
  quantity: number;
  /** Цена */
  price: number | null;
  /** Сумма */
  lineTotal: number;
};

export type RecipientsItem = {
  /** Email получателя */
  email: string;
  /** Основной получатель */
  primary: boolean;
};

export type OformlenieZakazaShape = {
  items: ItemsItem[];
  recipients: RecipientsItem[];
  /** Тип покупателя */
  customerType: string;
  contact: {
    /** Фамилия */
    lastName: string;
    /** Имя */
    firstName: string;
  };
  /** Email */
  email: string;
  /** Телефон */
  phone: string;
  /** Дата рождения */
  birthDate: string | null;
  company: {
    /** Название организации */
    name: string | null;
    /** ИНН */
    inn: string | null;
  };
  /** Способ получения */
  deliveryMethod: string;
  deliveryAddress: {
    /** Город */
    city: string | null;
    /** Улица */
    street: string | null;
    /** Дом */
    house: string | null;
  };
  /** Дата доставки */
  deliveryDate: Date | null;
  /** Адрес для счёта совпадает с адресом доставки */
  billingSame: boolean;
  billingAddress: {
    /** Город */
    city: string | null;
    /** Улица */
    street: string | null;
    /** Дом */
    house: string | null;
  };
  /** Сумма товаров */
  subtotal: number;
  /** Промокод */
  promoCode: string | null;
  /** Скидка, % */
  discount: number;
  /** Итого */
  total: number;
  /** Способ оплаты */
  paymentMethod: string;
  /** Email для чека */
  receiptEmail: string | null;
  /** Комментарий к заказу */
  comment: string | null;
  /** Согласен с условиями оферты */
  agreeTerms: boolean;
  /** Получать новости и акции */
  newsletter: boolean;
  /** Как вы о нас узнали */
  sources: unknown[];
};

/** Шаблон нового элемента массива `items`. */
const blankItemsItem = (): ItemsItem => ({
  title: "",
  quantity: 1,
  price: null,
  lineTotal: 0,
});

/** Шаблон нового элемента массива `recipients`. */
const blankRecipientsItem = (): RecipientsItem => ({
  email: "",
  primary: false,
});

/** Модель формы — по одной на сборку: `createForm({ model: createFormModel(), … })`. */
export const createFormModel = () =>
  createModel<OformlenieZakazaShape>({
    items: arrayOf(blankItemsItem, [{"title":"","quantity":1,"price":null,"lineTotal":0}]),
    recipients: arrayOf(blankRecipientsItem, [{"email":"","primary":true}]),
    customerType: "person",
    contact: {
      lastName: "",
      firstName: "",
    },
    email: "",
    phone: "",
    birthDate: "",
    company: {
      name: "",
      inn: "",
    },
    deliveryMethod: "pickup",
    deliveryAddress: {
      city: "",
      street: "",
      house: "",
    },
    deliveryDate: null,
    billingSame: true,
    billingAddress: {
      city: "",
      street: "",
      house: "",
    },
    subtotal: 0,
    promoCode: "",
    discount: 0,
    total: 0,
    paymentMethod: "card",
    receiptEmail: "",
    comment: "",
    agreeTerms: false,
    newsletter: false,
    sources: [],
  });
