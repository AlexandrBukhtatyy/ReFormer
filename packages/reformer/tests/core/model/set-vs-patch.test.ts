/**
 * `model.set` и `model.patch` — разные операции.
 *
 * `patch` — частичное обновление: записываются только переданные ключи, вложенные группы
 * сливаются. `set` — полная установка: значение ожидается целиком, а нехватка ключей — ошибка
 * вызывающего кода, о которой в dev сообщает предупреждение (значения при этом не трогаются).
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { createModel } from '../../../src/model/index';
import { markDerived } from '../../../src/model/derived-registry';

interface Profile {
  name: string;
  age: number | null;
  address: { city: string; street: string };
  tags: string[];
  total: number;
}

const createProfile = () =>
  createModel<Profile>({
    name: 'Анна',
    age: 30,
    address: { city: 'Казань', street: 'Баумана' },
    tags: ['a', 'b'],
    total: 0,
  });

const full = (): Profile => ({
  name: 'Борис',
  age: 41,
  address: { city: 'Москва', street: 'Арбат' },
  tags: ['x'],
  total: 7,
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('model.patch — частичное обновление', () => {
  it('записывает только переданные ключи и не предупреждает', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const model = createProfile();

    model.patch({ name: 'Борис' });

    expect(model.get()).toEqual({
      name: 'Борис',
      age: 30,
      address: { city: 'Казань', street: 'Баумана' },
      tags: ['a', 'b'],
      total: 0,
    });
    expect(warn).not.toHaveBeenCalled();
  });

  it('вложенную группу сливает, а не заменяет', () => {
    const model = createProfile();

    model.patch({ address: { city: 'Москва' } });

    expect(model.address.city).toBe('Москва');
    expect(model.address.street).toBe('Баумана');
  });

  it('массив заменяет целиком', () => {
    const model = createProfile();

    model.patch({ tags: ['x'] });

    expect(model.get().tags).toEqual(['x']);
  });

  it('лишние ключи значения игнорирует', () => {
    const model = createProfile();

    model.patch({ name: 'Борис', unknownKey: 1 } as never);

    expect(Object.keys(model.get())).toEqual(['name', 'age', 'address', 'tags', 'total']);
  });

  it('вычисляемое поле не затирает', () => {
    const model = createProfile();
    markDerived(model.$.total);

    model.patch({ total: 99, name: 'Борис' });

    expect(model.total).toBe(0);
    expect(model.name).toBe('Борис');
  });

  it('значение не-объект пропускает молча', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const model = createProfile();

    model.patch(null as never);
    model.patch({ address: null } as never);

    expect(model.address.city).toBe('Казань');
    expect(warn).not.toHaveBeenCalled();
  });

  it('уведомляет подписчика модели один раз на вызов', () => {
    const model = createProfile();
    const seen: Profile[] = [];
    const unsubscribe = model.$.subscribe((value) => seen.push(value));
    seen.length = 0;

    model.patch({ name: 'Борис', age: 41, address: { city: 'Москва' } });

    expect(seen).toHaveLength(1);
    unsubscribe();
  });

  it('на под-модели обновляет только её ключи', () => {
    const model = createProfile();

    model.address.patch({ street: 'Арбат' });

    expect(model.get().address).toEqual({ city: 'Казань', street: 'Арбат' });
  });
});

describe('model.set — полная установка', () => {
  it('записывает объект целиком и не предупреждает', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const model = createProfile();

    model.set(full());

    expect(model.get()).toEqual(full());
    expect(warn).not.toHaveBeenCalled();
  });

  it('недостающие ключи оставляет прежними и предупреждает списком путей', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const model = createProfile();

    model.set({ name: 'Борис', address: { city: 'Москва' }, tags: [], total: 1 } as never);

    expect(model.age).toBe(30);
    expect(model.address.street).toBe('Баумана');
    expect(model.name).toBe('Борис');
    expect(warn).toHaveBeenCalledTimes(1);
    const message = String(warn.mock.calls[0]![0]);
    expect(message).toMatch(/model\.set\(\.\.\.\)/);
    expect(message).toContain('«age»');
    expect(message).toContain('«address.street»');
    expect(message).toMatch(/patch/);
  });

  it('группу без объекта-значения считает недостающим ключом', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const model = createProfile();

    model.set({ ...full(), address: null } as never);

    expect(model.address.city).toBe('Казань');
    expect(String(warn.mock.calls[0]![0])).toContain('«address»');
  });

  it('значение не-объект не записывает и сообщает об этом', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const model = createProfile();

    model.set(null as never);

    expect(model.name).toBe('Анна');
    expect(String(warn.mock.calls[0]![0])).toMatch(/значение не объект/);
  });

  it('о вычисляемом поле не предупреждает: им владеет расчёт', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const model = createProfile();
    markDerived(model.$.total);
    const { total: _total, ...withoutDerived } = full();

    model.set(withoutDerived as never);

    expect(model.total).toBe(0);
    expect(warn).not.toHaveBeenCalled();
  });

  it('на под-модели называет в предупреждении её путь', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const model = createProfile();

    model.address.set({ city: 'Москва' } as never);

    expect(model.address.street).toBe('Баумана');
    const message = String(warn.mock.calls[0]![0]);
    expect(message).toMatch(/model\.address\.set\(\.\.\.\)/);
    expect(message).toContain('«address.street»');
  });

  it('в production не предупреждает', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const model = createProfile();

    model.set({ name: 'Борис' } as never);

    expect(model.name).toBe('Борис');
    expect(warn).not.toHaveBeenCalled();
  });
});
