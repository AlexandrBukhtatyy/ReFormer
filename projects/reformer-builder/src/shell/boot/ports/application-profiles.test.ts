/**
 * Служба профилей состава: что считается выбором, когда приложение перезапускается и когда —
 * отказывает словами вместо перезапуска.
 *
 * Перезапуск — действие, которое человек видит целиком и не может отменить. Поэтому проверяется
 * не «select что-то записал», а три вопроса: перезапустились ли, когда надо; не перезапустились
 * ли, когда нечего менять; и отказались ли, когда перезапуск ничего бы не сменил.
 *
 * @module shell/boot/ports/application-profiles.test
 */

import { describe, expect, it, vi } from 'vitest';
import type { ApplicationProfileInfo } from '@reformer/builder-plugin-api/internal';
import { PRESET_SETTINGS_KEY } from '@/shell/boot/stored-preset';
import { createApplicationProfilesService } from './application-profiles';

const REFORMER: ApplicationProfileInfo = { id: 'reformer.builder', name: 'ReFormer' };
const RJSF: ApplicationProfileInfo = { id: 'rjsf.builder', name: 'RJSF' };
const ACME: ApplicationProfileInfo = { id: 'acme', name: 'Формы Acme' };

/** Настройки в объёме службы: одна запись области user, читаемая «следующей сборкой». */
function harness(options: {
  current: ApplicationProfileInfo;
  launch?: ApplicationProfileInfo;
  offered?: readonly ApplicationProfileInfo[];
  /** Хранилище, которое принимает запись, но не сохраняет её, — IndexedDB недоступна. */
  volatile?: boolean;
}) {
  let stored: string | null = null;
  const writes: unknown[] = [];
  const reload = vi.fn();
  const service = createApplicationProfilesService({
    current: options.current,
    ...(options.launch !== undefined
      ? { choices: { launch: options.launch, offered: options.offered ?? [] } }
      : {}),
    settings: {
      set: (key, value, scope) => {
        writes.push({ key, value, scope });
        if (options.volatile !== true) stored = (value as string | undefined) ?? null;
        return Promise.resolve();
      },
    },
    reload,
    stored: () => Promise.resolve(stored),
  });
  return { service, reload, writes, stored: () => stored };
}

describe('служба профилей состава', () => {
  it('называет собранный профиль, профиль запуска и предложенные', () => {
    const { service } = harness({ current: RJSF, launch: REFORMER, offered: [REFORMER, RJSF] });

    expect(service.current()).toBe(RJSF);
    expect(service.launch()).toBe(REFORMER);
    expect(service.offered()).toEqual([REFORMER, RJSF]);
  });

  it('без сведений о выборе — переключать не между чем, профиль запуска равен собранному', () => {
    // Так `boot` зовут тесты и чужие сборки на той же оболочке: служба есть, выбора нет.
    const { service } = harness({ current: ACME });

    expect(service.launch()).toBe(ACME);
    expect(service.offered()).toEqual([]);
  });

  it('выбор другого профиля записывается в область user и перезапускает приложение', async () => {
    const { service, reload, writes } = harness({
      current: REFORMER,
      launch: REFORMER,
      offered: [REFORMER, RJSF],
    });

    await service.select(RJSF.id);

    expect(writes).toEqual([{ key: PRESET_SETTINGS_KEY, value: RJSF.id, scope: 'user' }]);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('выбор профиля запуска снимает запись, а не хранит её', async () => {
    // Человек собран на своём выборе и возвращается к конфигу: запись снята, перезапуск нужен.
    const { service, reload, writes } = harness({
      current: RJSF,
      launch: REFORMER,
      offered: [REFORMER, RJSF],
    });

    await service.select(REFORMER.id);

    expect(writes).toEqual([{ key: PRESET_SETTINGS_KEY, value: undefined, scope: 'user' }]);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('тот же профиль уже собран — выбор приводится в порядок без перезапуска', async () => {
    const { service, reload, writes } = harness({
      current: REFORMER,
      launch: REFORMER,
      offered: [REFORMER, RJSF],
    });

    await service.select(REFORMER.id);

    expect(writes).toHaveLength(1);
    expect(reload).not.toHaveBeenCalled();
  });

  it('профиль запуска выбирается, даже если его нет среди предложенных', async () => {
    // Свой профиль организации (`all-stacks`) к выбору не предложен, но вернуться к нему
    // с чужого выбора обязано быть можно — иначе «как в конфиге запуска» вело бы в отказ.
    const { service, reload } = harness({ current: RJSF, launch: ACME, offered: [REFORMER, RJSF] });

    await service.select(ACME.id);

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('профиль, не предложенный к выбору, отвергается — ни записи, ни перезапуска', async () => {
    const { service, reload, writes } = harness({
      current: REFORMER,
      launch: REFORMER,
      offered: [REFORMER, RJSF],
    });

    await expect(service.select('minimal')).rejects.toThrow('профиль «minimal» не предложен');
    expect(writes).toEqual([]);
    expect(reload).not.toHaveBeenCalled();
  });

  it('запись не сохранилась — отказ словами вместо перезапуска, который ничего не сменит', async () => {
    const { service, reload } = harness({
      current: REFORMER,
      launch: REFORMER,
      offered: [REFORMER, RJSF],
      volatile: true,
    });

    await expect(service.select(RJSF.id)).rejects.toThrow('выбор профиля не сохранился');
    expect(reload).not.toHaveBeenCalled();
  });

  it('отказ записи доходит до вызывающего, и приложение не перезапускается', async () => {
    const reload = vi.fn();
    const service = createApplicationProfilesService({
      current: REFORMER,
      choices: { launch: REFORMER, offered: [REFORMER, RJSF] },
      settings: { set: () => Promise.reject(new Error('квота исчерпана')) },
      reload,
      stored: () => Promise.resolve(null),
    });

    await expect(service.select(RJSF.id)).rejects.toThrow('квота исчерпана');
    expect(reload).not.toHaveBeenCalled();
  });
});
