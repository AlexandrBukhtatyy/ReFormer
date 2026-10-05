/**
 * Публичная поверхность выбора профиля: то, что берёт композиция, и ничего больше.
 *
 * Имена — идентификатор плагина и адреса его вкладов — живут в `./contract`: их называют тесты
 * состава, которым тело плагина ни к чему.
 *
 * @module plugins/base/profile-switch/index
 */

import { createProfileSwitchPlugin } from './plugin';

export { createProfileSwitchPlugin } from './plugin';
export {
  PROFILE_SWITCH_CELL_ID,
  PROFILE_SWITCH_PALETTE_PROVIDER_ID,
  PROFILE_SWITCH_PLUGIN_ID,
} from './contract';

/**
 * Фабрика состава: так плагин создаётся при сборке приложения. Её находит по папке
 * `application/composer/builtin-plugins` и зовёт с набором портов оболочки.
 * Портов оболочки плагину не нужно: всё он берёт службами в `activate`.
 */
export default function builtin() {
  return createProfileSwitchPlugin();
}
