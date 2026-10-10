/**
 * Массив модели под случайными последовательностями мутаций (fast-check, `fc.commands`).
 *
 * Эталон — обычный JS-массив, к которому применяются те же операции с допустимыми индексами:
 * `push`, `insertAt`, `removeAt`, `move`, `swap`, `clear`. Команда идёт либо через фасад массива
 * модели, либо через материализованный `FormArray` той же модели (он делегирует модели). После
 * каждой команды сверяются:
 * - значения (`toArray()`) и длина — с эталоном;
 * - пути листьев каждой строки — `items.<i>.<k>`;
 * - идентичность фасада строки: строку, которую операция не удаляла, фасад сохраняет (на этом
 *   держатся формы строк и ключи рендера);
 * - `FormArray`: длина, значения строк, та же форма строки и тот же `keyAt` у выживших строк.
 *
 * Индексы генерируются сырыми и приводятся к допустимым по модулю текущей длины в момент
 * выполнения команды. Воспроизведение: `FC_SEED=<seed> FC_NUM_RUNS=1000 npx vitest run <файл>`.
 */

import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { eachLeafSignal } from '../../../src/model/index';
import type { FormModel } from '../../../src/model/index';
import { createForm } from '../../../src/form/form-bundle';
import type { FormArray, FormGroup } from '../../../src/form/types/nodes';
import { disposeForm } from '../../test-utils/dispose-form';
import { propertyParams } from '../../test-utils/property';
import { InputStub } from '../../test-utils/stubs';

interface Row {
  title: string;
  qty: number;
}
interface Shape {
  items: Row[];
}

/** Эталон: значения строк и «жетоны» их идентичности в том же порядке. */
interface Reference {
  values: Row[];
  tokens: number[];
  next: number;
}

/** Проверяемая система и то, что запомнено о строках при их появлении. */
interface Real {
  model: FormModel<Shape>;
  form: object;
  rows: FormArray<Row>;
  facades: Map<number, FormModel<Row>>;
  forms: Map<number, FormGroup<Row> | undefined>;
  keys: Map<number, string>;
}

/** Через что идёт команда: фасад массива модели или нода FormArray. */
type Via = 'model' | 'form';

const rowSchema = (row: FormModel<Row>) => ({
  children: [
    { model: row.$.title, component: InputStub },
    { model: row.$.qty, component: InputStub },
  ],
});

/** Запомнить строку, появившуюся на `index`: её фасад, форму и ключ. */
function remember(reference: Reference, real: Real, index: number): void {
  const token = reference.next++;
  reference.tokens.splice(index, 0, token);
  real.facades.set(token, real.model.items.at(index));
  real.forms.set(token, real.rows.at(index));
  real.keys.set(token, real.rows.keyAt(index));
}

function verify(reference: Reference, real: Real): void {
  const { model, rows } = real;

  expect(model.items.toArray()).toEqual(reference.values);
  expect(model.items.length).toBe(reference.values.length);
  expect(rows.length).toBe(reference.values.length);
  expect(rows.value.value).toEqual(reference.values);

  reference.tokens.forEach((token, index) => {
    const facade = model.items.at(index);
    expect(facade).toBe(real.facades.get(token));
    expect(rows.at(index)).toBe(real.forms.get(token));
    expect(rows.keyAt(index)).toBe(real.keys.get(token));

    const paths: string[] = [];
    eachLeafSignal(facade, (signal) => paths.push(signal.__path));
    expect(paths).toEqual(Object.keys(reference.values[index]).map((k) => `items.${index}.${k}`));
    expect(facade.$.title).toBe(model.$.items[index].title);
  });
}

abstract class ArrayCommand implements fc.Command<Reference, Real> {
  constructor(protected readonly via: Via) {}

  check(_reference: Readonly<Reference>): boolean {
    return true;
  }

  run(reference: Reference, real: Real): void {
    this.apply(reference, real);
    verify(reference, real);
  }

  protected abstract apply(reference: Reference, real: Real): void;
  abstract toString(): string;
}

/** Команда, которой нужна хотя бы одна строка. */
abstract class RowCommand extends ArrayCommand {
  check(reference: Readonly<Reference>): boolean {
    return reference.values.length > 0;
  }
}

class Push extends ArrayCommand {
  constructor(
    private readonly row: Row,
    via: Via
  ) {
    super(via);
  }
  protected apply(reference: Reference, real: Real): void {
    if (this.via === 'model') real.model.items.push(this.row);
    else real.rows.push(this.row);
    reference.values.push({ ...this.row });
    remember(reference, real, reference.values.length - 1);
  }
  toString(): string {
    return `${this.via}.push(${JSON.stringify(this.row)})`;
  }
}

class InsertAt extends ArrayCommand {
  constructor(
    private readonly at: number,
    private readonly row: Row,
    via: Via
  ) {
    super(via);
  }
  protected apply(reference: Reference, real: Real): void {
    const index = this.at % (reference.values.length + 1);
    if (this.via === 'model') real.model.items.insertAt(index, this.row);
    else real.rows.insert(index, this.row);
    reference.values.splice(index, 0, { ...this.row });
    remember(reference, real, index);
  }
  toString(): string {
    return `${this.via}.insertAt(${this.at} mod (length+1), ${JSON.stringify(this.row)})`;
  }
}

class RemoveAt extends RowCommand {
  constructor(
    private readonly at: number,
    via: Via
  ) {
    super(via);
  }
  protected apply(reference: Reference, real: Real): void {
    const index = this.at % reference.values.length;
    if (this.via === 'model') real.model.items.removeAt(index);
    else real.rows.removeAt(index);
    reference.values.splice(index, 1);
    reference.tokens.splice(index, 1);
  }
  toString(): string {
    return `${this.via}.removeAt(${this.at} mod length)`;
  }
}

class Move extends RowCommand {
  constructor(
    private readonly from: number,
    private readonly to: number,
    via: Via
  ) {
    super(via);
  }
  protected apply(reference: Reference, real: Real): void {
    const length = reference.values.length;
    const from = this.from % length;
    const to = this.to % length;
    if (this.via === 'model') real.model.items.move(from, to);
    else real.rows.move(from, to);
    const [value] = reference.values.splice(from, 1);
    reference.values.splice(to, 0, value);
    const [token] = reference.tokens.splice(from, 1);
    reference.tokens.splice(to, 0, token);
  }
  toString(): string {
    return `${this.via}.move(${this.from} mod length, ${this.to} mod length)`;
  }
}

class Swap extends RowCommand {
  constructor(
    private readonly a: number,
    private readonly b: number,
    via: Via
  ) {
    super(via);
  }
  protected apply(reference: Reference, real: Real): void {
    const length = reference.values.length;
    const a = this.a % length;
    const b = this.b % length;
    if (this.via === 'model') real.model.items.swap(a, b);
    else real.rows.swap(a, b);
    for (const list of [reference.values, reference.tokens] as unknown[][]) {
      [list[a], list[b]] = [list[b], list[a]];
    }
  }
  toString(): string {
    return `${this.via}.swap(${this.a} mod length, ${this.b} mod length)`;
  }
}

class Clear extends ArrayCommand {
  protected apply(reference: Reference, real: Real): void {
    if (this.via === 'model') real.model.items.clear();
    else real.rows.clear();
    reference.values.length = 0;
    reference.tokens.length = 0;
  }
  toString(): string {
    return `${this.via}.clear()`;
  }
}

const rowArb = fc.record({
  title: fc.constantFrom('', 'a', 'b', 'ab'),
  qty: fc.integer({ min: 0, max: 3 }),
});
const viaArb = fc.constantFrom<Via>('model', 'form');
const indexArb = fc.nat(40);

const commandArbs = [
  fc.tuple(rowArb, viaArb).map(([row, via]) => new Push(row, via)),
  fc.tuple(indexArb, rowArb, viaArb).map(([at, row, via]) => new InsertAt(at, row, via)),
  fc.tuple(indexArb, viaArb).map(([at, via]) => new RemoveAt(at, via)),
  fc.tuple(indexArb, indexArb, viaArb).map(([from, to, via]) => new Move(from, to, via)),
  fc.tuple(indexArb, indexArb, viaArb).map(([a, b, via]) => new Swap(a, b, via)),
  viaArb.map((via) => new Clear(via)),
];

/** Модель с начальными строками, форма со схемой `{ model, item }` и запомненные строки. */
function setup(initialRows: Row[]): { reference: Reference; real: Real } {
  const bundle = createForm<Shape>({
    initial: { items: initialRows.map((row) => ({ ...row })) },
    schema: (model) => ({ children: [{ model: model.$.items, item: rowSchema }] }),
  });
  const reference: Reference = {
    values: initialRows.map((row) => ({ ...row })),
    tokens: [],
    next: 0,
  };
  const real: Real = {
    model: bundle.model,
    form: bundle.form,
    rows: bundle.form.items,
    facades: new Map(),
    forms: new Map(),
    keys: new Map(),
  };
  initialRows.forEach((_row, index) => remember(reference, real, index));
  return { reference, real };
}

describe('model-array — свойства мутаций против эталонного массива', () => {
  it('значения, пути, идентичность строк и FormArray совпадают с эталоном после каждой команды', () => {
    fc.assert(
      fc.property(
        fc.array(rowArb, { maxLength: 3 }),
        fc.commands(commandArbs, { maxCommands: 25 }),
        (initialRows, commands) => {
          const { reference, real } = setup(initialRows);
          try {
            verify(reference, real);
            fc.modelRun(() => ({ model: reference, real }), commands);
          } finally {
            disposeForm(real.form);
          }
        }
      ),
      propertyParams()
    );
  });
});
