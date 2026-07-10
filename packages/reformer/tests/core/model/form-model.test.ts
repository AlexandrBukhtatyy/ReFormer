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
import { createModel } from '../../../src/core/model';

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
      personalData: { lastName: 'Сидоров', firstName: 'П', gender: 'male' },
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
