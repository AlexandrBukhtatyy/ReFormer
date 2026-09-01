import { describe, expect, it, vi } from 'vitest';

import { createMenuIssueReporter, formatMenuIssue } from './menu-issues';
import type { MenuIssue } from './menu';

/** Отложенная печать: тест держит очередь сам, чтобы не зависеть от таймеров. */
function reporter(options: { commands?: readonly string[] } = {}) {
  const log = vi.fn();
  const queue: (() => void)[] = [];
  const known = new Set(options.commands ?? []);
  const report = createMenuIssueReporter({
    hasCommand: (id) => known.has(id),
    log,
    schedule: (flush) => queue.push(flush),
  });
  return {
    report,
    log,
    known,
    flush: () => {
      for (const flush of queue.splice(0)) flush();
    },
    pendingFlushes: () => queue.length,
  };
}

const missing = (target: string, entryId = 'shell.view.palette'): MenuIssue => ({
  kind: 'unknown-command',
  entryId,
  target,
});

describe('отложенный отчёт о промахах меню', () => {
  it('до сброса очереди не печатает ничего: первый кадр — не повод для ошибки', () => {
    const { report, log } = reporter();

    report(missing('host.palette.open'));

    expect(log).not.toHaveBeenCalled();
  });

  it('команда, появившаяся до сброса, снимает сообщение', () => {
    const { report, log, known, flush } = reporter();

    report(missing('host.palette.open'));
    known.add('host.palette.open');
    flush();

    expect(log).not.toHaveBeenCalled();
  });

  it('команда, которой так и нет, сообщается', () => {
    const { report, log, flush } = reporter();

    report(missing('nobody.here'));
    flush();

    expect(log).toHaveBeenCalledWith(expect.objectContaining({ target: 'nobody.here' }));
  });

  it('повторы одного промаха на каждом кадре дают одно сообщение', () => {
    const { report, log, flush } = reporter();

    report(missing('nobody.here'));
    report(missing('nobody.here'));
    flush();
    report(missing('nobody.here'));
    flush();

    expect(log).toHaveBeenCalledTimes(1);
  });

  it('одна отложенная задача на пачку промахов, а не по одной на каждый', () => {
    const { report, pendingFlushes } = reporter();

    report(missing('a.one', 'entry.a'));
    report(missing('b.two', 'entry.b'));

    expect(pendingFlushes()).toBe(1);
  });

  it('промахи, не зависящие от времени, перепроверкой не отменяются', () => {
    const { report, log, flush } = reporter();

    report({ kind: 'cycle', entryId: 'plugin.loop', target: 'view' });
    flush();

    expect(log).toHaveBeenCalledWith(expect.objectContaining({ kind: 'cycle' }));
  });

  it('разные записи с одной и той же командой сообщаются по отдельности', () => {
    const { report, log, flush } = reporter();

    report(missing('nobody.here', 'entry.a'));
    report(missing('nobody.here', 'entry.b'));
    flush();

    expect(log).toHaveBeenCalledTimes(2);
  });
});

describe('formatMenuIssue', () => {
  it('называет владельца записи, вид промаха и то, на что она ссылалась', () => {
    expect(
      formatMenuIssue({ kind: 'unknown-command', entryId: 'x', pluginId: 'git', target: 'y' })
    ).toBe('[shell] запись меню «x» плагина «git» не показана: unknown-command → «y»');
  });

  it('запись без владельца принадлежит оболочке', () => {
    expect(formatMenuIssue({ kind: 'too-deep', entryId: 'x' })).toBe(
      '[shell] запись меню «x» оболочки не показана: too-deep'
    );
  });
});
