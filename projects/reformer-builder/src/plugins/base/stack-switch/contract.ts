/**
 * Имена переключателя сочетаний: идентификатор плагина и адреса его вкладов.
 *
 * Отдельным модулем — чтобы тест и композиция называли вклад тем же именем, что и плагин,
 * не импортируя ради строки его тело.
 *
 * @module plugins/base/stack-switch/contract
 */

import manifest from './manifest.json';

/** Идентификатор плагина: пространство имён во всех реестрах и в словаре. */
export const STACK_SWITCH_PLUGIN_ID = manifest.id;

/** Ячейка строки состояния — идентификатор панели и адрес вклада. */
export const STACK_SWITCH_CELL_ID = 'stack-switch.cell';

/** Поставщик пунктов палитры «Сочетание: …». Он же — адрес вклада в точке расширения. */
export const STACK_SWITCH_PALETTE_PROVIDER_ID = 'stack-switch.combinations';
