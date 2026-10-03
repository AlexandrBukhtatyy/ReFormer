/**
 * Выбор профиля состава, сделанный человеком: ключ настройки и чтение ДО сборки приложения.
 *
 * ## Почему настройка читается мимо службы настроек
 *
 * Состав фиксируется при сборке приложения — раньше, чем появляется служба настроек: она сама
 * создаётся внутри `boot`. А выбор профиля обязан повлиять именно на сборку. Поэтому значение
 * читается отсюда, напрямую из хранилища области `user`, и приходит в `main.tsx` вместе
 * с конфигом запуска. Записывает его уже служба (`ports/application-profiles`), обычным
 * `settings.set`: ключ один, хранилище одно, и расходиться им негде.
 *
 * ## Почему не `localStorage` и не параметр адреса
 *
 * `localStorage` в проекте не используется нигде (шапка `services/settings-idb`). Параметр адреса
 * не переживает закрытия вкладки, а выбор профиля — такое же «как я настроил инструмент», как тема
 * и кит: человек ждёт, что завтра откроется то же самое.
 *
 * ## Отказ — это «выбора нет»
 *
 * Нет IndexedDB, запись испорчена, хранилище заблокировано — приложение собирается по конфигу
 * запуска, как если бы человек ничего не выбирал. Тот же принцип, что у всего пути запуска:
 * инструмент обязан открыться.
 *
 * @module shell/boot/stored-preset
 */

import { createIdbSettingsBackend } from '@/shell/platform/services/settings-idb';
import { createWorkspaceMetaStore } from '@/shell/platform/workspace/storage/idb';

/** Ключ настройки: профиль, выбранный человеком вместо `preset` конфига запуска. Область `user`. */
export const PRESET_SETTINGS_KEY = 'host.preset';

/**
 * Читает выбор профиля из области `user`. Не отвергается никогда: отказ хранилища — `null`.
 *
 * Хранилище заводится своё и тут же отпускается. Соединение у хранилищ одной базы общее и
 * считается по владельцам: оставь мы своё, очистка хранилища (`storage/purge`) ждала бы
 * соединения, которое уже никто не закроет.
 *
 * @param options.factory подмена IndexedDB — для тестов; по умолчанию берётся у окружения.
 */
export async function readStoredPreset(
  options: { readonly factory?: IDBFactory } = {}
): Promise<string | null> {
  const store = createWorkspaceMetaStore(options);
  try {
    const values = await createIdbSettingsBackend(store).read('user');
    const value = values[PRESET_SETTINGS_KEY];
    // В хранилище лежит то, что туда положили прошлые версии приложения: имя профиля отсюда
    // идёт в сборку состава, и не-строка там — мусор, а не выбор.
    return typeof value === 'string' && value.trim() !== '' ? value : null;
  } catch {
    return null;
  } finally {
    store.dispose();
  }
}
