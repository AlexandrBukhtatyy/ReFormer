/**
 * Диспетчер воркеров: стратегия запуска — ленивость, аренды, сон, потолок, падения.
 *
 * Часы ручные, сессии — двойники: проверяется порядок открытий и закрытий, а не воркеры.
 *
 * @module plugins/forms/mcp/connection/supervisor.test
 */

import { describe, expect, it } from 'vitest';
import { createFakeClock } from '../testing';
import { createSupervisor, SupervisorError, type Session, type SessionTarget } from './supervisor';

interface Probe {
  readonly opened: string[];
  readonly closed: string[];
  readonly lost: Map<string, (error: Error) => void>;
}

function setup(
  policy: Parameters<typeof createSupervisor>[0]['policy'] = {},
  failing = new Set<string>()
) {
  const clock = createFakeClock();
  const probe: Probe = { opened: [], closed: [], lost: new Map() };
  const supervisor = createSupervisor<Session>({
    policy: {
      maxLive: 2,
      defaultIdleSeconds: 60,
      restartBackoffMs: 10_000,
      maxCrashes: 3,
      ...policy,
    },
    clock,
    open: async (target, lost) => {
      if (failing.has(target.name)) throw new Error(`${target.name} refused`);
      probe.opened.push(target.name);
      probe.lost.set(target.name, lost);
      return {
        close: async () => {
          probe.closed.push(target.name);
        },
      };
    },
  });
  return { supervisor, clock, probe };
}

const worker = (name: string, idleSeconds?: number): SessionTarget => ({
  name,
  kind: 'worker',
  ...(idleSeconds === undefined ? {} : { idleSeconds }),
});

/** Дать отработать микрозадачам: закрытие идёт `void`-промисом. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('ленивый запуск и аренда', () => {
  it('до первой аренды ничего не открыто', () => {
    const { supervisor, probe } = setup();
    expect(supervisor.status('a').phase).toBe('idle');
    expect(probe.opened).toEqual([]);
    expect(supervisor.liveWorkers()).toBe(0);
  });

  it('повторная аренда — та же сессия, параллельные ждут одного открытия', async () => {
    const { supervisor, probe } = setup();
    const [first, second] = await Promise.all([
      supervisor.acquire(worker('a')),
      supervisor.acquire(worker('a')),
    ]);
    expect(first.session).toBe(second.session);
    expect(probe.opened).toEqual(['a']);
    first.release();
    second.release();
  });
});

describe('сон по простою', () => {
  it('после последней аренды — сон через умолчание, затем снова открытие', async () => {
    const { supervisor, clock, probe } = setup();
    const lease = await supervisor.acquire(worker('a'));
    lease.release();
    clock.advance(59_000);
    expect(supervisor.status('a').phase).toBe('running');
    clock.advance(1_000);
    await settle();
    expect(supervisor.status('a').phase).toBe('asleep');
    expect(probe.closed).toEqual(['a']);

    (await supervisor.acquire(worker('a'))).release();
    expect(probe.opened).toEqual(['a', 'a']);
  });

  it('idleSeconds сервера сильнее умолчания; 0 — сон сразу после вызова', async () => {
    const { supervisor, clock, probe } = setup();
    (await supervisor.acquire(worker('slow', 600))).release();
    clock.advance(60_000);
    expect(supervisor.status('slow').phase).toBe('running');

    (await supervisor.acquire(worker('light', 0))).release();
    await settle();
    expect(supervisor.status('light').phase).toBe('asleep');
    expect(probe.closed).toEqual(['light']);
  });

  it('с активной арендой не засыпает ни по таймеру, ни по просьбе', async () => {
    const { supervisor, clock } = setup();
    const lease = await supervisor.acquire(worker('a'));
    clock.advance(10 * 60_000);
    expect(await supervisor.sleep('a')).toBe(false);
    expect(supervisor.status('a').phase).toBe('running');
    lease.release();
    expect(await supervisor.sleep('a')).toBe(true);
    expect(supervisor.status('a').phase).toBe('asleep');
  });
});

describe('потолок живых воркеров', () => {
  it('нужен третий при потолке 2 — засыпает давно не использованный', async () => {
    const { supervisor, clock, probe } = setup();
    (await supervisor.acquire(worker('a'))).release();
    clock.advance(1_000);
    (await supervisor.acquire(worker('b'))).release();
    clock.advance(1_000);
    (await supervisor.acquire(worker('c'))).release();

    expect(probe.closed).toEqual(['a']);
    expect(supervisor.liveWorkers()).toBe(2);
  });

  it('удалённые серверы в потолок не входят', async () => {
    const { supervisor, probe } = setup();
    for (const name of ['a', 'b']) (await supervisor.acquire(worker(name))).release();
    (await supervisor.acquire({ name: 'remote', kind: 'remote' })).release();
    expect(probe.closed).toEqual([]);
    expect(supervisor.liveWorkers()).toBe(2);
  });

  it('все живые заняты — новый сверх потолка, лишний засыпает по освобождении', async () => {
    const { supervisor, clock, probe } = setup();
    const a = await supervisor.acquire(worker('a'));
    clock.advance(1_000);
    const b = await supervisor.acquire(worker('b'));
    const c = await supervisor.acquire(worker('c'));
    expect(supervisor.liveWorkers()).toBe(3);
    expect(probe.closed).toEqual([]);

    a.release();
    await settle();
    expect(probe.closed).toEqual(['a']);
    expect(supervisor.liveWorkers()).toBe(2);
    b.release();
    c.release();
  });
});

describe('падения', () => {
  it('упавшая сессия — пауза перед повтором, затем открывается снова', async () => {
    const { supervisor, clock, probe } = setup();
    (await supervisor.acquire(worker('a'))).release();
    probe.lost.get('a')!(new Error('boom'));
    expect(supervisor.status('a')).toMatchObject({ phase: 'crashed', crashes: 1, error: 'boom' });

    await expect(supervisor.acquire(worker('a'))).rejects.toMatchObject({ reason: 'backoff' });
    clock.advance(10_000);
    (await supervisor.acquire(worker('a'))).release();
    expect(probe.opened).toEqual(['a', 'a']);
    expect(supervisor.status('a').crashes).toBe(0);
  });

  it('падение от сессии, закрытой намеренно, не считается', async () => {
    const { supervisor, probe } = setup();
    (await supervisor.acquire(worker('a'))).release();
    const lost = probe.lost.get('a')!;
    await supervisor.sleep('a');
    lost(new Error('closed by us'));
    expect(supervisor.status('a').phase).toBe('asleep');
  });

  it('три неудачных открытия подряд — попытки остановлены до reset', async () => {
    const { supervisor, clock } = setup({}, new Set(['a']));
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await expect(supervisor.acquire(worker('a'))).rejects.toBeInstanceOf(SupervisorError);
      clock.advance(10_000);
    }
    expect(supervisor.status('a')).toMatchObject({ phase: 'crashed', crashes: 3, halted: true });
    await expect(supervisor.acquire(worker('a'))).rejects.toMatchObject({ reason: 'halted' });

    supervisor.reset('a');
    expect(supervisor.status('a')).toMatchObject({ phase: 'idle', crashes: 0, halted: false });
  });
});

describe('closeAll', () => {
  it('закрывает всё и забывает слоты', async () => {
    const { supervisor, probe } = setup();
    (await supervisor.acquire(worker('a'))).release();
    (await supervisor.acquire({ name: 'r', kind: 'remote' })).release();
    await supervisor.closeAll();
    expect(probe.closed.sort()).toEqual(['a', 'r']);
    expect(supervisor.liveWorkers()).toBe(0);
    expect(supervisor.status('a').phase).toBe('idle');
  });
});
