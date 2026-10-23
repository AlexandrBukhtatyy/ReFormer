/**
 * Панель журнала в настоящем браузере: переключатель видов, лента событий, очистка.
 *
 * Проверяется то, что без браузера невыразимо:
 *
 * - **переключатель кита.** Вид меняется щелчком по `ToggleGroup`, и щелчок по уже выбранному
 *   выбор не снимает — у журнала вид выбран всегда;
 * - **выбор переживает размонтирование.** Тело панели снимается, когда док свёрнут, и выбор,
 *   хранимый в нём, сбрасывался бы;
 * - **подробности за кнопкой в строке.** Раскрытие — не переход к ресурсу: это свойство
 *   всплытия события в настоящем DOM;
 * - **запись после монтирования.** Лента подписана на службу и показывает новую запись без
 *   внешней перерисовки.
 *
 * @module plugins/base/journal/ui/JournalPanel.browser.test
 */

import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import type {
  Disposable,
  LogEntry,
  LogEntryRequest,
  LogService,
  ResourceId,
} from '@reformer/builder-plugin-api';
import { renderReact } from '../../../../.shared/render';
import type { JournalHost } from '../host';
import { createJournalViewState, type JournalViewState } from '../view-state';
import { JournalPanel } from './JournalPanel';

const RESOURCE = 'fs:forms/credit/schema.json';

/**
 * Двойник службы журнала: вторая реализация контракта — цена границы слоёв, `plugins/**`
 * не видит `@/shell`. Снимок стабилен между изменениями, как требует контракт.
 */
function fakeLog(): LogService {
  let entries: readonly LogEntry[] = [];
  const observers = new Set<() => void>();
  let next = 0;
  const changed = () => {
    for (const cb of [...observers]) cb();
  };
  return {
    append(request: LogEntryRequest) {
      next += 1;
      const entry: LogEntry = {
        ...request,
        id: `l${String(next)}`,
        level: request.level ?? 'info',
        time: 0,
      };
      entries = [...entries, entry];
      changed();
      return entry;
    },
    entries: () => entries,
    clear() {
      entries = [];
      changed();
    },
    observe(cb): Disposable {
      observers.add(cb);
      return {
        dispose: () => {
          observers.delete(cb);
        },
      };
    },
  };
}

function fakeHost(opened: ResourceId[]): JournalHost {
  return {
    useTranslate: () => (key: string) => key,
    useHostMessage: () => (key: string, params?: Record<string, unknown>) =>
      key === 'acme:kit.failed' ? `Кит «${String(params?.name)}» не загрузился` : key,
    useFormatTime: () => () => '14:02:11',
    openResource: (id) => {
      opened.push(id);
    },
    nameOf: () => null,
  };
}

async function mount(options: { log?: LogService; view?: JournalViewState } = {}) {
  const log = options.log ?? fakeLog();
  const view = options.view ?? createJournalViewState();
  const opened: ResourceId[] = [];
  const rendered = renderReact(
    <div style={{ width: 640, height: 260, display: 'flex', flexDirection: 'column' }}>
      <JournalPanel host={fakeHost(opened)} diagnostics={null} log={log} view={view} />
    </div>
  );
  // Отрисовка асинхронна: до первого кадра переключателя в документе ещё нет.
  await vi.waitFor(() => {
    if (document.querySelector('[data-slot="toggle-group"]') === null) {
      throw new Error('панель ещё не отрисована');
    }
  });
  return { log, view, opened, unmount: rendered.unmount };
}

function toggle(name: string): HTMLElement {
  const item = [...document.querySelectorAll<HTMLElement>('[data-slot="toggle-group-item"]')].find(
    (element) => element.textContent?.startsWith(name)
  );
  if (item === undefined) throw new Error(`нет пункта переключателя «${name}»`);
  return item;
}

function button(text: string): HTMLButtonElement | undefined {
  return [...document.querySelectorAll<HTMLButtonElement>('button')].find(
    (element) => element.textContent === text
  );
}

const rows = () => document.querySelectorAll<HTMLElement>('[data-level]');

describe('переключатель видов', () => {
  it('по умолчанию — «Проблемы»; «События» показывают ленту, повторный щелчок выбор не снимает', async () => {
    const fixture = await mount();
    await expect.poll(() => toggle('view.problems').getAttribute('data-state')).toBe('on');
    expect(document.body.textContent).toContain('problems.empty.title');

    await userEvent.click(toggle('view.events'));
    await expect.poll(() => document.body.textContent).toContain('events.empty.title');

    await userEvent.click(toggle('view.events'));
    expect(fixture.view.get()).toBe('events');
    expect(toggle('view.events').getAttribute('data-state')).toBe('on');
    fixture.unmount();
  });

  it('выбор вида переживает размонтирование тела', async () => {
    const view = createJournalViewState();
    const first = await mount({ view });
    await userEvent.click(toggle('view.events'));
    first.unmount();

    const second = await mount({ view });
    await expect.poll(() => toggle('view.events').getAttribute('data-state')).toBe('on');
    second.unmount();
  });
});

describe('лента событий', () => {
  it('запись после монтирования появляется сама: время, источник и переведённое сообщение', async () => {
    const fixture = await mount({ view: createJournalViewState('events') });
    await expect.poll(() => document.body.textContent).toContain('events.empty.title');

    fixture.log.append({
      level: 'error',
      source: 'acme',
      messageKey: 'acme:kit.failed',
      params: { name: 'ui-kit' },
    });

    await expect.poll(() => rows().length).toBe(1);
    const row = rows()[0]!;
    expect(row.textContent).toContain('Кит «ui-kit» не загрузился');
    expect(row.textContent).toContain('14:02:11');
    expect(row.textContent).toContain('acme');
    // Счётчик на переключателе — число записей.
    expect(toggle('view.events').textContent).toContain('1');
    fixture.unmount();
  });

  it('новые — сверху', async () => {
    const log = fakeLog();
    log.append({ source: 'acme', messageKey: 'first' });
    log.append({ source: 'acme', messageKey: 'second' });
    const fixture = await mount({ log, view: createJournalViewState('events') });

    await expect.poll(() => rows().length).toBe(2);
    expect(rows()[0]?.textContent).toContain('second');
    fixture.unmount();
  });

  it('подробности свёрнуты и раскрываются кнопкой, не уводя к ресурсу', async () => {
    const log = fakeLog();
    log.append({
      level: 'error',
      source: 'acme',
      messageKey: 'acme:kit.failed',
      detail: 'TypeError: x is undefined',
      resource: RESOURCE,
    });
    const fixture = await mount({ log, view: createJournalViewState('events') });
    await expect.poll(() => rows().length).toBe(1);
    expect(document.querySelector('[data-detail]')).toBeNull();

    await userEvent.click(button('events.detail.show')!);

    await expect
      .poll(() => document.querySelector('[data-detail]')?.textContent)
      .toBe('TypeError: x is undefined');
    expect(fixture.opened).toEqual([]);
    fixture.unmount();
  });

  it('щелчок по строке с ресурсом открывает его', async () => {
    const log = fakeLog();
    log.append({ source: 'acme', messageKey: 'acme:kit.failed', resource: RESOURCE });
    const fixture = await mount({ log, view: createJournalViewState('events') });
    await expect.poll(() => rows().length).toBe(1);

    await userEvent.click(rows()[0]!);

    await expect.poll(() => fixture.opened).toEqual([RESOURCE]);
    fixture.unmount();
  });

  it('«Очистить» есть только в «Событиях», недоступна у пустого журнала и опустошает ленту', async () => {
    const log = fakeLog();
    const fixture = await mount({ log });
    expect(button('events.clear')).toBeUndefined();

    await userEvent.click(toggle('view.events'));
    await expect.poll(() => button('events.clear')?.disabled).toBe(true);

    log.append({ source: 'acme', messageKey: 'one' });
    await expect.poll(() => button('events.clear')?.disabled).toBe(false);

    await userEvent.click(button('events.clear')!);
    await expect.poll(() => rows().length).toBe(0);
    expect(log.entries()).toEqual([]);
    fixture.unmount();
  });

  it('без службы журнала лента пуста, а очистка недоступна', async () => {
    const opened: ResourceId[] = [];
    const rendered = renderReact(
      <div style={{ width: 640, height: 260, display: 'flex', flexDirection: 'column' }}>
        <JournalPanel
          host={fakeHost(opened)}
          diagnostics={null}
          log={null}
          view={createJournalViewState('events')}
        />
      </div>
    );
    try {
      await vi.waitFor(() => {
        expect(document.body.textContent).toContain('events.empty.title');
      });
      expect(button('events.clear')?.disabled).toBe(true);
    } finally {
      rendered.unmount();
    }
  });
});
