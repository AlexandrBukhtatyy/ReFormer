/**
 * Операторы `./behaviors` — утечки: счёт effect'ов каждого оператора до и после снятия.
 *
 * Каждый оператор сам регистрирует свою отписку в стоке схемы поведения; снимает их форма. Здесь
 * по каждому экспорту входа `./behaviors` закреплено, сколько effect'ов он держит, пока поведение
 * живо, и что после снятия формы (и повторного снятия) счётчик возвращается к базе. Подписка мимо
 * `effect` в счёт не попала бы — её выдало бы поведение: поэтому вместе со счётчиком проверяется,
 * что оператор после снятия молчит.
 *
 * Отдельно — операторы над строками (effect'ы строк приходят и уходят со строками, вложенные
 * `apply` / `applyEach` снимаются целиком), сборка, упавшая на середине, и циклы «собрать → снять».
 * Таблица сверена со списком экспортов входа. Что именно делает каждый оператор — в `operators`,
 * `collections`, `schema-operators` и `context` рядом.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { advance, flushMicrotasks, tick, useFakeClock } from '../test-utils/async';
import { createdEffects, liveEffects } from '../test-utils/effect-tracker';
import { disposeForm } from '../test-utils/dispose-form';
import { arrayOf, createModel, type FormModel } from '../../src/model/index';
import { isDerived } from '../../src/model/derived-registry';
import { createFormFromModel } from '../../src/form/create-form';
import * as behaviors from '../../src/form/behaviors/index';
import type { FormGroup } from '../../src/form/types/index';
import type { FormSchemaNode } from '../../src/form/types/schema-node';

vi.mock('@preact/signals-core', async (importOriginal) =>
  (await import('../test-utils/effect-tracker')).trackEffects(await importOriginal())
);

const {
  aggregateInto,
  apply,
  applyEach,
  compute,
  computeFrom,
  copyFrom,
  defer,
  defineFormBehavior,
  disableWhen,
  effect,
  enableWhen,
  exclusiveFlag,
  getScope,
  hideWhen,
  onChange,
  onComponentEvent,
  onDispose,
  onInit,
  onMount,
  onUnmount,
  renderEffect,
  resetWhen,
  revalidateWhen,
  syncFields,
  transformValue,
} = behaviors;

afterEach(() => {
  vi.useRealTimers();
});

interface Row {
  amount: number;
  primary: boolean;
  tags: Array<{ label: string }>;
}
interface Address {
  city: string;
  zip: string;
}
interface Probe {
  on: boolean;
  name: string;
  copy: string;
  total: number;
  home: Address;
  work: Address;
  rows: Row[];
}

const blankRow = (): Row => ({
  amount: 0,
  primary: false,
  tags: arrayOf(() => ({ label: '' })),
});

/** Модель зонда: два листа-соседа, две группы одной формы и массив из двух строк. */
const createProbe = (): FormModel<Probe> =>
  createModel<Probe>({
    on: false,
    name: '',
    copy: '',
    total: 0,
    home: { city: '', zip: '' },
    work: { city: '', zip: '' },
    rows: arrayOf(blankRow, [
      { amount: 1, primary: false, tags: [] },
      { amount: 2, primary: false, tags: [] },
    ]),
  });

const probeSchema = (model: FormModel<Probe>): FormSchemaNode => ({
  children: [
    { model: model.$.name },
    { model: model.$.copy },
    { model: model.$.home.city },
    { model: model.$.work.city },
    {
      model: model.$.rows,
      item: (row: FormModel<Row>) => ({
        children: [
          { model: row.$.amount },
          { model: row.$.primary },
          {
            model: row.$.tags,
            item: (tag: FormModel<{ label: string }>) => ({ model: tag.$.label }),
          },
        ],
      }),
    },
  ],
});

/** Effect'ы самой формы зонда: массив строк и массив меток в каждой из двух строк. */
const FORM_EFFECTS = 3;

type Setup = (model: FormModel<Probe>, spy: () => void) => void;

const build = (
  model: FormModel<Probe>,
  setup?: Setup,
  spy: () => void = () => {}
): FormGroup<Probe> =>
  createFormFromModel<Probe>({
    model,
    schema: probeSchema(model),
    ...(setup
      ? { behavior: defineFormBehavior<Probe>(({ model: scoped }) => setup(scoped, spy)) }
      : {}),
  });

/** Оператор в таблице: вызов внутри схемы поведения и effect'ы, которые он держит. */
interface Operator {
  /** Экспорт входа `./behaviors`. */
  readonly operator: keyof typeof behaviors;
  /** Вариант вызова — для названия теста. */
  readonly variant?: string;
  readonly effects: number;
  readonly setup: Setup;
  /** Правка модели, на которую оператор отвечает вызовом шпиона (если у него есть колбэк). */
  readonly poke?: (model: FormModel<Probe>) => void;
}

const operators: Operator[] = [
  {
    operator: 'compute',
    effects: 1,
    setup: (model, spy) =>
      compute(model.$.total, () => {
        spy();
        return model.name.length;
      }),
    poke: (model) => {
      model.name = 'compute';
    },
  },
  {
    operator: 'computeFrom',
    effects: 1,
    setup: (model, spy) =>
      computeFrom([model.$.name], model.$.total, (name: string) => {
        spy();
        return name.length;
      }),
    poke: (model) => {
      model.name = 'computeFrom';
    },
  },
  {
    operator: 'copyFrom',
    variant: 'лист',
    effects: 1,
    setup: (model, spy) =>
      copyFrom(model.$.name, model.$.copy, {
        transform: (value) => {
          spy();
          return value;
        },
      }),
    poke: (model) => {
      model.name = 'copyFrom';
    },
  },
  {
    operator: 'copyFrom',
    variant: 'группа',
    effects: 1,
    setup: (model, spy) =>
      copyFrom(model.$.home, model.$.work, {
        transform: (value) => {
          spy();
          return value;
        },
      }),
    poke: (model) => {
      model.home.city = 'Казань';
    },
  },
  {
    operator: 'onChange',
    effects: 1,
    setup: (model, spy) => onChange(model.$.name, spy),
    poke: (model) => {
      model.name = 'onChange';
    },
  },
  {
    operator: 'onChange',
    variant: 'immediate',
    effects: 1,
    setup: (model, spy) => onChange(model.$.name, spy, { immediate: true }),
    poke: (model) => {
      model.name = 'immediate';
    },
  },
  {
    operator: 'onChange',
    variant: 'debounce',
    effects: 1,
    setup: (model, spy) => onChange(model.$.name, spy, { debounce: 5 }),
    poke: (model) => {
      model.name = 'debounce';
    },
  },
  {
    operator: 'enableWhen',
    variant: 'лист',
    effects: 1,
    setup: (model, spy) =>
      enableWhen(model.$.name, () => {
        spy();
        return model.on;
      }),
    poke: (model) => {
      model.on = true;
    },
  },
  {
    operator: 'enableWhen',
    variant: 'два листа',
    effects: 2,
    setup: (model) => enableWhen([model.$.name, model.$.copy], () => model.on),
  },
  {
    operator: 'enableWhen',
    variant: 'группа',
    effects: 1,
    setup: (model, spy) =>
      enableWhen(model.$.home, () => {
        spy();
        return model.on;
      }),
    poke: (model) => {
      model.on = true;
    },
  },
  {
    operator: 'disableWhen',
    effects: 1,
    setup: (model, spy) =>
      disableWhen(model.$.name, () => {
        spy();
        return model.on;
      }),
    poke: (model) => {
      model.on = true;
    },
  },
  {
    operator: 'transformValue',
    effects: 1,
    setup: (model, spy) =>
      transformValue(model.$.name, (value) => {
        spy();
        return value.trim();
      }),
    poke: (model) => {
      model.name = ' transformValue ';
    },
  },
  {
    operator: 'resetWhen',
    effects: 1,
    setup: (model, spy) =>
      resetWhen(
        model.$.name,
        () => {
          spy();
          return model.on;
        },
        { resetValue: '' }
      ),
    poke: (model) => {
      model.on = true;
    },
  },
  {
    operator: 'syncFields',
    effects: 2,
    setup: (model, spy) =>
      syncFields(model.$.name, model.$.copy, {
        transform: (value) => {
          spy();
          return value;
        },
      }),
    poke: (model) => {
      model.name = 'syncFields';
    },
  },
  {
    operator: 'revalidateWhen',
    effects: 1,
    setup: (model, spy) => revalidateWhen([model.$.name], spy),
    poke: (model) => {
      model.name = 'revalidateWhen';
    },
  },
  {
    operator: 'apply',
    variant: 'две группы',
    // По одному effect'у под-схемы на группу.
    effects: 2,
    setup: (model, spy) =>
      apply(
        [model.$.home, model.$.work],
        defineFormBehavior<Address>(({ model: address }) => {
          onChange(address.$.city, spy);
        })
      ),
    poke: (model) => {
      model.work.city = 'Томск';
    },
  },
  {
    operator: 'applyEach',
    // Свой effect и по одному effect'у поведения на каждую из двух строк.
    effects: 3,
    setup: (model, spy) =>
      applyEach(
        model.$.rows,
        defineFormBehavior<Row>(({ model: row }) => {
          onChange(row.$.amount, spy);
        })
      ),
    poke: (model) => {
      model.rows.at(1).amount = 20;
    },
  },
  {
    operator: 'exclusiveFlag',
    // `applyEach` и `onChange` флага каждой из двух строк.
    effects: 3,
    setup: (model) => exclusiveFlag<Row>(model.$.rows, (row) => row.$.primary),
  },
  {
    operator: 'aggregateInto',
    effects: 1,
    setup: (model, spy) =>
      aggregateInto<Row>(model.$.rows, () => {
        spy();
        return [];
      }),
    poke: (model) => {
      model.rows.at(0).amount = 10;
    },
  },
  {
    operator: 'effect',
    effects: 1,
    setup: (model, spy) =>
      effect(() => {
        void model.name;
        spy();
      }),
    poke: (model) => {
      model.name = 'effect';
    },
  },
  // Остальные effect'ов не создают: они пишут в сток схемы или в хранилище узлов.
  { operator: 'defer', effects: 0, setup: (_model, spy) => defer(spy) },
  { operator: 'onDispose', effects: 0, setup: () => onDispose(() => {}) },
  { operator: 'getScope', effects: 0, setup: () => void getScope<Probe>().model },
  {
    operator: 'hideWhen',
    effects: 0,
    setup: (model) => hideWhen(getScope<Probe>().schema.node('block'), () => model.on),
  },
  {
    operator: 'onComponentEvent',
    effects: 0,
    setup: (_model, spy) =>
      onComponentEvent(getScope<Probe>().schema.node('block'), 'onClick', spy),
  },
  {
    operator: 'renderEffect',
    effects: 0,
    setup: (_model, spy) => renderEffect(getScope<Probe>().schema, spy),
  },
  {
    operator: 'onInit',
    effects: 0,
    setup: () => onInit(getScope<Probe>().schema.node('block'), () => {}),
  },
  {
    operator: 'onMount',
    effects: 0,
    setup: (_model, spy) => onMount(getScope<Probe>().schema.node('block'), spy),
  },
  {
    operator: 'onUnmount',
    effects: 0,
    setup: (_model, spy) => onUnmount(getScope<Probe>().schema.node('block'), spy),
  },
];

const titleOf = ({ operator, variant }: Operator): string =>
  variant ? `${operator} (${variant})` : operator;

describe("operators — счёт effect'ов до и после снятия", () => {
  it('таблица покрывает все операторы входа ./behaviors', () => {
    const exported = Object.keys(behaviors).filter(
      (name) => typeof behaviors[name as keyof typeof behaviors] === 'function'
    );
    // `defineFormBehavior` — сама схема поведения: в ней идёт каждый вызов таблицы.
    const covered = new Set<string>([
      ...operators.map(({ operator }) => operator),
      'defineFormBehavior',
    ]);

    expect([...covered].sort()).toEqual(exported.sort());
  });

  it("форма зонда без поведения держит только effect'ы своих массивов", () => {
    const base = liveEffects();

    const form = build(createProbe());
    const built = liveEffects() - base;
    disposeForm(form);

    expect({ built, disposed: liveEffects() - base }).toEqual({ built: FORM_EFFECTS, disposed: 0 });
  });

  for (const entry of operators) {
    it(`${titleOf(entry)}: держит effect'ов — ${entry.effects}; снятие и повторное снятие возвращают к базе`, async () => {
      const base = liveEffects();
      const createdBefore = createdEffects();

      const form = build(createProbe(), entry.setup);
      await tick();
      const held = liveEffects() - base - FORM_EFFECTS;
      const created = createdEffects() - createdBefore - FORM_EFFECTS;
      disposeForm(form);
      const disposed = liveEffects() - base;
      disposeForm(form);

      // Создано столько же, сколько живёт: сборка effect'ы не пересоздаёт.
      expect({ held, created, disposed, again: liveEffects() - base }).toEqual({
        held: entry.effects,
        created: entry.effects,
        disposed: 0,
        again: 0,
      });
    });
  }

  /** Поправить всё, на что смотрят операторы таблицы: условие, листья, обе группы и строки. */
  const editEverything = (model: FormModel<Probe>, mark: string, amount: number): void => {
    model.on = !model.on;
    model.name = mark;
    model.home.city = mark;
    model.work.city = mark;
    model.rows.at(0).amount = amount;
    model.rows.at(1).amount = amount + 1;
  };

  for (const entry of operators.filter(({ poke }) => poke !== undefined)) {
    it(`${titleOf(entry)}: до снятия отвечает на правку; правка в тике снятия и после него — тишина`, async () => {
      useFakeClock();
      const model = createProbe();
      const spy = vi.fn();
      const form = build(model, entry.setup, spy);
      await advance(10);
      spy.mockClear();

      entry.poke?.(model);
      await advance(10);
      const live = spy.mock.calls.length > 0;
      // Правка и снятие в одном тике: отложенный колбэк и таймер оператора ещё ждут.
      editEverything(model, 'перед снятием', 100);
      spy.mockClear();
      disposeForm(form);
      const timers = vi.getTimerCount();
      editEverything(model, 'после снятия', 200);
      await advance(10);

      expect({ live, afterDispose: spy.mock.calls.length, timers }).toEqual({
        live: true,
        afterDispose: 0,
        timers: 0,
      });
    });
  }
});

describe('operators — строки и вложенные схемы', () => {
  /** Строка: свой `compute`, реакция на сумму и поведение меток — `applyEach` внутри `applyEach`. */
  const rowBehavior = defineFormBehavior<Row>(({ model: row }) => {
    compute(row.$.primary, () => row.amount > 100);
    onChange(row.$.amount, () => {});
    applyEach(
      row.$.tags,
      defineFormBehavior<{ label: string }>(({ model: tag }) => {
        transformValue(tag.$.label, (label) => label.trim());
      })
    );
  });
  /** На строку: `compute`, `onChange`, `applyEach` меток. */
  const ROW_EFFECTS = 3;

  it("effect'ы поведения строк приходят и уходят вместе со строками", async () => {
    const model = createProbe();
    const form = build(model, (scoped) => applyEach(scoped.$.rows, rowBehavior));
    await tick();
    const before = liveEffects();

    model.rows.push();
    await tick();
    // Поведение строки и effect её формы — массив меток.
    const pushed = liveEffects() - before;
    model.rows.at(2).tags.push({ label: ' метка ' });
    await tick();
    const tagged = liveEffects() - before;
    model.rows.removeAt(2);
    await tick();
    const removed = liveEffects() - before;
    model.rows.clear();
    await tick();
    const cleared = liveEffects() - before;
    disposeForm(form);

    expect({ pushed, tagged, removed, cleared }).toEqual({
      pushed: ROW_EFFECTS + 1,
      tagged: ROW_EFFECTS + 1 + 1,
      removed: 0,
      cleared: -2 * (ROW_EFFECTS + 1),
    });
  });

  it('вложенные apply и applyEach снимаются целиком вместе с формой', async () => {
    const base = liveEffects();
    const model = createProbe();
    model.rows.at(0).tags.push({ label: 'а' });
    const form = build(model, (scoped) => {
      apply(
        scoped.$.home,
        defineFormBehavior<Address>(({ model: address }) => {
          transformValue(address.$.zip, (zip) => zip.trim());
          compute(address.$.city, () => address.zip);
        })
      );
      applyEach(scoped.$.rows, rowBehavior);
    });
    await tick();
    const built = liveEffects() - base - FORM_EFFECTS;
    const derived = isDerived(model.rows.at(0).$.primary);

    disposeForm(form);

    // Подформа: 2; `applyEach` строк: 1; строки: 2 × 3; поведение единственной метки: 1.
    expect({
      built,
      derived,
      disposed: liveEffects() - base,
      released: !isDerived(model.rows.at(0).$.primary),
    }).toEqual({
      built: 2 + 1 + 2 * ROW_EFFECTS + 1,
      derived: true,
      disposed: 0,
      released: true,
    });
  });
});

describe('operators — сборка на середине и циклы', () => {
  it("поведение, упавшее на середине, своих effect'ов не оставляет и derived отпускает", () => {
    const model = createProbe();
    const base = liveEffects();

    try {
      createFormFromModel<Probe>({
        model,
        behavior: defineFormBehavior<Probe>(({ model: scoped }) => {
          compute(scoped.$.total, () => scoped.name.length);
          syncFields(scoped.$.name, scoped.$.copy);
          onChange(scoped.$.name, () => {}, { debounce: 50 });
          throw new Error('сбой на середине');
        }),
      });
    } catch {
      // Сборка упала — формы у вызывающего нет.
    }

    expect({ live: liveEffects() - base, derived: isDerived(model.$.total) }).toEqual({
      live: 0,
      derived: false,
    });
  });

  it("20 циклов «собрать → править → снять» со всеми операторами effect'ы и таймеры не копят", async () => {
    useFakeClock();
    const base = liveEffects();
    const drift = new Set<string>();
    const created = new Set<number>();

    for (let cycle = 0; cycle < 20; cycle++) {
      const createdBefore = createdEffects();
      const model = createProbe();
      const form = build(model, (scoped, spy) => {
        for (const { setup } of operators) setup(scoped, spy);
      });
      await flushMicrotasks();
      model.name = `цикл ${cycle}`;
      model.on = cycle % 2 === 0;
      model.rows.push();
      disposeForm(form);
      drift.add(`${liveEffects() - base}/${vi.getTimerCount()}`);
      created.add(createdEffects() - createdBefore);
    }
    await advance(100);

    expect({ drift: [...drift], created: created.size }).toEqual({ drift: ['0/0'], created: 1 });
  });
});
