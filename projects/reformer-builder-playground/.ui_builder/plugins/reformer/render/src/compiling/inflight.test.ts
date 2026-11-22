import { describe, expect, it } from 'vitest';

import { createInflightMarks, INFLIGHT_PREFIX, type MarkStorage } from './inflight';

/** Хранилище в памяти — как `localStorage`, только своё у каждого теста. */
function memoryStorage(): MarkStorage & { readonly items: Map<string, string> } {
  const items = new Map<string, string>();
  return {
    items,
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => {
      items.set(key, value);
    },
    removeItem: (key) => {
      items.delete(key);
    },
  };
}

const FORM = 'fs:forms/contact/schema/form.schema.json';

describe('метка незавершённой сборки', () => {
  it('стоит, пока сборка идёт, и снимается её завершением', () => {
    const storage = memoryStorage();
    const marks = createInflightMarks(() => storage, 'page-1');

    const release = marks.begin(FORM);
    expect(storage.items.has(`${INFLIGHT_PREFIX}${FORM}`)).toBe(true);

    release();
    expect(storage.items.size).toBe(0);
  });

  it('своя идущая сборка паузой не считается', () => {
    const marks = createInflightMarks(() => memoryStorage(), 'page-1');
    marks.begin(FORM);

    expect(marks.stale(FORM)).toBe(false);
  });

  it('метка прошлой загрузки страницы — пауза; соседняя форма от неё не встаёт', () => {
    const storage = memoryStorage();
    // Прошлая загрузка начала сборку и зависла: снять метку ей было нечем.
    createInflightMarks(() => storage, 'hung-page').begin(FORM);

    const marks = createInflightMarks(() => storage, 'page-2');

    expect(marks.stale(FORM)).toBe(true);
    expect(marks.stale('fs:forms/other/schema/form.schema.json')).toBe(false);
  });

  it('«собрать снова» снимает чужую метку', () => {
    const storage = memoryStorage();
    createInflightMarks(() => storage, 'hung-page').begin(FORM);
    const marks = createInflightMarks(() => storage, 'page-2');

    marks.clear(FORM);

    expect(marks.stale(FORM)).toBe(false);
  });

  it('две сборки одной формы: завершение первой не снимает метку из-под второй', () => {
    const storage = memoryStorage();
    const marks = createInflightMarks(() => storage, 'page-1');

    const first = marks.begin(FORM);
    const second = marks.begin(FORM);
    first();
    // Вторая как раз могла повиснуть — метка обязана остаться.
    expect(storage.items.size).toBe(1);

    second();
    expect(storage.items.size).toBe(0);
  });

  it('повторное снятие ничего не делает: чужую сборку оно не снимет', () => {
    const storage = memoryStorage();
    const marks = createInflightMarks(() => storage, 'page-1');

    const first = marks.begin(FORM);
    first();
    marks.begin(FORM);
    first();

    expect(storage.items.size).toBe(1);
  });

  it('штатный уход со страницы снимает метки идущих сборок', () => {
    const storage = memoryStorage();
    const marks = createInflightMarks(() => storage, 'page-1');
    const release = marks.begin(FORM);
    marks.begin('fs:forms/other/schema/form.schema.json');

    marks.abandon();

    expect(storage.items.size).toBe(0);
    // Сборка, завершившаяся после ухода, ничего не ломает.
    expect(() => release()).not.toThrow();
  });

  it('испорченная запись — пауза: лишний вопрос дешевле повторного зависания', () => {
    const storage = memoryStorage();
    storage.setItem(`${INFLIGHT_PREFIX}${FORM}`, '{не json');

    expect(createInflightMarks(() => storage, 'page-1').stale(FORM)).toBe(true);
  });

  it('хранилище недоступно или бросает — защиты нет, но и сбоя нет', () => {
    const broken: MarkStorage = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
      removeItem: () => {
        throw new Error('SecurityError');
      },
    };
    for (const storage of [() => broken, () => null]) {
      const marks = createInflightMarks(storage, 'page-1');
      expect(() => marks.begin(FORM)()).not.toThrow();
      expect(marks.stale(FORM)).toBe(false);
      expect(() => marks.clear(FORM)).not.toThrow();
    }
    expect(() =>
      createInflightMarks(() => {
        throw new Error('доступ к localStorage запрещён');
      }, 'page-1').begin(FORM)()
    ).not.toThrow();
  });
});
