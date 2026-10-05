/**
 * Имена плагина «Проект» — отдельным листом графа.
 *
 * Идентификаторы команд и вкладов — то, на что ссылаются снаружи: раскладка клавиш человека,
 * e2e, ассистент. Модуль обязан остаться без импортов значений — кроме собственного
 * манифеста: JSON это лист, и кода плагина за ним нет.
 *
 * @module plugins/base/project/contract
 */

import manifest from './manifest.json';

/** Идентификатор плагина: пространство имён во всех реестрах и в словаре. */
export const PROJECT_PLUGIN_ID = manifest.id;

/** «Открыть папку…» — выбор каталога проекта. */
export const OPEN_PROJECT_COMMAND_ID = 'project.openProject';
/** Сохранить активный документ в источник. */
export const SAVE_COMMAND_ID = 'project.save';
/** Сохранить всё изменённое. */
export const SAVE_ALL_COMMAND_ID = 'project.saveAll';
/** Открыть недавний проект: с `{ id }` — этот, без аргументов — выбор из списка. */
export const OPEN_RECENT_COMMAND_ID = 'project.openRecent';
/** Убрать из списка все недавние проекты, кроме открытого. */
export const CLEAR_RECENT_COMMAND_ID = 'project.clearRecent';

/** Стартовая страница: «Открыть папку…» и недавно открытые проекты. */
export const PROJECT_WELCOME_PANEL_ID = 'project.welcome';
