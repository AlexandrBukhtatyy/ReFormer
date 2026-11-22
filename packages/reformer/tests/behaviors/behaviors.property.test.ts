/**
 * Сходимость операторов поведения на случайных последовательностях записей (fast-check).
 *
 * Пользователь и сервер пишут в поля как угодно: несколько правок в одном тике, правки вперемешку
 * с отложенными записями поведения, в оба поля связи сразу. Когда отложенные записи отработали
 * (`await macrotask()`), оператор обязан прийти к своему инварианту:
 * - `syncFields(a, b)` — поля равны эталону «побеждает последняя запись, сдвинувшая поле»;
 * - `copyFrom` листа — цель равна эталону сразу после каждой правки; группы — после записей;
 * - `exclusiveFlag` — выбрано не больше одной строки; при правках по одной — ровно эталон;
 * - `aggregateInto` — сумма строк равна 100, а последний проход меняет только последнюю строку;
 * - цепочка `compute` — вычисляемые поля равны эталону сразу после каждой записи, bulk-запись их
 *   не трогает.
 *
 * Команда `flush` между правками даёт отработать части микротасков — так отложенные записи
 * поведения перемешиваются с правками. Каждый прогон — своя форма, снимается в `finally`.
 *
 * Записи ждёт граница макротаска через `setImmediate`, а не `tick()` (`setTimeout`): отложенные
 * записи поведения — микротаски, обе границы дожидаются их одинаково, но `setTimeout(0)` на
 * Windows стоит ≈ 15 мс, и глубокий прогон (`FC_NUM_RUNS=1000`) шёл бы минуты, упираясь в таймаут
 * теста. Таймеров (`debounce`) у проверяемых операторов нет.
 *
 * Воспроизведение: `FC_SEED=<seed> FC_NUM_RUNS=1000 npx vitest run <файл>`.
 */

import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { createModel, type FormModel } from '../../src/model/index';
import { createFormFromModel } from '../../src/form/create-form';
import {
  aggregateInto,
  compute,
  copyFrom,
  defineFormBehavior,
  exclusiveFlag,
  syncFields,
  type FormBehavior,
} from '../../src/form/behaviors';
import type { FormGroup } from '../../src/form/types/index';
import { disposeForm } from '../test-utils/dispose-form';
import { flushMicrotasks } from '../test-utils/async';
import { propertyParams } from '../test-utils/property';

/** Граница макротаска без задержки таймера: к её концу отработали все микротаски. */
const macrotask = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

/** Таймаут async-свойства — с запасом на число прогонов (`FC_NUM_RUNS`). */
const ASYNC_TIMEOUT = Math.max(5_000, (propertyParams().numRuns ?? 100) * 20);

const flushArb = fc.record({
  kind: fc.constant('flush' as const),
  count: fc.integer({ min: 1, max: 3 }),
});
type Flush = { kind: 'flush'; count: number };

/** Сборка формы над моделью с поведением; форма снимается после проверки. */
async function withForm<T>(
  model: FormModel<T>,
  behavior: FormBehavior<T>,
  check: (form: FormGroup<T>) => Promise<void> | void
): Promise<void> {
  const form = createFormFromModel<T>({ model, behavior });
  try {
    await check(form);
  } finally {
    disposeForm(form);
  }
}

describe('behaviors — syncFields', () => {
  interface Pair {
    a: string;
    b: string;
  }
  type Command = { kind: 'a' | 'b'; value: string } | Flush;
  const valueArb = fc.constantFrom('', 'x', 'y', 'X', 'Y');
  const commandArb: fc.Arbitrary<Command> = fc.oneof(
    fc.record({ kind: fc.constantFrom('a' as const, 'b' as const), value: valueArb }),
    flushArb
  );

  it(
    'поля сходятся к эталону «побеждает последняя запись»; transform — только a → b; согласованную пару b → a не пишет',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.boolean(),
          fc.array(commandArb, { maxLength: 12 }),
          async (upper, commands) => {
            const transform = (value: string) => (upper ? value.toUpperCase() : value);
            const model = createModel<Pair>({ a: '', b: '' });
            const behavior = defineFormBehavior<Pair>(({ model: m }) => {
              syncFields(m.$.a, m.$.b, upper ? { transform } : undefined);
            });
            // Эталон: значения и направление ожидающей записи (при создании — a → b).
            const ref: { a: string; b: string; pending: 'a' | 'b' | null } = {
              a: '',
              b: '',
              pending: 'a',
            };
            const applyPending = (): void => {
              if (ref.pending === 'a') ref.b = transform(ref.a);
              // Пара уже согласована (b совпало с transform(a)) — a сохраняет свою форму значения.
              if (ref.pending === 'b' && transform(ref.a) !== ref.b) ref.a = ref.b;
              ref.pending = null;
            };

            await withForm(model, behavior, async () => {
              for (const command of commands) {
                if (command.kind === 'flush') {
                  await flushMicrotasks(command.count);
                  applyPending();
                } else if (ref[command.kind] !== command.value) {
                  model[command.kind] = command.value;
                  ref[command.kind] = command.value;
                  ref.pending = command.kind;
                }
              }
              await macrotask();
              applyPending();

              expect(model.get()).toEqual({ a: ref.a, b: ref.b });
            });
          }
        ),
        propertyParams()
      );
    },
    ASYNC_TIMEOUT
  );
});

describe('behaviors — copyFrom', () => {
  it('лист с when и transform: цель равна эталону сразу после каждой правки', () => {
    interface Leaf {
      on: boolean;
      src: string;
      dst: string;
    }
    type Command = { kind: 'src' | 'dst'; value: string } | { kind: 'on'; value: boolean };
    const commandArb: fc.Arbitrary<Command> = fc.oneof(
      fc.record({
        kind: fc.constantFrom('src' as const, 'dst' as const),
        value: fc.constantFrom('', 'a', 'B', ' c '),
      }),
      fc.record({ kind: fc.constant('on' as const), value: fc.boolean() })
    );
    const transform = (value: string) => value.trim().toLowerCase();

    fc.assert(
      fc.property(fc.boolean(), fc.array(commandArb, { maxLength: 15 }), (on, commands) => {
        const model = createModel<Leaf>({ on, src: 'Start', dst: '' });
        const ref = { ...model.get() };
        const copy = (): void => {
          if (ref.on) ref.dst = transform(ref.src);
        };
        copy(); // начальный прогон эффекта
        const form = createFormFromModel<Leaf>({
          model,
          behavior: defineFormBehavior<Leaf>(({ model: m }) => {
            copyFrom(m.$.src, m.$.dst, { when: () => m.on, transform });
          }),
        });
        try {
          for (const command of commands) {
            if (command.kind === 'dst') {
              model.dst = command.value; // правка цели эффект не будит
              ref.dst = command.value;
            } else if (ref[command.kind] !== command.value) {
              if (command.kind === 'on') model.on = command.value;
              else model.src = command.value;
              (ref as Record<string, unknown>)[command.kind] = command.value;
              copy();
            }
            expect(model.dst).toBe(ref.dst);
          }
        } finally {
          disposeForm(form);
        }
      }),
      propertyParams()
    );
  });

  it(
    'группа с when: после отложенных записей цель равна снимку источника на момент записи',
    async () => {
      interface Address {
        city: string;
        zip: string;
      }
      interface Groups {
        on: boolean;
        src: Address;
        dst: Address;
      }
      type Command =
        | { kind: 'src' | 'dst'; key: keyof Address; value: string }
        | { kind: 'on'; value: boolean }
        | Flush;
      const commandArb: fc.Arbitrary<Command> = fc.oneof(
        fc.record({
          kind: fc.constantFrom('src' as const, 'dst' as const),
          key: fc.constantFrom('city' as const, 'zip' as const),
          value: fc.constantFrom('', 'a', 'b'),
        }),
        fc.record({ kind: fc.constant('on' as const), value: fc.boolean() }),
        flushArb
      );

      await fc.assert(
        fc.asyncProperty(
          fc.boolean(),
          fc.array(commandArb, { maxLength: 15 }),
          async (on, commands) => {
            const model = createModel<Groups>({
              on,
              src: { city: 'Казань', zip: '420000' },
              dst: { city: '', zip: '' },
            });
            // Эталон: значения и признак ожидающей записи. Каждый прогон эффекта отменяет
            // ожидающую запись и при включённом условии планирует новую; запись читает снимок
            // источника и условие в момент выполнения [ReFormer-h4d6].
            const ref = model.get();
            let pending = false;
            const rerun = (): void => {
              pending = ref.on;
            };
            const applyPending = (): void => {
              if (pending && ref.on) ref.dst = { ...ref.src };
              pending = false;
            };
            rerun(); // начальный прогон эффекта
            const behavior = defineFormBehavior<Groups>(({ model: m }) => {
              copyFrom(m.$.src, m.$.dst, { when: () => m.on });
            });

            await withForm(model, behavior, async () => {
              for (const command of commands) {
                if (command.kind === 'flush') {
                  await flushMicrotasks(command.count);
                  applyPending();
                } else if (command.kind === 'on') {
                  if (ref.on === command.value) continue;
                  model.on = command.value;
                  ref.on = command.value;
                  rerun();
                } else if (command.kind === 'dst') {
                  model.dst[command.key] = command.value;
                  ref.dst = { ...ref.dst, [command.key]: command.value };
                } else if (ref.src[command.key] !== command.value) {
                  model.src[command.key] = command.value;
                  ref.src = { ...ref.src, [command.key]: command.value };
                  rerun();
                }
              }
              await macrotask();
              applyPending();

              expect(model.get().dst).toEqual(ref.dst);
            });
          }
        ),
        propertyParams()
      );
    },
    ASYNC_TIMEOUT
  );
});

describe('behaviors — exclusiveFlag', () => {
  interface Flag {
    primary: boolean;
  }
  interface Flags {
    rows: Flag[];
  }
  /** Правка строк; `flush` к ним добавляет только первое свойство. */
  type Edit = { kind: 'select' | 'unselect' | 'remove'; index: number } | { kind: 'push' };
  const editArb: fc.Arbitrary<Edit> = fc.oneof(
    fc.record({
      kind: fc.constantFrom('select' as const, 'unselect' as const, 'remove' as const),
      index: fc.nat({ max: 5 }),
    }),
    fc.record({ kind: fc.constant('push' as const) })
  );
  /** Начальные строки: выбрано не больше одной. */
  const initialArb = fc
    .tuple(fc.integer({ min: 1, max: 4 }), fc.option(fc.nat({ max: 3 }), { nil: undefined }))
    .map(([length, selected]) =>
      Array.from({ length }, (_row, index) => ({ primary: index === selected }))
    );
  const exclusive = defineFormBehavior<Flags>(({ model: m }) => {
    exclusiveFlag<Flag>(m.$.rows, (row) => row.$.primary);
  });

  /** Правка модели по команде; индекс берётся по модулю длины. */
  function apply(model: FormModel<Flags>, command: Edit): void {
    if (command.kind === 'push') {
      model.rows.push({ primary: false });
      return;
    }
    const length = model.rows.length;
    if (length === 0) return;
    const index = command.index % length;
    if (command.kind === 'remove') model.rows.removeAt(index);
    else model.rows.at(index).primary = command.kind === 'select';
  }

  const selected = (model: FormModel<Flags>): number =>
    model.get().rows.filter((row) => row.primary).length;

  it(
    'при любых правках вперемешку с микротасками выбрано не больше одной строки',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          initialArb,
          fc.array(fc.oneof(editArb, flushArb), { maxLength: 15 }),
          async (rows, commands) => {
            const model = createModel<Flags>({ rows });

            await withForm(model, exclusive, async () => {
              for (const command of commands) {
                if (command.kind === 'flush') await flushMicrotasks(command.count);
                else apply(model, command);
              }
              await macrotask();

              expect(selected(model)).toBeLessThanOrEqual(1);
            });
          }
        ),
        propertyParams()
      );
    },
    ASYNC_TIMEOUT
  );

  it(
    'правки по одной: выбрана ровно последняя выбранная строка',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          initialArb,
          fc.array(editArb, { maxLength: 10 }),
          async (rows, commands) => {
            const model = createModel<Flags>({ rows });
            const ref = rows.map((row) => row.primary);

            await withForm(model, exclusive, async () => {
              for (const command of commands) {
                const length = ref.length;
                apply(model, command);
                if (command.kind === 'push') ref.push(false);
                else if (length > 0) {
                  const index = command.index % length;
                  if (command.kind === 'remove') ref.splice(index, 1);
                  else if (command.kind === 'unselect') ref[index] = false;
                  else if (!ref[index]) ref.forEach((_flag, i) => (ref[i] = i === index));
                }
                // Реакция и её собственные записи — две ступени микротасков.
                await flushMicrotasks(5);
                expect(model.get().rows.map((row) => row.primary)).toEqual(ref);
              }
              await macrotask();

              expect(model.get().rows.map((row) => row.primary)).toEqual(ref);
            });
          }
        ),
        propertyParams()
      );
    },
    ASYNC_TIMEOUT
  );
});

describe('behaviors — aggregateInto', () => {
  interface Share {
    n: number;
  }
  interface Shares {
    rows: Share[];
  }
  type Command =
    | { kind: 'push'; n: number }
    | { kind: 'remove'; index: number }
    | { kind: 'set'; index: number; n: number }
    | Flush;
  const nArb = fc.integer({ min: 0, max: 30 });
  const commandArb: fc.Arbitrary<Command> = fc.oneof(
    fc.record({ kind: fc.constant('push' as const), n: nArb }),
    fc.record({ kind: fc.constant('remove' as const), index: fc.nat({ max: 5 }) }),
    fc.record({ kind: fc.constant('set' as const), index: fc.nat({ max: 5 }), n: nArb }),
    flushArb
  );
  /** Последняя строка добирает сумму до 100. */
  const toHundred = (rows: Share[]) =>
    rows.length === 0
      ? []
      : [
          {
            index: rows.length - 1,
            patch: { n: 100 - rows.slice(0, -1).reduce((s, r) => s + r.n, 0) },
          },
        ];

  it(
    'после записей сумма строк равна 100, последний проход трогает только последнюю строку',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            nArb.map((n) => ({ n })),
            { maxLength: 4 }
          ),
          fc.array(commandArb, { maxLength: 15 }),
          async (rows, commands) => {
            const model = createModel<Shares>({ rows });
            const behavior = defineFormBehavior<Shares>(({ model: m }) => {
              aggregateInto<Share>(m.$.rows, toHundred);
            });

            await withForm(model, behavior, async () => {
              for (const command of commands) {
                const length = model.rows.length;
                if (command.kind === 'flush') await flushMicrotasks(command.count);
                else if (command.kind === 'push') model.rows.push({ n: command.n });
                else if (length === 0) continue;
                else if (command.kind === 'remove') model.rows.removeAt(command.index % length);
                else model.rows.at(command.index % length).n = command.n;
              }
              const before = model.get().rows.map((row) => row.n);
              await macrotask();
              const after = model.get().rows.map((row) => row.n);

              expect({
                others: after.slice(0, -1),
                sum: after.reduce((sum, n) => sum + n, 0),
              }).toEqual({ others: before.slice(0, -1), sum: after.length === 0 ? 0 : 100 });
            });
          }
        ),
        propertyParams()
      );
    },
    ASYNC_TIMEOUT
  );
});

describe('behaviors — цепочка compute', () => {
  interface Item {
    qty: number;
    price: number;
  }
  interface Order {
    items: Item[];
    region: 'RU' | 'EU';
    frozen: boolean;
    subtotal: number;
    rate: number;
    tax: number;
    total: number;
    snapshot: number;
  }
  type Command =
    | { kind: 'push'; item: Item }
    | { kind: 'remove'; index: number }
    | { kind: 'qty'; index: number; value: number }
    | { kind: 'region'; value: 'RU' | 'EU' }
    | { kind: 'frozen'; value: boolean }
    | { kind: 'patch'; value: number };
  const small = fc.integer({ min: 0, max: 9 });
  const itemArb = fc.record({ qty: small, price: small });
  const commandArb: fc.Arbitrary<Command> = fc.oneof(
    fc.record({ kind: fc.constant('push' as const), item: itemArb }),
    fc.record({ kind: fc.constant('remove' as const), index: fc.nat({ max: 4 }) }),
    fc.record({ kind: fc.constant('qty' as const), index: fc.nat({ max: 4 }), value: small }),
    fc.record({
      kind: fc.constant('region' as const),
      value: fc.constantFrom('RU' as const, 'EU' as const),
    }),
    fc.record({ kind: fc.constant('frozen' as const), value: fc.boolean() }),
    fc.record({ kind: fc.constant('patch' as const), value: small })
  );
  // Вычисляемые поля объявлены «снизу вверх» — сходимость не должна зависеть от порядка.
  const behavior = defineFormBehavior<Order>(({ model: m }) => {
    compute(m.$.snapshot, () => m.total, { when: () => !m.frozen });
    compute(m.$.total, () => m.subtotal * 100 + m.tax);
    compute(m.$.tax, () => m.subtotal * m.rate);
    compute(m.$.rate, () => (m.region === 'EU' ? 20 : 10));
    compute(m.$.subtotal, () =>
      m.items.map((item) => item.qty * item.price).reduce((s, v) => s + v, 0)
    );
  });

  it('вычисляемые поля равны эталону после каждой записи; bulk-запись их не трогает', () => {
    fc.assert(
      fc.property(
        fc.array(itemArb, { maxLength: 3 }),
        fc.array(commandArb, { maxLength: 12 }),
        (items, commands) => {
          const model = createModel<Order>({
            items,
            region: 'RU',
            frozen: false,
            subtotal: -1,
            rate: -1,
            tax: -1,
            total: -1,
            snapshot: -1,
          });
          let snapshot = -1;
          const expected = () => {
            const subtotal = model.get().items.reduce((s, item) => s + item.qty * item.price, 0);
            const rate = model.region === 'EU' ? 20 : 10;
            const total = subtotal * 100 + subtotal * rate;
            if (!model.frozen) snapshot = total;
            return { subtotal, rate, tax: subtotal * rate, total, snapshot };
          };
          const actual = () => {
            const { subtotal, rate, tax, total } = model.get();
            return { subtotal, rate, tax, total, snapshot: model.snapshot };
          };
          const form = createFormFromModel<Order>({ model, behavior });
          try {
            expect(actual()).toEqual(expected());
            for (const command of commands) {
              const length = model.items.length;
              if (command.kind === 'push') model.items.push(command.item);
              else if (command.kind === 'region') model.region = command.value;
              else if (command.kind === 'frozen') model.frozen = command.value;
              else if (command.kind === 'patch') {
                // bulk-запись с «сервера»: производные поля из payload пропускаются
                model.patch({ subtotal: command.value, tax: command.value, total: command.value });
              } else if (length === 0) continue;
              else if (command.kind === 'remove') model.items.removeAt(command.index % length);
              else model.items.at(command.index % length).qty = command.value;
              expect(actual()).toEqual(expected());
            }
          } finally {
            disposeForm(form);
          }
        }
      ),
      propertyParams()
    );
  });
});
