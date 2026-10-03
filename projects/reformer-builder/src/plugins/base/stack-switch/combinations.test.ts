/**
 * Список сочетаний: что видит человек при каждом раскладе двух осей.
 *
 * Проверяются не строки подписей, а три свойства, из-за которых список вычисляется, а не
 * объявляется: он полон (все движки × все доступные киты), отмечает ровно одно действующее
 * сочетание и не меняет порядка от переключения.
 *
 * @module plugins/base/stack-switch/combinations.test
 */

import { describe, expect, it } from 'vitest';
import type { ApplicationProfileInfo, KitSummary } from '@reformer/builder-plugin-api';
import { describeSwitch, type KitsView, type ProfilesView } from './combinations';

const REFORMER: ApplicationProfileInfo = { id: 'reformer.builder', name: 'ReFormer' };
const RJSF: ApplicationProfileInfo = { id: 'rjsf.builder', name: 'RJSF' };
const ALL: ApplicationProfileInfo = { id: 'all-stacks', name: 'ReFormer + RJSF' };

const kit = (id: string, label: string, active: boolean): KitSummary => ({
  id,
  label,
  package: `@vendor/${id}`,
  version: '1.0.0',
  active,
  origin: { kind: 'builtin' },
});

const profilesOf = (
  current: ApplicationProfileInfo,
  launch: ApplicationProfileInfo = current,
  offered: readonly ApplicationProfileInfo[] = [REFORMER, RJSF]
): ProfilesView => ({ current: () => current, launch: () => launch, offered: () => offered });

const kitsOf = (...available: KitSummary[]): KitsView => ({ available: () => available });

const UI_KIT = kit('reformer-ui-kit', 'ReFormer UI Kit', true);
const HEXA = kit('hexa-ui', 'Kaspersky HexaUI', false);

describe('сочетания «движок × кит»', () => {
  it('два движка и два кита — четыре сочетания, действует одно', () => {
    const state = describeSwitch(profilesOf(REFORMER), kitsOf(UI_KIT, HEXA));

    expect(state.combinations.map((c) => c.label)).toEqual([
      'ReFormer + ReFormer UI Kit',
      'ReFormer + Kaspersky HexaUI',
      'RJSF + ReFormer UI Kit',
      'RJSF + Kaspersky HexaUI',
    ]);
    expect(state.combinations.filter((c) => c.active).map((c) => c.label)).toEqual([
      'ReFormer + ReFormer UI Kit',
    ]);
    expect(state.label).toBe('ReFormer · ReFormer UI Kit');
    expect(state.activeId).toBe(state.combinations[0]?.id);
  });

  it('перезапуска требуют только сочетания с другим движком', () => {
    const state = describeSwitch(profilesOf(REFORMER), kitsOf(UI_KIT, HEXA));

    expect(state.combinations.map((c) => c.restarts)).toEqual([false, false, true, true]);
  });

  it('кит плагина появился — появились сочетания с ним', () => {
    // Без проекта HexaUI нет: кит внешний, и о нём узнают, когда плагин его внесёт.
    const before = describeSwitch(profilesOf(REFORMER), kitsOf(UI_KIT));
    const after = describeSwitch(profilesOf(REFORMER), kitsOf(UI_KIT, HEXA));

    expect(before.combinations).toHaveLength(2);
    expect(after.combinations).toHaveLength(4);
  });

  it('порядок не зависит от того, что собрано сейчас', () => {
    const onReformer = describeSwitch(profilesOf(REFORMER, REFORMER), kitsOf(UI_KIT));
    const onRjsf = describeSwitch(profilesOf(RJSF, REFORMER), kitsOf(UI_KIT));

    // Список, в котором пункты меняются местами после переключения, заставляет искать глазами.
    expect(onRjsf.combinations.map((c) => c.id)).toEqual(onReformer.combinations.map((c) => c.id));
    expect(onRjsf.label).toBe('RJSF · ReFormer UI Kit');
  });

  it('профиль запуска вне предложенных стоит первым и остаётся достижимым', () => {
    // Свой профиль организации: к выбору не предложен, но собран — и вернуться к нему можно.
    const state = describeSwitch(profilesOf(ALL, ALL), kitsOf(UI_KIT));

    expect(state.combinations.map((c) => c.profile?.id)).toEqual([
      'all-stacks',
      'reformer.builder',
      'rjsf.builder',
    ]);
    expect(state.combinations[0]?.active).toBe(true);
  });

  it('организация закрепила состав — остаются сочетания одного движка', () => {
    const state = describeSwitch(profilesOf(RJSF, RJSF, []), kitsOf(UI_KIT, HEXA));

    expect(state.combinations.map((c) => c.label)).toEqual([
      'RJSF + ReFormer UI Kit',
      'RJSF + Kaspersky HexaUI',
    ]);
    expect(state.combinations.some((c) => c.restarts)).toBe(false);
  });

  it('китов в составе нет — переключатель одних движков', () => {
    const state = describeSwitch(profilesOf(REFORMER), undefined);

    expect(state.combinations.map((c) => c.label)).toEqual(['ReFormer', 'RJSF']);
    expect(state.combinations.map((c) => c.kit)).toEqual([null, null]);
    expect(state.label).toBe('ReFormer');
  });

  it('службы профилей нет — переключатель одних китов, и перезапуска не требует ни один', () => {
    const state = describeSwitch(undefined, kitsOf(UI_KIT, HEXA));

    expect(state.combinations.map((c) => c.label)).toEqual(['ReFormer UI Kit', 'Kaspersky HexaUI']);
    expect(state.combinations.map((c) => c.restarts)).toEqual([false, false]);
    expect(state.label).toBe('ReFormer UI Kit');
  });

  it('нет ни одной оси — показывать нечего', () => {
    expect(describeSwitch(undefined, undefined)).toEqual({
      combinations: [],
      label: null,
      activeId: null,
      resetRestarts: false,
    });
  });

  it('возврат к конфигу запуска перезапускает, только когда собран другой движок', () => {
    expect(describeSwitch(profilesOf(REFORMER, REFORMER), kitsOf(UI_KIT)).resetRestarts).toBe(
      false
    );
    expect(describeSwitch(profilesOf(RJSF, REFORMER), kitsOf(UI_KIT)).resetRestarts).toBe(true);
    // Без службы профилей возвращать движок некуда: сбрасывается один кит, и на лету.
    expect(describeSwitch(undefined, kitsOf(UI_KIT, HEXA)).resetRestarts).toBe(false);
  });

  it('адреса сочетаний различны — годятся ключами и значениями радио-группы', () => {
    const { combinations } = describeSwitch(profilesOf(REFORMER), kitsOf(UI_KIT, HEXA));

    expect(new Set(combinations.map((c) => c.id)).size).toBe(combinations.length);
  });
});
