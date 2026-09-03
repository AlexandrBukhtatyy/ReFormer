/**
 * Наблюдатель dev-плагинов: оба триггера, коалесценция, границы.
 *
 * Правка «во внешнем IDE» имитируется `MemorySource.put()` — правкой мимо контракта,
 * ровно для этого у двойника и заведённой. Возврат фокуса — фейковое окно, время — счётчик:
 * троттлинг проверяется сдвигом счётчика, а не ожиданием настоящей секунды.
 *
 * @module shell/platform/plugin/dev-watch.test
 */

import { describe, expect, it } from 'vitest';
import { createEventBus } from '@/shell/platform/primitives/event';
import { makeResourceId } from '@/shell/platform/primitives/resource';
import { toDisposable, type Disposable } from '@/shell/platform/primitives/disposable';
import { createMemorySource, type MemorySource } from '@/shell/platform/source/memory';
import type { Source } from '@/shell/platform/source/types';
import { WorkspaceDidChange } from '@/shell/platform/workspace/workspace';
import type { ProjectPluginEntry, ProjectPluginState } from './catalog';
import { createPluginDevWatch } from './dev-watch';

const SOURCE_ID = 'memory';

function entry(id: string, state: ProjectPluginState, dev: boolean): ProjectPluginEntry {
  return { id, name: id, state, dev };
}

/** Каталог-двойник: список подставляется тестом, вызовы записываются. */
function createFakeCatalog(initial: readonly ProjectPluginEntry[]) {
  let entries = [...initial];
  const listeners = new Set<() => void>();
  const calls: string[] = [];
  /** Приостановка перезагрузки: тест решает, когда она «закончилась». */
  let gate: Promise<void> | null = null;
  return {
    calls,
    set(next: readonly ProjectPluginEntry[]): void {
      entries = [...next];
      for (const listener of [...listeners]) listener();
    },
    hold(): () => void {
      let release: () => void = () => undefined;
      gate = new Promise((resolve) => {
        release = resolve;
      });
      return release;
    },
    catalog: {
      list: (): readonly ProjectPluginEntry[] => entries,
      subscribe(listener: () => void): Disposable {
        listeners.add(listener);
        return toDisposable(() => listeners.delete(listener));
      },
      async reload(id: string): Promise<boolean> {
        calls.push(`reload:${id}`);
        if (gate !== null) await gate;
        return true;
      },
      async enable(id: string): Promise<boolean> {
        calls.push(`enable:${id}`);
        if (gate !== null) await gate;
        return true;
      },
    },
  };
}

function createFakeTarget() {
  const listeners = new Map<string, Set<() => void>>();
  return {
    addEventListener(type: string, listener: () => void): void {
      let set = listeners.get(type);
      if (set === undefined) listeners.set(type, (set = new Set()));
      set.add(listener);
    },
    removeEventListener(type: string, listener: () => void): void {
      listeners.get(type)?.delete(listener);
    },
    fire(type: string): void {
      for (const listener of [...(listeners.get(type) ?? [])]) listener();
    },
  };
}

/** Ждёт условия. Двойник источника отвечает с настоящей задержкой — без ожидания никак. */
async function until(condition: () => boolean, what: string): Promise<void> {
  const deadline = Date.now() + 2000;
  while (!condition()) {
    if (Date.now() > deadline) throw new Error(`не дождались: ${what}`);
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

/** Пауза, за которую НЕзаказанное действие успело бы проявиться. */
const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 150));

/**
 * Дождаться ПОЛНОГО снимка базы плагина: stat его последнего по сортировке файла.
 * Ждать первого недостаточно — правка между первым и последним попала бы в базу,
 * и сравнивать стало бы не с чем.
 */
const baselineOf = (memory: MemorySource, pluginId: string): Promise<void> =>
  until(
    () =>
      memory.calls.some(
        (call) =>
          call.op === 'stat' && call.path === `.ui_builder/plugins/${pluginId}/manifest.json`
      ),
    `база ${pluginId}`
  );

const FILES = {
  '.ui_builder/plugins/demo/manifest.json': '{"id":"demo"}',
  '.ui_builder/plugins/demo/main.ts': 'export default 1;',
  '.ui_builder/plugins/other/manifest.json': '{"id":"other"}',
  '.ui_builder/plugins/other/main.ts': 'export default 2;',
};

interface Rig {
  memory: MemorySource;
  fake: ReturnType<typeof createFakeCatalog>;
  win: ReturnType<typeof createFakeTarget>;
  events: ReturnType<typeof createEventBus>;
  clock: { at: number };
  focus(): void;
  watch: Disposable;
}

function createRig(
  initial: readonly ProjectPluginEntry[],
  options: { source?: () => Source | null } = {}
): Rig {
  const memory = createMemorySource(FILES);
  const fake = createFakeCatalog(initial);
  const win = createFakeTarget();
  const events = createEventBus();
  const clock = { at: 0 };
  const watch = createPluginDevWatch({
    catalog: fake.catalog,
    source: options.source ?? ((): Source | null => memory),
    events,
    window: win,
    now: () => clock.at,
  });
  return {
    memory,
    fake,
    win,
    events,
    clock,
    watch,
    focus(): void {
      clock.at += 10_000;
      win.fire('focus');
    },
  };
}

const savedChange = (path: string) => ({
  changes: [{ id: makeResourceId(SOURCE_ID, path), type: 'saved' as const }],
});

describe('возврат фокуса', () => {
  it('изменившийся файл dev-плагина перезагружает его, неизменившийся — нет', async () => {
    const rig = createRig([entry('demo', 'enabled', true)]);
    // База снимается при создании; дождаться её — увидеть stat в журнале обращений.
    await baselineOf(rig.memory, 'demo');

    rig.focus();
    await settle();
    expect(rig.fake.calls).toEqual([]);

    rig.memory.put('.ui_builder/plugins/demo/main.ts', 'export default 3;');
    rig.focus();
    await until(() => rig.fake.calls.includes('reload:demo'), 'перезагрузка demo');

    // Снимок обновлён самой перезагрузкой: тот же фокус больше ничего не поднимает.
    await settle();
    rig.focus();
    await settle();
    expect(rig.fake.calls).toEqual(['reload:demo']);
    rig.watch.dispose();
  });

  it('плагин без пометки dev не наблюдается, выключенный человеком — тоже', async () => {
    const rig = createRig([entry('demo', 'enabled', false), entry('other', 'disabled', true)]);
    await settle();
    rig.memory.put('.ui_builder/plugins/demo/main.ts', 'x');
    rig.memory.put('.ui_builder/plugins/other/main.ts', 'y');
    rig.focus();
    await settle();
    expect(rig.fake.calls).toEqual([]);
    rig.watch.dispose();
  });

  it('упавший dev-плагин после правки поднимается через enable, а не reload', async () => {
    const rig = createRig([entry('demo', 'failed', true)]);
    await baselineOf(rig.memory, 'demo');
    rig.memory.put('.ui_builder/plugins/demo/main.ts', 'исправлено');
    rig.focus();
    await until(() => rig.fake.calls.includes('enable:demo'), 'подъём demo');
    expect(rig.fake.calls).not.toContain('reload:demo');
    rig.watch.dispose();
  });

  it('троттлинг: второй фокус в ту же секунду не проверяет заново', async () => {
    const rig = createRig([entry('demo', 'enabled', true)]);
    await baselineOf(rig.memory, 'demo');
    rig.focus();
    await settle();
    const listsAfterFirst = rig.memory.calls.filter((call) => call.op === 'list').length;
    rig.clock.at += 100; // меньше интервала
    rig.win.fire('focus');
    await settle();
    expect(rig.memory.calls.filter((call) => call.op === 'list').length).toBe(listsAfterFirst);
    rig.watch.dispose();
  });

  it('смена источника не перезагружает: первый обход нового проекта только снимает базу', async () => {
    const memoryB = createMemorySource(FILES, { id: SOURCE_ID });
    let active: Source | null = null;
    const rig = createRig([entry('demo', 'enabled', true)], { source: () => active });
    active = rig.memory;
    // База снята у источника A.
    rig.fake.set([entry('demo', 'enabled', true)]);
    await baselineOf(rig.memory, 'demo');

    active = memoryB;
    rig.focus();
    await settle();
    expect(rig.fake.calls).toEqual([]);

    memoryB.put('.ui_builder/plugins/demo/main.ts', 'изменение в B');
    rig.focus();
    await until(() => rig.fake.calls.includes('reload:demo'), 'перезагрузка после базы B');
    rig.watch.dispose();
  });
});

describe('сохранение из встроенного редактора', () => {
  it('saved под каталогом dev-плагина перезагружает его; чужие и черновые — нет', async () => {
    const rig = createRig([entry('demo', 'enabled', true), entry('other', 'enabled', false)]);
    await settle();

    rig.events.emit(WorkspaceDidChange, {
      changes: [
        { id: makeResourceId(SOURCE_ID, 'src/form.json'), type: 'saved' },
        { id: makeResourceId(SOURCE_ID, '.ui_builder/plugins/other/main.ts'), type: 'saved' },
        { id: makeResourceId(SOURCE_ID, '.ui_builder/plugins/demo/main.ts'), type: 'written' },
      ],
    });
    await settle();
    expect(rig.fake.calls).toEqual([]);

    rig.events.emit(WorkspaceDidChange, savedChange('.ui_builder/plugins/demo/main.ts'));
    await until(() => rig.fake.calls.includes('reload:demo'), 'перезагрузка по сохранению');
    rig.watch.dispose();
  });

  it('поводы во время перезагрузки схлопываются в один повторный заход', async () => {
    const rig = createRig([entry('demo', 'enabled', true)]);
    await settle();
    const release = rig.fake.hold();

    rig.events.emit(WorkspaceDidChange, savedChange('.ui_builder/plugins/demo/main.ts'));
    await until(() => rig.fake.calls.length === 1, 'первая перезагрузка началась');
    // Ещё два повода, пока первая в полёте.
    rig.events.emit(WorkspaceDidChange, savedChange('.ui_builder/plugins/demo/main.ts'));
    rig.events.emit(WorkspaceDidChange, savedChange('.ui_builder/plugins/demo/manifest.json'));
    await settle();
    expect(rig.fake.calls).toEqual(['reload:demo']);

    release();
    await until(() => rig.fake.calls.length === 2, 'один повторный заход');
    await settle();
    expect(rig.fake.calls).toEqual(['reload:demo', 'reload:demo']);
    rig.watch.dispose();
  });

  it('после dispose ни один триггер не работает', async () => {
    const rig = createRig([entry('demo', 'enabled', true)]);
    await settle();
    rig.watch.dispose();

    rig.memory.put('.ui_builder/plugins/demo/main.ts', 'после dispose');
    rig.focus();
    rig.events.emit(WorkspaceDidChange, savedChange('.ui_builder/plugins/demo/main.ts'));
    await settle();
    expect(rig.fake.calls).toEqual([]);
  });
});
