/**
 * `FormArrayNode` — массив под-форм над массивом модели: то, чего нет в `model-array-node*.test.ts`.
 *
 * Значение и обход (`getValue` — снимок без подписки, `setValue(null)`, `forEach`), ключи строк
 * (`keyAt` за пределами и на краях, сохранение форм и ключей при `insert`/`removeAt`), `reset` к
 * строкам на момент создания, свои замечания (`ownIssues`) против замечаний строк (`issues`),
 * делегирование мутаций массиву модели и повторный `dispose` — на собственной заглушке массива.
 *
 * `dirty` состава: методы ноды ставят, запись в модель — нет, `reset` снимает.
 *
 * Строка `null` в массиве модели: форма её пропускает, индексы ноды — по строкам формы.
 *
 * Зонды: строка, добавленная в выключенный массив; ожидание async-правила на ручке самого массива.
 */

import { describe, expect, it } from 'vitest';
import { effect, signal } from '@preact/signals-core';
import { arrayOf, createModel } from '../../../src/model/index';
import type { FormModel } from '../../../src/model/types';
import { createFormFromModel } from '../../../src/form/create-form';
import { createForm } from '../../../src/form/form-bundle';
import { FormArrayNode, type ModelArrayControl } from '../../../src/form/nodes/form-array-node';
import { rowKeyOf } from '../../../src/form/schema/row-key';
import { defineFormBehavior, onDispose } from '../../../src/form/behaviors';
import { applyEach, defineValidation, validate, validateAsync } from '../../../src/form/validation';
import { required } from '../../../src/form/validators';
import type { ValidationIssue } from '../../../src/form/types/contracts';
import type { FormArray, FormGroup } from '../../../src/form/types/nodes';
import { deferred } from '../../test-utils/async';
import { issueCodes } from '../../test-utils/issues';

interface Phone {
  number: string;
  kind: string;
}

interface Contacts {
  name: string;
  phones: Phone[];
}

const blankPhone = (): Phone => ({ number: '', kind: 'mobile' });

const phoneRow = (row: FormModel<Phone>) => ({
  children: [{ model: row.$.number }, { model: row.$.kind }],
});

/** Форма с массивом телефонов; по умолчанию — две строки «1» и «2». */
function createContacts(numbers: string[] = ['1', '2']) {
  const model = createModel<Contacts>({
    name: '',
    phones: arrayOf(
      blankPhone,
      numbers.map((number) => ({ ...blankPhone(), number }))
    ),
  });
  const form = createFormFromModel<Contacts>({
    model,
    schema: { children: [{ model: model.$.name }, { model: model.$.phones, item: phoneRow }] },
  });
  return { model, form, phones: form.phones };
}

const numbersOf = (phones: FormArray<Phone>): string[] =>
  phones.map((row) => row.number.value.value);

const codesOf = (issues: readonly ValidationIssue[]): string[] => issues.map((issue) => issue.code);

describe('form-array-node — значение и обход', () => {
  it('getValue — снимок без подписки: новый массив, правка снимка модель не трогает', () => {
    const { model, phones } = createContacts();
    let reads = 0;
    const stop = effect(() => {
      reads++;
      phones.getValue();
    });

    const snapshot = phones.getValue();
    snapshot[0].number = 'changed';
    snapshot.push(blankPhone());
    phones.push();
    stop();

    expect(reads).toBe(1);
    expect(phones.getValue()).not.toBe(snapshot);
    expect(model.get().phones.map((phone) => phone.number)).toEqual(['1', '2', '']);
  });

  it('forEach обходит формы строк с индексами в текущем порядке', () => {
    const { phones } = createContacts(['1', '2', '3']);
    phones.move(2, 0);

    const visited: string[] = [];
    phones.forEach((row, index) => visited.push(`${index}:${row.number.value.value}`));

    expect(visited).toEqual(['0:3', '1:1', '2:2']);
  });

  it('setValue(null) очищает массив, как пустой список', () => {
    const { model, phones } = createContacts();

    phones.setValue(null as unknown as Phone[]);

    expect(phones.length).toBe(0);
    expect(model.get().phones).toEqual([]);
  });

  it('setValue неполными строками дополняет их по шаблону массива модели', () => {
    const { model, phones } = createContacts([]);

    phones.setValue([{ number: '9' } as Phone]);

    expect(model.get().phones).toEqual([{ number: '9', kind: 'mobile' }]);
    expect(phones.at(0)?.kind.value.value).toBe('mobile');
  });
});

describe('form-array-node — ключи строк', () => {
  it('keyAt за пределами — RangeError с индексом: отрицательный, равный длине, у пустого', () => {
    const { phones } = createContacts();

    expect(() => phones.keyAt(-1)).toThrow(RangeError);
    expect(() => phones.keyAt(2)).toThrow('no row at index 2');

    phones.clear();
    expect(() => phones.keyAt(0)).toThrow(RangeError);
  });

  it('keyAt — ключ под-модели строки (rowKeyOf) строкой из цифр', () => {
    const { model, phones } = createContacts();

    const key = phones.keyAt(1);

    expect(key).toMatch(/^\d+$/);
    expect(key).toBe(String(rowKeyOf(model.phones.at(1)!)));
  });

  it('insert(i): формы и ключи прежних строк сохраняются, у вставленной — новые', () => {
    const { phones } = createContacts();
    const [first, second] = [phones.at(0), phones.at(1)];
    const [firstKey, secondKey] = [phones.keyAt(0), phones.keyAt(1)];

    phones.insert(1, { number: 'new', kind: 'home' });

    expect(numbersOf(phones)).toEqual(['1', 'new', '2']);
    expect(phones.at(0)).toBe(first);
    expect(phones.at(2)).toBe(second);
    expect([phones.keyAt(0), phones.keyAt(2)]).toEqual([firstKey, secondKey]);
    expect([firstKey, secondKey]).not.toContain(phones.keyAt(1));
    expect([first, second]).not.toContain(phones.at(1));
  });

  it('insert без значения — строка по шаблону, в начало и в конец', () => {
    const { phones } = createContacts(['1']);

    phones.insert(0);
    phones.insert(phones.length, { number: 'last', kind: 'work' });

    expect(phones.getValue()).toEqual([
      { number: '', kind: 'mobile' },
      { number: '1', kind: 'mobile' },
      { number: 'last', kind: 'work' },
    ]);
  });

  it('removeAt: формы и ключи оставшихся строк не меняются', () => {
    const { phones } = createContacts(['1', '2', '3']);
    const third = phones.at(2);
    const [firstKey, thirdKey] = [phones.keyAt(0), phones.keyAt(2)];

    phones.removeAt(1);

    expect(phones.at(1)).toBe(third);
    expect([phones.keyAt(0), phones.keyAt(1)]).toEqual([firstKey, thirdKey]);
  });

  it('setValue пересобирает строки: новые формы и новые ключи', () => {
    const { phones } = createContacts(['1']);
    const before = phones.at(0);
    const keyBefore = phones.keyAt(0);

    phones.setValue([{ number: '1', kind: 'mobile' }]);

    expect(phones.at(0)).not.toBe(before);
    expect(phones.keyAt(0)).not.toBe(keyBefore);
  });

  it('строка null в массиве модели формой пропускается, индексы ноды — по строкам формы [ReFormer-j0ee]', () => {
    const { model, phones } = createContacts();
    model.set({
      name: '',
      phones: [
        null as unknown as Phone,
        { number: '2', kind: 'home' },
        { number: '3', kind: 'work' },
      ],
    });

    expect(model.phones.length).toBe(3);
    expect(phones.length).toBe(2);
    expect(phones.at(0)?.number.value.value).toBe('2');
    // keyAt согласован с at: ключ строки, а не падение на null (рендер строк идёт по keyAt).
    expect(phones.keyAt(0)).toBe(String(rowKeyOf(model.phones.at(1)!)));
    expect(() => phones.keyAt(2)).toThrow(RangeError);

    phones.move(1, 0);
    expect(numbersOf(phones)).toEqual(['3', '2']);
    // «Удалить» у первой строки удаляет её, а не null перед ней.
    phones.removeAt(0);
    expect(numbersOf(phones)).toEqual(['2']);
    phones.insert(1, { number: '4', kind: 'home' });
    expect(numbersOf(phones)).toEqual(['2', '4']);
    expect(model.phones.length).toBe(3);
  });
});

describe('form-array-node — reset', () => {
  it('reset() — к строкам на момент создания после push, removeAt, move и правки поля', () => {
    const { phones } = createContacts(['1', '2']);
    const created = phones.getValue();

    phones.push({ number: '3', kind: 'work' });
    phones.removeAt(0);
    phones.move(0, 1);
    phones.at(0)?.number.setValue('changed');
    phones.reset();

    expect(phones.getValue()).toEqual(created);
  });

  it('снимок строк создания правками не портится: reset дважды даёт одно и то же', () => {
    const { phones } = createContacts(['1']);

    phones.reset();
    phones.at(0)?.number.setValue('edited');
    phones.at(0)?.kind.setValue('home');
    phones.reset();

    expect(phones.getValue()).toEqual([{ number: '1', kind: 'mobile' }]);
  });

  it('reset() снимает свои замечания массива; строки — новые формы без touched и dirty', () => {
    const { phones } = createContacts(['1']);
    const before = phones.at(0);
    phones.setIssues([{ code: 'phones.min' }]);
    before?.number.setValue('2');
    before?.number.markAsTouched();

    phones.reset();

    expect(phones.ownIssues.value).toEqual([]);
    expect(phones.valid.value).toBe(true);
    // reset идёт через setValue (clear + push) — строки пересобраны, а не сброшены на месте.
    expect(phones.at(0)).not.toBe(before);
    expect(phones.touched.value).toBe(false);
    expect(phones.dirty.value).toBe(false);
  });

  it('reset(values) — к переданным строкам, затем reset() — снова к строкам создания', () => {
    const { phones } = createContacts(['1']);

    phones.reset([
      { number: 'a', kind: 'home' },
      { number: 'b', kind: 'work' },
    ]);
    expect(numbersOf(phones)).toEqual(['a', 'b']);

    phones.reset();
    expect(numbersOf(phones)).toEqual(['1']);
  });
});

describe('form-array-node — замечания: ownIssues и issues', () => {
  it('issues — свои первыми, затем строк в текущем порядке строк', () => {
    const { phones } = createContacts();
    phones.setIssues([{ code: 'phones.min' }]);
    phones.at(0)?.number.setIssues([{ code: 'first' }]);
    phones.at(1)?.number.setIssues([{ code: 'second' }]);
    expect(issueCodes(phones)).toEqual(['phones.min', 'first', 'second']);

    phones.swap(0, 1);

    expect(issueCodes(phones)).toEqual(['phones.min', 'second', 'first']);
  });

  it('ownIssues — только свои: замечания строк туда не попадают, setIssues строк не трогает', () => {
    const { phones } = createContacts();
    phones.at(0)?.number.setIssues([{ code: 'required' }]);
    phones.at(1)?.setIssues([{ code: 'row.server' }]);
    expect(phones.ownIssues.value).toEqual([]);

    phones.setIssues([{ code: 'phones.min' }]);

    expect(codesOf(phones.ownIssues.value)).toEqual(['phones.min']);
    expect(issueCodes(phones.at(0)!.number)).toEqual(['required']);
    expect(codesOf(phones.at(1)!.ownIssues.value)).toEqual(['row.server']);
  });

  it('clearIssues снимает свои замечания, замечания строк и полей строк', () => {
    const { phones } = createContacts();
    phones.setIssues([{ code: 'phones.min' }]);
    phones.at(0)?.setIssues([{ code: 'row.server' }]);
    phones.at(1)?.kind.setIssues([{ code: 'kind.invalid' }]);

    phones.clearIssues();

    expect(phones.issues.value).toEqual([]);
    expect(phones.valid.value).toBe(true);
  });

  it('выключенная строка не входит в valid массива', () => {
    const { phones } = createContacts();
    const row = phones.at(1)!;
    row.setIssues([{ code: 'row.server' }]);
    expect(phones.valid.value).toBe(false);

    row.disable();

    expect(phones.valid.value).toBe(true);
  });

  it('disable() массива снимает его собственные замечания [ReFormer-z4p9]', () => {
    const { phones } = createContacts();
    phones.setIssues([{ code: 'phones.min' }]);

    phones.disable();

    expect(phones.ownIssues.value).toEqual([]);
  });
});

interface Shape {
  name: string;
  phones: Phone[];
}

const phoneRules = defineValidation<Shape>(({ model }) => {
  applyEach(model.$.phones, ({ model: row }) => {
    validate(row.$.number, [required()]);
  });
});

const createShape = () =>
  createForm<Shape>({
    initial: { name: 'Neo', phones: arrayOf(blankPhone, [{ number: '1', kind: 'mobile' }]) },
    schema: (model) => ({
      children: [{ model: model.$.name }, { model: model.$.phones, item: phoneRow }],
    }),
    validation: phoneRules,
  });

describe('form-array-node — строка, добавленная в выключенный массив (зонд)', () => {
  it('агрегат valid формы выключенный массив не считает, даже с пустой новой строкой', () => {
    const bundle = createShape();
    bundle.form.phones.disable();

    bundle.form.phones.push();

    expect(bundle.form.phones.disabled.value).toBe(true);
    expect(bundle.form.valid.value).toBe(true);
  });

  it('строка, добавленная в выключенный массив, выключена [ReFormer-kk90]', () => {
    const bundle = createShape();
    bundle.form.phones.disable();

    bundle.form.phones.push();

    expect(bundle.form.phones.at(1)?.number.disabled.value).toBe(true);
  });

  it('проверка формы согласна с агрегатом: статус valid, как form.valid [ReFormer-kk90]', async () => {
    const bundle = createShape();
    bundle.form.phones.disable();
    bundle.form.phones.push();

    const result = await bundle.validate();

    expect(result.status).toBe('valid');
  });
});

describe('form-array-node — dirty состава [ReFormer-j33t]', () => {
  it('push строки делает массив dirty: значение массива изменилось', () => {
    const { phones } = createContacts();

    phones.push({ number: '3', kind: 'work' });

    expect(phones.dirty.value).toBe(true);
  });

  it.each([
    ['insert', (phones: FormArray<Phone>) => phones.insert(0, { number: '0', kind: 'home' })],
    ['removeAt', (phones: FormArray<Phone>) => phones.removeAt(0)],
    ['move', (phones: FormArray<Phone>) => phones.move(0, 1)],
    ['swap', (phones: FormArray<Phone>) => phones.swap(0, 1)],
    ['clear', (phones: FormArray<Phone>) => phones.clear()],
    ['setValue', (phones: FormArray<Phone>) => phones.setValue([{ number: '9', kind: 'home' }])],
  ])('%s делает массив dirty, строки при этом не тронуты', (_name, mutate) => {
    const { phones } = createContacts();

    mutate(phones);

    expect(phones.dirty.value).toBe(true);
    expect(phones.map((row) => row.dirty.value)).not.toContain(true);
  });

  it('операция, которая состав не поменяла, dirty не ставит', () => {
    const { phones } = createContacts();
    phones.move(1, 1);
    phones.swap(0, 0);
    expect(phones.dirty.value).toBe(false);

    const empty = createContacts([]).phones;
    // Рецепт «очистить список при снятом флаге» после сброса формы зовёт clear пустого массива.
    empty.clear();
    empty.setValue([]);
    expect(empty.dirty.value).toBe(false);
  });

  it('запись в массив модели dirty не ставит — как запись в модель у поля', () => {
    const { model, phones } = createContacts();

    model.phones.push({ number: '3', kind: 'work' });
    model.phones.removeAt(0);

    expect(phones.length).toBe(2);
    expect(phones.dirty.value).toBe(false);
  });

  it('reset снимает dirty состава — и свой, и через сброс формы', () => {
    const { form, phones } = createContacts();
    phones.removeAt(0);
    phones.reset();
    expect(phones.dirty.value).toBe(false);

    phones.push();
    form.reset();
    expect(phones.dirty.value).toBe(false);
    expect(form.dirty.value).toBe(false);
  });
});

describe('form-array-node — pending (зонды)', () => {
  it('async-правило поля строки держит массив в pending до конца прогона', async () => {
    const check = deferred<ValidationIssue | null>();
    const rules = defineValidation<Shape>(({ model }) => {
      applyEach(model.$.phones, ({ model: row }) => {
        validateAsync(row.$.number, [() => check.promise]);
      });
    });
    const bundle = createForm<Shape>({
      initial: { name: '', phones: arrayOf(blankPhone, [{ number: '1', kind: 'mobile' }]) },
      schema: (model) => ({ children: [{ model: model.$.phones, item: phoneRow }] }),
      validation: rules,
    });

    const run = bundle.validate();
    const pendingWhileRunning = bundle.form.phones.pending.value;
    check.resolve({ code: 'taken' });
    await run;

    expect(pendingWhileRunning).toBe(true);
    expect(bundle.form.phones.pending.value).toBe(false);
    expect(issueCodes(bundle.form.phones)).toEqual(['taken']);
  });

  it('async-правило на ручке массива держит массив в pending [ReFormer-zo3f]', async () => {
    const check = deferred<ValidationIssue | null>();
    const rules = defineValidation<Shape>(({ model }) => {
      validateAsync(model.$.phones, [() => check.promise]);
    });
    const bundle = createForm<Shape>({
      initial: { name: '', phones: arrayOf(blankPhone, [{ number: '1', kind: 'mobile' }]) },
      schema: (model) => ({ children: [{ model: model.$.phones, item: phoneRow }] }),
      validation: rules,
    });

    const run = bundle.validate();
    const pendingWhileRunning = bundle.form.phones.pending.value;
    check.resolve(null);
    await run;

    expect([pendingWhileRunning, bundle.form.phones.pending.value]).toEqual([true, false]);
  });
});

/** Элемент заглушки массива модели: форма строки держится за его идентичность. */
interface StubRow {
  id: string;
}

/**
 * Заглушка массива модели: состав — сигнал, мутации записываются в журнал. Нужна там, где массив
 * модели не даёт нужного состояния (одна под-модель на двух позициях).
 */
function stubArray(initial: StubRow[]) {
  const items = signal<StubRow[]>(initial);
  const calls: string[] = [];
  const write = (call: string, next: StubRow[]): void => {
    calls.push(call);
    items.value = next;
  };
  const control: ModelArrayControl<StubRow> = {
    get length() {
      return items.value.length;
    },
    at: (index) => items.value[index] as FormModel<StubRow> | undefined,
    push: (item) => write(`push(${item?.id})`, [...items.peek(), item ?? { id: 'blank' }]),
    insertAt: (index, item) => {
      const next = [...items.peek()];
      next.splice(index, 0, item ?? { id: 'blank' });
      write(`insertAt(${index}, ${item?.id})`, next);
    },
    removeAt: (index) =>
      write(
        `removeAt(${index})`,
        items.peek().filter((_, i) => i !== index)
      ),
    move: (from, to) => write(`move(${from}, ${to})`, items.peek()),
    swap: (first, second) => write(`swap(${first}, ${second})`, items.peek()),
    clear: () => write('clear()', []),
    toArray: () => items.peek().map((item) => ({ ...item })),
  };
  return { items, calls, control };
}

/** Строитель форм строк: поведение каждой строки пишет в журнал свой dispose. */
function rowBuilder(disposed: string[]) {
  return (rowModel: FormModel<StubRow>): FormGroup<StubRow> => {
    const id = (rowModel as unknown as StubRow).id;
    return createFormFromModel<StubRow>({
      model: createModel<StubRow>({ id }),
      behavior: defineFormBehavior<StubRow>(() => {
        onDispose(() => disposed.push(id));
      }),
    });
  };
}

describe('form-array-node — делегирование массиву модели и dispose (заглушка массива)', () => {
  it('мутации уходят в массив модели как есть; setValue и reset — через clear и push', () => {
    const { calls, control } = stubArray([{ id: 'a' }, { id: 'b' }]);
    const array = new FormArrayNode<StubRow>(control, rowBuilder([]));

    array.push({ id: 'c' });
    array.insert(1, { id: 'd' });
    array.removeAt(0);
    array.move(0, 1);
    array.swap(0, 1);
    array.clear();
    array.setValue([{ id: 'e' }]);
    calls.push('— reset —');
    array.reset();

    expect(calls).toEqual([
      'push(c)',
      'insertAt(1, d)',
      'removeAt(0)',
      'move(0, 1)',
      'swap(0, 1)',
      'clear()',
      'clear()',
      'push(e)',
      '— reset —',
      'clear()',
      'push(a)',
      'push(b)',
    ]);
  });

  it('одна под-модель на двух позициях — одна форма строки, при исчезновении dispose один раз', () => {
    const shared = { id: 'shared' };
    const { items, control } = stubArray([shared, shared]);
    const disposed: string[] = [];
    const array = new FormArrayNode<StubRow>(control, rowBuilder(disposed));
    expect(array.length).toBe(2);
    expect(array.at(0)).toBe(array.at(1));

    items.value = [];

    expect(array.length).toBe(0);
    expect(disposed).toEqual(['shared']);
  });

  it('повторный dispose безопасен: поведение каждой строки снимается один раз', () => {
    const { control } = stubArray([{ id: 'a' }, { id: 'b' }]);
    const disposed: string[] = [];
    const array = new FormArrayNode<StubRow>(control, rowBuilder(disposed));

    array.dispose();
    array.dispose();

    expect(disposed.sort()).toEqual(['a', 'b']);
  });
});
