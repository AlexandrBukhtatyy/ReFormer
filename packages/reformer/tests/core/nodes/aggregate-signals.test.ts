/**
 * Агрегированные сигналы контейнера (`createAggregateSignals`) — состояние группы и массива
 * под-форм из детей и своих замечаний.
 *
 * Сначала агрегат сам по себе, на детях-заглушках из сигналов: выключенный ребёнок в `valid` не
 * входит, `pending`/`touched`/`dirty` — «хотя бы один», в `issues` свои замечания идут первыми,
 * состав детей читается реактивно, своё `warning` не блокирует, своё ожидание (`ownPending`)
 * снимает и `valid`, и `invalid`. Затем зонды на настоящих формах: замечание `warning` и ожидание
 * async-правила — там агрегат расходился с полем и с контрактом `FormNode` (`valid` — «нет
 * блокирующих замечаний», `invalid` — «нода не ждёт проверки»): [ReFormer-sc1a], [ReFormer-xdrh].
 */

import { describe, expect, it } from 'vitest';
import { signal, type Signal } from '@preact/signals-core';
import { createAggregateSignals } from '../../../src/form/aggregate-signals';
import { createForm } from '../../../src/form/form-bundle';
import { createModel, arrayOf } from '../../../src/model/index';
import { createFormFromModel } from '../../../src/form/create-form';
import type { FormModel } from '../../../src/model/types';
import { defineValidation, validate, validateAsync } from '../../../src/form/validation';
import type { ValidationIssue } from '../../../src/form/types/contracts';
import type { FormNode } from '../../../src/form/types/nodes';
import { deferred } from '../../test-utils/async';
import { issueCodes } from '../../test-utils/issues';

/** Ребёнок-заглушка: только сигналы, которые читает агрегат. */
interface FakeChild {
  disabled: Signal<boolean>;
  valid: Signal<boolean>;
  invalid: Signal<boolean>;
  pending: Signal<boolean>;
  touched: Signal<boolean>;
  dirty: Signal<boolean>;
  issues: Signal<readonly ValidationIssue[]>;
}

type FlagName = 'pending' | 'touched' | 'dirty';

function fakeChild(
  state: Partial<Record<'disabled' | 'valid' | FlagName, boolean>> & {
    issues?: ValidationIssue[];
  } = {}
): FakeChild {
  const valid = state.valid ?? true;
  const pending = state.pending ?? false;
  return {
    disabled: signal(state.disabled ?? false),
    valid: signal(valid),
    invalid: signal(!valid && !pending),
    pending: signal(pending),
    touched: signal(state.touched ?? false),
    dirty: signal(state.dirty ?? false),
    issues: signal(state.issues ?? []),
  };
}

/** Агрегат над списком детей в сигнале — его можно менять по ходу теста. */
function aggregateOf(children: FakeChild[], own: ValidationIssue[] = []) {
  const list = signal(children);
  const ownIssues = signal<readonly ValidationIssue[]>(own);
  const ownPending = signal(false);
  const signals = createAggregateSignals({
    getChildren: () => list.value as unknown as readonly FormNode<unknown>[],
    ownIssues,
    ownPending,
  });
  return { list, ownIssues, ownPending, signals };
}

const required: ValidationIssue = { code: 'required' };
const warning: ValidationIssue = { code: 'weak', severity: 'warning' };

describe('aggregate-signals — valid и invalid', () => {
  it('без детей и своих замечаний контейнер валиден', () => {
    const { signals } = aggregateOf([]);

    expect(signals.valid.value).toBe(true);
    expect(signals.invalid.value).toBe(false);
  });

  it('невалидный включённый ребёнок делает контейнер невалидным', () => {
    const { signals } = aggregateOf([fakeChild(), fakeChild({ valid: false })]);

    expect(signals.valid.value).toBe(false);
    expect(signals.invalid.value).toBe(true);
  });

  it('выключенный ребёнок в valid не входит, даже невалидный', () => {
    const broken = fakeChild({ valid: false });
    const { signals } = aggregateOf([fakeChild(), broken]);
    expect(signals.valid.value).toBe(false);

    broken.disabled.value = true;
    expect(signals.valid.value).toBe(true);
    expect(signals.invalid.value).toBe(false);

    broken.disabled.value = false;
    expect(signals.valid.value).toBe(false);
  });

  it('своё замечание делает контейнер невалидным при валидных детях', () => {
    const { ownIssues, signals } = aggregateOf([fakeChild()], [required]);
    expect(signals.valid.value).toBe(false);

    ownIssues.value = [];
    expect(signals.valid.value).toBe(true);
  });

  it('своё warning не блокирует: контейнер valid и не invalid [ReFormer-sc1a]', () => {
    const { signals } = aggregateOf([fakeChild()], [warning]);

    expect([signals.valid.value, signals.invalid.value]).toEqual([true, false]);
  });

  it('пока ребёнок ждёт проверки, контейнер ни valid, ни invalid [ReFormer-xdrh]', () => {
    const { signals } = aggregateOf([fakeChild({ valid: false }), fakeChild({ pending: true })]);

    expect([signals.pending.value, signals.valid.value, signals.invalid.value]).toEqual([
      true,
      false,
      false,
    ]);
  });

  it('своё ожидание: pending, а блокирующее своё замечание до конца проверки не invalid', () => {
    const { ownPending, signals } = aggregateOf([fakeChild()], [required]);
    ownPending.value = true;
    expect([signals.pending.value, signals.valid.value, signals.invalid.value]).toEqual([
      true,
      false,
      false,
    ]);

    ownPending.value = false;
    expect([signals.pending.value, signals.invalid.value]).toEqual([false, true]);
  });

  it('новый ребёнок в составе сразу входит в valid', () => {
    const { list, signals } = aggregateOf([fakeChild()]);
    expect(signals.valid.value).toBe(true);

    list.value = [...list.value, fakeChild({ valid: false })];

    expect(signals.valid.value).toBe(false);
  });
});

describe('aggregate-signals — pending, touched, dirty: хотя бы один ребёнок', () => {
  it.each<FlagName>(['pending', 'touched', 'dirty'])('%s', (flag) => {
    const first = fakeChild();
    const second = fakeChild();
    const { signals } = aggregateOf([first, second]);
    expect(signals[flag].value).toBe(false);

    second[flag].value = true;
    expect(signals[flag].value).toBe(true);

    first[flag].value = true;
    second[flag].value = false;
    expect(signals[flag].value).toBe(true);

    first[flag].value = false;
    expect(signals[flag].value).toBe(false);
  });

  it('без детей — ни pending, ни touched, ни dirty', () => {
    const { signals } = aggregateOf([], [required]);

    expect(signals.pending.value).toBe(false);
    expect(signals.touched.value).toBe(false);
    expect(signals.dirty.value).toBe(false);
  });

  it('тронутый выключенный ребёнок тоже делает контейнер touched', () => {
    const { signals } = aggregateOf([fakeChild({ disabled: true, touched: true })]);

    expect(signals.touched.value).toBe(true);
  });
});

describe('aggregate-signals — issues', () => {
  it('сначала свои замечания, затем детей в порядке детей', () => {
    const { signals } = aggregateOf(
      [
        fakeChild({ issues: [{ code: 'a1' }, { code: 'a2' }] }),
        fakeChild(),
        fakeChild({ issues: [{ code: 'b1' }] }),
      ],
      [{ code: 'own' }]
    );

    expect(issueCodes(signals)).toEqual(['own', 'a1', 'a2', 'b1']);
  });

  it('список пересобирается при смене своих замечаний, замечаний ребёнка и состава', () => {
    const child = fakeChild();
    const { list, ownIssues, signals } = aggregateOf([child]);
    expect(signals.issues.value).toEqual([]);

    child.issues.value = [{ code: 'child' }];
    ownIssues.value = [{ code: 'own' }];
    list.value = [...list.value, fakeChild({ issues: [{ code: 'late' }] })];

    expect(issueCodes(signals)).toEqual(['own', 'child', 'late']);
  });
});

interface Login {
  login: string;
}

interface Phone {
  number: string;
}

interface Contacts {
  phones: Phone[];
}

const phoneRow = (row: FormModel<Phone>) => ({ children: [{ model: row.$.number }] });

/** Правило массива — только предупреждение: статус прогона его не считает блокирующим. */
const phonesWarning = defineValidation<Contacts>(({ model }) => {
  validate(model.$.phones, [() => ({ code: 'phones.few', severity: 'warning' })]);
});

const createContacts = () =>
  createForm<Contacts>({
    initial: { phones: arrayOf(() => ({ number: '' }), [{ number: '+7' }]) },
    schema: (model) => ({ children: [{ model: model.$.phones, item: phoneRow }] }),
    validation: phonesWarning,
  });

describe('aggregate-signals — зонды на настоящей форме', () => {
  it('warning поля не блокирует ни поле, ни группу', () => {
    const model = createModel({ login: '', address: { city: '' } });
    const form = createFormFromModel({ model });

    form.address.city.setIssues([warning]);

    expect(form.address.city.valid.value).toBe(true);
    expect(form.address.valid.value).toBe(true);
    expect(form.valid.value).toBe(true);
    expect(issueCodes(form)).toEqual(['weak']);
  });

  it('собственное warning группы не блокирует её, как и warning поля [ReFormer-sc1a]', () => {
    const model = createModel({ login: '', address: { city: '' } });
    const form = createFormFromModel({ model });

    form.address.setIssues([warning]);

    expect(form.address.valid.value).toBe(true);
  });

  it('прогон с warning на массиве — статус valid: предупреждение не блокирует', async () => {
    const bundle = createContacts();

    const result = await bundle.validate();

    expect(result.status).toBe('valid');
    expect(bundle.form.phones.ownIssues.value.map((issue) => issue.code)).toEqual(['phones.few']);
  });

  it('после прогона со статусом valid форма тоже valid — warning массива [ReFormer-sc1a]', async () => {
    const bundle = createContacts();

    await bundle.validate();

    expect(bundle.form.valid.value).toBe(true);
  });

  it('пока поле ждёт async-правила: поле pending и не invalid, группа pending и не valid', async () => {
    const check = deferred<ValidationIssue | null>();
    const rules = defineValidation<Login>(({ model }) => {
      validateAsync(model.$.login, [() => check.promise]);
    });
    const bundle = createForm<Login>({ initial: { login: 'neo' }, validation: rules });

    const run = bundle.validate();
    const field = bundle.form.login;
    const seen = {
      fieldPending: field.pending.value,
      fieldInvalid: field.invalid.value,
      groupPending: bundle.form.pending.value,
      groupValid: bundle.form.valid.value,
    };
    check.resolve(null);
    await run;

    expect(seen).toEqual({
      fieldPending: true,
      fieldInvalid: false,
      groupPending: true,
      groupValid: false,
    });
    expect(bundle.form.valid.value).toBe(true);
  });

  it('пока поле ждёт async-правила, группа не invalid — как и само поле [ReFormer-xdrh]', async () => {
    const check = deferred<ValidationIssue | null>();
    const rules = defineValidation<Login>(({ model }) => {
      validateAsync(model.$.login, [() => check.promise]);
    });
    const bundle = createForm<Login>({ initial: { login: 'neo' }, validation: rules });

    const run = bundle.validate();
    const groupInvalidWhilePending = bundle.form.invalid.value;
    check.resolve(null);
    await run;

    expect(groupInvalidWhilePending).toBe(false);
  });
});
