/**
 * Список профилей к выбору: что в нём, в каком порядке и что о каждом сказано.
 *
 * Правило чистое, поэтому проверяется без React и без реестров: служба профилей приходит
 * аргументом. Проверяется то, из-за чего список врал бы: действующий профиль вне предложенных,
 * профиль запуска вне предложенных, пометка перезагрузки у действующего.
 *
 * @module plugins/base/profile-switch/choices.test
 */

import { describe, expect, it } from 'vitest';
import type { ApplicationProfileInfo } from '@reformer/builder-plugin-api';
import { describeSwitch, type ProfilesView } from './choices';

const BUILDER: ApplicationProfileInfo = { id: 'builder', name: 'Конструктор' };
const MINIMAL: ApplicationProfileInfo = { id: 'minimal', name: 'Минимальный' };
const DOCS: ApplicationProfileInfo = { id: 'docs', name: 'Документы' };

const profiles = (options: {
  current?: ApplicationProfileInfo;
  launch?: ApplicationProfileInfo;
  offered?: readonly ApplicationProfileInfo[];
}): ProfilesView => ({
  current: () => options.current ?? BUILDER,
  launch: () => options.launch ?? BUILDER,
  offered: () => options.offered ?? [BUILDER, MINIMAL],
});

const labels = (view: ProfilesView | undefined) =>
  describeSwitch(view).choices.map((choice) => choice.label);

describe('профили к выбору', () => {
  it('предложенные профили — пунктами; действует один, остальные перезагрузят приложение', () => {
    const state = describeSwitch(profiles({}));

    expect(state.choices).toEqual([
      { id: 'builder', label: 'Конструктор', active: true, restarts: false },
      { id: 'minimal', label: 'Минимальный', active: false, restarts: true },
    ]);
    expect(state.label).toBe('Конструктор');
    expect(state.activeId).toBe('builder');
  });

  it('порядок не зависит от того, что собрано сейчас', () => {
    expect(labels(profiles({ current: MINIMAL }))).toEqual(labels(profiles({ current: BUILDER })));
  });

  it('профиль запуска вне предложенных стоит первым и остаётся достижимым', () => {
    // Конфиг предложил два профиля, а запускает третьим: вернуться к нему должно быть чем.
    expect(labels(profiles({ launch: DOCS, current: DOCS }))).toEqual([
      'Документы',
      'Конструктор',
      'Минимальный',
    ]);
  });

  it('действующий профиль вне предложенных всё равно в списке', () => {
    // Выбор сделан под другим конфигом: список без него не показал бы, что сейчас работает.
    const state = describeSwitch(profiles({ current: DOCS }));

    expect(state.choices.at(-1)).toMatchObject({ id: 'docs', active: true });
    expect(state.label).toBe('Документы');
  });

  it('организация закрепила состав — профиль один, и выбирать не из чего', () => {
    expect(describeSwitch(profiles({ offered: [] })).choices).toHaveLength(1);
  });

  it('службы профилей нет — показывать нечего', () => {
    expect(describeSwitch(undefined)).toEqual({
      choices: [],
      label: null,
      activeId: null,
      resetRestarts: false,
    });
  });

  it('возврат к конфигу запуска перезагружает, только когда собран другой профиль', () => {
    expect(describeSwitch(profiles({})).resetRestarts).toBe(false);
    expect(describeSwitch(profiles({ current: MINIMAL })).resetRestarts).toBe(true);
  });

  it('идентификаторы пунктов различны — годятся ключами и значениями радио-группы', () => {
    const ids = describeSwitch(profiles({ launch: DOCS })).choices.map((choice) => choice.id);

    expect(new Set(ids).size).toBe(ids.length);
  });
});
