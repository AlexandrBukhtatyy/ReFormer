/**
 * Имена выбора профиля: идентификатор плагина и адреса его вкладов.
 *
 * Отдельным модулем — чтобы тест и композиция называли вклад тем же именем, что и плагин,
 * не импортируя ради строки его тело.
 *
 * @module plugins/base/profile-switch/contract
 */

import manifest from './manifest.json';

/** Идентификатор плагина: пространство имён во всех реестрах и в словаре. */
export const PROFILE_SWITCH_PLUGIN_ID = manifest.id;

/** Ячейка строки состояния — идентификатор панели и адрес вклада. */
export const PROFILE_SWITCH_CELL_ID = 'profile-switch.cell';

/** Поставщик пунктов палитры «Профиль: …». Он же — адрес вклада в точке расширения. */
export const PROFILE_SWITCH_PALETTE_PROVIDER_ID = 'profile-switch.profiles';
