/**
 * Схема заявки на кредит: визард из семи шагов и разметка каждого шага.
 *
 * Схема задействует все виды узлов и привязок ядра так, как их пишут в настоящей форме:
 * - узлы шагов с `selector` — по ним поток связывает шаг с правилами, а поведение адресует узлы;
 * - текстовые дети: литерал-строка, число, сигнал модели и вычисляемый сигнал (`computed`);
 * - подформа адреса объявлена один раз и подключена к двум группам (регистрация и проживание) и
 *   к адресу в строке созаёмщика — подформа внутри `item`;
 * - подформа занятости с массивом прежних мест работы внутри;
 * - строка созаёмщика с собственными `selector` — их адресует поведение строки (`applyEach`);
 * - строка телефона — сама поле, без контейнера;
 * - массив рекомендателей без шаблона в модели: шаблон строки — `initialValue` узла;
 * - поле, выключенное схемой (`disabled: true`), — номер заявки на шаге проверки.
 */

import type { FormModel, FormSchemaNode, SchemaChild } from '../../../../src/index';
import { computed } from '../../../../src/signals';
import {
  Checkbox,
  DateInput,
  FieldArray,
  FileUpload,
  MultiSelect,
  NumberInput,
  PhoneInput,
  Section,
  Select,
  Step,
  Summary,
  TextInput,
  Wizard,
} from './components';
import { LOAN_STEPS, type LoanStepId } from './flow';
import {
  DOCUMENT_ACCEPT,
  type Address,
  type CoBorrower,
  type Employment,
  type LoanApplication,
  type Phone,
  type PreviousJob,
  type Reference,
} from './model';

/** Варианты выпадающих списков. */
const LOAN_TYPE_OPTIONS = [
  { value: 'consumer', label: 'Потребительский' },
  { value: 'mortgage', label: 'Ипотека' },
  { value: 'car', label: 'Автокредит' },
];
const EMPLOYMENT_OPTIONS = [
  { value: 'employed', label: 'Работаю по найму' },
  { value: 'self-employed', label: 'Самозанятый' },
  { value: 'unemployed', label: 'Не работаю' },
];
const RELATION_OPTIONS = [
  { value: 'spouse', label: 'Супруг(а)' },
  { value: 'parent', label: 'Родитель' },
  { value: 'child', label: 'Ребёнок' },
  { value: 'other', label: 'Другое' },
];
const INTEREST_OPTIONS = [
  { value: 'deposit', label: 'Вклады' },
  { value: 'card', label: 'Кредитная карта' },
  { value: 'insurance', label: 'Страхование' },
  { value: 'investments', label: 'Инвестиции' },
];
const REGION_OPTIONS = ['Москва', 'Московская область', 'Санкт-Петербург'];

/** Шаблон новой строки рекомендателя — запасной путь: в модели у массива шаблона нет. */
export const REFERENCE_TEMPLATE: Reference = { name: '', phone: '' };

/** Сумма в рублях с разрядами — для сводки. */
const rubles = (amount: number): string => `${amount.toLocaleString('ru-RU')} ₽`;

/**
 * Подформа адреса: одна на адреса регистрации и проживания и на адрес созаёмщика. Список городов
 * подгружает поведение адреса при выборе региона.
 */
const addressPart = (address: FormModel<Address>): FormSchemaNode => ({
  component: Section,
  children: [
    {
      model: address.$.region,
      component: Select,
      componentProps: { label: 'Регион', options: REGION_OPTIONS },
    },
    {
      model: address.$.city,
      component: Select,
      componentProps: { label: 'Город', options: [] },
    },
    { model: address.$.street, component: TextInput, componentProps: { label: 'Улица и дом' } },
    {
      model: address.$.postalCode,
      component: TextInput,
      componentProps: { label: 'Индекс', inputMode: 'numeric' },
    },
  ],
});

/** Строка прежнего места работы. */
const previousJobRow = (job: FormModel<PreviousJob>): FormSchemaNode => ({
  component: Section,
  children: [
    { model: job.$.company, component: TextInput, componentProps: { label: 'Организация' } },
    { model: job.$.years, component: NumberInput, componentProps: { label: 'Стаж, лет' } },
  ],
});

/** Подформа занятости: работодатель и прежние места работы. */
const employmentPart = (employment: FormModel<Employment>): FormSchemaNode => ({
  component: Section,
  children: [
    {
      model: employment.$.status,
      component: Select,
      componentProps: { label: 'Занятость', options: EMPLOYMENT_OPTIONS },
    },
    {
      // Секцию прячет поведение подформы, когда заёмщик не работает.
      selector: 'employer',
      component: Section,
      componentProps: { title: 'Работодатель' },
      children: [
        {
          model: employment.$.companyName,
          component: TextInput,
          componentProps: { label: 'Организация' },
        },
        {
          model: employment.$.position,
          component: TextInput,
          componentProps: { label: 'Должность' },
        },
        {
          model: employment.$.companySite,
          component: TextInput,
          componentProps: { label: 'Сайт работодателя', type: 'url' },
        },
        {
          model: employment.$.monthlyIncome,
          component: NumberInput,
          componentProps: { label: 'Доход в месяц, ₽' },
        },
      ],
    },
    {
      selector: 'previous-jobs',
      model: employment.$.previousJobs,
      component: FieldArray,
      componentProps: { title: 'Прежние места работы', addLabel: '+ Место работы' },
      item: previousJobRow,
    },
  ],
});

/** Строка телефона созаёмщика — сама поле. */
const phoneRow = (phone: FormModel<Phone>): FormSchemaNode => ({
  model: phone.$.number,
  component: PhoneInput,
  componentProps: { label: 'Телефон' },
});

/** Строка созаёмщика: свои `selector` адресует поведение строки. */
const coBorrowerRow = (row: FormModel<CoBorrower>): FormSchemaNode => ({
  component: Section,
  children: [
    { model: row.$.fullName, component: TextInput, componentProps: { label: 'ФИО' } },
    {
      model: row.$.relation,
      component: Select,
      componentProps: { label: 'Кем приходится', options: RELATION_OPTIONS },
    },
    { model: row.$.monthlyIncome, component: NumberInput, componentProps: { label: 'Доход, ₽' } },
    {
      model: row.$.share,
      component: NumberInput,
      componentProps: { label: 'Доля ответственности, %' },
    },
    {
      model: row.$.isPrimaryContact,
      component: Checkbox,
      componentProps: { label: 'Основной контакт' },
    },
    {
      model: row.$.livesWithApplicant,
      component: Checkbox,
      componentProps: { label: 'Живёт с заёмщиком' },
    },
    { selector: 'co-borrower-address', model: row.$.address, part: addressPart },
    {
      selector: 'co-borrower-phones',
      model: row.$.phones,
      component: FieldArray,
      componentProps: { addLabel: '+ Телефон' },
      item: phoneRow,
    },
  ],
});

/** Строка рекомендателя. */
const referenceRow = (reference: FormModel<Reference>): FormSchemaNode => ({
  component: Section,
  children: [
    { model: reference.$.name, component: TextInput, componentProps: { label: 'Имя' } },
    { model: reference.$.phone, component: PhoneInput, componentProps: { label: 'Телефон' } },
  ],
});

/** Содержимое шага «Кредит». */
function loanStep(model: FormModel<LoanApplication>): SchemaChild[] {
  // Сводка обновляется на месте: платёж форматирует вычисляемый сигнал, ставку выводит сигнал поля.
  const payment = computed(() => rubles(model.loan.monthlyPayment));
  return [
    {
      model: model.$.loan.type,
      component: Select,
      componentProps: { label: 'Вид кредита', options: LOAN_TYPE_OPTIONS },
    },
    { model: model.$.loan.amount, component: NumberInput, componentProps: { label: 'Сумма, ₽' } },
    { model: model.$.loan.term, component: NumberInput, componentProps: { label: 'Срок, мес.' } },
    { model: model.$.loan.purpose, component: TextInput, componentProps: { label: 'Цель' } },
    {
      model: model.$.loan.firstPaymentDate,
      component: DateInput,
      componentProps: { label: 'Первый платёж' },
    },
    { model: model.$.loan.promoCode, component: TextInput, componentProps: { label: 'Промокод' } },
    {
      selector: 'mortgage',
      component: Section,
      componentProps: { title: 'Залог' },
      children: [
        {
          model: model.$.loan.propertyValue,
          component: NumberInput,
          componentProps: { label: 'Стоимость недвижимости, ₽' },
        },
        {
          model: model.$.loan.initialPayment,
          component: NumberInput,
          componentProps: { label: 'Первоначальный взнос, ₽' },
        },
      ],
    },
    {
      selector: 'loan-estimate',
      component: Summary,
      children: ['Ставка ', model.$.loan.interestRate, '% годовых, платёж ', payment, ' в месяц'],
    },
  ];
}

/** Содержимое шага «Заёмщик»: поля вложенной группы паспорта привязаны напрямую. */
function applicantStep(model: FormModel<LoanApplication>): SchemaChild[] {
  const { applicant } = model.$;
  return [
    { model: applicant.lastName, component: TextInput, componentProps: { label: 'Фамилия' } },
    { model: applicant.firstName, component: TextInput, componentProps: { label: 'Имя' } },
    { model: applicant.middleName, component: TextInput, componentProps: { label: 'Отчество' } },
    { component: Summary, children: ['Полное имя: ', applicant.fullName] },
    {
      model: applicant.birthDate,
      component: DateInput,
      componentProps: { label: 'Дата рождения' },
    },
    { model: applicant.inn, component: TextInput, componentProps: { label: 'ИНН' } },
    {
      selector: 'passport',
      component: Section,
      componentProps: { title: 'Паспорт' },
      children: [
        {
          model: applicant.passport.series,
          component: TextInput,
          componentProps: { label: 'Серия' },
        },
        {
          model: applicant.passport.number,
          component: TextInput,
          componentProps: { label: 'Номер' },
        },
        {
          model: applicant.passport.issueDate,
          component: DateInput,
          componentProps: { label: 'Дата выдачи' },
        },
        {
          model: applicant.passport.issuedBy,
          component: TextInput,
          componentProps: { label: 'Кем выдан' },
        },
      ],
    },
  ];
}

/** Содержимое шага «Контакты»: одна подформа на два адреса. */
function contactsStep(model: FormModel<LoanApplication>): SchemaChild[] {
  return [
    { model: model.$.phone, component: PhoneInput, componentProps: { label: 'Телефон' } },
    {
      model: model.$.email,
      component: TextInput,
      componentProps: { label: 'Email', type: 'email' },
    },
    { selector: 'registration-address', model: model.$.registrationAddress, part: addressPart },
    {
      model: model.$.sameAsRegistration,
      component: Checkbox,
      componentProps: { label: 'Проживаю по адресу регистрации' },
    },
    { selector: 'residence-address', model: model.$.residenceAddress, part: addressPart },
  ];
}

/** Содержимое шага «Работа»: занятость — подформа над группой. */
function employmentStep(model: FormModel<LoanApplication>): SchemaChild[] {
  return [{ selector: 'employment-form', model: model.$.employment, part: employmentPart }];
}

/** Содержимое шага «Семья и созаёмщики». */
function coBorrowersStep(model: FormModel<LoanApplication>): SchemaChild[] {
  return [
    { model: model.$.dependents, component: NumberInput, componentProps: { label: 'Иждивенцев' } },
    {
      model: model.$.hasCoBorrowers,
      component: Checkbox,
      componentProps: { label: 'Есть созаёмщики' },
    },
    {
      selector: 'co-borrowers-list',
      model: model.$.coBorrowers,
      component: FieldArray,
      componentProps: { title: 'Созаёмщики', addLabel: '+ Созаёмщик' },
      item: coBorrowerRow,
    },
    { component: Summary, children: ['Доход семьи: ', model.$.totalIncome, ' ₽ в месяц'] },
  ];
}

/** Содержимое шага «Документы и согласия». */
function documentsStep(model: FormModel<LoanApplication>): SchemaChild[] {
  const { consent } = model.$;
  return [
    {
      model: model.$.documents,
      component: FileUpload,
      componentProps: { label: 'Документы', accept: DOCUMENT_ACCEPT, multiple: true },
    },
    {
      model: model.$.interests,
      component: MultiSelect,
      componentProps: { label: 'Что ещё интересно', options: INTEREST_OPTIONS },
    },
    {
      selector: 'references',
      model: model.$.references,
      component: FieldArray,
      componentProps: { title: 'Рекомендатели', addLabel: '+ Рекомендатель' },
      initialValue: REFERENCE_TEMPLATE,
      item: referenceRow,
    },
    {
      selector: 'consent',
      component: Section,
      componentProps: { title: 'Согласия' },
      children: [
        {
          model: consent.personalData,
          component: Checkbox,
          componentProps: { label: 'Согласен на обработку персональных данных' },
        },
        {
          model: consent.creditBureau,
          component: Checkbox,
          componentProps: { label: 'Согласен на запрос в бюро кредитных историй' },
        },
        {
          model: consent.smsPhone,
          component: PhoneInput,
          componentProps: { label: 'Телефон для кода подписи' },
        },
        {
          model: consent.notifyByEmail,
          component: Checkbox,
          componentProps: { label: 'Присылать уведомления на почту' },
        },
        {
          model: consent.notificationEmail,
          component: TextInput,
          componentProps: { label: 'Почта для уведомлений' },
        },
      ],
    },
  ];
}

/** Содержимое шага «Проверка заявки»: только просмотр. */
function reviewStep(model: FormModel<LoanApplication>): SchemaChild[] {
  return [
    {
      // Номер присваивает сервер: поле показывает его, но не даёт править.
      model: model.$.applicationNumber,
      component: TextInput,
      disabled: true,
      componentProps: { label: 'Номер заявки' },
    },
    {
      selector: 'review-summary',
      component: Summary,
      children: [
        model.$.applicant.fullName,
        ': ',
        model.$.loan.amount,
        ' ₽ на ',
        model.$.loan.term,
        ' мес.',
      ],
    },
    { component: Summary, children: ['Решение — в течение ', 3, ' рабочих дней'] },
  ];
}

const STEP_CONTENT: Record<LoanStepId, (model: FormModel<LoanApplication>) => SchemaChild[]> = {
  loan: loanStep,
  applicant: applicantStep,
  contacts: contactsStep,
  employment: employmentStep,
  'co-borrowers': coBorrowersStep,
  documents: documentsStep,
  review: reviewStep,
};

/** Схема заявки — билдер дерева для `createForm({ schema })`. */
export const loanSchema = (model: FormModel<LoanApplication>): FormSchemaNode => ({
  selector: 'wizard',
  component: Wizard,
  componentProps: { submitLabel: 'Отправить заявку' },
  children: LOAN_STEPS.map(({ id, title }) => ({
    selector: id,
    component: Step,
    componentProps: { title },
    children: STEP_CONTENT[id](model),
  })),
});
