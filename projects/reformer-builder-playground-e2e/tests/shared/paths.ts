import path from 'path';

/** Корень монорепозитория: `tests/shared` → пакет e2e → `projects` → корень. */
export const REPO_ROOT = path.resolve(__dirname, '../../../..');

/** Пакет билдера — его dev-сервер или собранный `dist/` поднимает конфиг Playwright. */
export const BUILDER_DIR = path.join(REPO_ROOT, 'projects', 'reformer-builder');

/** Проект, который билдер открывает в тестах как рабочий каталог. */
export const PLAYGROUND_DIR = path.join(REPO_ROOT, 'projects', 'reformer-builder-playground');

/**
 * Конфиг билдера в playground — один файл на оба уровня чтения.
 *
 * Уровень ЗАПУСКА: лаунчер (или dev-сервер) отдаёт его приложению до сборки состава — отсюда
 * профиль «ReFormer + RJSF», локаль и тема. Уровень ПРОЕКТА: открыв playground, приложение
 * читает тот же файл ещё раз. Раскладка «запустил в корне проекта и его же открыл»: поля уровня
 * запуска совпадают с конфигом запуска, и билдер о них не предупреждает.
 */
export const PLAYGROUND_CONFIG = path.join(PLAYGROUND_DIR, '.ui_builder', 'config.json');
