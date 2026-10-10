/**
 * Сборка сложной формы целиком — заявка на кредит (`fixtures/loan-application`).
 *
 * Сквозные сценарии опираются на то, что фикстура собрана правильно и все модули ядра работают
 * вместе. Здесь это и проверяется: сборка без предупреждений dev и в заданном порядке; документ
 * схемы с реестром даёт то же дерево, что билдер; ручная сборка (`createFormFromModel` +
 * `createFormLevel`) равна сборке одним вызовом; компиляция знает все виды узлов, области и
 * селекторы заявки; гарды различают её ноды; каждый оператор поведения подключён и действует.
 * Поток, отправка, массивы, гонки, стратегии и локализация — в соседних сценариях (`README.md`).
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { advance, settle, useFakeClock } from '../test-utils/async';
import { disposeForm } from '../test-utils/dispose-form';
import { issueCodes } from '../test-utils/issues';
import {
  compileSchema,
  createForm,
  createFormFromModel,
  createFormLevel,
  getNodeForSignal,
  isCompiledNode,
  isDerived,
  isFormArray,
  isFormControl,
  isFormGroup,
  isFormNode,
  type CompiledArrayNode,
  type CompiledContainerNode,
  type CompiledNode,
  type CompiledPartNode,
  type CompiledSchema,
  type DeepPartial,
  type FlowTransition,
  type FormBundle,
  type FormModel,
  type SchemaNodeId,
} from '../../src/index';
import type { ValidationResult } from '../../src/form/validation/index';
import * as validators from '../../src/form/validators/index';
import { parseMessage, validateLocale } from '../../src/i18n';
import {
  addCoBorrower,
  daysFromToday,
  documentFile,
  fillApplicantStep,
  fillContactsStep,
  fillEmploymentStep,
  fillLoanStep,
  flushBehaviors,
  passWizardTo,
  yearsAgo,
} from './fixtures/loan-application/actions';
import { createLoanServer } from './fixtures/loan-application/api';
import {
  AUTOSAVE_INTERVAL,
  CITY_LOOKUP_DEBOUNCE,
  annuityPayment,
  createLoanBehavior,
} from './fixtures/loan-application/behavior';
import {
  createLoanForm,
  type LoanForm,
  type LoanFormOptions,
} from './fixtures/loan-application/create-loan-form';
import { LOAN_STEP_IDS, createLoanFlow } from './fixtures/loan-application/flow';
import { loanEn, loanIssueMessages, loanRu } from './fixtures/loan-application/messages';
import {
  LOAN_LIMITS,
  blankAddress,
  createLoanInitial,
  createLoanModel,
  type LoanApplication,
} from './fixtures/loan-application/model';
import { REFERENCE_TEMPLATE, loanSchema } from './fixtures/loan-application/schema';
import { createLoanRules } from './fixtures/loan-application/validation';
import { Checkbox, NumberInput, TextInput } from './fixtures/loan-application/components';

// ─── Сборки теста и их уборка ───────────────────────────────────────────────────────────────

/** Сборки текущего теста: после теста их поведение и стратегия снимаются. */
const assembled: Array<{ form: object; stop?: () => void }> = [];

function build(options?: LoanFormOptions): LoanForm {
  const built = createLoanForm(options);
  assembled.push({
    form: built.bundle.form,
    stop: () => built.bundle.validation?.controller.dispose(),
  });
  return built;
}

afterEach(() => {
  for (const { form, stop } of assembled.splice(0)) {
    disposeForm(form);
    stop?.();
  }
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// ─── Помощники утверждений ─────────────────────────────────────────────────────────────────

/** Хранилище правил узлов области: корня сборки либо под-модели (строка, подформа). */
const overridesOf = (bundle: FormBundle<LoanApplication>, subModel: object = bundle.model) =>
  bundle.render.controller.scopeOf(subModel).__overrideMaps;

/** Непустые замечания прогона по путям полей. */
function issuesByPath(result: ValidationResult): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [handle, issues] of result.issues) {
    if (issues.length > 0) out[handle.__path] = issues.map((issue) => issue.code);
  }
  return out;
}

/** Узел компиляции по `selector` (или пути) области. */
function nodeOf<N extends CompiledNode>(compiled: CompiledSchema, id: string): N {
  const node = compiled.nodes.get(id as SchemaNodeId);
  if (node === undefined) throw new Error(`в области «${compiled.scope}» нет узла «${id}»`);
  return node as N;
}

/** Описание дерева области для сравнения сборок: вид, идентификатор, область и подформы. */
function describeTree(compiled: CompiledSchema | undefined): unknown {
  if (compiled === undefined) return undefined;
  return [...compiled.nodes.values()].map((node) => ({
    id: node.id,
    kind: node.kind,
    scope: node.scope,
    ...(node.kind === 'part' ? { content: describeTree(node.content) } : {}),
  }));
}

/** Вид ноды глазами гардов. */
const guardsOf = (value: unknown) => ({
  node: isFormNode(value),
  control: isFormControl(value),
  group: isFormGroup(value),
  array: isFormArray(value),
});

const GUARDS = {
  control: { node: true, control: true, group: false, array: false },
  group: { node: true, control: false, group: true, array: false },
  array: { node: true, control: false, group: false, array: true },
  none: { node: false, control: false, group: false, array: false },
} as const;

// ─── Сборка ────────────────────────────────────────────────────────────────────────────────

describe('createForm — сборка заявки на кредит', () => {
  it('BA-01: сборка, строки массивов и отложенные записи поведения — без предупреждений dev', async () => {
    const warn = vi.spyOn(console, 'warn');
    const error = vi.spyOn(console, 'error');

    const { bundle } = build();
    // Строки компилируются при появлении: их предупреждения пришли бы только сейчас.
    addCoBorrower(bundle.model, { livesWithApplicant: false });
    fillEmploymentStep(bundle.model);
    bundle.form.references.push();
    await settle();
    build({ rules: 'all' });
    build({ initial: createLoanInitial(), seed: (model) => fillLoanStep(model) });
    await settle();

    expect(warn.mock.calls).toEqual([]);
    expect(error.mock.calls).toEqual([]);
  });

  it('BA-02: порядок сборки — seed, схема, поведение, setup', () => {
    const server = createLoanServer();
    const rules = createLoanRules(server.api);
    const seen: string[] = [];

    createForm<LoanApplication>({
      model: createLoanModel(),
      seed: (model) => {
        model.applicationNumber = 'ЗК-000042';
        seen.push('seed');
      },
      schema: (model) => {
        seen.push(`схема видит номер ${model.applicationNumber}`);
        return loanSchema(model);
      },
      behavior: createLoanBehavior(server.api, rules),
      validation: { extras: rules.crossStep },
      flow: createLoanFlow(rules),
      setup: (bundle) => {
        assembled.push({ form: bundle.form });
        // Заголовок визарду ставит поведение (`onInit`) — к `setup` оно уже отработало.
        seen.push(
          `setup видит заголовок ${String(overridesOf(bundle).propsOverrides.get('wizard')?.title)}`
        );
      },
    });

    expect(seen).toEqual([
      'seed',
      'схема видит номер ЗК-000042',
      'setup видит заголовок Заявка № ЗК-000042',
    ]);
  });

  it('BA-03: документ схемы с заглушкой реестра собирает то же дерево, что билдер', () => {
    const document = { format: 2, form: 'loan-application' };
    const resolveSchema = vi.fn((_document: unknown, model: FormModel<never>) => ({
      tree: loanSchema(model as unknown as FormModel<LoanApplication>),
    }));

    const viaRegistry = createForm<LoanApplication>({
      model: createLoanModel(),
      schema: document,
      registry: { resolveSchema },
    });
    const viaBuilder = createForm<LoanApplication>({
      model: createLoanModel(),
      schema: loanSchema,
    });
    assembled.push({ form: viaRegistry.form }, { form: viaBuilder.form });

    expect(resolveSchema).toHaveBeenCalledTimes(1);
    expect(resolveSchema).toHaveBeenCalledWith(document, viaRegistry.model);
    expect(describeTree(viaRegistry.render.tree)).toEqual(describeTree(viaBuilder.render.tree));
    expect(viaRegistry.form.loan.amount.component).toBe(NumberInput);
  });

  it('BA-04: варианты фабрики — полный набор правил без потока и модель из `initial`', () => {
    const singlePage = build({ rules: 'all' });
    const fromInitial = build({
      initial: { ...createLoanInitial(), applicationNumber: 'ЗК-000007' },
    });

    expect(singlePage.bundle.flow).toBeUndefined();
    expect(singlePage.bundle.validation?.rules).toBe(singlePage.rules.all);
    // Поля сервера помечает и сборка из готовых значений.
    expect(isDerived(fromInitial.bundle.model.$.applicationNumber)).toBe(true);
    expect(overridesOf(fromInitial.bundle).propsOverrides.get('wizard')).toMatchObject({
      title: 'Заявка № ЗК-000007',
    });
  });

  it('BA-05: словари заявки разбираются; у русской и английской локали одни ключи и подстановки', () => {
    expect(validateLocale(loanRu.messages, loanEn.messages)).toEqual([]);
    for (const message of Object.values(loanIssueMessages)) {
      if (typeof message === 'string') expect(() => parseMessage(message)).not.toThrow();
    }
  });
});

// ─── Паритет ручной сборки ─────────────────────────────────────────────────────────────────

describe('createFormFromModel + createFormLevel — паритет со сборкой одним вызовом', () => {
  /** Та же заявка, собранная по частям: модель, уровень формы, ноды и поведение. */
  function assembleByHand() {
    const server = createLoanServer();
    const rules = createLoanRules(server.api);
    const model = createLoanModel();
    const level = createFormLevel(model, {
      validation: { extras: rules.crossStep },
      flow: createLoanFlow(rules),
    });
    const form = createFormFromModel<LoanApplication>({
      model,
      schema: loanSchema(model),
      behavior: createLoanBehavior(server.api, rules),
      flow: level.flow,
    });
    assembled.push({ form });
    return { model, form, level };
  }

  /** Одни и те же данные — с ошибками в нескольких шагах и в строке массива. */
  function fillWithMistakes(model: FormModel<LoanApplication>): void {
    fillLoanStep(model, { amount: 7_000_000 });
    fillApplicantStep(model, { inn: '123' });
    fillContactsStep(model);
    addCoBorrower(model, { livesWithApplicant: false });
  }

  it('BA-06: те же значения после заполнения и те же замечания после проверки', async () => {
    const { bundle } = build();
    const byHand = assembleByHand();
    fillWithMistakes(bundle.model);
    fillWithMistakes(byHand.model);
    await settle();

    expect(byHand.model.get()).toEqual(bundle.model.get());

    const [fromBundle, fromHand] = await Promise.all([bundle.validate(), byHand.level.validate()]);

    expect(fromBundle.status).toBe('invalid');
    expect(fromHand.status).toBe(fromBundle.status);
    expect(issuesByPath(fromHand)).toEqual(issuesByPath(fromBundle));
    expect(issueCodes(byHand.form)).toEqual(issueCodes(bundle.form));
    expect(issuesByPath(fromBundle)).toMatchObject({
      // Правило шага и межшаговое правило из `extras` — на одном поле, в одном прогоне.
      'loan.amount': ['loan.amount.max', 'loan.paymentTooHigh'],
      'applicant.inn': ['applicant.inn.format'],
      'coBorrowers.0.address.city': ['address.city.required'],
    });
    // `params` правила (`RuleOptions`) сливаются с параметрами самого правила.
    expect(bundle.form.loan.amount.issues.value[0]).toEqual({
      code: 'loan.amount.max',
      params: { max: 5_000_000, actual: 7_000_000, loanType: 'consumer' },
    });
  });

  it('BA-07: поток ручной сборки — те же шаги, переход и отказ', async () => {
    const { bundle } = build();
    const byHand = assembleByHand();
    // Замечания перехода — по ручкам своей модели: сравниваются по путям полей.
    const view = (transition: FlowTransition | undefined) =>
      transition?.status === 'stayed'
        ? {
            ...transition,
            validation: transition.validation && issuesByPath(transition.validation),
          }
        : transition;

    expect(byHand.level.flow?.steps).toEqual(bundle.flow?.steps);
    const [stayedByHand, stayed] = [await byHand.level.flow?.next(), await bundle.flow?.next()];
    expect(stayed).toMatchObject({ status: 'stayed', step: 'loan', reason: 'invalid' });
    expect(view(stayedByHand)).toEqual(view(stayed));

    fillLoanStep(bundle.model);
    fillLoanStep(byHand.model);
    expect(await byHand.level.flow?.next()).toEqual(await bundle.flow?.next());
    expect(byHand.level.flow?.current.value).toBe('applicant');
  });
});

// ─── Компиляция ────────────────────────────────────────────────────────────────────────────

describe('compileSchema — дерево заявки', () => {
  it('BA-08: визард из семи шагов; шаг адресуется своим `selector`', () => {
    const model = createLoanModel();
    const compiled = compileSchema(loanSchema(model), model);
    const root = compiled.root as CompiledContainerNode;

    expect(compiled.scope).toBe('#');
    expect(root).toMatchObject({ kind: 'container', selector: 'wizard', id: 'wizard' });
    expect(root.children.map((step) => (step.kind === 'text' ? step.kind : step.selector))).toEqual(
      LOAN_STEP_IDS
    );
    for (const id of LOAN_STEP_IDS) expect(nodeOf(compiled, id).kind).toBe('container');
    expect(isCompiledNode(root)).toBe(true);
    expect(isCompiledNode(root.source)).toBe(false);
  });

  it('BA-09: поля — над листом, над массивом целиком, над листом из `null`, выключенное схемой', () => {
    const model = createLoanModel();
    const { fields } = compileSchema(loanSchema(model), model);

    expect(fields.get(model.$.loan.amount)).toMatchObject({
      kind: 'field',
      component: NumberInput,
    });
    // Мультивыбор: значение поля — массив, ручка поля — узел-массив модели.
    expect(fields.get(model.$.interests)?.handle).toBe(model.$.interests);
    // Файлы: начальное `null` — в модели лист.
    expect(fields.get(model.$.documents)?.kind).toBe('field');
    expect(fields.get(model.$.applicationNumber)).toMatchObject({
      disabled: true,
      component: TextInput,
    });
    expect(fields.get(model.$.loan.amount)?.disabled).toBe(false);
    // Поля подформ — в индексе корня: их ноды строит та же сборка.
    expect(fields.get(model.$.registrationAddress.city)?.scope).toBe('#/registrationAddress');
    expect(fields.get(model.$.employment.companyName)?.scope).toBe('#/employment');
  });

  it('BA-10: подформы — одна часть адреса на две группы, массив внутри подформы занятости', () => {
    const model = createLoanModel();
    const compiled = compileSchema(loanSchema(model), model);

    const registration = nodeOf<CompiledPartNode>(compiled, 'registration-address');
    const residence = nodeOf<CompiledPartNode>(compiled, 'residence-address');
    const employment = nodeOf<CompiledPartNode>(compiled, 'employment-form');

    expect([registration.kind, residence.kind, employment.kind]).toEqual(['part', 'part', 'part']);
    expect(registration.content.scope).toBe('#/registrationAddress');
    expect(residence.content.scope).toBe('#/residenceAddress');
    expect(residence.model).toBe(model.residenceAddress);
    // Узлы подформы живут в её области, массив — ещё и в индексе корня (его ноду строит корень).
    expect(nodeOf(employment.content, 'previous-jobs').kind).toBe('array');
    expect(nodeOf(employment.content, 'employer').kind).toBe('container');
    expect(compiled.nodes.has('previous-jobs' as SchemaNodeId)).toBe(false);
    expect(compiled.arrays.get(model.$.employment.previousJobs)?.selector).toBe('previous-jobs');
  });

  it('BA-11: массивы — шаблоны строк (модели и узла схемы) и строки со своими областями', () => {
    const { bundle } = build();
    const tree = bundle.render.tree as CompiledSchema;
    const references = nodeOf<CompiledArrayNode>(tree, 'references');
    const coBorrowers = nodeOf<CompiledArrayNode>(tree, 'co-borrowers-list');

    // У рекомендателей шаблона в модели нет — «Добавить» берёт `initialValue` узла.
    expect(references.initialValue).toBe(REFERENCE_TEMPLATE);
    bundle.form.references.push();
    expect(bundle.model.references.toArray()).toEqual([REFERENCE_TEMPLATE]);
    // Шаблон отдаётся копией: правка строки не портит его.
    bundle.model.references.at(0).name = 'Петров';
    expect(REFERENCE_TEMPLATE).toEqual({ name: '', phone: '' });

    // Созаёмщик и его телефон добавлены без значения — по шаблонам `arrayOf` модели.
    const row = addCoBorrower(bundle.model);
    expect(row.address.get()).toEqual(blankAddress());
    expect(row.phones.toArray()).toEqual([{ number: '+7 (900) 765-43-21' }]);
    const rowSchema = coBorrowers.row(row);
    expect(rowSchema.scope).toBe(`#/coBorrowers[${bundle.form.coBorrowers.keyAt(0)}]`);
    expect(coBorrowers.row(row)).toBe(rowSchema);
    const address = nodeOf<CompiledPartNode>(rowSchema, 'co-borrower-address');
    expect(address.kind).toBe('part');
    expect(address.content.scope).toBe(`${rowSchema.scope}/address`);
    // Строка телефона — сама поле: корень её области не контейнер.
    const phones = nodeOf<CompiledArrayNode>(rowSchema, 'co-borrower-phones');
    expect(phones.row(row.phones.at(0)).root.kind).toBe('field');
    // Селекторы строки корню не видны и с ним не пересекаются.
    expect(tree.nodes.has('co-borrower-address' as SchemaNodeId)).toBe(false);
  });

  it('BA-12: текстовые дети — строка, число, сигнал поля и вычисляемый сигнал', () => {
    const { bundle } = build();
    const tree = bundle.render.tree as CompiledSchema;
    const estimate = nodeOf<CompiledContainerNode>(tree, 'loan-estimate');
    const review = nodeOf<CompiledContainerNode>(tree, 'review');

    const [text] = estimate.children;
    expect(estimate.children).toHaveLength(1);
    expect(text.kind).toBe('text');
    const parts = text.kind === 'text' ? text.parts : [];
    expect(parts[0]).toBe('Ставка ');
    expect(parts[1]).toBe(bundle.model.$.loan.interestRate);

    fillLoanStep(bundle.model);
    const payment = parts[3] as { readonly value: unknown };
    expect(payment.value).toBe(`${annuityPayment(500_000, 36, 15.9).toLocaleString('ru-RU')} ₽`);
    // Подряд идущие литерал, число и снова литерал — один текстовый узел.
    const decision = review.children[2];
    expect(decision.kind).toBe('container');
    const decisionText = decision.kind === 'container' ? decision.children[0] : undefined;
    expect(decisionText).toMatchObject({
      kind: 'text',
      parts: ['Решение — в течение ', 3, ' рабочих дней'],
    });
  });
});

// ─── Гарды ─────────────────────────────────────────────────────────────────────────────────

describe('type guards — ноды заявки', () => {
  it('BA-13: гарды различают поле, группу, массив под-форм и поле над массивом', () => {
    const { bundle } = build();
    addCoBorrower(bundle.model);
    fillEmploymentStep(bundle.model);
    const { form, model } = bundle;
    const row = form.coBorrowers.at(0);

    const cases: Record<string, [unknown, keyof typeof GUARDS]> = {
      форма: [form, 'group'],
      'группа loan': [form.loan, 'group'],
      'вложенная группа passport': [form.applicant.passport, 'group'],
      'поле суммы': [form.loan.amount, 'control'],
      'мультивыбор — поле над массивом': [form.interests, 'control'],
      'файлы — поле из null': [form.documents, 'control'],
      'выключенное схемой поле': [form.applicationNumber, 'control'],
      'массив созаёмщиков': [form.coBorrowers, 'array'],
      'строка созаёмщика': [row, 'group'],
      'адрес в строке': [row?.address, 'group'],
      'телефоны в строке': [row?.phones, 'array'],
      'массив в подформе': [form.employment.previousJobs, 'array'],
      'нода по ручке группы': [getNodeForSignal(model.$.registrationAddress), 'group'],
      'нода по ручке листа': [getNodeForSignal(model.$.loan.amount), 'control'],
      модель: [model, 'none'],
      'ручка поля': [model.$.loan.amount, 'none'],
      'узел компиляции': [bundle.render.tree?.root, 'none'],
      null: [null, 'none'],
    };

    const actual = Object.fromEntries(
      Object.entries(cases).map(([label, [value]]) => [label, guardsOf(value)])
    );
    const expected = Object.fromEntries(
      Object.entries(cases).map(([label, [, kind]]) => [label, GUARDS[kind]])
    );
    expect(actual).toEqual(expected);
    expect(getNodeForSignal(model.$.registrationAddress)).toBe(form.registrationAddress);
  });
});

// ─── Операторы поведения ───────────────────────────────────────────────────────────────────

describe('поведение заявки — каждый оператор подключён', () => {
  it('BA-14: compute — платёж, полное имя и доход семьи; загрузка черновика их не затирает', () => {
    const { bundle } = build();
    const { model } = bundle;

    fillLoanStep(model);
    fillApplicantStep(model);
    fillEmploymentStep(model);
    addCoBorrower(model);

    const payment = annuityPayment(500_000, 36, 15.9);
    expect(model.loan.monthlyPayment).toBe(payment);
    expect(model.applicant.fullName).toBe('Иванов Иван Иванович');
    expect(model.totalIncome).toBe(230_000);
    expect(model.paymentToIncomeRatio).toBe(Math.round((payment / 230_000) * 100));

    model.patch({ loan: { monthlyPayment: 1 }, applicant: { fullName: 'черновик' } });
    expect(model.loan.monthlyPayment).toBe(payment);
    expect(model.applicant.fullName).toBe('Иванов Иван Иванович');
  });

  it('BA-15: computeFrom — ставка следует за видом и сроком кредита', () => {
    const { bundle } = build();
    const { model } = bundle;

    model.loan.term = 36;
    expect(model.loan.interestRate).toBe(15.9);
    model.loan.type = 'mortgage';
    expect(model.loan.interestRate).toBe(9.9);
    model.loan.term = 120;
    expect(model.loan.interestRate).toBe(10.9);
    expect(isDerived(model.$.loan.interestRate)).toBe(true);
  });

  it('BA-16: явный markDerived — номер заявки не затирает загрузка, но пишет сервер', () => {
    const { bundle } = build();
    const { model } = bundle;

    expect(isDerived(model.$.applicationNumber)).toBe(true);
    model.patch({ applicationNumber: 'ЧЕРНОВИК', email: 'ivanov@example.ru' });
    expect(model.applicationNumber).toBe('');
    expect(model.email).toBe('ivanov@example.ru');

    model.applicationNumber = 'ЗК-000042';
    expect(model.applicationNumber).toBe('ЗК-000042');
  });

  it('BA-17: enableWhen со сбросом — залог включён только у ипотеки и стирается при смене вида', async () => {
    const { bundle } = build();
    const { model, form } = bundle;
    await settle();
    expect(form.loan.propertyValue.disabled.value).toBe(true);

    model.loan.type = 'mortgage';
    await settle();
    expect(form.loan.propertyValue.disabled.value).toBe(false);
    expect(form.loan.initialPayment.disabled.value).toBe(false);

    model.loan.patch({ propertyValue: 9_000_000, initialPayment: 2_000_000 });
    model.loan.type = 'car';
    await settle();
    expect(form.loan.propertyValue.disabled.value).toBe(true);
    expect([model.loan.propertyValue, model.loan.initialPayment]).toEqual([null, null]);
  });

  it('BA-18: disableWhen со сбросом в подформе — без работы данные работодателя выключены и стёрты', async () => {
    const { bundle } = build();
    const { model, form } = bundle;
    fillEmploymentStep(model);
    await settle();
    expect(form.employment.companyName.disabled.value).toBe(false);

    model.employment.status = 'unemployed';
    await settle();
    expect(form.employment.companyName.disabled.value).toBe(true);
    expect(form.employment.monthlyIncome.disabled.value).toBe(true);
    expect([model.employment.companyName, model.employment.monthlyIncome]).toEqual(['', null]);
    expect(form.employment.previousJobs.disabled.value).toBe(false);

    model.employment.status = 'self-employed';
    await settle();
    expect(form.employment.companyName.disabled.value).toBe(false);
  });

  it('BA-19: copyFrom группы и enableWhen группы — адрес проживания копирует регистрацию, пока совпадает', async () => {
    const { bundle } = build();
    const { model, form } = bundle;
    fillContactsStep(model);
    await settle();

    expect(model.residenceAddress.get()).toEqual(model.registrationAddress.get());
    expect(form.residenceAddress.disabled.value).toBe(true);
    expect(form.residenceAddress.city.disabled.value).toBe(true);

    model.sameAsRegistration = false;
    await settle();
    expect(form.residenceAddress.disabled.value).toBe(false);
    model.registrationAddress.street = 'ул. Новая, д. 1';
    await settle();
    expect(model.residenceAddress.street).toBe('ул. Тверская, д. 7');
  });

  it('BA-20: copyFrom с transform — почта для уведомлений: контактная в нижнем регистре', () => {
    const { bundle } = build();
    const { model } = bundle;

    model.email = ' Ivanov@Example.RU ';
    expect(model.consent.notificationEmail).toBe('');
    model.consent.notifyByEmail = true;
    expect(model.consent.notificationEmail).toBe('ivanov@example.ru');
    model.email = 'PETROV@example.ru';
    expect(model.consent.notificationEmail).toBe('petrov@example.ru');
  });

  it('BA-21: syncFields — телефон для кода подписи синхронизирован с контактным в обе стороны', async () => {
    const { bundle } = build();
    const { model } = bundle;

    model.phone = '+7 (900) 123-45-67';
    await settle();
    expect(model.consent.smsPhone).toBe('+79001234567');

    model.consent.smsPhone = '+79007654321';
    await settle();
    expect([model.phone, model.consent.smsPhone]).toEqual(['+79007654321', '+79007654321']);
  });

  it('BA-22: transformValue — промокод, индекс в обеих подформах адреса, телефон в строке строки', async () => {
    const { bundle } = build();
    const { model } = bundle;
    // Отложенные записи сборки — до правок: иначе копия адреса затёрла бы правку (BA-41).
    await settle();
    model.sameAsRegistration = false;
    const row = addCoBorrower(model);

    model.loan.promoCode = 'spring 24';
    model.registrationAddress.postalCode = '125-009 Москва';
    model.residenceAddress.postalCode = 'abc1234567';
    row.address.postalCode = 'дом 101000';
    row.phones.at(0).number = '+7 (900) 765-43-21x';
    await settle();

    expect(model.loan.promoCode).toBe('SPRING24');
    expect(model.registrationAddress.postalCode).toBe('125009');
    expect(model.residenceAddress.postalCode).toBe('123456');
    expect(row.address.postalCode).toBe('101000');
    expect(row.phones.at(0).number).toBe('+7 (900) 765-43-21');
  });

  it('BA-23: resetWhen — промокод на ипотеку не действует и стирается при её выборе', async () => {
    const { bundle } = build();
    const { model } = bundle;
    model.loan.promoCode = 'SPRING24';
    await settle();

    model.loan.type = 'mortgage';
    await settle();
    expect(model.loan.promoCode).toBe('');
  });

  it('BA-24: onChange с immediate — пределы суммы в пропсах поля сразу после сборки и при смене вида', async () => {
    const { bundle } = build();
    const { model, form } = bundle;
    await settle();
    expect(form.loan.amount.componentProps.value).toEqual({
      label: 'Сумма, ₽',
      ...LOAN_LIMITS.consumer,
    });

    model.loan.type = 'car';
    await settle();
    expect(form.loan.amount.componentProps.value).toMatchObject(LOAN_LIMITS.car);
  });

  it('BA-25: onChange с debounce и signal — города региона: один запрос после паузы, устаревший отменён', async () => {
    useFakeClock();
    const server = createLoanServer({ manual: ['loadCities'] });
    const { bundle } = build({ server });
    const { model, form } = bundle;
    await flushBehaviors();
    model.sameAsRegistration = false;

    model.registrationAddress.region = 'Москва';
    await advance(CITY_LOOKUP_DEBOUNCE - 1);
    model.registrationAddress.region = 'Московская область';
    await advance(CITY_LOOKUP_DEBOUNCE);
    expect(server.callsOf('loadCities').map((call) => call.args[0])).toEqual([
      'Московская область',
    ]);
    expect(form.registrationAddress.city.componentProps.value).toMatchObject({ loading: true });

    const stale = server.last('loadCities');
    model.registrationAddress.region = 'Санкт-Петербург';
    await advance(CITY_LOOKUP_DEBOUNCE);
    expect(stale.aborted).toBe(true);
    server.last('loadCities').resolve(['Санкт-Петербург', 'Колпино']);
    await flushBehaviors();

    expect(form.registrationAddress.city.componentProps.value).toMatchObject({
      options: ['Санкт-Петербург', 'Колпино'],
      loading: false,
    });
    expect(form.residenceAddress.city.componentProps.value).toMatchObject({ options: [] });
  });

  it('BA-26: revalidateWhen — смена стоимости залога перепроверяет взнос, если ошибку уже видели', async () => {
    const { bundle } = build();
    const { model, form } = bundle;
    await settle();
    model.loan.type = 'mortgage';
    await settle();
    model.loan.patch({ propertyValue: 5_000_000, initialPayment: 1_000_000 });
    await settle();

    model.loan.propertyValue = 900_000;
    await settle();
    expect(form.loan.initialPayment.issues.value).toEqual([]);

    form.loan.initialPayment.markAsTouched();
    model.loan.propertyValue = 800_000;
    await settle();
    expect(issueCodes(form.loan.initialPayment)).toEqual(['loan.initialPayment.tooHigh']);

    model.loan.propertyValue = 5_000_000;
    await settle();
    expect(form.loan.initialPayment.issues.value).toEqual([]);
  });

  it('BA-27: apply — подсхема получает область своей группы: модель, форму и схему подформы', async () => {
    const { bundle } = build();
    const { model, form } = bundle;
    model.employment.status = 'unemployed';
    await settle();

    const employment = overridesOf(bundle, model.employment);
    expect(employment.conditionRegistry.get('employer')?.()).toBe(true);
    expect(overridesOf(bundle).conditionRegistry.has('employer')).toBe(false);
    expect(form.employment.position.disabled.value).toBe(true);
  });

  it('BA-28: applyEach вложенный — поведение у каждой строки своё и снимается с удалённой', async () => {
    const { bundle } = build();
    const { model } = bundle;
    const first = addCoBorrower(model, { livesWithApplicant: true });
    const second = addCoBorrower(model, { livesWithApplicant: false });
    await settle();

    expect(overridesOf(bundle, first).conditionRegistry.get('co-borrower-address')?.()).toBe(true);
    expect(overridesOf(bundle, second).conditionRegistry.get('co-borrower-address')?.()).toBe(
      false
    );
    expect(bundle.form.coBorrowers.at(0)?.address.disabled.value).toBe(true);
    expect(bundle.form.coBorrowers.at(1)?.address.disabled.value).toBe(false);

    model.coBorrowers.removeAt(0);
    await settle();
    expect(overridesOf(bundle, first).conditionRegistry.has('co-borrower-address')).toBe(false);
    expect(overridesOf(bundle, second).conditionRegistry.has('co-borrower-address')).toBe(true);
  });

  it('BA-29: exclusiveFlag — основной контакт у созаёмщиков один', async () => {
    const { bundle } = build();
    const { model } = bundle;
    const first = addCoBorrower(model);
    const second = addCoBorrower(model);

    first.isPrimaryContact = true;
    await settle();
    second.isPrimaryContact = true;
    await settle();

    expect([first.isPrimaryContact, second.isPrimaryContact]).toEqual([false, true]);
  });

  it('BA-30: aggregateInto — долю последнего созаёмщика досчитывает форма до 100 %', async () => {
    const { bundle } = build();
    const { model } = bundle;
    const first = addCoBorrower(model, { share: 0 });
    await settle();
    expect(first.share).toBe(100);

    const second = addCoBorrower(model);
    first.share = 70;
    await settle();
    expect([first.share, second.share]).toEqual([70, 30]);
  });

  it('BA-31: onChange без задержки — снятая отметка созаёмщиков очищает список', async () => {
    const { bundle } = build();
    const { model } = bundle;
    addCoBorrower(model);
    addCoBorrower(model);
    await settle();

    model.hasCoBorrowers = false;
    await settle();
    expect(bundle.form.coBorrowers.length).toBe(0);
  });

  it('BA-32: hideWhen — секции корня, строки и подформы скрываются по своим условиям', async () => {
    const { bundle } = build();
    const { model } = bundle;
    const root = overridesOf(bundle).conditionRegistry;

    expect(root.get('mortgage')?.()).toBe(true);
    expect(root.get('residence-address')?.()).toBe(true);
    expect(root.get('co-borrowers-list')?.()).toBe(true);

    model.loan.type = 'mortgage';
    model.sameAsRegistration = false;
    addCoBorrower(model);
    await settle();
    expect(root.get('mortgage')?.()).toBe(false);
    expect(root.get('residence-address')?.()).toBe(false);
    expect(root.get('co-borrowers-list')?.()).toBe(false);
  });

  it('BA-33: onInit и patchProps — заголовок визарда стоит до первого рендера', () => {
    const { bundle } = build();

    expect(overridesOf(bundle).propsOverrides.get('wizard')).toMatchObject({
      title: 'Новая заявка',
    });
  });

  it('BA-34: onComponentEvent — клик по шагу визарда идёт через поток и соблюдает его правила', async () => {
    const { bundle } = build();
    const onStepClick = overridesOf(bundle).callbackRegistry.get('wizard')?.get('onStepClick');

    expect(onStepClick?.('contacts')).toEqual({ status: 'stayed', step: 'loan', reason: 'locked' });
    await passWizardTo(bundle, 'contacts');
    expect(onStepClick?.('loan')).toEqual({ status: 'moved', from: 'contacts', to: 'loan' });
    expect(bundle.flow?.current.value).toBe('loan');
  });

  it('BA-35: renderEffect и flow.goTo — ипотека без залога возвращает к шагу кредита', async () => {
    const { bundle } = build();
    const [effectFn] = overridesOf(bundle).effectRegistry;
    await passWizardTo(bundle, 'contacts');

    effectFn();
    expect(bundle.flow?.current.value).toBe('contacts');

    bundle.model.loan.type = 'mortgage';
    effectFn();
    expect(bundle.flow?.current.value).toBe('loan');
  });

  it('BA-36: onMount и onUnmount — автосохранение черновика, пока визард на экране', async () => {
    useFakeClock();
    const { bundle, server } = build();
    const hooks = overridesOf(bundle).lifecycleRegistry.get('wizard');

    const cleanup = hooks?.onMount?.();
    await advance(AUTOSAVE_INTERVAL * 2);
    expect(server.callsOf('saveDraft')).toHaveLength(2);

    if (typeof cleanup === 'function') cleanup();
    await advance(AUTOSAVE_INTERVAL);
    expect(server.callsOf('saveDraft')).toHaveLength(2);

    bundle.model.email = 'ivanov@example.ru';
    hooks?.onUnmount?.();
    expect(server.last('saveDraft').args[0]).toMatchObject({ email: 'ivanov@example.ru' });
  });

  it('BA-37: пользовательский оператор на getScope / effect / defer / onDispose — заполненность анкеты', async () => {
    const { bundle } = build();
    const { model } = bundle;
    const props = () => overridesOf(bundle).propsOverrides.get('wizard');
    await settle();
    expect(props()).toMatchObject({ progress: 0 });

    fillLoanStep(model);
    await settle();
    expect(props()).toMatchObject({ progress: 30 });

    disposeForm(bundle.form);
    await settle();
    expect(props()).toMatchObject({ title: 'Новая заявка', progress: undefined });
  });

  it('BA-38: сборка заявки привязывает компоненты полей и подформ к нодам', () => {
    const { bundle } = build();

    expect(bundle.form.sameAsRegistration.component).toBe(Checkbox);
    expect(bundle.form.registrationAddress.street.component).toBe(TextInput);
    expect(bundle.form.residenceAddress.street.component).toBe(TextInput);
    // Поле вне схемы (производное) — нода без компонента.
    expect(bundle.form.totalIncome.component).toBeUndefined();
  });
});

// ─── Загрузка в том же тике ────────────────────────────────────────────────────────────────

describe('createForm — загрузка заявки сразу после сборки', () => {
  /**
   * Заявка с сервера: ипотека с залогом и отдельный адрес проживания. Приложение пишет её в модель
   * сразу после сборки — в том же тике, пока отложенные записи сборки (`enableWhen`, `copyFrom`
   * группы) ещё не выполнены.
   */
  const LOADED = {
    loan: { type: 'mortgage', propertyValue: 9_000_000, initialPayment: 2_000_000 },
    sameAsRegistration: false,
    registrationAddress: {
      region: 'Москва',
      city: 'Москва',
      street: 'ул. Тверская, д. 7',
      postalCode: '125009',
    },
    residenceAddress: {
      region: 'Санкт-Петербург',
      city: 'Колпино',
      street: 'ул. Ленина, д. 1',
      postalCode: '196650',
    },
  } satisfies DeepPartial<LoanApplication>;

  it('BA-39: после отложенных записей сборки загрузка сохраняет залог и адрес проживания', async () => {
    const { bundle } = build();
    await settle();

    bundle.model.patch(LOADED);
    await settle();

    expect(bundle.model.loan.propertyValue).toBe(9_000_000);
    expect(bundle.model.loan.initialPayment).toBe(2_000_000);
    expect(bundle.model.residenceAddress.get()).toEqual(LOADED.residenceAddress);
    expect(bundle.form.loan.propertyValue.disabled.value).toBe(false);
    expect(bundle.form.residenceAddress.disabled.value).toBe(false);
  });

  // `enableWhen` откладывает переключение доступности и раньше брал решение «выключить и стереть»
  // на момент планирования: задание первого прогона (вид ещё потребительский) выполнялось после
  // загрузки и стирало залог, хотя условие к этому моменту уже истинно.
  it('BA-40: загрузка в том же тике сохраняет залог ипотеки [ReFormer-qesu]', async () => {
    const { bundle } = build();

    bundle.model.patch(LOADED);
    await settle();

    expect(bundle.model.loan.propertyValue).toBe(9_000_000);
  });

  // `copyFrom` группы раньше писал снимок источника, снятый при прогоне эффекта, и не
  // перепроверял `when` в момент записи: снимок пустого адреса регистрации со сборки затирал
  // загруженный адрес проживания, хотя копирование к этому моменту уже выключено.
  it('BA-41: загрузка в том же тике сохраняет отдельный адрес проживания [ReFormer-h4d6]', async () => {
    const { bundle } = build();

    bundle.model.patch(LOADED);
    await settle();

    expect(bundle.model.residenceAddress.city).toBe('Колпино');
  });
});

// ─── Правила ──────────────────────────────────────────────────────────────────────────────

describe('правила заявки — каждое из 27 правил ./validators подключено к своему полю', () => {
  const MEGABYTE = 1024 * 1024;

  /** Нарушение одного правила в заполненной заявке: что поменять и какое замечание ждать. */
  interface Violation {
    /** Фабрика правила во входе `./validators`. */
    readonly rule: string;
    readonly path: string;
    readonly code: string;
    readonly violate: (model: FormModel<LoanApplication>) => void;
  }

  /** Приложить документы; файлы создаются в момент нарушения, а не при загрузке модуля. */
  const attach =
    (...files: Array<[name: string, size: number, type?: string]>) =>
    (model: FormModel<LoanApplication>): void => {
      model.$.documents.value = files.map(([name, size, type]) => documentFile(name, size, type));
    };

  const VIOLATIONS: readonly Violation[] = [
    {
      rule: 'required',
      path: 'loan.purpose',
      code: 'required',
      violate: (m) => void (m.loan.purpose = ''),
    },
    {
      rule: 'min',
      path: 'loan.amount',
      code: 'loan.amount.min',
      violate: (m) => void (m.loan.amount = 20_000),
    },
    {
      rule: 'max',
      path: 'loan.amount',
      code: 'loan.amount.max',
      violate: (m) => void (m.loan.amount = 7_000_000),
    },
    {
      rule: 'minLength',
      path: 'loan.purpose',
      code: 'minLength',
      violate: (m) => void (m.loan.purpose = 'Ремонт'),
    },
    {
      rule: 'maxLength',
      path: 'loan.purpose',
      code: 'maxLength',
      violate: (m) => void (m.loan.purpose = 'Р'.repeat(201)),
    },
    { rule: 'email', path: 'email', code: 'email', violate: (m) => void (m.email = 'ivanov@') },
    {
      rule: 'pattern',
      path: 'applicant.passport.series',
      code: 'passport.series.format',
      violate: (m) => void (m.applicant.passport.series = '45'),
    },
    {
      rule: 'url',
      path: 'employment.companySite',
      code: 'employment.companySite.url',
      violate: (m) => void (m.employment.companySite = 'ромашка'),
    },
    { rule: 'phone', path: 'phone', code: 'phone', violate: (m) => void (m.phone = '12345') },
    {
      rule: 'isNumber',
      path: 'loan.amount',
      code: 'isNumber',
      violate: (m) => void (m.loan.amount = Number.NaN),
    },
    {
      rule: 'integer',
      path: 'loan.term',
      code: 'integer',
      violate: (m) => void (m.loan.term = 36.5),
    },
    {
      rule: 'multipleOf',
      path: 'loan.amount',
      code: 'loan.amount.step',
      violate: (m) => void (m.loan.amount = 500_500),
    },
    {
      rule: 'nonNegative',
      path: 'dependents',
      code: 'nonNegative',
      violate: (m) => void (m.dependents = -1),
    },
    {
      rule: 'nonZero',
      path: 'loan.initialPayment',
      code: 'nonZero',
      violate: (m) =>
        m.loan.patch({ type: 'mortgage', propertyValue: 5_000_000, initialPayment: 0 }),
    },
    {
      rule: 'isDate',
      path: 'applicant.birthDate',
      code: 'date_invalid',
      violate: (m) => void (m.applicant.birthDate = '1990-02-30'),
    },
    {
      rule: 'minDate',
      path: 'applicant.passport.issueDate',
      code: 'passport.issueDate.min',
      violate: (m) => void (m.applicant.passport.issueDate = '1997-06-30'),
    },
    {
      rule: 'maxDate',
      path: 'loan.firstPaymentDate',
      code: 'loan.firstPaymentDate.max',
      violate: (m) => void (m.loan.firstPaymentDate = daysFromToday(120)),
    },
    {
      rule: 'pastDate',
      path: 'applicant.passport.issueDate',
      code: 'date_future',
      violate: (m) => void (m.applicant.passport.issueDate = daysFromToday(1)),
    },
    {
      rule: 'futureDate',
      path: 'loan.firstPaymentDate',
      code: 'date_past',
      violate: (m) => void (m.loan.firstPaymentDate = daysFromToday(-1)),
    },
    {
      rule: 'minAge',
      path: 'applicant.birthDate',
      code: 'applicant.birthDate.minAge',
      violate: (m) => void (m.applicant.birthDate = yearsAgo(17)),
    },
    {
      rule: 'maxAge',
      path: 'applicant.birthDate',
      code: 'applicant.birthDate.maxAge',
      violate: (m) => void (m.applicant.birthDate = yearsAgo(80)),
    },
    {
      rule: 'maxFileSize',
      path: 'documents',
      code: 'maxFileSize',
      violate: attach(['scan.pdf', 11 * MEGABYTE], ['income.pdf', 1024]),
    },
    {
      rule: 'minFileSize',
      path: 'documents',
      code: 'minFileSize',
      violate: attach(['empty.pdf', 0], ['income.pdf', 1024]),
    },
    {
      rule: 'fileType',
      path: 'documents',
      code: 'fileType',
      violate: attach(['notes.txt', 1024, 'text/plain'], ['income.pdf', 1024]),
    },
    {
      rule: 'maxFiles',
      path: 'documents',
      code: 'maxFiles',
      violate: attach(
        ...Array.from({ length: 6 }, (_, index): [string, number] => [`page-${index}.pdf`, 1024])
      ),
    },
    {
      rule: 'minFiles',
      path: 'documents',
      code: 'documents.minFiles',
      violate: attach(['passport.pdf', 1024]),
    },
    {
      rule: 'maxTotalFileSize',
      path: 'documents',
      code: 'maxTotalFileSize',
      violate: attach(['a.pdf', 7 * MEGABYTE], ['b.pdf', 7 * MEGABYTE], ['c.pdf', 7 * MEGABYTE]),
    },
  ];

  it('BA-42: таблица нарушений покрывает все фабрики правил входа ./validators', () => {
    const helpers = new Set(['isFileLike', 'matchesFileAccept', 'toFileArray']);
    const factories = Object.keys(validators).filter((name) => !helpers.has(name));

    expect(factories).toHaveLength(27);
    expect(VIOLATIONS.map(({ rule }) => rule).sort()).toEqual(factories.sort());
  });

  it.each(VIOLATIONS)('BA-42 · $rule — замечание $code на поле $path', async (violation) => {
    const { bundle } = build();
    await passWizardTo(bundle, 'review');

    violation.violate(bundle.model);
    await settle();
    const result = await bundle.validate();

    expect(issuesByPath(result)[violation.path]).toContain(violation.code);
  });

  it('BA-43: cross в строке — без телефонов у живущего отдельно созаёмщика замечание ложится на массив', async () => {
    const { bundle } = build();
    await passWizardTo(bundle, 'review');
    const row = bundle.model.coBorrowers.at(0);

    row.patch({
      livesWithApplicant: false,
      address: {
        region: 'Москва',
        city: 'Москва',
        street: 'ул. Ленина, д. 1',
        postalCode: '101000',
      },
    });
    row.phones.clear();
    await settle();
    const result = await bundle.validate();

    const rowForm = bundle.form.coBorrowers.at(0);
    expect(result.status).toBe('invalid');
    expect(issuesByPath(result)).toEqual({
      'coBorrowers.0.phones': ['coBorrower.phones.required'],
    });
    expect(issueCodes({ issues: rowForm!.phones.ownIssues })).toEqual([
      'coBorrower.phones.required',
    ]);
    expect(issueCodes(rowForm!)).toEqual(['coBorrower.phones.required']);
  });
});
