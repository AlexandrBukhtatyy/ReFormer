/**
 * Что человек может выбрать: профили приложения, между которыми оно переключается.
 *
 * Профиль — состав встроенных плагинов, собранный при запуске (`application/profiles`). Какие
 * профили предложены, решает приложение вместе с конфигом запуска; здесь они только
 * перечисляются с тем, что о каждом нужно знать ячейке и палитре: действует ли он сейчас
 * и потребует ли выбор перезагрузки.
 *
 * Раньше модуль перемножал две оси — профиль и кит — в «сочетания». Киты уехали из встроенных
 * плагинов вместе со своим выбором (плагин китов вносит свою ячейку), и осталась одна ось.
 *
 * Модуль чистый: службы приходят аргументом, React и реестров здесь нет.
 *
 * @module plugins/base/profile-switch/choices
 */

import type {
  ApplicationProfileInfo,
  ApplicationProfilesService,
} from '@reformer/builder-plugin-api';

/** Служба профилей в объёме, нужном для перечисления. */
export type ProfilesView = Pick<ApplicationProfilesService, 'current' | 'launch' | 'offered'>;

/** Профиль как пункт списка. */
export interface ProfileChoice {
  readonly id: string;
  readonly label: string;
  /** Действует сейчас. */
  readonly active: boolean;
  /** Выбор сменит состав — а значит, перезагрузит приложение. */
  readonly restarts: boolean;
}

export interface SwitchState {
  readonly choices: readonly ProfileChoice[];
  /** Имя действующего профиля; `null` — службы профилей нет, показывать нечего. */
  readonly label: string | null;
  readonly activeId: string | null;
  /** Возврат к конфигу запуска сменит профиль — и тоже перезагрузит приложение. */
  readonly resetRestarts: boolean;
}

/**
 * Профили в порядке показа: профиль запуска, затем предложенные, затем действующий.
 *
 * Действующий добавляется явно: он может не входить в предложенные (выбор, сделанный под другим
 * конфигом), и список без него не показал бы, что сейчас работает.
 */
function profilesOf(profiles: ProfilesView): readonly ApplicationProfileInfo[] {
  const seen = new Set<string>();
  const ordered: ApplicationProfileInfo[] = [];
  for (const profile of [profiles.launch(), ...profiles.offered(), profiles.current()]) {
    if (seen.has(profile.id)) continue;
    seen.add(profile.id);
    ordered.push(profile);
  }
  return ordered;
}

/** Состояние выбора профиля. Без службы профилей — пустое: ячейка тогда не рисуется. */
export function describeSwitch(profiles: ProfilesView | undefined): SwitchState {
  if (profiles === undefined) {
    return { choices: [], label: null, activeId: null, resetRestarts: false };
  }
  const current = profiles.current();
  return {
    choices: profilesOf(profiles).map((profile) => ({
      id: profile.id,
      label: profile.name,
      active: profile.id === current.id,
      restarts: profile.id !== current.id,
    })),
    label: current.name,
    activeId: current.id,
    resetRestarts: current.id !== profiles.launch().id,
  };
}
