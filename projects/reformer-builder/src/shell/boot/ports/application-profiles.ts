/**
 * Служба профилей состава: что собрано, что предложено и как выбрать другое.
 *
 * Оболочка профилей не знает — она получает ИМЕНА от того, кто собрал состав
 * (`BootOptions.application.profile`, `BootOptions.profileChoices`), и добавляет единственное,
 * что умеет сама: записать выбор в настройки и перезапустить приложение. Состав фиксируется
 * до `boot`, поэтому «выбрать другой профиль» и есть «запомнить и перезапуститься»: следующая
 * сборка прочитает выбор раньше, чем начнёт собираться (`../stored-preset`).
 *
 * ## Выбор, равный профилю запуска, не хранится
 *
 * Он СНИМАЕТ запись. Иначе человек, вернувшийся к профилю конфига, оставался бы «выбравшим»,
 * и смена `preset` в конфиге запуска его бы уже не касалась — при том, что он сам попросил
 * вести себя как конфиг. Одно действие интерфейса — «как в конфиге запуска» — поэтому не
 * отдельный глагол службы, а `select(launch().id)`.
 *
 * ## Перезапуск только после проверки записи
 *
 * Без IndexedDB (приватное окно) хранилище настроек молча живёт в памяти сессии: запись
 * «удалась», но перезапуск её не увидит. Человек получил бы перезагрузку, после которой ничего
 * не изменилось, — неотличимо от поломки. Поэтому перед перезапуском выбор перечитывается тем же
 * путём, каким его прочтёт следующая сборка, и расхождение становится отказом словами.
 *
 * @module shell/boot/ports/application-profiles
 */

import type {
  ApplicationProfileInfo,
  ApplicationProfilesService,
  SettingsService,
} from '@reformer/builder-plugin-api/internal';
import type { ProfileChoices } from '@/shell/boot/composition';
import { PRESET_SETTINGS_KEY } from '@/shell/boot/stored-preset';

export interface ApplicationProfilesDeps {
  /** Профиль, из которого приложение собрано на самом деле. */
  readonly current: ApplicationProfileInfo;
  /**
   * Что предложено к выбору. Нет — приложение выбора не даёт: тесты и чужие сборки на той же
   * оболочке зовут `boot` без него, и служба тогда честно отвечает «переключать не между чем».
   */
  readonly choices?: ProfileChoices;
  readonly settings: Pick<SettingsService, 'set'>;
  /** Перезапуск приложения. Портом: оболочке звать `location.reload` самой нельзя. */
  readonly reload: () => void;
  /** Выбор, каким его прочтёт следующая сборка, — для сверки перед перезапуском. */
  readonly stored: () => Promise<string | null>;
}

export function createApplicationProfilesService(
  deps: ApplicationProfilesDeps
): ApplicationProfilesService {
  const launch = deps.choices?.launch ?? deps.current;
  const offered = deps.choices?.offered ?? [];

  return {
    current: () => deps.current,
    launch: () => launch,
    offered: () => offered,

    async select(id: string): Promise<void> {
      if (id !== launch.id && !offered.some((profile) => profile.id === id)) {
        throw new Error(`профиль «${id}» не предложен к выбору`);
      }
      const choice = id === launch.id ? null : id;
      // Область названа явно: выбор профиля — про человека и его инструмент, а не про проект.
      await deps.settings.set(PRESET_SETTINGS_KEY, choice ?? undefined, 'user');
      if ((await deps.stored()) !== choice) {
        throw new Error('выбор профиля не сохранился: хранилище настроек недоступно');
      }
      // Тот же профиль уже собран — перезапускать нечего: запись лишь привела выбор в порядок.
      if (id !== deps.current.id) deps.reload();
    },
  };
}
