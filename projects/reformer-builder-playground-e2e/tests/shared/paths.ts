import path from 'path';

/** Корень монорепозитория: `tests/shared` → пакет e2e → `projects` → корень. */
const REPO_ROOT = path.resolve(__dirname, '../../../..');

/** Пакет билдера — его dev-сервер или собранный `dist/` поднимает конфиг Playwright. */
export const BUILDER_DIR = path.join(REPO_ROOT, 'projects', 'reformer-builder');

/** Проект, который билдер открывает в тестах как рабочий каталог. */
export const PLAYGROUND_DIR = path.join(REPO_ROOT, 'projects', 'reformer-builder-playground');

/**
 * Конфиг уровня ЗАПУСКА билдера: состав плагинов, локаль и тема.
 *
 * Лежит в playground отдельным файлом, а не в его `.ui_builder/config.json`: тот читается ещё
 * и как конфиг ПРОЕКТА, а `preset`, `profiles` и `defaults` на уровне проекта не применяются —
 * билдер говорит об этом предупреждением при каждом открытии.
 */
export const LAUNCH_CONFIG = path.join(PLAYGROUND_DIR, 'builder.launch.json');
