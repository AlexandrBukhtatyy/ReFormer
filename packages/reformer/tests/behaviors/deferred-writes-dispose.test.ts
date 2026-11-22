/**
 * Зонд «отложенная запись после снятия поведения в том же тике».
 *
 * Часть операторов пишет не сразу, а на микротаске: `enableWhen`/`disableWhen` поля и группы,
 * `copyFrom` группы, `aggregateInto`, колбэк `onChange` (и `exclusiveFlag` поверх него),
 * value-операции `transformValue`, `resetWhen`, `syncFields`, `revalidateWhen`. Сценарий: источник
 * изменился, и форму сразу сняли — в том же тике (размонтирование, смена сборки). Ожидание: снятое
 * поведение больше ничего не пишет.
 *
 * Value-операции модели ожидающие записи отменяют (`tests/core/model/behaviors-value-dispose`) —
 * здесь проверяется, что и через операторы формы. У остальных операторов отменитель
 * `runOutsideEffect` раньше терялся: `defer` в `context.ts` [ReFormer-bcv4], `enableWhen` в
 * `node.ts` [ReFormer-ctlc], колбэк `onChange` [ReFormer-4sj8]. Каждый сценарий идёт парой:
 * контроль без снятия (запись есть — зонд не холостой) и сам зонд.
 */

import { describe, expect, it, vi, type Mock } from 'vitest';
import { createModel, type FormModel } from '../../src/model/index';
import { createFormFromModel } from '../../src/form/create-form';
import {
  aggregateInto,
  copyFrom,
  defineFormBehavior,
  disableWhen,
  enableWhen,
  exclusiveFlag,
  onChange,
  resetWhen,
  revalidateWhen,
  syncFields,
  transformValue,
} from '../../src/form/behaviors';
import type { FormGroup } from '../../src/form/types/index';
import { disposeForm } from '../test-utils/dispose-form';
import { tick } from '../test-utils/async';
import { disposeProbeChecks, type DisposeProbe } from '../test-utils/dispose-probe';

interface Row {
  n: number;
  primary: boolean;
}
interface Probe {
  on: boolean;
  name: string;
  code: string;
  type: string;
  card: string;
  left: string;
  right: string;
  max: number;
  a: { city: string };
  b: { city: string };
  rows: Row[];
}

const createProbe = (): FormModel<Probe> =>
  createModel<Probe>({
    on: false,
    name: '',
    code: '',
    type: 'card',
    card: '4242',
    left: '',
    right: '',
    max: 1,
    a: { city: '' },
    b: { city: '' },
    rows: [
      { n: 10, primary: true },
      { n: 0, primary: false },
    ],
  });

/** Доступ к состоянию нод без полной типизации прокси формы. */
interface ProbeView {
  name: { disabled: { value: boolean } };
  b: { disabled: { value: boolean } };
}

interface Scenario {
  readonly name: string;
  /** Поведение с одним оператором; `spy` — колбэк оператора, если он нужен. */
  readonly behavior: (m: FormModel<Probe>, spy: Mock) => void;
  /** Правка источника. */
  readonly change: (model: FormModel<Probe>) => void;
  /** Случилась ли отложенная запись оператора после правки. */
  readonly written: (model: FormModel<Probe>, form: ProbeView, spy: Mock) => boolean;
}

/** Последняя строка добирает `n` до 100. */
const lastToHundred = (rows: Row[]) => [
  { index: rows.length - 1, patch: { n: 100 - rows.slice(0, -1).reduce((s, r) => s + r.n, 0) } },
];

/** Форма зонда: модель, форма с поведением из одного оператора и шпион его колбэка. */
interface ProbeForm {
  readonly model: FormModel<Probe>;
  readonly form: FormGroup<Probe>;
  readonly spy: Mock;
}

/**
 * Проверки сценария: собрать форму, дождаться начальных записей, поправить источник и, если надо,
 * снять форму — в том же тике.
 */
const checksOf = (scenario: Scenario) => {
  const probe: DisposeProbe<ProbeForm> = {
    build() {
      const model = createProbe();
      const spy = vi.fn();
      const form = createFormFromModel<Probe>({
        model,
        behavior: defineFormBehavior<Probe>(({ model: m }) => scenario.behavior(m, spy)),
      });
      return { model, form, spy };
    },
    change: ({ model }) => scenario.change(model),
    dispose: ({ form }) => disposeForm(form),
    written: ({ model, form, spy }) => scenario.written(model, form as unknown as ProbeView, spy),
  };
  return disposeProbeChecks(probe);
};

/** Операторы, чьи ожидающие записи отменяются (value-операции модели). */
const cancelled: Scenario[] = [
  {
    name: 'transformValue',
    behavior: (m) => transformValue(m.$.code, (value) => value.toUpperCase()),
    change: (model) => {
      model.code = 'abc';
    },
    written: (model) => model.code === 'ABC',
  },
  {
    name: 'resetWhen',
    behavior: (m) => resetWhen(m.$.card, () => m.type !== 'card', { resetValue: '' }),
    change: (model) => {
      model.type = 'cash';
    },
    written: (model) => model.card === '',
  },
  {
    name: 'syncFields',
    behavior: (m) => syncFields(m.$.left, m.$.right),
    change: (model) => {
      model.left = 'x';
    },
    written: (model) => model.right === 'x',
  },
  {
    name: 'revalidateWhen',
    behavior: (m, spy) => revalidateWhen([m.$.max], spy),
    change: (model) => {
      model.max = 2;
    },
    written: (_model, _form, spy) => spy.mock.calls.length > 0,
  },
];

/** Операторы, чей отменитель отложенной записи раньше терялся (метка — задача исправления). */
const lost: Array<Scenario & { readonly defect: string }> = [
  {
    name: 'enableWhen поля',
    defect: 'ReFormer-ctlc',
    behavior: (m) => enableWhen(m.$.name, () => m.on),
    change: (model) => {
      model.on = true;
    },
    written: (_model, form) => !form.name.disabled.value,
  },
  {
    name: 'disableWhen поля',
    defect: 'ReFormer-ctlc',
    behavior: (m) => disableWhen(m.$.name, () => !m.on),
    change: (model) => {
      model.on = true;
    },
    written: (_model, form) => !form.name.disabled.value,
  },
  {
    name: 'enableWhen группы',
    defect: 'ReFormer-bcv4',
    behavior: (m) => enableWhen(m.$.b, () => m.on),
    change: (model) => {
      model.on = true;
    },
    written: (_model, form) => !form.b.disabled.value,
  },
  {
    name: 'copyFrom группы',
    defect: 'ReFormer-bcv4',
    behavior: (m) => copyFrom(m.$.a, m.$.b),
    change: (model) => {
      model.a.city = 'Казань';
    },
    written: (model) => model.b.city === 'Казань',
  },
  {
    name: 'aggregateInto',
    defect: 'ReFormer-bcv4',
    behavior: (m) => aggregateInto<Row>(m.$.rows, lastToHundred),
    change: (model) => {
      model.rows.at(0).n = 30;
    },
    written: (model) => model.rows.at(1).n === 70,
  },
  {
    name: 'onChange',
    defect: 'ReFormer-4sj8',
    behavior: (m, spy) => onChange(m.$.name, spy),
    change: (model) => {
      model.name = 'Анна';
    },
    written: (_model, _form, spy) => spy.mock.calls.length > 0,
  },
  {
    name: 'exclusiveFlag',
    defect: 'ReFormer-4sj8',
    behavior: (m) => exclusiveFlag<Row>(m.$.rows, (row) => row.$.primary),
    change: (model) => {
      model.rows.at(1).primary = true;
    },
    written: (model) => !model.rows.at(0).primary,
  },
];

describe('deferred writes — value-операции: ожидающая запись отменяется', () => {
  for (const scenario of cancelled) {
    const checks = checksOf(scenario);

    it(`${scenario.name}: без снятия запись случается (контроль)`, checks.control);

    it(`${scenario.name}: снятие формы в том же тике отменяет запись`, checks.disposed);
  }

  it('сборка и снятие в одном тике: начальная запись не случается', async () => {
    const model = createProbe();
    model.code = 'abc';
    model.left = 'x';
    const form = createFormFromModel<Probe>({
      model,
      behavior: defineFormBehavior<Probe>(({ model: m }) => {
        transformValue(m.$.code, (value) => value.toUpperCase());
        syncFields(m.$.left, m.$.right);
      }),
    });

    disposeForm(form);
    await tick();

    expect({ code: model.code, right: model.right }).toEqual({ code: 'abc', right: '' });
  });
});

describe('deferred writes — снятие отменяет отложенную запись операторов формы', () => {
  for (const scenario of lost) {
    const checks = checksOf(scenario);

    it(`${scenario.name}: без снятия запись случается (контроль)`, checks.control);

    it(
      `${scenario.name}: снятие формы в том же тике отменяет запись [${scenario.defect}]`,
      checks.disposed
    );
  }

  it('сборка и снятие в одном тике: начальная запись enableWhen не случается [ReFormer-ctlc]', async () => {
    const model = createProbe();
    const form = createFormFromModel<Probe>({
      model,
      behavior: defineFormBehavior<Probe>(({ model: m }) => {
        enableWhen(m.$.name, () => m.on); // on = false → начальная запись: выключить
      }),
    }) as FormGroup<Probe>;

    disposeForm(form);
    await tick();

    expect((form as unknown as ProbeView).name.disabled.value).toBe(false);
  });
});
