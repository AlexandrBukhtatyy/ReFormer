import { describe, expect, it, vi } from 'vitest';

import { makeResourceId, type ResourceId } from '../../primitives/resource';
import {
  attachFocusChecks,
  classifyDivergence,
  createDivergenceWatch,
  NO_DIVERGENCE,
  type DivergenceWorkspace,
  type EventTargetLike,
  type ExternalCheck,
} from './divergence';

const rid = (path: string): ResourceId => makeResourceId('mem', path);

/** Рабочая область в объёме наблюдения: отвечает заготовленным списком и считает обращения. */
function fakeWorkspace(answers: readonly ExternalCheck[][]): DivergenceWorkspace & {
  readonly asked: (readonly ResourceId[] | undefined)[];
} {
  const asked: (readonly ResourceId[] | undefined)[] = [];
  let turn = 0;
  return {
    asked,
    checkSource(ids) {
      asked.push(ids);
      const answer = answers[Math.min(turn, answers.length - 1)] ?? [];
      turn += 1;
      return Promise.resolve(answer);
    },
  };
}

/** Двойник `window`/`document`: окружение тестов — `node`, настоящего события взять негде. */
function fakeTarget(): EventTargetLike & { fire(type: string): void; readonly count: number } {
  const listeners = new Map<string, Set<() => void>>();
  let count = 0;
  return {
    get count() {
      return count;
    },
    addEventListener(type, listener) {
      count += 1;
      (listeners.get(type) ?? listeners.set(type, new Set()).get(type)!).add(listener);
    },
    removeEventListener(type, listener) {
      count -= 1;
      listeners.get(type)?.delete(listener);
    },
    fire(type) {
      for (const listener of [...(listeners.get(type) ?? [])]) listener();
    },
  };
}

describe('сравнение с источником', () => {
  it('равные ревизии — совпадение; разные — расхождение', () => {
    expect(classifyDivergence({ expected: 'r1', actual: 'r1', hasBase: true, present: true })).toBe(
      'same'
    );
    expect(classifyDivergence({ expected: 'r1', actual: 'r2', hasBase: true, present: true })).toBe(
      'diverged'
    );
  });

  it('сравнение только на равенство: откат источника назад — тоже расхождение', () => {
    // Ревизия непрозрачна, «новее» на ней не вычисляется. Здесь это видно: r2 → r1.
    expect(classifyDivergence({ expected: 'r2', actual: 'r1', hasBase: true, present: true })).toBe(
      'diverged'
    );
  });

  it('источник без ревизий отвечает «неизвестно», а не «совпало»', () => {
    expect(
      classifyDivergence({ expected: undefined, actual: undefined, hasBase: true, present: true })
    ).toBe('unknown');
    expect(
      classifyDivergence({ expected: 'r1', actual: undefined, hasBase: true, present: true })
    ).toBe('unknown');
  });

  it('файл исчез из источника — отдельный ответ, не расхождение ревизий', () => {
    expect(
      classifyDivergence({ expected: 'r1', actual: undefined, hasBase: true, present: false })
    ).toBe('gone');
  });

  it('локально созданного файла в источнике нет — так и должно быть', () => {
    expect(classifyDivergence({ hasBase: false, present: false })).toBe('same');
  });

  it('у локально созданного файла появился тёзка в источнике — расхождение', () => {
    // Ревизий сравнивать нечего, но сохранение затрёт чужой файл целиком.
    expect(classifyDivergence({ hasBase: false, present: true, actual: 'r7' })).toBe('diverged');
  });
});

describe('наблюдение за расхождениями', () => {
  it('до первой проверки расхождений нет, и снимок — общий пустой', () => {
    const watch = createDivergenceWatch({ workspace: fakeWorkspace([]) });
    expect(watch.get()).toBe(NO_DIVERGENCE);
  });

  it('проверка запоминает расхождения и не запоминает совпадения', async () => {
    const watch = createDivergenceWatch({
      workspace: fakeWorkspace([
        [
          { id: rid('a.ts'), status: 'diverged', expected: 'r1', actual: 'r2' },
          { id: rid('b.ts'), status: 'same', expected: 'r1', actual: 'r1' },
          { id: rid('c.ts'), status: 'unknown' },
        ],
      ]),
      now: () => 100,
    });

    const state = await watch.check('focus');
    expect(state.count).toBe(1);
    expect(state.records[0]).toEqual({
      id: rid('a.ts'),
      status: 'diverged',
      expected: 'r1',
      actual: 'r2',
      reason: 'focus',
      at: 100,
    });
    expect(watch.recordOf(rid('b.ts'))).toBeNull();
  });

  it('исчезнувший файл — тоже расхождение, но со своим видом', async () => {
    const watch = createDivergenceWatch({
      workspace: fakeWorkspace([[{ id: rid('a.ts'), status: 'gone', expected: 'r1' }]]),
    });
    await watch.check('command');
    expect(watch.recordOf(rid('a.ts'))?.status).toBe('gone');
  });

  it('совпадение снимает прежнее расхождение', async () => {
    const watch = createDivergenceWatch({
      workspace: fakeWorkspace([
        [{ id: rid('a.ts'), status: 'diverged', expected: 'r1', actual: 'r2' }],
        [{ id: rid('a.ts'), status: 'same', expected: 'r2', actual: 'r2' }],
      ]),
    });
    await watch.check('focus');
    expect(watch.get().count).toBe(1);
    await watch.check('focus');
    expect(watch.get().count).toBe(0);
  });

  it('ссылка на снимок не меняется, пока не изменилось содержимое', async () => {
    const watch = createDivergenceWatch({
      workspace: fakeWorkspace([
        [{ id: rid('a.ts'), status: 'diverged', expected: 'r1', actual: 'r2' }],
      ]),
      // Часы идут, но `at` в сравнение снимков не входит — иначе `useSyncExternalStore`
      // перерисовывал бы дерево на каждой проверке.
      now: vi.fn(() => Math.random()),
    });
    const listener = vi.fn();
    watch.subscribe(listener);

    await watch.check('focus');
    const first = watch.get();
    await watch.check('reopen');
    expect(watch.get()).toBe(first);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('подметания без списка схлопываются: два фокуса подряд — один обход', async () => {
    const workspace = fakeWorkspace([[]]);
    const watch = createDivergenceWatch({ workspace });
    const both = Promise.all([watch.check('focus'), watch.check('focus')]);
    await both;
    expect(workspace.asked).toHaveLength(1);
  });

  it('проверка по списку не схлопывается с подметанием: спрашивают про другое', async () => {
    const workspace = fakeWorkspace([[]]);
    const watch = createDivergenceWatch({ workspace });
    await Promise.all([watch.check('focus'), watch.check('save', [rid('a.ts')])]);
    expect(workspace.asked).toEqual([undefined, [rid('a.ts')]]);
  });

  it('после завершения подметания следующее идёт заново', async () => {
    const workspace = fakeWorkspace([[]]);
    const watch = createDivergenceWatch({ workspace });
    await watch.check('focus');
    await watch.check('focus');
    expect(workspace.asked).toHaveLength(2);
  });

  it('отказы-конфликты сохранения заносятся без похода в источник', () => {
    const workspace = fakeWorkspace([]);
    const watch = createDivergenceWatch({ workspace, now: () => 5 });
    watch.noteConflicts([{ id: rid('a.ts'), expected: 'r1', actual: 'r9' }]);
    expect(workspace.asked).toHaveLength(0);
    expect(watch.recordOf(rid('a.ts'))).toEqual({
      id: rid('a.ts'),
      status: 'diverged',
      expected: 'r1',
      actual: 'r9',
      reason: 'save',
      at: 5,
    });
  });

  it('разрешённое расхождение снимается', () => {
    const watch = createDivergenceWatch({ workspace: fakeWorkspace([]) });
    watch.noteConflicts([{ id: rid('a.ts'), actual: 'r9' }]);
    const listener = vi.fn();
    watch.subscribe(listener);
    watch.resolve(rid('a.ts'));
    expect(watch.get().count).toBe(0);
    expect(listener).toHaveBeenCalledTimes(1);
    // Снимать нечего — подписчиков не тревожим.
    watch.resolve(rid('a.ts'));
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('отказ проверки не рушит наблюдение и уходит наружу', async () => {
    const onError = vi.fn();
    const watch = createDivergenceWatch({
      workspace: {
        checkSource: () => Promise.reject(new Error('нет доступа к папке')),
      },
      onError,
    });
    await expect(watch.check('focus')).resolves.toBe(NO_DIVERGENCE);
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('падение подписчика не мешает остальным', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const watch = createDivergenceWatch({
      workspace: fakeWorkspace([[{ id: rid('a.ts'), status: 'diverged', actual: 'r2' }]]),
    });
    const second = vi.fn();
    watch.subscribe(() => {
      throw new Error('упал');
    });
    watch.subscribe(second);
    await watch.check('focus');
    expect(second).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});

describe('проверка при возврате фокуса', () => {
  it('фокус окна и возврат вкладки ведут в одну проверку', () => {
    const watch = { check: vi.fn(() => Promise.resolve(NO_DIVERGENCE)) };
    const win = fakeTarget();
    const doc = Object.assign(fakeTarget(), { visibilityState: 'visible' });
    let clock = 0;
    attachFocusChecks(watch, { window: win, document: doc, now: () => (clock += 10_000) });

    win.fire('focus');
    doc.fire('visibilitychange');
    expect(watch.check).toHaveBeenCalledTimes(2);
    expect(watch.check).toHaveBeenLastCalledWith('focus');
  });

  it('уход со вкладки проверки не вызывает: смотреть на файлы некому', () => {
    const watch = { check: vi.fn(() => Promise.resolve(NO_DIVERGENCE)) };
    const win = fakeTarget();
    const doc = Object.assign(fakeTarget(), { visibilityState: 'hidden' });
    attachFocusChecks(watch, { window: win, document: doc });
    doc.fire('visibilitychange');
    expect(watch.check).not.toHaveBeenCalled();
  });

  it('частые события не дают обходов чаще, чем раз в интервал', () => {
    const watch = { check: vi.fn(() => Promise.resolve(NO_DIVERGENCE)) };
    const win = fakeTarget();
    let clock = 0;
    attachFocusChecks(watch, { window: win, minIntervalMs: 1000, now: () => clock });

    win.fire('focus');
    clock = 500;
    win.fire('focus');
    expect(watch.check).toHaveBeenCalledTimes(1);
    clock = 1600;
    win.fire('focus');
    expect(watch.check).toHaveBeenCalledTimes(2);
  });

  it('снятие подписки отписывает от обоих источников событий', () => {
    const watch = { check: vi.fn(() => Promise.resolve(NO_DIVERGENCE)) };
    const win = fakeTarget();
    const doc = Object.assign(fakeTarget(), { visibilityState: 'visible' });
    const subscription = attachFocusChecks(watch, { window: win, document: doc });
    expect(win.count + doc.count).toBe(2);
    subscription.dispose();
    expect(win.count + doc.count).toBe(0);
    win.fire('focus');
    expect(watch.check).not.toHaveBeenCalled();
  });
});
