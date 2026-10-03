/**
 * Публичная поверхность переключателя сочетаний: то, что берёт композиция, и ничего больше.
 *
 * Имена — идентификатор плагина и адреса его вкладов — живут в `./contract`: их называют тесты
 * состава, которым тело плагина ни к чему.
 *
 * @module plugins/base/stack-switch/index
 */

import { createStackSwitchPlugin } from './plugin';

export { createStackSwitchPlugin } from './plugin';
export {
  STACK_SWITCH_CELL_ID,
  STACK_SWITCH_PALETTE_PROVIDER_ID,
  STACK_SWITCH_PLUGIN_ID,
} from './contract';

/**
 * Фабрика состава: так плагин создаётся при сборке приложения. Её находит по папке
 * `application/composer/builtin-plugins` и зовёт с набором портов оболочки.
 * Портов оболочки плагину не нужно: всё он берёт возможностями в `activate`.
 */
export default function builtin() {
  return createStackSwitchPlugin();
}
