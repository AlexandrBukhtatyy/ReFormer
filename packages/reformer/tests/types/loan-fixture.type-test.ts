/**
 * Сквозная compile-time проверка фикстуры «заявка на кредит»
 * (`tests/integration/fixtures/loan-application/`). Проверяется `tsc` (`tsconfig.tests.json`);
 * vitest его НЕ запускает — нет суффикса `.test.`.
 *
 * Убеждается, что сборка заявки типизирована целиком: ноды и значения групп, строк массивов и
 * подформ выводятся из `LoanApplication`; обработчик `bundle.submission.submit` получает заявку, а результат
 * отправки несёт то, что он вернул; шаги — закрытый список `LoanStepId`; правила, поведение, схема
 * и словари фикстуры выведены без `any` и другой форме данных не подходят. Ядро — только из входов
 * сабпатов, как в самой фикстуре.
 *
 * Дефекты типов размечены `[ReFormer-xxxx]`: строка с меткой в комментарии обязана перестать
 * компилироваться после исправления.
 */

import { expectTypeOf } from 'vitest';
import {
  createForm,
  type FlowTransition,
  type FormArray,
  type FormBundle,
  type FormControl,
  type FormFlow,
  type FormFlowConfig,
  type FormGroup,
  type FormModel,
  type FormSchemaNode,
  type ModelArray,
  type SubmitResult,
} from '../../src/index';
import type { FormBehavior } from '../../src/form/behaviors/index';
import type { ValidationDefinition, ValidationResult } from '../../src/form/validation/index';
import type { FormLocale } from '../../src/i18n';
import { addCoBorrower, passWizardTo } from '../integration/fixtures/loan-application/actions';
import {
  createLoanServer,
  type LoanApi,
  type LoanServer,
} from '../integration/fixtures/loan-application/api';
import { createLoanBehavior } from '../integration/fixtures/loan-application/behavior';
import {
  createLoanForm,
  type LoanForm,
  type LoanFormOptions,
} from '../integration/fixtures/loan-application/create-loan-form';
import {
  LOAN_STEPS,
  LOAN_STEP_IDS,
  createLoanFlow,
  type LoanStepId,
} from '../integration/fixtures/loan-application/flow';
import {
  loanEn,
  loanIssueMessages,
  loanRu,
} from '../integration/fixtures/loan-application/messages';
import {
  LOAN_LIMITS,
  createLoanInitial,
  type Address,
  type CoBorrower,
  type LoanApplication,
  type LoanType,
  type Phone,
  type PreviousJob,
  type Reference,
} from '../integration/fixtures/loan-application/model';
import { REFERENCE_TEMPLATE, loanSchema } from '../integration/fixtures/loan-application/schema';
import {
  createLoanRules,
  type LoanRules,
} from '../integration/fixtures/loan-application/validation';

/** `T` — это `any`. */
type IsAny<T> = 0 extends 1 & T ? true : false;

/** Квитанция отправки заявки — то, что возвращает сервер. */
type SubmitReceipt = Awaited<ReturnType<LoanApi['submitApplication']>>;

/** Подформа адреса — билдер над моделью адреса (как `addressPart` схемы). */
declare const addressPart: (model: FormModel<Address>) => FormSchemaNode;
/** Правила и поведение другой формы данных — адреса. */
declare const foreignRules: ValidationDefinition<Address>;
declare const foreignBehavior: FormBehavior<Address>;

/** Ноды сборки: поля групп, подформы, строки массивов и массивы как значение поля. */
export function loanNodeTypeChecks({ bundle }: LoanForm): void {
  const typed: FormBundle<LoanApplication> = bundle;
  const { form } = bundle;
  // Поля групп, в том числе вложенной группы паспорта.
  const loanType: FormControl<LoanType> = form.loan.type;
  const amount: FormControl<number | null> = form.loan.amount;
  const series: FormControl<string> = form.applicant.passport.series;
  // Две группы одной формы — одна подформа схемы.
  const registration: FormGroup<Address> = form.registrationAddress;
  const residence: FormGroup<Address> = form.residenceAddress;
  // Подформа с массивом внутри.
  const previousJobs: FormArray<PreviousJob> = form.employment.previousJobs;
  // Строки массива: группа строки, подформа адреса в строке и вложенный массив телефонов.
  const coBorrowers: FormArray<CoBorrower> = form.coBorrowers;
  const row: FormGroup<CoBorrower> | undefined = coBorrowers.at(0);
  const rowCity: FormControl<string> | undefined = row?.address.city;
  const rowPhone: FormControl<string> | undefined = row?.phones.at(0)?.number;
  const relation: FormControl<CoBorrower['relation']> | undefined = row?.relation;
  // Массив целиком — поле: файлы из `null` и мультивыбор.
  const documents: FormControl<File[] | null> = form.documents;
  const interests: FormControl<LoanApplication['interests']> = form.interests;
  // Массив без шаблона в модели — массив под-форм, как и остальные.
  const references: FormArray<Reference> = form.references;
  const referenceKey: string = references.keyAt(0);

  // @ts-expect-error — мультивыбор — поле: строк у него нет
  void form.interests.at(0);
  // @ts-expect-error — в заявке нет поручителя
  void form.guarantor;
  // @ts-expect-error — нода не подменяет значение: значение — в модели
  const amountValue: number | null = form.loan.amount;

  void [typed, loanType, amount, series, registration, residence, previousJobs, rowCity, rowPhone];
  void [relation, documents, interests, referenceKey, amountValue];
}

/**
 * Точные типы ключевых мест. Присваивание выше ловит только тип ШИРЕ ожидаемого; `expectTypeOf`
 * требует совпадения и заметит потерю `null` или сужение формы данных.
 */
export function loanExactTypeChecks({ bundle, server }: LoanForm): void {
  const { form, model } = bundle;
  expectTypeOf(bundle).toEqualTypeOf<FormBundle<LoanApplication>>();
  expectTypeOf(form.loan.type).toEqualTypeOf<FormControl<LoanType>>();
  expectTypeOf(form.loan.amount).toEqualTypeOf<FormControl<number | null>>();
  expectTypeOf(form.documents).toEqualTypeOf<FormControl<File[] | null>>();
  expectTypeOf(form.applicant.passport.series).toEqualTypeOf<FormControl<string>>();
  expectTypeOf(form.coBorrowers.at(0)?.relation).toEqualTypeOf<
    FormControl<CoBorrower['relation']> | undefined
  >();
  expectTypeOf(form.loan.amount.getValue()).toEqualTypeOf<number | null>();
  expectTypeOf(model.loan.amount).toEqualTypeOf<number | null>();
  expectTypeOf(model.coBorrowers).toEqualTypeOf<ModelArray<CoBorrower>>();
  expectTypeOf(model.coBorrowers.at(0).phones).toEqualTypeOf<ModelArray<Phone>>();
  expectTypeOf(model.$.documents.value).toEqualTypeOf<File[] | null>();
  expectTypeOf(model.get()).toEqualTypeOf<LoanApplication>();
  expectTypeOf(bundle.flow).toEqualTypeOf<FormFlow | undefined>();
  expectTypeOf(bundle.submission.submit(server.api.submitApplication)).toEqualTypeOf<
    Promise<SubmitResult<SubmitReceipt>>
  >();
  expectTypeOf<LoanStepId>().toEqualTypeOf<
    'loan' | 'applicant' | 'contacts' | 'employment' | 'co-borrowers' | 'documents' | 'review'
  >();
}

/** Значения модели: группы, строки массивов, снимок и загрузка. */
export function loanValueTypeChecks({ bundle }: LoanForm): void {
  const { model } = bundle;
  const typed: FormModel<LoanApplication> = model;
  const amount: number | null = model.loan.amount;
  const fullName: string = model.applicant.fullName;
  const coBorrower: FormModel<CoBorrower> = model.coBorrowers.at(0);
  const phones: ModelArray<Phone> = model.coBorrowers.at(0).phones;
  const city: string = model.coBorrowers.at(0).address.city;
  const previousJobs: ModelArray<PreviousJob> = model.employment.previousJobs;
  const documents: File[] | null = model.$.documents.value;
  const snapshot: LoanApplication = model.get();
  const initial: LoanApplication = createLoanInitial();
  const limits: { readonly min: number; readonly max: number } = LOAN_LIMITS[model.loan.type];
  const added: FormModel<CoBorrower> = addCoBorrower(model, { fullName: 'Анна Иванова' });
  model.patch({ loan: { amount: 500_000 }, coBorrowers: [] });

  // @ts-expect-error — сумма — число либо `null`
  model.patch({ loan: { amount: '500 000' } });
  // @ts-expect-error — помощник принимает правки строки созаёмщика без телефонов
  addCoBorrower(model, { phones: [] });
  // @ts-expect-error — поле документов с `null` в типе — значение как есть, не фасад [ReFormer-sme2]
  void model.documents.length;
  const documentsValue: File[] | null = model.documents;
  void documentsValue;

  void [typed, amount, fullName, coBorrower, phones, city, previousJobs, documents, snapshot];
  void [initial, limits, added];
}

/** Отправка: обработчик получает заявку, итог — объединение статусов. */
export async function loanSubmitTypeChecks({ bundle, server }: LoanForm): Promise<void> {
  const sent: SubmitResult<SubmitReceipt> = await bundle.submission.submit((values) =>
    server.api.submitApplication(values)
  );
  if (sent.status === 'submitted') {
    const applicationNumber: string = sent.result.applicationNumber;
    void applicationNumber;
  } else if (sent.status === 'failed') {
    const error: unknown = sent.error;
    void error;
  } else {
    const validation: ValidationResult = sent.validation;
    void validation;
  }
  // Результат отправки — то, что вернул обработчик.
  const amount: SubmitResult<number | null> = await bundle.submission.submit(
    (values: LoanApplication) => values.loan.amount
  );

  // @ts-expect-error — обработчик получает заявку, а не адрес
  await bundle.submission.submit((values: Address) => values.city);
  // @ts-expect-error — результат обработчика есть только у отправленной формы
  void sent.result;

  void amount;
}

/** Шаги заявки: закрытый список идентификаторов и поток сборки. */
export async function loanStepTypeChecks(loan: LoanForm): Promise<void> {
  const first: LoanStepId = 'loan';
  const ids: readonly LoanStepId[] = LOAN_STEP_IDS;
  const firstStep: { readonly id: 'loan'; readonly title: 'Кредит' } = LOAN_STEPS[0];
  // Шагов ровно семь, и у каждого — запись в таблице по шагам.
  const count: (typeof LOAN_STEPS)['length'] = 7;
  const byStep: Record<LoanStepId, boolean> = {
    loan: true,
    applicant: true,
    contacts: true,
    employment: true,
    'co-borrowers': true,
    documents: true,
    review: false,
  };
  const transitions: FlowTransition[] = await passWizardTo(loan.bundle, 'documents');
  const flow: FormFlowConfig<LoanApplication> = createLoanFlow(loan.rules);

  // @ts-expect-error — шага `contact` нет: шаг называется `contacts`
  const typo: LoanStepId = 'contact';
  // @ts-expect-error — шагов семь
  const wrongCount: (typeof LOAN_STEPS)['length'] = 6;
  // @ts-expect-error — помощник проходит визард только до шагов заявки
  await passWizardTo(loan.bundle, 'summary');
  // поведение под вопросом: поток сборки идентификаторов шагов заявки не знает — `goTo('summary')`
  // компилируется и бросает исключение в рантайме (`FormFlow` не параметризован шагами).
  loan.bundle.flow?.goTo('summary');

  void [first, ids, firstStep, count, byStep, transitions, flow, typo, wrongCount];
}

/** Правила, поведение, схема и словари фикстуры: без `any`, только для формы заявки. */
export function loanDefinitionTypeChecks(server: LoanServer): void {
  const rules: LoanRules = createLoanRules(server.api);
  const steps: ValidationDefinition<LoanApplication>[] = [
    rules.loan,
    rules.applicant,
    rules.contacts,
    rules.employment,
    rules.coBorrowers,
    rules.documents,
  ];
  const behavior: FormBehavior<LoanApplication> = createLoanBehavior(server.api, rules);
  const schema: (model: FormModel<LoanApplication>) => FormSchemaNode = loanSchema;
  const template: Reference = REFERENCE_TEMPLATE;
  // Выведенные типы фикстуры — не `any`.
  const notAny: [
    IsAny<ReturnType<typeof createLoanRules>['all']>,
    IsAny<ReturnType<typeof createLoanBehavior>>,
    IsAny<Parameters<typeof loanSchema>[0]>,
    IsAny<ReturnType<typeof createLoanForm>['bundle']['model']>,
    IsAny<(typeof loanIssueMessages)['loan.amount.min']>,
  ] = [false, false, false, false, false];
  // Коды словаря формы — литералы, локали заявки — данные локали.
  const code: keyof typeof loanIssueMessages = 'documents.minFiles';
  const locales: readonly FormLocale[] = [loanRu, loanEn];

  // Чужой форме данных правила, поведение и схема заявки не подходят — `any` подошёл бы.
  // @ts-expect-error — правила заявки не подходят адресу
  const addressRules: ValidationDefinition<Address> = rules.contacts;
  // @ts-expect-error — поведение заявки не подходит адресу
  const addressBehavior: FormBehavior<Address> = behavior;
  // @ts-expect-error — схема заявки строится над моделью заявки
  const addressSchema: (model: FormModel<Address>) => FormSchemaNode = loanSchema;
  // @ts-expect-error — такого кода в словаре формы нет
  const missingCode: keyof typeof loanIssueMessages = 'documents.maxFiles';

  void [steps, schema, template, notAny, code, locales, addressRules, addressBehavior];
  void [addressSchema, missingCode];
}

/** Опции сборки заявки и сама сборка на `createForm`. */
export function loanAssemblyTypeChecks(): void {
  const options: LoanFormOptions = {
    strategy: 'afterFirstSubmit',
    liveAfterSubmit: 'blur',
    debounce: 300,
    rules: 'all',
    initial: createLoanInitial(),
    seed: (model) => model.patch({ phone: '+7 900 123-45-67' }),
  };
  const loan: LoanForm = createLoanForm(options);
  const server: LoanServer = createLoanServer({ manual: ['checkInn'], unknownInns: ['0'] });
  const withServer: LoanForm = createLoanForm({ server });
  // Правила и поведение сценария поверх заявки — той же формы данных.
  const extended: LoanForm = createLoanForm({
    extraRules: loan.rules.crossStep,
    extraBehavior: createLoanBehavior(server.api, loan.rules),
  });
  // Схема заявки — билдер над моделью заявки, как в фикстуре.
  const bundle: FormBundle<LoanApplication> = createForm<LoanApplication>({
    initial: createLoanInitial(),
    schema: loanSchema,
  });

  // @ts-expect-error — набор правил — по шагам (`steps`) либо одной схемой (`all`)
  createLoanForm({ rules: 'some' });
  // @ts-expect-error — ручной режим — только у методов API заявки
  createLoanServer({ manual: ['sendSms'] });
  // @ts-expect-error — правила сценария — правила заявки, а не адреса
  createLoanForm({ extraRules: foreignRules });
  // @ts-expect-error — поведение сценария — поведение заявки, а не адреса
  createLoanForm({ extraBehavior: foreignBehavior });
  // [ReFormer-3c6o] сейчас компилируется, а не должно: сборка заявки принимает билдер схемы адреса —
  // ветка `| object` в типе `CreateFormConfig.schema` пропускает любую функцию.
  createForm<LoanApplication>({ initial: createLoanInitial(), schema: addressPart });

  void [loan, withServer, extended, bundle];
}
