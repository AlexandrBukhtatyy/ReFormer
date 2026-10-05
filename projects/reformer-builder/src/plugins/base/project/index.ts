/**
 * Публичная поверхность плагина «Проект»: то, что берёт композиция, и ничего больше.
 *
 * Команды, подменю недавних и стартовая страница — внутреннее и меняется без согласования.
 *
 * @module plugins/base/project/index
 */

import { createProjectPlugin } from './plugin';

export { createProjectPlugin } from './plugin';
export {
  CLEAR_RECENT_COMMAND_ID,
  OPEN_PROJECT_COMMAND_ID,
  OPEN_RECENT_COMMAND_ID,
  PROJECT_PLUGIN_ID,
  PROJECT_WELCOME_PANEL_ID,
  SAVE_ALL_COMMAND_ID,
  SAVE_COMMAND_ID,
} from './contract';

/**
 * Фабрика состава: так плагин создаётся при сборке приложения. Её находит по папке
 * `application/composer/builtin-plugins`. Портов плагину не нужно: всё берётся из контекста.
 */
export default function builtin() {
  return createProjectPlugin();
}
