/**
 * Два хранилища под одной службой настроек: глобальное — в браузере, проектное — в проекте.
 *
 * ## Кто где живёт
 *
 * ```text
 * user        IndexedDB браузера      «как я настроил инструмент»
 * workspace   .ui_builder/settings.json открытого проекта   «как настроен ЭТОТ проект»
 * ```
 *
 * Правило разрешения не меняется — оно живёт в самой службе (`./settings`): `workspace`
 * перекрывает `user`, `user` перекрывает умолчание вклада. Здесь решается только МЕСТО,
 * и решается оно по вопросу, на который отвечает область: «мой инструмент» принадлежит
 * человеку и вкладке, «этот проект» — проекту и его команде.
 *
 * ## Переезд без потерь
 *
 * До этого модуля обе области лежали в IndexedDB, и у открытых проектов там уже что-то
 * записано. Молча забыть это нельзя, поэтому:
 *
 * - **чтение**: пока файла настроек в проекте нет (или он пуст), область читается
 *   из прежнего места — человек не замечает переезда вовсе;
 * - **первая запись** переносит прежние значения в файл ЦЕЛИКОМ, а не только изменённый
 *   ключ. Иначе переключение одной галочки обнулило бы остальные: файл стал бы старше
 *   прежней записи и при этом главнее её.
 *
 * Прежнее место после переезда не чистится. Оно перестаёт читаться, как только в файле
 * появляется хоть один ключ, и остаётся нетронутым — на случай, если человек вернётся
 * к версии билдера без файлового слоя.
 *
 * ## Источник без записи
 *
 * Проект можно открыть только на чтение (демо, чужая папка, отозванное разрешение). Тогда
 * проектный слой пишется НЕ в файл, а в прежнее место: настройка сохраняется, а файл
 * проекта остаётся нетронутым. Это названная деградация, а не отказ: потерять настройку
 * человека из-за того, что папка read-only, — худший из исходов, а записать в папку,
 * которая не позволяет, невозможно физически.
 *
 * ## Каталога `.ui_builder` нет
 *
 * Чужая папка, которую билдер видит впервые: ни конфига, ни настроек, ни каталога под них.
 * Файловый источник каталог под запись не создаёт и отвечает `not-found` — и это правильно:
 * плагины пишут настройки и при старте, так что `mkdir` перед записью заводил бы
 * `.ui_builder/settings.json` в любой просто открытой папке. Поэтому отказ `not-found` уводит
 * запись в прежнее место, как у источника без записи, и область остаётся на нём, пока
 * каталог не появится. Первая удачная запись в файл переносит накопленное целиком.
 *
 * @module shell/platform/services/settings-layers
 */

import type { SettingsScope } from '@reformer/builder-plugin-api/internal';
import { isSourceError } from '@/shell/platform/source/errors';
import type { SettingsBackend } from './settings';
import type { ProjectSettingsBackend } from './settings-project';

export interface LayeredSettingsDeps {
  /**
   * Прежнее (и глобальное) хранилище: IndexedDB.
   *
   * Отвечает за область `user` целиком и за область `workspace` до переезда — и после него,
   * если проект открыт без права записи.
   */
  readonly browser: SettingsBackend;
  /** Файл в открытом проекте. */
  readonly project: ProjectSettingsBackend;
}

export function createLayeredSettingsBackend(deps: LayeredSettingsDeps): SettingsBackend {
  /**
   * Читается ли область проекта из ПРЕЖНЕГО места.
   *
   * Снимается при чтении: пока в файле пусто, живём на прежних значениях. Состояние, а не
   * вычисление на каждый вызов, потому что запись обязана знать, переносить ли прежнее.
   */
  let legacy = true;

  const readProject = async (): Promise<Readonly<Record<string, unknown>>> => {
    const fromFile = await deps.project.read('workspace');
    if (Object.keys(fromFile).length > 0) {
      legacy = false;
      return fromFile;
    }
    legacy = true;
    return deps.browser.read('workspace');
  };

  /** Переносит прежние значения в файл при первой записи, чтобы они не пропали. */
  const carryOver = async (): Promise<void> => {
    if (!legacy) return;
    const previous = await deps.browser.read('workspace');
    for (const [key, value] of Object.entries(previous)) {
      await deps.project.write('workspace', key, value);
    }
    legacy = false;
  };

  return {
    read: (scope: SettingsScope) =>
      scope === 'workspace' ? readProject() : deps.browser.read(scope),

    write: async (scope: SettingsScope, key: string, value: unknown) => {
      if (scope !== 'workspace' || !deps.project.writable()) {
        await deps.browser.write(scope, key, value);
        return;
      }
      try {
        await carryOver();
        await deps.project.write(scope, key, value);
      } catch (error) {
        if (!isSourceError(error, 'not-found')) throw error;
        // Каталога `.ui_builder` нет (см. шапку): пишем в прежнее место и остаёмся на нём.
        legacy = true;
        await deps.browser.write(scope, key, value);
      }
    },

    remove: async (scope: SettingsScope, key: string) => {
      if (scope !== 'workspace' || !deps.project.writable()) {
        await deps.browser.remove(scope, key);
        return;
      }
      try {
        await carryOver();
        await deps.project.remove(scope, key);
      } catch (error) {
        if (!isSourceError(error, 'not-found')) throw error;
        legacy = true;
      }
      // Прежнее место тоже забывает ключ: иначе снятие записи вернуло бы значение,
      // которое человек только что убрал, — при следующем открытии проекта без файла.
      await deps.browser.remove(scope, key);
    },
  };
}
