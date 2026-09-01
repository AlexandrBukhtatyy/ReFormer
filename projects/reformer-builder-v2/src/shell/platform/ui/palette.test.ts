import { describe, expect, it, vi } from 'vitest';

import type { CommandContribution } from '@/shell/platform/primitives/command';
import { whenContext } from '@/shell/platform/primitives/when-context';
import {
  commandPaletteItems,
  createPaletteQueryRunner,
  filterPaletteItems,
  matchRank,
  mergePaletteItems,
  queryTokens,
  resolvePaletteItem,
  type PaletteItem,
  type PaletteItemProvider,
  type ResolvedPaletteItem,
  type TimerHandle,
} from './palette';

/** Перевод теста — видимая подстановка: так сразу заметно, что пришло через словарь. */
const translate = (key: string): string => `«${key}»`;

function item(patch: Partial<ResolvedPaletteItem> & { id: string }): ResolvedPaletteItem {
  return { title: patch.id, order: 0, run: () => undefined, ...patch };
}

function command(patch: Partial<CommandContribution> & { id: string }): CommandContribution {
  return { titleKey: `${patch.id}.title`, run: () => undefined, ...patch };
}

describe('resolvePaletteItem', () => {
  it('переводит ключ', () => {
    const resolved = resolvePaletteItem({ id: 'a', titleKey: 'x.y', run: () => 1 }, translate);
    expect(resolved.title).toBe('«x.y»');
  });

  it('готовую строку не переводит — имена файлов не проходят через словарь', () => {
    const resolved = resolvePaletteItem({ id: 'a', title: 'form.json', run: () => 1 }, translate);
    expect(resolved.title).toBe('form.json');
  });

  it('готовая строка выигрывает у ключа', () => {
    // Указаны оба — значит вносящий не решил. Показать перевод значило бы показать не тот
    // текст, который он видел перед глазами, когда писал `title`.
    const resolved = resolvePaletteItem(
      { id: 'a', title: 'form.json', titleKey: 'x.y', run: () => 1 },
      translate
    );
    expect(resolved.title).toBe('form.json');
  });

  it('без заголовка показывает идентификатор, а не пустоту', () => {
    expect(resolvePaletteItem({ id: 'a.b', run: () => 1 }, translate).title).toBe('a.b');
  });
});

describe('commandPaletteItems', () => {
  const options = {
    translate,
    execute: vi.fn(),
    detail: (c: CommandContribution) => c.keybinding,
  };

  it('переводит titleKey и показывает подпись', () => {
    const items = commandPaletteItems(
      [command({ id: 'a.save', keybinding: 'mod+s' })],
      whenContext(),
      options
    );
    expect(items).toEqual([
      expect.objectContaining({ id: 'a.save', title: '«a.save.title»', detail: 'mod+s' }),
    ]);
  });

  it('неприменимые команды не показывает вовсе', () => {
    // Строка, которая находится, но не запускается, учит человека неверному: он запоминает,
    // что команда «не работает», а она просто неуместна сейчас.
    const items = commandPaletteItems(
      [
        command({ id: 'a.on', enabled: () => true }),
        command({ id: 'a.off', enabled: () => false }),
      ],
      whenContext(),
      options
    );
    expect(items.map((entry) => entry.id)).toEqual(['a.on']);
  });

  it('упавший предикат считается запретом и сообщается', () => {
    const onError = vi.fn();
    const boom = new Error('предикат сломан');
    const items = commandPaletteItems(
      [
        command({
          id: 'a.boom',
          enabled: () => {
            throw boom;
          },
        }),
      ],
      whenContext(),
      { ...options, onError }
    );
    expect(items).toEqual([]);
    expect(onError).toHaveBeenCalledWith(boom, 'a.boom');
  });

  it('запускает команду через реестр, а не её run', () => {
    // Общая дверь с ассистентом: то, что вызывается из палитры, он вызывает так же.
    const execute = vi.fn();
    const items = commandPaletteItems([command({ id: 'a.save' })], whenContext(), {
      ...options,
      execute,
    });
    items[0].run();
    expect(execute).toHaveBeenCalledWith('a.save');
  });
});

describe('mergePaletteItems', () => {
  it('при совпадении идентификаторов побеждает команда, а не поставщик', () => {
    const merged = mergePaletteItems(
      [item({ id: 'a.save', title: 'команда' })],
      [item({ id: 'a.save', title: 'подделка' }), item({ id: 'file', title: 'form.json' })]
    );
    expect(merged.map((entry) => entry.title)).toEqual(['команда', 'form.json']);
  });

  it('повтор внутри динамической части тоже схлопывается', () => {
    const merged = mergePaletteItems([], [item({ id: 'x' }), item({ id: 'x' })]);
    expect(merged).toHaveLength(1);
  });
});

describe('queryTokens', () => {
  it('делит запрос на слова и снимает регистр', () => {
    expect(queryTokens('  Сохранить  ВСЁ ')).toEqual(['сохранить', 'всё']);
    expect(queryTokens('   ')).toEqual([]);
  });
});

describe('matchRank', () => {
  const save = item({ id: 'a', title: 'Сохранить всё', detail: 'Ctrl+Shift+S' });

  it('пустой запрос совпадает со всем', () => {
    expect(matchRank(save, '')).toBe(0);
  });

  it('слова ищутся по «и», а не по «или»', () => {
    expect(matchRank(save, 'сохранить всё')).toBeGreaterThanOrEqual(0);
    expect(matchRank(save, 'сохранить проект')).toBe(-1);
  });

  it('порядок слов не важен', () => {
    expect(matchRank(save, 'всё сохранить')).toBeGreaterThanOrEqual(0);
  });

  it('совпадение в начале заголовка ценнее совпадения в середине и в подписи', () => {
    const middle = item({ id: 'b', title: 'Быстро сохранить' });
    const onlyDetail = item({ id: 'c', title: 'Экспорт', detail: 'сохранить на диск' });
    expect(matchRank(save, 'сохранить')).toBeLessThan(matchRank(middle, 'сохранить'));
    expect(matchRank(middle, 'сохранить')).toBeLessThan(matchRank(onlyDetail, 'сохранить'));
  });
});

describe('filterPaletteItems', () => {
  it('отбрасывает несовпавшее', () => {
    const items = [item({ id: 'a', title: 'Сохранить' }), item({ id: 'b', title: 'Закрыть' })];
    expect(filterPaletteItems(items, 'сохр').map((entry) => entry.id)).toEqual(['a']);
  });

  it('сначала разряд совпадения, потом order, потом алфавит', () => {
    const items = [
      item({ id: 'z', title: 'Ящик', order: 0 }),
      item({ id: 'a', title: 'Абажур', order: 0 }),
      item({ id: 'p', title: 'Первый', order: -10 }),
      item({ id: 'd', title: 'Ерунда', detail: 'абажур' }),
    ];
    // Пустой запрос: разряд у всех одинаков, значит решают order и алфавит.
    expect(filterPaletteItems(items, '', 'ru').map((entry) => entry.id)).toEqual([
      'p',
      'a',
      'd',
      'z',
    ]);
    // Запрос «абажур»: совпадение в заголовке обходит совпадение в подписи, несмотря
    // на равный order.
    expect(filterPaletteItems(items, 'абажур', 'ru').map((entry) => entry.id)).toEqual(['a', 'd']);
  });

  it('порядок устойчив: тот же вход даёт тот же выход', () => {
    const items = [item({ id: 'b', title: 'Одно' }), item({ id: 'a', title: 'Одно' })];
    expect(filterPaletteItems(items, '', 'ru').map((entry) => entry.id)).toEqual(
      filterPaletteItems(items, '', 'ru').map((entry) => entry.id)
    );
  });
});

/** Планировщик под управлением теста: настоящие таймеры стоили бы задержки каждый прогон. */
function fakeScheduler() {
  const queue = new Map<number, () => void>();
  let next = 1;
  return {
    schedule: (fn: () => void): TimerHandle => {
      const handle = next++;
      queue.set(handle, fn);
      return handle;
    },
    cancelScheduled: (handle: TimerHandle): void => {
      queue.delete(handle as number);
    },
    get pending(): number {
      return queue.size;
    },
    flush(): void {
      const scheduled = [...queue.values()];
      queue.clear();
      for (const fn of scheduled) fn();
    },
  };
}

/** Отдаёт микрозадачам возможность отработать: `Promise.all` внутри бегунка асинхронен. */
const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

function provider(id: string, items: readonly PaletteItem[]): PaletteItemProvider {
  return { id, provide: () => [...items] };
}

const FILE: PaletteItem = { id: 'file', title: 'form.json', run: () => undefined };

describe('createPaletteQueryRunner', () => {
  it('не обращается к поставщикам до истечения задержки', async () => {
    const timers = fakeScheduler();
    const provide = vi.fn(() => [FILE]);
    const deliver = vi.fn();
    const runner = createPaletteQueryRunner(deliver, {
      schedule: timers.schedule,
      cancelScheduled: timers.cancelScheduled,
    });

    runner.request([{ id: 'files', provide }], 'fo', whenContext());
    // Ввод символа не имеет права рождать обращение к источнику на каждое нажатие.
    expect(provide).not.toHaveBeenCalled();

    timers.flush();
    await settle();
    expect(provide).toHaveBeenCalledTimes(1);
    expect(deliver).toHaveBeenCalledWith([FILE]);
  });

  it('новый запрос отменяет запланированный', async () => {
    const timers = fakeScheduler();
    const provide = vi.fn(() => [FILE]);
    const runner = createPaletteQueryRunner(vi.fn(), {
      schedule: timers.schedule,
      cancelScheduled: timers.cancelScheduled,
    });

    runner.request([{ id: 'files', provide }], 'f', whenContext());
    runner.request([{ id: 'files', provide }], 'fo', whenContext());
    runner.request([{ id: 'files', provide }], 'for', whenContext());
    expect(timers.pending).toBe(1);

    timers.flush();
    await settle();
    expect(provide).toHaveBeenCalledTimes(1);
    expect(provide).toHaveBeenCalledWith('for', whenContext());
  });

  it('ответ на устаревший запрос не доставляется', async () => {
    const timers = fakeScheduler();
    const deliver = vi.fn();
    const runner = createPaletteQueryRunner(deliver, {
      schedule: timers.schedule,
      cancelScheduled: timers.cancelScheduled,
    });

    let release: (items: PaletteItem[]) => void = () => undefined;
    const slow: PaletteItemProvider = {
      id: 'slow',
      provide: () =>
        new Promise<PaletteItem[]>((resolve) => {
          release = resolve;
        }),
    };

    runner.request([slow], 'старый', whenContext());
    timers.flush();
    // Запрос ушёл к поставщику и ещё не вернулся — а палитру уже закрыли.
    runner.cancel();
    release([FILE]);
    await settle();
    expect(deliver).not.toHaveBeenCalled();
  });

  it('отказ одного поставщика не мешает остальным', async () => {
    const timers = fakeScheduler();
    const deliver = vi.fn();
    const onError = vi.fn();
    const boom = new Error('источник недоступен');
    const runner = createPaletteQueryRunner(deliver, {
      schedule: timers.schedule,
      cancelScheduled: timers.cancelScheduled,
      onError,
    });

    runner.request(
      [{ id: 'broken', provide: () => Promise.reject(boom) }, provider('files', [FILE])],
      '',
      whenContext()
    );
    timers.flush();
    await settle();

    expect(deliver).toHaveBeenCalledWith([FILE]);
    expect(onError).toHaveBeenCalledWith(boom, 'broken');
  });

  it('пустой набор поставщиков доставляется сразу и пустым', () => {
    const timers = fakeScheduler();
    const deliver = vi.fn();
    const runner = createPaletteQueryRunner(deliver, {
      schedule: timers.schedule,
      cancelScheduled: timers.cancelScheduled,
    });

    runner.request([], 'что угодно', whenContext());
    // Иначе закрытие палитры оставляло бы динамическую часть от прошлого открытия.
    expect(deliver).toHaveBeenCalledWith([]);
    expect(timers.pending).toBe(0);
  });

  it('dispose снимает запланированное', async () => {
    const timers = fakeScheduler();
    const provide = vi.fn(() => [FILE]);
    const runner = createPaletteQueryRunner(vi.fn(), {
      schedule: timers.schedule,
      cancelScheduled: timers.cancelScheduled,
    });

    runner.request([{ id: 'files', provide }], '', whenContext());
    runner.dispose();
    timers.flush();
    await settle();
    expect(provide).not.toHaveBeenCalled();
  });
});

describe('заголовок разрешается словарём владельца', () => {
  it('команде плагина ключ ищут в его пространстве имён, а не в словаре Host', () => {
    // Ровно тот промах, ради которого владелец и заводился: без него палитра показывала бы
    // маркер вроде ⟦editor-schema.command.delete⟧ на каждой команде плагина.
    const seen: Array<{ key: string; owner?: string }> = [];
    const items = commandPaletteItems(
      [
        {
          id: 'editor-schema.delete',
          titleKey: 'command.delete',
          pluginId: 'editor-schema',
          run: () => {},
        },
        { id: 'workspace.save', titleKey: 'shell.save', run: () => {} },
      ],
      whenContext(),
      {
        translate: (key, owner) => {
          seen.push({ key, owner: owner?.pluginId });
          return owner?.pluginId === undefined ? `host:${key}` : `${owner.pluginId}:${key}`;
        },
        execute: () => {},
      }
    );

    expect(seen).toEqual([
      { key: 'command.delete', owner: 'editor-schema' },
      { key: 'shell.save', owner: undefined },
    ]);
    expect(items.map((i) => i.title)).toEqual(['editor-schema:command.delete', 'host:shell.save']);
  });
});
