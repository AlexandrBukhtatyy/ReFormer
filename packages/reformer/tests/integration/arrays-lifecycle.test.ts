/**
 * Жизненный цикл массивов заявки на кредит: строки добавляют, переставляют, удаляют и загружают с
 * сервера, а их форма, проверка и поведение должны оставаться при своей строке.
 *
 * В заявке три вида массивов под-форм: созаёмщики (строка с подформой адреса и вложенным массивом
 * телефонов, шаблон строки — в модели), прежние места работы (массив внутри подформы занятости) и
 * рекомендатели (шаблона в модели нет — его даёт `initialValue` узла схемы). Сценарии проверяют
 * связку модели, нод, поведения строк (`applyEach`) и проверки шага:
 * - `insert` / `insertAt`, `move`, `swap` — замечания, `touched`, `componentProps`, `keyAt` и
 *   поведение строки едут вместе со строкой, а пути новой проверки — по новым индексам;
 * - `removeAt` и `clear` — удалённая строка не держит `valid`, её поведение и правила узлов сняты;
 * - `map` / `forEach` — обход форм строк в текущем порядке;
 * - `patch` массива с сервера (длиннее, короче, пустой) — строки собираются заново, со вложенными
 *   шаблонами и поведением строк, производные поля пересчитаны;
 * - `modelOf` — ручка строки ведёт к своей строке и после перестановки;
 * - ошибки строк в результате проверки шага — с путями строк, вложенных групп и массивов;
 * - `dirty` массива — известный дефект `ReFormer-j33t`.
 * Ветви самих нод и модели массива покрыты юнит-тестами (`tests/core/nodes/`, `tests/core/model/`).
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { advance, settle, useFakeClock } from '../test-utils/async';
import { disposeForm } from '../test-utils/dispose-form';
import { issueCodes } from '../test-utils/issues';
import { mountScope, type MountedScope } from '../test-utils/schema-harness';
import { modelOf, type FormModel, type SchemaScope } from '../../src/index';
import type { ValidationResult } from '../../src/form/validation/index';
import {
  addCoBorrower,
  fillEmploymentStep,
  flushBehaviors,
} from './fixtures/loan-application/actions';
import { CITY_LOOKUP_DEBOUNCE } from './fixtures/loan-application/behavior';
import {
  createLoanForm,
  type LoanForm,
  type LoanFormOptions,
} from './fixtures/loan-application/create-loan-form';
import {
  blankAddress,
  type Address,
  type CoBorrower,
  type LoanApplication,
} from './fixtures/loan-application/model';
import { REFERENCE_TEMPLATE } from './fixtures/loan-application/schema';

// ─── Сборки теста и их уборка ───────────────────────────────────────────────────────────────

/** Сборки текущего теста: после теста их поведение и стратегия снимаются. */
const assembled: LoanForm[] = [];
/** Смонтированные харнессом области строк. */
const mounted: MountedScope[] = [];

function build(options?: LoanFormOptions): LoanForm {
  const built = createLoanForm(options);
  assembled.push(built);
  return built;
}

/** Смонтировать область схемы, как это делает рендерер, — с уборкой после теста. */
function mount(scope: SchemaScope, selectors: string[]): MountedScope {
  const view = mountScope(scope, selectors);
  mounted.push(view);
  return view;
}

afterEach(() => {
  for (const view of mounted.splice(0)) view.unmount();
  for (const { bundle } of assembled.splice(0)) {
    disposeForm(bundle.form);
    bundle.validation?.controller.dispose();
  }
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// ─── Помощники ──────────────────────────────────────────────────────────────────────────────

/** Непустые замечания прогона по путям полей. */
function issuesByPath(result: ValidationResult): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [handle, issues] of result.issues) {
    if (issues.length > 0) out[handle.__path] = issues.map((issue) => issue.code);
  }
  return out;
}

/** Замечания второго созаёмщика из {@link addTwoCoBorrowers}. */
const SECOND_ROW_CODES = ['coBorrower.relation.required', 'coBorrower.monthlyIncome.min'];

/**
 * Шаг «Семья и созаёмщики» с двумя созаёмщиками: первый проходит правила строки, у второго не
 * указано родство и мал доход. Доля второго — остаток до 100 % (её досчитывает форма).
 */
function addTwoCoBorrowers(
  model: FormModel<LoanApplication>
): [FormModel<CoBorrower>, FormModel<CoBorrower>] {
  model.dependents = 1;
  const first = addCoBorrower(model, { fullName: 'Иванова Мария Петровна', share: 60 });
  const second = addCoBorrower(model, {
    fullName: 'Иванов Пётр Иванович',
    relation: null,
    monthlyIncome: 5_000,
  });
  return [first, second];
}

/** Отдельный адрес созаёмщика. */
const SPB_ADDRESS: Address = {
  region: 'Санкт-Петербург',
  city: 'Колпино',
  street: 'ул. Ленина, д. 1',
  postalCode: '196650',
};

/** Созаёмщики из черновика на сервере — обычные данные, без шаблонов `arrayOf`. */
const serverCoBorrowers = (): CoBorrower[] => [
  {
    fullName: 'Петров Пётр Петрович',
    relation: 'parent',
    monthlyIncome: 50_000,
    share: 50,
    isPrimaryContact: true,
    livesWithApplicant: false,
    address: { ...SPB_ADDRESS },
    phones: [{ number: '+7 (900) 000-00-01' }],
  },
  {
    fullName: 'Петрова Анна Ивановна',
    relation: 'parent',
    monthlyIncome: 40_000,
    share: 30,
    isPrimaryContact: false,
    livesWithApplicant: true,
    address: blankAddress(),
    phones: [{ number: '+7 (900) 000-00-02' }],
  },
  {
    fullName: 'Петров Олег Петрович',
    relation: 'child',
    monthlyIncome: 30_000,
    share: 0,
    isPrimaryContact: false,
    livesWithApplicant: true,
    address: blankAddress(),
    phones: [],
  },
];

// ─── Перестановки и вставки ────────────────────────────────────────────────────────────────

describe('массивы заявки — вставка и перестановка строк с замечаниями', () => {
  it('AL-01: insert в начало — замечания, touched и ключи строк едут со своими строками', async () => {
    const { bundle } = build();
    const { model, form } = bundle;
    await settle();
    const [, second] = addTwoCoBorrowers(model);
    await settle();
    const checked = await bundle.validateStep('co-borrowers');
    expect(issuesByPath(checked)).toEqual({
      'coBorrowers.1.relation': ['coBorrower.relation.required'],
      'coBorrowers.1.monthlyIncome': ['coBorrower.monthlyIncome.min'],
    });
    const secondForm = form.coBorrowers.at(1)!;
    const keys = [form.coBorrowers.keyAt(0), form.coBorrowers.keyAt(1)];

    form.coBorrowers.insert(0);

    expect(form.coBorrowers.length).toBe(3);
    expect(form.coBorrowers.at(2)).toBe(secondForm);
    expect([form.coBorrowers.keyAt(1), form.coBorrowers.keyAt(2)]).toEqual(keys);
    expect(issueCodes(secondForm)).toEqual(SECOND_ROW_CODES);
    expect(secondForm.relation.touched.value).toBe(true);
    const added = form.coBorrowers.at(0)!;
    expect([added.touched.value, added.issues.value]).toEqual([false, []]);
    // Ключи прошлого результата — сами ручки полей: их пути уже новые.
    expect(second.$.relation.__path).toBe('coBorrowers.2.relation');
    expect(issuesByPath(checked)).toEqual({
      'coBorrowers.2.relation': ['coBorrower.relation.required'],
      'coBorrowers.2.monthlyIncome': ['coBorrower.monthlyIncome.min'],
    });
  });

  it('AL-02: swap — формы, замечания и ключи меняются местами; доли досчитаны заново, пути проверки — новые', async () => {
    const { bundle } = build();
    const { model, form } = bundle;
    await settle();
    addTwoCoBorrowers(model);
    await settle();
    expect(model.coBorrowers.map((row) => row.share)).toEqual([60, 40]);
    await bundle.validateStep('co-borrowers');
    const rows = form.coBorrowers.map((row) => row);
    const keys = [form.coBorrowers.keyAt(0), form.coBorrowers.keyAt(1)];

    form.coBorrowers.swap(0, 1);

    expect(form.coBorrowers.map((row) => row)).toEqual([rows[1], rows[0]]);
    expect(form.coBorrowers.at(0)).toBe(rows[1]);
    expect([form.coBorrowers.keyAt(0), form.coBorrowers.keyAt(1)]).toEqual([keys[1], keys[0]]);
    expect(form.coBorrowers.map((row) => issueCodes(row))).toEqual([SECOND_ROW_CODES, []]);
    await settle();
    // Последним стал первый созаёмщик — остаток до 100 % снова его.
    expect(model.coBorrowers.map((row) => row.share)).toEqual([40, 60]);
    expect(issuesByPath(await bundle.validateStep('co-borrowers'))).toEqual({
      'coBorrowers.0.relation': ['coBorrower.relation.required'],
      'coBorrowers.0.monthlyIncome': ['coBorrower.monthlyIncome.min'],
    });
  });

  it('AL-03: move в массиве внутри подформы — замечания прежнего места работы едут со строкой', async () => {
    const { bundle } = build();
    const { model, form } = bundle;
    await settle();
    fillEmploymentStep(model);
    model.employment.previousJobs.push({ company: '', years: 2.5 });
    expect(issuesByPath(await bundle.validateStep('employment'))).toEqual({
      'employment.previousJobs.1.company': ['previousJob.company.required'],
      'employment.previousJobs.1.years': ['integer'],
    });
    const broken = form.employment.previousJobs.at(1)!;

    form.employment.previousJobs.move(1, 0);

    expect(form.employment.previousJobs.at(0)).toBe(broken);
    expect(issueCodes(broken)).toEqual(['previousJob.company.required', 'integer']);
    expect(issuesByPath(await bundle.validateStep('employment'))).toEqual({
      'employment.previousJobs.0.company': ['previousJob.company.required'],
      'employment.previousJobs.0.years': ['integer'],
    });
  });

  it('AL-04: пропсы компонентов и правила узлов строки едут со строкой — города региона и скрытие адреса после swap', async () => {
    useFakeClock();
    const { bundle } = build();
    const { model, form } = bundle;
    await flushBehaviors();
    const first = addCoBorrower(model, { livesWithApplicant: false });
    addCoBorrower(model, { livesWithApplicant: false });
    await flushBehaviors();
    first.address.region = 'Санкт-Петербург';
    await advance(CITY_LOOKUP_DEBOUNCE);
    await flushBehaviors();
    const firstCity = form.coBorrowers.at(0)!.address.city;
    expect(firstCity.componentProps.value).toMatchObject({
      options: ['Санкт-Петербург', 'Колпино'],
      loading: false,
    });

    form.coBorrowers.swap(0, 1);

    expect(form.coBorrowers.at(1)!.address.city).toBe(firstCity);
    expect(firstCity.componentProps.value).toMatchObject({
      options: ['Санкт-Петербург', 'Колпино'],
    });
    expect(form.coBorrowers.at(0)!.address.city.componentProps.value).toMatchObject({
      options: [],
    });
    // Область строки — по её под-модели: правило скрытия адреса читает условие своей строки.
    const view = mount(bundle.render.controller.scopeOf(first), ['co-borrower-address']);
    expect(view.isHidden('co-borrower-address')).toBe(false);
    first.livesWithApplicant = true;
    await flushBehaviors();
    expect(view.isHidden('co-borrower-address')).toBe(true);
    expect(form.coBorrowers.map((row) => row.address.disabled.value)).toEqual([false, true]);
  });

  it('AL-05: поведение строки держится за строку, а не за индекс — после move', async () => {
    const { bundle } = build();
    const { model, form } = bundle;
    await settle();
    addCoBorrower(model, { fullName: 'Иванова Мария Петровна', isPrimaryContact: true });
    addCoBorrower(model, { fullName: 'Иванов Пётр Иванович' });
    const third = addCoBorrower(model, { fullName: 'Иванова Анна Петровна' });
    await settle();

    model.coBorrowers.move(2, 0);
    // Каждая правка — в переставленной строке: её операторы и должны сработать.
    third.phones.at(0).number = '+7 (900) 555-00-11 доб.';
    third.isPrimaryContact = true;
    third.livesWithApplicant = false;
    await settle();

    expect(third.phones.at(0).number).toBe('+7 (900) 555-00-11 ');
    expect(model.coBorrowers.map((row) => row.isPrimaryContact)).toEqual([true, false, false]);
    expect(form.coBorrowers.map((row) => row.address.disabled.value)).toEqual([false, true, true]);
  });

  it('AL-06: map и forEach обходят формы строк в текущем порядке — с их ключами и валидностью', async () => {
    const { bundle } = build();
    const { model, form } = bundle;
    await settle();
    addTwoCoBorrowers(model);
    await settle();
    await bundle.validateStep('co-borrowers');
    const before: Array<[string, boolean]> = [];
    form.coBorrowers.forEach((row, index) => {
      before.push([form.coBorrowers.keyAt(index), row.valid.value]);
    });

    form.coBorrowers.move(1, 0);

    const after = form.coBorrowers.map((row, index): [string, boolean] => [
      form.coBorrowers.keyAt(index),
      row.valid.value,
    ]);
    expect(after).toEqual([before[1], before[0]]);
    expect(after.map(([, valid]) => valid)).toEqual([false, true]);
  });
});

// ─── Удаление ──────────────────────────────────────────────────────────────────────────────

describe('массивы заявки — удаление строк', () => {
  it('AL-07: removeAt — удалённая строка не держит valid, её поведение и правила узлов сняты, доля пересчитана', async () => {
    const { bundle } = build();
    const { model, form } = bundle;
    await settle();
    const [first, second] = addTwoCoBorrowers(model);
    await settle();
    await bundle.validateStep('co-borrowers');
    const removedRules = bundle.render.controller.scopeOf(second).__overrideMaps;
    expect([form.coBorrowers.valid.value, form.valid.value]).toEqual([false, false]);
    expect(removedRules.conditionRegistry.has('co-borrower-address')).toBe(true);

    form.coBorrowers.removeAt(1);

    expect([form.coBorrowers.valid.value, form.valid.value]).toEqual([true, true]);
    expect(removedRules.conditionRegistry.has('co-borrower-address')).toBe(false);
    // Правка удалённой строки — без реакции поведения: преобразование индекса снято.
    second.address.postalCode = 'дом 101000';
    await settle();
    expect(second.address.postalCode).toBe('дом 101000');
    expect(first.share).toBe(100);
    expect((await bundle.validateStep('co-borrowers')).status).toBe('valid');
  });

  it('AL-08: clear — строки сняты вместе с замечаниями; пустой список при отметке «есть созаёмщики» — замечание шага', async () => {
    const { bundle } = build();
    const { model, form } = bundle;
    await settle();
    addTwoCoBorrowers(model);
    await settle();
    await bundle.validateStep('co-borrowers');
    expect(form.coBorrowers.issues.value).not.toEqual([]);

    form.coBorrowers.clear();

    expect([form.coBorrowers.length, form.coBorrowers.issues.value, form.valid.value]).toEqual([
      0,
      [],
      true,
    ]);
    await settle();
    expect(model.totalIncome).toBe(0);
    expect(issuesByPath(await bundle.validateStep('co-borrowers'))).toEqual({
      hasCoBorrowers: ['coBorrowers.empty'],
    });
  });
});

// ─── Загрузка с сервера ────────────────────────────────────────────────────────────────────

describe('массивы заявки — patch массива с сервера', () => {
  it('AL-09: patch длиннее прежнего — строки собраны заново: прежняя снята с замечанием, новые со шаблонами и поведением', async () => {
    const { bundle } = build();
    const { model, form } = bundle;
    await settle();
    addCoBorrower(model);
    await settle();
    const previous = form.coBorrowers.at(0)!;
    const previousKey = form.coBorrowers.keyAt(0);
    previous.fullName.setIssues([{ code: 'server.duplicate' }]);

    model.patch({ coBorrowers: serverCoBorrowers() });
    await settle();

    expect(form.coBorrowers.length).toBe(3);
    // `patch` заменяет массив целиком: строки — новые, у прежней ни формы, ни замечания в списке.
    expect(form.coBorrowers.at(0)).not.toBe(previous);
    expect(form.coBorrowers.keyAt(0)).not.toBe(previousKey);
    expect(form.coBorrowers.issues.value).toEqual([]);
    // Поведение строк из данных сервера: адрес по флагу, доля последнего досчитана, доход семьи.
    expect(form.coBorrowers.map((row) => row.address.disabled.value)).toEqual([false, true, true]);
    expect(model.coBorrowers.map((row) => row.share)).toEqual([50, 30, 20]);
    expect(model.totalIncome).toBe(120_000);
    // Вложенный шаблон в строке из обычных данных: «Добавить» телефон без значения.
    model.coBorrowers.at(2).phones.push();
    expect(model.coBorrowers.at(2).phones.toArray()).toEqual([{ number: '' }]);
  });

  it('AL-10: patch короче и пустой — лишние формы сняты, доход семьи и доли пересчитаны', async () => {
    const { bundle } = build();
    const { model, form } = bundle;
    await settle();
    model.hasCoBorrowers = true;
    model.dependents = 1;
    model.patch({ coBorrowers: serverCoBorrowers() });
    await settle();
    const dropped = form.coBorrowers.at(2)!;
    dropped.fullName.setIssues([{ code: 'server.duplicate' }]);

    model.patch({ coBorrowers: serverCoBorrowers().slice(0, 1) });
    await settle();
    expect([form.coBorrowers.length, model.coBorrowers.at(0).share, model.totalIncome]).toEqual([
      1, 100, 50_000,
    ]);
    expect(form.coBorrowers.issues.value).toEqual([]);
    expect((await bundle.validateStep('co-borrowers')).status).toBe('valid');

    model.patch({ coBorrowers: [] });
    await settle();
    expect([form.coBorrowers.length, model.totalIncome]).toEqual([0, 0]);
    expect(issuesByPath(await bundle.validateStep('co-borrowers'))).toEqual({
      hasCoBorrowers: ['coBorrowers.empty'],
    });
  });

  it('AL-11: modelOf — ручки массива, строки, группы строки и массива в подформе дают их фасады; ручка строки ведёт к ней и после swap', async () => {
    const { bundle } = build();
    const { model, form } = bundle;
    await settle();
    const [first, second] = addTwoCoBorrowers(model);
    fillEmploymentStep(model);
    const firstHandle = model.$.coBorrowers[0];

    expect(modelOf(model.$.coBorrowers)).toBe(model.coBorrowers);
    expect(modelOf(firstHandle)).toBe(first);
    expect(modelOf(model.$.coBorrowers[1].address)).toBe(second.address);
    expect(modelOf(model.$.employment.previousJobs)).toBe(model.employment.previousJobs);

    // Перестановка в модели — форма строк следует за ней.
    model.coBorrowers.swap(0, 1);

    expect(modelOf(firstHandle)).toBe(first);
    expect(modelOf(model.$.coBorrowers[0])).toBe(second);
    // Правка через фасад ручки — в строке модели и в её форме.
    modelOf(firstHandle).fullName = 'Иванова Мария';
    expect(form.coBorrowers.at(1)!.fullName.value.value).toBe('Иванова Мария');
  });
});

// ─── Новая строка и ошибки строк ──────────────────────────────────────────────────────────

describe('массивы заявки — поведение и проверка строк', () => {
  it('AL-12: applyEach на новой строке — поведение строки действует сразу после «Добавить»', async () => {
    const { bundle } = build();
    const { model, form } = bundle;
    await settle();
    model.hasCoBorrowers = true;

    form.coBorrowers.push();

    // Строка по шаблону модели — живёт отдельно: правило узла записано сразу, к первому кадру.
    const row = model.coBorrowers.at(0);
    const view = mount(bundle.render.controller.scopeOf(row), ['co-borrower-address']);
    expect(view.isHidden('co-borrower-address')).toBe(false);
    row.address.postalCode = 'дом 101000';
    row.phones.push();
    row.phones.at(0).number = '+7 (900) 000-00-00 x';
    await settle();
    expect(row.address.postalCode).toBe('101000');
    expect(row.phones.at(0).number).toBe('+7 (900) 000-00-00 ');
    expect([row.share, form.coBorrowers.at(0)!.address.disabled.value]).toEqual([100, false]);

    row.livesWithApplicant = true;
    await settle();
    expect([
      view.isHidden('co-borrower-address'),
      form.coBorrowers.at(0)!.address.disabled.value,
    ]).toEqual([true, true]);
  });

  it('AL-13: ошибки строк в результате проверки шага — с путями строк, групп в строке и вложенных массивов', async () => {
    const { bundle } = build();
    const { model, form } = bundle;
    await settle();
    model.dependents = 1;
    addCoBorrower(model, { fullName: 'Иванова Мария Петровна', share: 60 });
    const second = addCoBorrower(model, {
      fullName: 'Петров Пётр Петрович',
      share: 30,
      livesWithApplicant: false,
      address: { ...SPB_ADDRESS, city: '' },
    });
    second.phones.push({ number: '123' });
    const third = addCoBorrower(model, {
      fullName: 'Петрова Анна Ивановна',
      livesWithApplicant: false,
      address: SPB_ADDRESS,
    });
    third.phones.clear();
    await settle();

    const result = await bundle.validateStep('co-borrowers');

    expect(issuesByPath(result)).toEqual({
      'coBorrowers.1.address.city': ['address.city.required'],
      'coBorrowers.1.phones.1.number': ['phone'],
      'coBorrowers.2.phones': ['coBorrower.phones.required'],
    });
    // Те же замечания — на нодах строк: поле вложенного массива и собственное замечание массива.
    expect(issueCodes(form.coBorrowers.at(1)!.phones.at(1)!)).toEqual(['phone']);
    expect(issueCodes({ issues: form.coBorrowers.at(2)!.phones.ownIssues })).toEqual([
      'coBorrower.phones.required',
    ]);
  });

  it('AL-14: рекомендатели — insert и insertAt без значения берут шаблон узла схемы; ошибки строк по путям', async () => {
    const { bundle } = build();
    const { model, form } = bundle;
    await settle();
    form.references.push({ name: 'Петров Пётр', phone: '+7 (900) 111-22-33' });

    form.references.insert(0);
    model.references.insertAt(2);

    expect(model.references.toArray()).toEqual([
      REFERENCE_TEMPLATE,
      { name: 'Петров Пётр', phone: '+7 (900) 111-22-33' },
      REFERENCE_TEMPLATE,
    ]);
    model.references.at(0).name = 'Сидоров';
    expect([REFERENCE_TEMPLATE.name, model.references.at(2).name]).toEqual(['', '']);
    const references = Object.entries(issuesByPath(await bundle.validateStep('documents'))).filter(
      ([path]) => path.startsWith('references.')
    );
    expect(Object.fromEntries(references)).toEqual({
      'references.0.phone': ['required'],
      'references.2.name': ['required'],
      'references.2.phone': ['required'],
    });
  });

  it.fails(
    'AL-15: удаление строки делает массив dirty — состав списка изменился [ReFormer-j33t]',
    () => {
      const { bundle } = build({
        seed: (model) => {
          addCoBorrower(model);
          addCoBorrower(model);
        },
      });

      bundle.form.coBorrowers.removeAt(0);

      expect(bundle.form.coBorrowers.dirty.value).toBe(true);
    }
  );
});
