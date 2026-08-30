/**
 * Состояние превью: стабильность снимка, замещение находок по источнику, выбор поверхности.
 *
 * @module plugins/preview/store.test
 */

import { describe, expect, it } from 'vitest';
import { createPreviewStore } from './store';

describe('createPreviewStore', () => {
  it('снимок стабилен по ссылке, пока ничего не менялось', () => {
    const store = createPreviewStore();
    expect(store.get()).toBe(store.get());
  });

  it('повторный выбор того же узла подписчиков не будит', () => {
    const store = createPreviewStore();
    let calls = 0;
    store.subscribe(() => {
      calls += 1;
    });
    store.select(['a1b2c3d4']);
    store.select(['a1b2c3d4']);
    // Совпадающее по содержимому значение не уведомляет — это оно гасит эхо между
    // отражающими друг друга сторонами канала выделения.
    expect(calls).toBe(1);
  });

  it('введённые значения лежат вне снимка: на них никто не подписан', () => {
    const store = createPreviewStore();
    const before = store.get();
    let calls = 0;
    store.subscribe(() => {
      calls += 1;
    });
    store.keepValues({ loanType: 'ипотека' });
    // Значения читает только сборка формы, и перерисовывать из-за них некого.
    expect(store.values()).toEqual({ loanType: 'ипотека' });
    expect(store.get()).toBe(before);
    expect(calls).toBe(0);
  });

  it('находки источника ЗАМЕЩАЮТСЯ, а не копятся', () => {
    const store = createPreviewStore();
    store.report('a', [{ file: 'x.ts', phase: 'evaluate', message: 'первая' }]);
    store.report('a', [{ file: 'x.ts', phase: 'evaluate', message: 'вторая' }]);
    expect(store.get().problems).toEqual([{ file: 'x.ts', phase: 'evaluate', message: 'вторая' }]);
  });

  it('пустой список снимает прошлые находки источника', () => {
    const store = createPreviewStore();
    store.report('a', [{ file: 'x.ts', phase: 'evaluate', message: 'первая' }]);
    store.report('a', []);
    expect(store.get().problems).toEqual([]);
  });

  it('находки разных источников живут рядом', () => {
    const store = createPreviewStore();
    store.report('a', [{ file: 'a.ts', phase: 'evaluate', message: 'a' }]);
    store.report('b', [{ file: 'b.ts', phase: 'transpile', message: 'b' }]);
    expect(store.get().problems).toHaveLength(2);
  });

  it('те же находки по содержимому снимок не меняют: пересборка не должна перерисовывать панель', () => {
    const store = createPreviewStore();
    store.report('a', [{ file: 'x.ts', phase: 'evaluate', message: 'одна' }]);
    const snapshot = store.get();
    store.report('a', [{ file: 'x.ts', phase: 'evaluate', message: 'одна' }]);
    expect(store.get()).toBe(snapshot);
  });

  it('одинаковое выделение снимок не меняет', () => {
    const store = createPreviewStore();
    store.select(['a1b2c3d4']);
    const snapshot = store.get();
    store.select(['a1b2c3d4']);
    expect(store.get()).toBe(snapshot);
  });
});
