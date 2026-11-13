/**
 * Живой путь узла модели и `path` нод формы (ReFormer-7ybd, ReFormer-zy8k).
 *
 * Путь строки массива меняется вместе с её индексом. `__path` ручки — обычное свойство: его
 * читают однажды, и разметка, не перерисованная после удаления соседки, держала прежний индекс.
 * Живой путь — сигнал: подписчик узнаёт о переезде. Новый состав и новые пути массив пишет одной
 * записью — подписчик состава видит элементы уже на их местах.
 */
import { describe, expect, it } from 'vitest';
import { effect, signal } from '@preact/signals-core';
import { arrayOf, createModel } from '../../../src/model/index';
import { livePathOf } from '../../../src/model/model-value-proxy';
import { createForm } from '../../../src/form/form-bundle';
import { FormControlNode } from '../../../src/form/nodes/form-control-node';

interface Phone {
  number: string;
  tags: string[];
}
interface Profile {
  name: string;
  phones: Phone[];
}

const phone = (number: string): Phone => ({ number, tags: [] });

function createProfile() {
  return createModel<Profile>({
    name: '',
    phones: arrayOf(() => phone(''), [phone('1'), phone('2'), phone('3')]),
  });
}

describe('livePathOf — путь узла модели как сигнал', () => {
  it('лист, строка и вложенный массив строки следуют за индексом строки', () => {
    const model = createProfile();
    const leaf = livePathOf(model.$.phones[2].number)!;
    const row = livePathOf(model.$.phones[2])!;
    const nested = livePathOf(model.$.phones[2].tags)!;
    expect([leaf.value, row.value, nested.value]).toEqual([
      'phones.2.number',
      'phones.2',
      'phones.2.tags',
    ]);

    model.phones.removeAt(0);

    expect([leaf.value, row.value, nested.value]).toEqual([
      'phones.1.number',
      'phones.1',
      'phones.1.tags',
    ]);
  });

  it('value-фасады: под-модель строки и массив — тот же путь, что у ручек', () => {
    const model = createProfile();
    expect(livePathOf(model.phones)?.value).toBe('phones');
    expect(livePathOf(model.phones.at(1))?.value).toBe('phones.1');
    expect(livePathOf(model)?.value).toBe('');
  });

  it('move, swap и insertAt переносят путь; путь, запрошенный после, — текущий', () => {
    const model = createProfile();
    const first = livePathOf(model.$.phones[0].number)!;

    model.phones.move(0, 2);
    expect(first.value).toBe('phones.2.number');
    model.phones.swap(2, 1);
    expect(first.value).toBe('phones.1.number');
    model.phones.insertAt(0, phone('0'));
    expect(first.value).toBe('phones.2.number');
    expect(livePathOf(model.$.phones[0].number)?.value).toBe('phones.0.number');
  });

  it('подписчик состава видит элементы уже с новыми путями', () => {
    const model = createProfile();
    const seen: string[][] = [];
    const stop = effect(() => {
      void model.phones.length; // подписка на состав
      seen.push(
        Array.from({ length: model.$.phones.length }, (_, i) => model.$.phones[i].number.__path)
      );
    });

    model.phones.removeAt(0);
    stop();

    expect(seen.at(-1)).toEqual(['phones.0.number', 'phones.1.number']);
  });

  it('не ручка модели — undefined', () => {
    expect(livePathOf(signal(''))).toBeUndefined();
    expect(livePathOf({})).toBeUndefined();
    expect(livePathOf(null)).toBeUndefined();
  });
});

describe('path нод формы', () => {
  it('поле строки и массив под-форм — живой путь из модели', () => {
    const bundle = createForm<Profile>({
      model: createProfile(),
      schema: (model) => ({
        children: [
          { model: model.$.name, component: 'input' },
          {
            model: model.$.phones,
            item: (row) => ({ children: [{ model: row.$.number, component: 'input' }] }),
          },
        ],
      }),
    });
    const { form } = bundle;
    const third = form.phones.at(2)!.number;
    expect(form.name.path.value).toBe('name');
    expect(form.phones.path.value).toBe('phones');
    expect(third.path.value).toBe('phones.2.number');

    form.phones.removeAt(0);

    expect(third.path.value).toBe('phones.1.number');
  });

  it('поле над собственным сигналом, не из модели, — пустой путь', () => {
    const node = new FormControlNode<string>({ valueSignal: signal('x') });
    expect(node.path.value).toBe('');
  });
});
