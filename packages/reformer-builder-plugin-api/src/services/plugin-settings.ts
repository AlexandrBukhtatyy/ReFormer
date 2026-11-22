/**
 * Ключ настроек плагина каталога.
 *
 * Одна функция на всё приложение: адрес не должен разъехаться между тем, кто пишет настройку,
 * и тем, кто рисует её форму. Сам вид службы настроек для плагина живёт в оболочке билдера.
 *
 * @module @reformer/builder-plugin-api/services/plugin-settings
 */

/** Ключ настроек плагина каталога. Одна функция на всё приложение: адрес не должен разъехаться. */
export function pluginSettingsKey(pluginId: string): string {
  if (pluginId.trim() === '') {
    throw new Error('pluginSettingsKey: идентификатор плагина не может быть пустым');
  }
  return `workspace.plugin.${pluginId}.settings`;
}
