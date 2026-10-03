/**
 * Сочетания «движок × кит»: что показать человеку и что из показанного активно.
 *
 * Чистая функция от двух служб — без React, без подписок и без состояния. Ячейка строки
 * состояния и палитра команд обязаны показывать ОДИН список: разойдись они, человек видел бы
 * сочетание в одном месте и не находил в другом.
 *
 * ## Две оси, которые не знают друг о друге
 *
 * Движок — профиль состава приложения: он фиксируется при сборке, и сменить его значит
 * перезапуститься. Кит — настройка, меняется на лету и общий для всех движков. Сочетание — не
 * сущность, а пара значений этих осей, поэтому список здесь ВЫЧИСЛЯЕТСЯ: появился кит плагина —
 * появились сочетания с ним, и объявлять их заранее негде и незачем.
 *
 * ## Любой из осей может не быть
 *
 * Китов нет в составе без плагина китов (демо-стек), службы профилей — в приложении, которое
 * выбора не даёт. Оставшаяся ось показывается одна: переключатель одной оси лучше, чем его
 * отсутствие, а «+» с пустой половиной — хуже обоих.
 *
 * @module plugins/base/stack-switch/combinations
 */

import type {
  ApplicationProfileInfo,
  ApplicationProfilesService,
  KitsService,
  KitSummary,
} from '@reformer/builder-plugin-api';

/** Службы в объёме, нужном списку: только чтение. */
export type ProfilesView = Pick<ApplicationProfilesService, 'current' | 'launch' | 'offered'>;
export type KitsView = Pick<KitsService, 'available'>;

/** Одно сочетание в списке. */
export interface Combination {
  /** Адрес в списке: устойчив между пересчётами, годится React-ключом и значением радио-группы. */
  readonly id: string;
  /** Движок; `null` — оси движков нет. */
  readonly profile: ApplicationProfileInfo | null;
  /** Кит; `null` — оси китов нет. */
  readonly kit: KitSummary | null;
  /** Подпись для человека: «ReFormer + Kaspersky HexaUI». */
  readonly label: string;
  /** Это сочетание действует сейчас. */
  readonly active: boolean;
  /** Выбор перезапустит приложение: движок другой. */
  readonly restarts: boolean;
}

/** Всё, что рисуют ячейка и палитра. */
export interface SwitchState {
  readonly combinations: readonly Combination[];
  /** Подпись ячейки — «движок · кит»; `null` — показывать нечего, ячейки нет. */
  readonly label: string | null;
  /** Адрес активного сочетания; `null` — ни одно не активно. */
  readonly activeId: string | null;
  /**
   * Возврат к конфигу запуска перезапустит приложение: собран не тот движок, что в конфиге.
   * Про кит здесь знать нечего — он возвращается на лету.
   */
  readonly resetRestarts: boolean;
}

/** Разделитель половин адреса. В идентификаторах профилей и китов не встречается. */
const ID_SEPARATOR = '|';

const combinationId = (profile: ApplicationProfileInfo | null, kit: KitSummary | null): string =>
  `${profile?.id ?? ''}${ID_SEPARATOR}${kit?.id ?? ''}`;

/**
 * Движки по порядку: профиль запуска, затем предложенные, затем собранный.
 *
 * Порядок не зависит от того, что собрано сейчас, и это свойство, а не случайность: список,
 * в котором пункты меняются местами после переключения, заставляет искать глазами то, что
 * рука уже помнит. Собранный профиль дописывается последним только тогда, когда его нет ни
 * в конфиге запуска, ни среди предложенных, — иначе он уже стоит на своём месте.
 */
function enginesOf(profiles: ProfilesView | undefined): readonly ApplicationProfileInfo[] {
  if (profiles === undefined) return [];
  const seen = new Set<string>();
  const engines: ApplicationProfileInfo[] = [];
  for (const profile of [profiles.launch(), ...profiles.offered(), profiles.current()]) {
    if (seen.has(profile.id)) continue;
    seen.add(profile.id);
    engines.push(profile);
  }
  return engines;
}

/** Список сочетаний и подпись ячейки по текущему состоянию двух служб. */
export function describeSwitch(
  profiles: ProfilesView | undefined,
  kits: KitsView | undefined
): SwitchState {
  const engines = enginesOf(profiles);
  const available = kits?.available() ?? [];
  const current = profiles?.current() ?? null;
  const activeKit = available.find((kit) => kit.active) ?? null;

  // Пустая ось заменяется одним «пустым» значением: декартово произведение тогда само
  // вырождается в список оставшейся оси, без отдельной ветки на каждый случай.
  const profileAxis: readonly (ApplicationProfileInfo | null)[] =
    engines.length > 0 ? engines : [null];
  const kitAxis: readonly (KitSummary | null)[] = available.length > 0 ? available : [null];

  const combinations: Combination[] = [];
  for (const profile of profileAxis) {
    for (const kit of kitAxis) {
      if (profile === null && kit === null) continue;
      const sameEngine = profile === null || profile.id === current?.id;
      combinations.push({
        id: combinationId(profile, kit),
        profile,
        kit,
        label: [profile?.name, kit?.label].filter((part) => part !== undefined).join(' + '),
        active: sameEngine && (kit === null || kit.active),
        restarts: !sameEngine,
      });
    }
  }

  const parts = [current?.name, activeKit?.label].filter((part) => part !== undefined);
  return {
    combinations,
    label: parts.length > 0 ? parts.join(' · ') : null,
    activeId: combinations.find((combination) => combination.active)?.id ?? null,
    resetRestarts: profiles !== undefined && current?.id !== profiles.launch().id,
  };
}
