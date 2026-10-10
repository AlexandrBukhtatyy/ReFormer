/**
 * Внутренние утилиты слоя поведения (`src/form/behaviors/internals.ts`) — чистые функции.
 *
 * От них зависит выбор ветки операторов «скаляр / группа»: лист модели и узел-массив копируются
 * значением, группа — по полям. Ошибка здесь незаметна снаружи: `enableWhen` молча потерял бы
 * группу, `copyFrom` писал бы в read-only агрегат. Отдельно — guard циклов `compute`: понятная
 * ошибка вместо «Cycle detected» и проброс любых других ошибок как есть.
 */

import { describe, expect, it, vi } from 'vitest';
import { computed, signal } from '@preact/signals-core';
import { createModel } from '../../src/model/index';
import {
  asArray,
  isLeafSignal,
  isValueHandle,
  makeCycleGuard,
  readGroup,
  writeGroup,
  type GroupSignals,
} from '../../src/form/behaviors/internals';

interface Profile {
  name: string;
  address: {
    city: string;
    geo: { lat: number; lng: number };
    tags: string[];
  };
}

const createProfile = () =>
  createModel<Profile>({
    name: 'Анна',
    address: { city: 'Казань', geo: { lat: 55, lng: 49 }, tags: ['дом'] },
  });

const group = (handle: unknown): GroupSignals => handle as GroupSignals;

describe('internals — лист и ручка значения', () => {
  it('isLeafSignal: лист модели и сигнал — да; группа, массив и не-сигналы — нет', () => {
    const model = createProfile();
    const cases: Array<[string, unknown]> = [
      ['лист модели', model.$.name],
      ['сигнал', signal(1)],
      ['computed', computed(() => 1)],
      ['группа', model.$.address],
      ['массив', model.$.address.tags],
      ['null', null],
      ['undefined', undefined],
      ['число', 42],
      ['объект без peek', {}],
      ['peek не функция', { peek: 1 }],
      ['функция', Object.assign(() => 0, { peek: () => 0 })],
    ];

    expect(cases.map(([label, value]) => [label, isLeafSignal(value)])).toEqual([
      ['лист модели', true],
      ['сигнал', true],
      ['computed', true],
      ['группа', false],
      ['массив', false],
      ['null', false],
      ['undefined', false],
      ['число', false],
      ['объект без peek', false],
      ['peek не функция', false],
      ['функция', false],
    ]);
  });

  it('isValueHandle: лист и массив целиком — да, группа — нет', () => {
    const model = createProfile();

    expect([
      isValueHandle(model.$.name),
      isValueHandle(model.$.address.tags),
      isValueHandle(model.$.address),
      isValueHandle(model.$.address.geo),
      isValueHandle('строка'),
    ]).toEqual([true, true, false, false, false]);
  });

  it('asArray: одиночное значение заворачивает, массив отдаёт как есть', () => {
    const list = [1, 2];

    expect(asArray(3)).toEqual([3]);
    expect(asArray(list)).toBe(list);
  });
});

describe('internals — readGroup / writeGroup', () => {
  it('readGroup читает группу рекурсивно, массив — значением целиком', () => {
    const model = createProfile();

    expect(readGroup(group(model.$.address))).toEqual({
      city: 'Казань',
      geo: { lat: 55, lng: 49 },
      tags: ['дом'],
    });
  });

  it('writeGroup пишет по полям: вложенная группа — рекурсивно, массив — заменой', () => {
    const model = createProfile();

    writeGroup(group(model.$.address), {
      city: 'Самара',
      geo: { lat: 53, lng: 50 },
      tags: ['работа', 'дача'],
    });

    expect(model.get().address).toEqual({
      city: 'Самара',
      geo: { lat: 53, lng: 50 },
      tags: ['работа', 'дача'],
    });
  });

  it('writeGroup: ключи цели, которых нет в значении, получают пустое значение', () => {
    // поведение под вопросом [ReFormer-nm2x]: обход идёт по ключам ЦЕЛИ — отсутствующее в значении поле
    // становится undefined (массив — пустым), тогда как `model.set` такие поля оставляет как
    // есть. Через copyFrom групп разной формы это стирает поля цели.
    const model = createProfile();

    writeGroup(group(model.$.address), { city: 'Самара' });

    expect(model.get().address).toEqual({
      city: 'Самара',
      geo: { lat: undefined, lng: undefined },
      tags: [],
    });
  });

  it('writeGroup без значения очищает все поля группы', () => {
    // поведение под вопросом [ReFormer-nm2x]: то же — значение `undefined` не «ничего не писать», а «стереть всё».
    const model = createProfile();

    writeGroup(group(model.$.address.geo), undefined as unknown as Record<string, unknown>);

    expect(model.get().address.geo).toEqual({ lat: undefined, lng: undefined });
  });
});

describe('internals — makeCycleGuard', () => {
  it('без ошибки запись проходит как есть', () => {
    const target = signal(0);
    const guard = makeCycleGuard(target);

    guard(() => {
      target.value = 5;
    });

    expect(target.value).toBe(5);
  });

  it('«Cycle detected» превращается в понятную ошибку с путём поля', () => {
    const model = createModel({ total: 0 });
    const guard = makeCycleGuard(model.$.total);

    expect(() =>
      guard(() => {
        throw new Error('Cycle detected');
      })
    ).toThrowError(/compute\("total"\): расходящийся цикл пересчёта/);
  });

  it('сигнал без пути: в сообщении «?»; текст цикла распознаётся без учёта регистра', () => {
    const guard = makeCycleGuard(signal(0));

    expect(() =>
      guard(() => {
        throw new Error('preact: CYCLE DETECTED');
      })
    ).toThrowError(/compute\("\?"\)/);
  });

  it('другая ошибка пробрасывается тем же объектом', () => {
    const failure = new TypeError('запись запрещена');
    const guard = makeCycleGuard(signal(0));
    let caught: unknown;

    try {
      guard(() => {
        throw failure;
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBe(failure);
  });

  it('брошенное не-Error значение пробрасывается как есть, даже с текстом цикла', () => {
    const guard = makeCycleGuard(signal(0));
    const write = vi.fn(() => {
      throw 'Cycle detected';
    });

    expect(() => guard(write)).toThrow('Cycle detected');
    expect(() => guard(write)).not.toThrowError(/расходящийся/);
  });
});
