/**
 * Выбор сочетания: какие службы и в каком порядке зовутся, и что происходит при отказе.
 *
 * Смена движка заканчивается перезапуском, которого не отменить, поэтому проверяется порядок,
 * а не итог: вопрос — до любой записи, кит — до движка, а отказ на любом шаге останавливает
 * всё, что после него.
 *
 * @module plugins/base/stack-switch/switching.test
 */

import { describe, expect, it, vi } from 'vitest';
import type { Combination } from './combinations';
import { applyCombination, resetToLaunch, type SwitchDeps } from './switching';

const kit = (id: string, active: boolean) => ({
  id,
  label: id,
  package: `@vendor/${id}`,
  version: '1.0.0',
  active,
  origin: { kind: 'builtin' } as const,
});

const combination = (over: Partial<Combination>): Combination => ({
  id: 'x',
  profile: { id: 'rjsf.builder', name: 'RJSF' },
  kit: kit('hexa-ui', false),
  label: 'RJSF + hexa-ui',
  active: false,
  restarts: false,
  ...over,
});

/** Службы-двойники, пишущие в общий журнал: порядок вызовов и есть предмет проверки. */
function harness(
  options: { confirm?: boolean; noPrompt?: boolean; current?: string; launch?: string } = {}
) {
  const calls: string[] = [];
  const reported: unknown[] = [];
  const activate = vi.fn((id: string) => {
    calls.push(`kit:${id}`);
    return Promise.resolve();
  });
  const select = vi.fn((id: string) => {
    calls.push(`profile:${id}`);
    return Promise.resolve();
  });
  const resetChoice = vi.fn(() => {
    calls.push('kit:reset');
    return Promise.resolve();
  });
  const profile = (id: string) => ({ id, name: id === 'rjsf.builder' ? 'RJSF' : 'ReFormer' });
  const confirm = vi.fn((request: { titleKey: string }) => {
    calls.push(`confirm:${request.titleKey}`);
    return Promise.resolve(options.confirm ?? true);
  });
  const deps: SwitchDeps = {
    pluginId: 'reformer.stack-switch',
    profiles: () => ({
      select,
      current: () => profile(options.current ?? 'reformer.builder'),
      launch: () => profile(options.launch ?? 'reformer.builder'),
    }),
    kits: () => ({ activate, resetChoice }),
    prompt: () => (options.noPrompt === true ? undefined : { confirm }),
    report: (error) => {
      reported.push(error);
    },
  };
  return { deps, calls, reported, activate, select, confirm, resetChoice };
}

describe('выбор сочетания', () => {
  it('тот же движок, другой кит — кит переключается сразу, без вопроса и перезапуска', async () => {
    const { deps, calls } = harness();

    await applyCombination(deps, combination({ restarts: false }));

    expect(calls).toEqual(['kit:hexa-ui']);
  });

  it('другой движок — вопрос, затем кит, затем движок', async () => {
    const { deps, calls, confirm } = harness();

    await applyCombination(deps, combination({ restarts: true }));

    // Кит ДО движка: `select` перезапускает приложение, и запись после него не случилась бы.
    expect(calls).toEqual(['confirm:confirm.title', 'kit:hexa-ui', 'profile:rjsf.builder']);
    expect(confirm.mock.calls[0]?.[0]).toMatchObject({
      pluginId: 'reformer.stack-switch',
      params: { engine: 'RJSF' },
    });
  });

  it('отказ на вопрос — ничего не записано', async () => {
    const { deps, calls } = harness({ confirm: false });

    await applyCombination(deps, combination({ restarts: true }));

    expect(calls).toEqual(['confirm:confirm.title']);
  });

  it('спросить нечем — движок не меняется: перезапуск без вопроса хуже', async () => {
    const { deps, calls } = harness({ noPrompt: true });

    await applyCombination(deps, combination({ restarts: true }));

    expect(calls).toEqual([]);
  });

  it('кит уже действует — при смене движка он не трогается', async () => {
    const { deps, calls } = harness();

    await applyCombination(
      deps,
      combination({ restarts: true, kit: kit('reformer-ui-kit', true) })
    );

    expect(calls).toEqual(['confirm:confirm.title', 'profile:rjsf.builder']);
  });

  it('оси китов нет — меняется только движок', async () => {
    const { deps, calls } = harness();

    await applyCombination(deps, combination({ restarts: true, kit: null }));

    expect(calls).toEqual(['confirm:confirm.title', 'profile:rjsf.builder']);
  });

  it('действующее сочетание — не действие', async () => {
    const { deps, calls } = harness();

    await applyCombination(deps, combination({ active: true }));

    expect(calls).toEqual([]);
  });

  it('кит исчез между показом и щелчком — отказ человеку, движок не меняется', async () => {
    const { deps, activate, select, reported } = harness();
    const gone = new Error('кит «hexa-ui» недоступен');
    activate.mockRejectedValueOnce(gone);

    await applyCombination(deps, combination({ restarts: true }));

    expect(reported).toEqual([gone]);
    expect(select).not.toHaveBeenCalled();
  });

  it('выбор профиля не сохранился — отказ человеку, а не тишина', async () => {
    const { deps, select, reported } = harness();
    const failure = new Error('выбор профиля не сохранился');
    select.mockRejectedValueOnce(failure);

    await expect(applyCombination(deps, combination({ restarts: true }))).resolves.toBeUndefined();
    expect(reported).toEqual([failure]);
  });
});

describe('возврат к конфигу запуска', () => {
  it('собран профиль запуска — выбор кита и запись профиля снимаются без вопроса', async () => {
    const { deps, calls } = harness();

    await resetToLaunch(deps);

    // `select(launch)` зовётся и здесь: перезапуска не будет, но запись выбора, переставшего
    // действовать, снимется.
    expect(calls).toEqual(['kit:reset', 'profile:reformer.builder']);
  });

  it('собран выбор человека — вопрос, затем кит, затем профиль запуска', async () => {
    const { deps, calls, confirm } = harness({ current: 'rjsf.builder' });

    await resetToLaunch(deps);

    expect(calls).toEqual(['confirm:confirm.title', 'kit:reset', 'profile:reformer.builder']);
    expect(confirm.mock.calls[0]?.[0]).toMatchObject({ params: { engine: 'ReFormer' } });
  });

  it('отказ на вопрос — ни одна ось не тронута', async () => {
    const { deps, calls } = harness({ current: 'rjsf.builder', confirm: false });

    await resetToLaunch(deps);

    expect(calls).toEqual(['confirm:confirm.title']);
  });

  it('службы профилей нет — сбрасывается один кит', async () => {
    const { deps, calls } = harness();

    await resetToLaunch({ ...deps, profiles: () => undefined });

    expect(calls).toEqual(['kit:reset']);
  });

  it('китов нет — сбрасывается один движок', async () => {
    const { deps, calls } = harness({ current: 'rjsf.builder' });

    await resetToLaunch({ ...deps, kits: () => undefined });

    expect(calls).toEqual(['confirm:confirm.title', 'profile:reformer.builder']);
  });

  it('отказ сброса — человеку, а не в тишину', async () => {
    const { deps, resetChoice, select, reported } = harness();
    const failure = new Error('хранилище недоступно');
    resetChoice.mockRejectedValueOnce(failure);

    await resetToLaunch(deps);

    expect(reported).toEqual([failure]);
    expect(select).not.toHaveBeenCalled();
  });
});
