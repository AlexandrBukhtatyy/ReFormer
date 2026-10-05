/**
 * Смена профиля: вопрос про перезагрузку, обращение к службе профилей и отказы.
 *
 * Смена профиля перезагружает приложение, поэтому проверяется главное: без согласия человека
 * ничего не происходит — в том числе когда спросить нечем, — а отказ службы доходит до человека,
 * а не теряется.
 *
 * @module plugins/base/profile-switch/switching.test
 */

import { describe, expect, it, vi } from 'vitest';
import type { ProfileChoice } from './choices';
import { applyChoice, resetToLaunch, type SwitchDeps } from './switching';

const BUILDER = { id: 'builder', name: 'Конструктор' };
const MINIMAL = { id: 'minimal', name: 'Минимальный' };

const choice = (over: Partial<ProfileChoice> = {}): ProfileChoice => ({
  id: 'minimal',
  label: 'Минимальный',
  active: false,
  restarts: true,
  ...over,
});

function stand(
  options: {
    confirm?: boolean | null;
    current?: typeof BUILDER;
    profiles?: boolean;
    select?: () => Promise<void>;
  } = {}
) {
  const select = vi.fn(options.select ?? (() => Promise.resolve()));
  const confirm = vi.fn(() => Promise.resolve(options.confirm ?? true));
  const report = vi.fn();
  const deps: SwitchDeps = {
    pluginId: 'reformer.profile-switch',
    profiles: () =>
      options.profiles === false
        ? undefined
        : { select, current: () => options.current ?? BUILDER, launch: () => BUILDER },
    prompt: () => (options.confirm === null ? undefined : { confirm }),
    report,
  };
  return { deps, select, confirm, report };
}

describe('выбор профиля', () => {
  it('другой профиль — вопрос про перезагрузку, затем выбор', async () => {
    const { deps, select, confirm } = stand();

    await applyChoice(deps, choice());

    expect(confirm).toHaveBeenCalledWith(
      expect.objectContaining({
        titleKey: 'confirm.title',
        params: { profile: 'Минимальный' },
        pluginId: 'reformer.profile-switch',
      })
    );
    expect(select).toHaveBeenCalledWith('minimal');
  });

  it('отказ на вопрос — профиль не меняется', async () => {
    const { deps, select } = stand({ confirm: false });

    await applyChoice(deps, choice());

    expect(select).not.toHaveBeenCalled();
  });

  it('спросить нечем — профиль не меняется: перезагрузка без вопроса хуже', async () => {
    const { deps, select } = stand({ confirm: null });

    await applyChoice(deps, choice());

    expect(select).not.toHaveBeenCalled();
  });

  it('действующий профиль — не действие', async () => {
    const { deps, select, confirm } = stand();

    await applyChoice(deps, choice({ id: 'builder', active: true, restarts: false }));

    expect(confirm).not.toHaveBeenCalled();
    expect(select).not.toHaveBeenCalled();
  });

  it('выбор не сохранился — отказ человеку, а не тишина', async () => {
    const failure = new Error('хранилище недоступно');
    const { deps, report } = stand({ select: () => Promise.reject(failure) });

    await applyChoice(deps, choice());

    expect(report).toHaveBeenCalledWith(failure);
  });
});

describe('возврат к конфигу запуска', () => {
  it('собран профиль запуска — запись выбора снимается без вопроса', async () => {
    const { deps, select, confirm } = stand();

    await resetToLaunch(deps);

    expect(confirm).not.toHaveBeenCalled();
    expect(select).toHaveBeenCalledWith('builder');
  });

  it('собран выбор человека — вопрос, затем профиль запуска', async () => {
    const { deps, select, confirm } = stand({ current: MINIMAL });

    await resetToLaunch(deps);

    expect(confirm).toHaveBeenCalledWith(
      expect.objectContaining({ params: { profile: 'Конструктор' } })
    );
    expect(select).toHaveBeenCalledWith('builder');
  });

  it('отказ на вопрос — профиль не тронут', async () => {
    const { deps, select } = stand({ current: MINIMAL, confirm: false });

    await resetToLaunch(deps);

    expect(select).not.toHaveBeenCalled();
  });

  it('службы профилей нет — делать нечего, и это не отказ', async () => {
    const { deps, report } = stand({ profiles: false });

    await resetToLaunch(deps);

    expect(report).not.toHaveBeenCalled();
  });

  it('отказ сброса — человеку, а не в тишину', async () => {
    const failure = new Error('хранилище недоступно');
    const { deps, report } = stand({ select: () => Promise.reject(failure) });

    await resetToLaunch(deps);

    expect(report).toHaveBeenCalledWith(failure);
  });
});
