/**
 * Unit tests для FormModel (слой данных M1)
 *
 * Покрывает:
 * - value-доступ (чтение/запись), вложенность
 * - $-сигналы (path-aware), реактивность через effect
 * - массивы: push/removeAt/insertAt/move/clear, at/map/forEach, реактивная длина
 * - get/set/patch/isDirty/reset/captureInitial
 * - signalAt (резолв пути)
 */

import { describe, it, expect } from 'vitest';
import { effect } from '@preact/signals-core';
import { createModel, watchField } from '../../../src/model/index';

interface CoBorrower {
  personalData: { lastName: string; firstName: string };
  relationship: string;
  monthlyIncome: number;
}

interface CreditForm {
  loanType: string;
  loanAmount: number | null;
  personalData: { lastName: string; firstName: string; gender: 'male' | 'female' };
  coBorrowers: CoBorrower[];
  tags: string[];
}

const makeModel = () =>
  createModel<CreditForm>({
    loanType: 'consumer',
    loanAmount: null,
    personalData: { lastName: '', firstName: '', gender: 'male' },
    coBorrowers: [],
    tags: [],
  });

describe('FormModel: value-доступ', () => {
  it('читает и пишет примитивные поля', () => {
    const m = makeModel();
    expect(m.loanType).toBe('consumer');
    m.loanType = 'mortgage';
    expect(m.loanType).toBe('mortgage');
  });

  it('читает и пишет вложенные поля', () => {
    const m = makeModel();
    expect(m.personalData.lastName).toBe('');
    m.personalData.lastName = 'Иванов';
    expect(m.personalData.lastName).toBe('Иванов');
    expect(m.get().personalData.lastName).toBe('Иванов');
  });

  it('null-значение допустимо как лист', () => {
    const m = makeModel();
    expect(m.loanAmount).toBeNull();
    m.loanAmount = 50000;
    expect(m.loanAmount).toBe(50000);
  });
});

describe('FormModel: $-сигналы', () => {
  it('отдаёт сигнал с корректным __path', () => {
    const m = makeModel();
    expect(m.$.loanType.value).toBe('consumer');
    expect(m.$.loanType.__path).toBe('loanType');
    expect(m.$.personalData.lastName.__path).toBe('personalData.lastName');
  });

  it('сигнал и value-доступ разделяют одно значение', () => {
    const m = makeModel();
    m.$.loanType.value = 'car';
    expect(m.loanType).toBe('car');
    m.loanType = 'business';
    expect(m.$.loanType.value).toBe('business');
  });

  it('реактивен: effect перезапускается при изменении', () => {
    const m = makeModel();
    const seen: unknown[] = [];
    const dispose = effect(() => {
      seen.push(m.$.loanType.value);
    });
    m.loanType = 'mortgage';
    expect(seen).toEqual(['consumer', 'mortgage']);
    dispose();
  });
});

describe('FormModel: массивы', () => {
  it('push/length реактивны', () => {
    const m = makeModel();
    const lengths: number[] = [];
    const dispose = effect(() => {
      lengths.push(m.coBorrowers.length);
    });
    m.coBorrowers.push({
      personalData: { lastName: 'A', firstName: 'B' },
      relationship: 'брат',
      monthlyIncome: 100,
    });
    expect(m.coBorrowers.length).toBe(1);
    expect(lengths).toEqual([0, 1]);
    dispose();
  });

  it('at/map отдают под-модель элемента с $-сигналами', () => {
    const m = makeModel();
    m.coBorrowers.push({
      personalData: { lastName: 'Петров', firstName: 'И' },
      relationship: 'брат',
      monthlyIncome: 100,
    });
    const item = m.coBorrowers.at(0)!;
    expect(item.relationship).toBe('брат');
    expect(item.$.personalData.lastName.value).toBe('Петров');
    item.relationship = 'отец';
    expect(m.get().coBorrowers[0].relationship).toBe('отец');
  });

  it('removeAt переиндексирует пути элементов', () => {
    const m = makeModel();
    m.coBorrowers.push({
      personalData: { lastName: '0', firstName: '' },
      relationship: '',
      monthlyIncome: 0,
    });
    m.coBorrowers.push({
      personalData: { lastName: '1', firstName: '' },
      relationship: '',
      monthlyIncome: 0,
    });
    m.coBorrowers.removeAt(0);
    expect(m.coBorrowers.length).toBe(1);
    const item0 = m.coBorrowers.at(0)!;
    expect(item0.$.personalData.lastName.value).toBe('1');
    expect(item0.$.personalData.lastName.__path).toBe('coBorrowers.0.personalData.lastName');
  });

  it('примитивный массив: push/индексный доступ', () => {
    const m = makeModel();
    m.tags.push('a');
    m.tags.push('b');
    expect(m.tags.length).toBe(2);
    expect(m.tags[0]).toBe('a');
    expect(m.get().tags).toEqual(['a', 'b']);
  });
});

describe('FormModel: API get/set/patch/isDirty/reset', () => {
  it('get отдаёт снимок', () => {
    const m = makeModel();
    m.loanType = 'mortgage';
    m.personalData.firstName = 'Иван';
    expect(m.get()).toMatchObject({ loanType: 'mortgage', personalData: { firstName: 'Иван' } });
  });

  it('set массово заменяет значения', () => {
    const m = makeModel();
    m.set({
      loanType: 'car',
      loanAmount: null,
      personalData: { lastName: 'Сидоров', firstName: 'П', gender: 'male' },
      coBorrowers: [],
      tags: [],
    });
    expect(m.loanType).toBe('car');
    expect(m.personalData.lastName).toBe('Сидоров');
  });

  it('isDirty: false изначально, true после правки, false после reset', () => {
    const m = makeModel();
    expect(m.isDirty()).toBe(false);
    m.loanType = 'mortgage';
    expect(m.isDirty()).toBe(true);
    m.reset();
    expect(m.isDirty()).toBe(false);
    expect(m.loanType).toBe('consumer');
  });

  it('captureInitial обновляет точку отсчёта', () => {
    const m = makeModel();
    m.loanType = 'mortgage';
    m.captureInitial();
    expect(m.isDirty()).toBe(false);
    m.reset();
    expect(m.loanType).toBe('mortgage');
  });

  it('reset восстанавливает длину массива', () => {
    const m = makeModel();
    m.coBorrowers.push({
      personalData: { lastName: 'X', firstName: '' },
      relationship: '',
      monthlyIncome: 0,
    });
    expect(m.coBorrowers.length).toBe(1);
    m.reset();
    expect(m.coBorrowers.length).toBe(0);
  });
});

describe('FormModel: signalAt', () => {
  it('резолвит путь в сигнал', () => {
    const m = makeModel();
    const sig = m.signalAt('personalData.lastName');
    expect(sig).toBe(m.$.personalData.lastName);
    sig!.value = 'Кузнецов';
    expect(m.personalData.lastName).toBe('Кузнецов');
  });

  it('резолвит путь элемента массива', () => {
    const m = makeModel();
    m.coBorrowers.push({
      personalData: { lastName: 'Z', firstName: '' },
      relationship: '',
      monthlyIncome: 0,
    });
    const sig = m.signalAt('coBorrowers.0.personalData.lastName');
    expect(sig?.value).toBe('Z');
  });

  it('возвращает undefined для несуществующего пути', () => {
    const m = makeModel();
    expect(m.signalAt('nope.nope')).toBeUndefined();
  });
});

describe('FormModel: вложенные группы — суб-модели', () => {
  it('вложенная группа — FormModel: сигнал идентичен корневому $-дереву', () => {
    const m = makeModel();
    // model.personalData.$.lastName === model.$.personalData.lastName (тот же PathAwareSignal)
    expect(m.personalData.$.lastName).toBe(m.$.personalData.lastName);
    expect(m.personalData.$.lastName.__path).toBe('personalData.lastName');
  });

  it('__path группы сохранён (паритет с прежним value-proxy)', () => {
    const m = makeModel();
    expect((m.personalData as unknown as { __path: string }).__path).toBe('personalData');
  });

  it('value-доступ сохранён (чтение/запись/get)', () => {
    const m = makeModel();
    expect(m.personalData.lastName).toBe('');
    m.personalData.lastName = 'Иванов';
    expect(m.personalData.lastName).toBe('Иванов');
    expect(m.get().personalData.lastName).toBe('Иванов');
    expect(m.personalData.get()).toEqual({ lastName: 'Иванов', firstName: '', gender: 'male' });
  });

  it('фасад под-модели стабилен (facadeCache)', () => {
    const m = makeModel();
    expect(m.personalData).toBe(m.personalData);
  });

  it('API под-модели scoped на группу (isDirty/reset/signalAt)', () => {
    const m = makeModel();
    const pd = m.personalData;
    expect(pd.isDirty()).toBe(false);
    pd.lastName = 'X';
    expect(pd.isDirty()).toBe(true);
    // относительный путь резолвится от группы, тот же сигнал
    expect(pd.signalAt('lastName')).toBe(m.$.personalData.lastName);
    pd.reset();
    expect(pd.isDirty()).toBe(false);
    expect(pd.lastName).toBe('');
    // правка соседнего корневого поля не пачкает под-модель
    m.loanType = 'mortgage';
    expect(pd.isDirty()).toBe(false);
    expect(m.isDirty()).toBe(true);
  });

  it('реактивен через суб-модель ($-сигнал общий)', () => {
    const m = makeModel();
    const seen: unknown[] = [];
    const dispose = effect(() => {
      seen.push(m.personalData.$.lastName.value);
    });
    m.personalData.lastName = 'Петров';
    expect(seen).toEqual(['', 'Петров']);
    dispose();
  });

  it('корень: __path === "" и не enumerable', () => {
    const m = makeModel();
    expect((m as unknown as { __path: string }).__path).toBe('');
    expect('__path' in m).toBe(false);
    expect(Object.keys(m)).not.toContain('__path');
  });

  it('элемент массива: индекс и at() дают тот же фасад', () => {
    const m = makeModel();
    m.coBorrowers.push({
      personalData: { lastName: 'A', firstName: 'B' },
      relationship: 'брат',
      monthlyIncome: 100,
    });
    expect(m.coBorrowers[0]).toBe(m.coBorrowers.at(0));
    expect(m.coBorrowers[0].$.personalData.lastName).toBe(m.$.coBorrowers[0].personalData.lastName);
    // вложенная группа внутри элемента массива — тоже суб-модель
    expect(m.coBorrowers[0].personalData.$.lastName).toBe(m.$.coBorrowers[0].personalData.lastName);
  });
});

describe('FormModel: подписка на контейнерные узлы $', () => {
  const addCoBorrower = (m: ReturnType<typeof makeModel>, lastName: string) =>
    m.coBorrowers.push({
      personalData: { lastName, firstName: '' },
      relationship: 'брат',
      monthlyIncome: 0,
    });

  it('корень: subscribe отдаёт значение модели целиком и реагирует на любое поле', () => {
    const m = makeModel();
    const seen: CreditForm[] = [];
    const unsubscribe = m.$.subscribe((v) => seen.push(v));

    // preact вызывает подписчика сразу — паритет с листовым `model.$.field.subscribe`
    expect(seen).toHaveLength(1);
    expect(seen[0]).toEqual({
      loanType: 'consumer',
      loanAmount: null,
      personalData: { lastName: '', firstName: '', gender: 'male' },
      coBorrowers: [],
      tags: [],
    });

    m.loanType = 'mortgage';
    m.personalData.lastName = 'Иванов';

    expect(seen).toHaveLength(3);
    expect(seen[2].loanType).toBe('mortgage');
    expect(seen[2].personalData.lastName).toBe('Иванов');

    unsubscribe();
    m.loanType = 'auto';
    expect(seen).toHaveLength(3);
  });

  it('группа: subscribe/value/peek видят только своё поддерево', () => {
    const m = makeModel();
    const seen: CreditForm['personalData'][] = [];
    m.$.personalData.subscribe((v) => seen.push(v));

    expect(m.$.personalData.value).toEqual({ lastName: '', firstName: '', gender: 'male' });

    m.personalData.firstName = 'Пётр';
    expect(seen).toHaveLength(2);
    expect(seen[1]).toEqual({ lastName: '', firstName: 'Пётр', gender: 'male' });

    // поле вне группы подписчика не трогает
    m.loanType = 'auto';
    expect(seen).toHaveLength(2);

    // peek — снимок без подписки
    expect(m.$.personalData.peek()).toEqual({ lastName: '', firstName: 'Пётр', gender: 'male' });
  });

  it('группа: peek() не создаёт зависимости внутри effect', () => {
    const m = makeModel();
    let runs = 0;
    effect(() => {
      m.$.personalData.peek();
      runs++;
    });
    expect(runs).toBe(1);
    m.personalData.lastName = 'Сидоров';
    expect(runs).toBe(1);
  });

  it('массив: subscribe реагирует и на состав, и на правку элемента', () => {
    const m = makeModel();
    const seen: CoBorrower[][] = [];
    m.$.coBorrowers.subscribe((v) => seen.push(v));
    expect(seen[0]).toEqual([]);

    addCoBorrower(m, 'Иванов');
    expect(seen).toHaveLength(2);
    expect(seen[1][0].personalData.lastName).toBe('Иванов');

    // правка листа внутри элемента
    m.coBorrowers[0].personalData.lastName = 'Петров';
    expect(seen).toHaveLength(3);
    expect(seen[2][0].personalData.lastName).toBe('Петров');

    m.coBorrowers.removeAt(0);
    expect(seen).toHaveLength(4);
    expect(seen[3]).toEqual([]);
  });

  it('массив примитивов: subscribe отдаёт значения, length остаётся реактивной', () => {
    const m = makeModel();
    const seen: string[][] = [];
    m.$.tags.subscribe((v) => seen.push(v));

    m.tags.push('a');
    m.tags.push('b');
    expect(seen[seen.length - 1]).toEqual(['a', 'b']);
    expect(m.$.tags.length).toBe(2);
  });

  it('set/reset модели уведомляют подписчика один раз (batch)', () => {
    const m = makeModel();
    let calls = 0;
    m.$.subscribe(() => calls++);
    expect(calls).toBe(1);

    m.set({
      loanType: 'mortgage',
      loanAmount: 500,
      personalData: { lastName: 'Иванов', firstName: 'Пётр', gender: 'female' },
      coBorrowers: [],
      tags: ['x'],
    });
    expect(calls).toBe(2);

    m.reset();
    expect(calls).toBe(3);
    expect(m.$.value.loanType).toBe('consumer');
  });

  it('идентичность контейнерного узла стабильна', () => {
    const m = makeModel();
    expect(m.$.personalData).toBe(m.$.personalData);
    expect(m.$.coBorrowers).toBe(m.$.coBorrowers);
    // под-модель и корневое дерево — тот же узел
    expect(m.personalData.$).toBe(m.$.personalData);
    // листья по-прежнему те же сигналы
    expect(m.$.personalData.lastName).toBe(m.personalData.$.lastName);
  });

  it('служебные свойства сигнала не видны в in/Object.keys', () => {
    const m = makeModel();
    expect(Object.keys(m.$.personalData)).toEqual(['lastName', 'firstName', 'gender']);
    expect('value' in m.$.personalData).toBe(false);
    expect('subscribe' in m.$.personalData).toBe(false);
    expect('lastName' in m.$.personalData).toBe(true);
    expect((m.$.personalData as unknown as { __path: string }).__path).toBe('personalData');
    expect((m.$.coBorrowers as unknown as { __kind: string }).__kind).toBe('array');
  });

  it('контейнерный узел принимается операциями над ReadonlySignal (watchField)', () => {
    const m = makeModel();
    const seen: CreditForm['personalData'][] = [];
    // структурная совместимость: watchField типизирован на ReadonlySignal<T>
    const stop = watchField(m.$.personalData, (v) => seen.push(v));

    m.personalData.lastName = 'Иванов';
    expect(seen).toHaveLength(1);
    expect(seen[0].lastName).toBe('Иванов');

    stop();
    m.personalData.firstName = 'Пётр';
    expect(seen).toHaveLength(1);
  });

  it('поле с именем value затеняет свойство сигнала, subscribe продолжает работать', () => {
    const m = createModel<{ amount: { value: number; currency: string } }>({
      amount: { value: 0, currency: 'RUB' },
    });
    // ребёнок выигрывает у свойства сигнала — тот же приоритет, что у методов ModelApi
    expect(m.$.amount.value).toBe(m.amount.$.value);

    const seen: { value: number; currency: string }[] = [];
    m.$.amount.subscribe((v) => seen.push(v));
    m.amount.value = 42;
    expect(seen[seen.length - 1]).toEqual({ value: 42, currency: 'RUB' });
  });
});
