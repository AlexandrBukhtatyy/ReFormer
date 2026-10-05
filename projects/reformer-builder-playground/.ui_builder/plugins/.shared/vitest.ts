/**
 * Общее для vitest-конфигов пакетов плагинов этого проекта.
 *
 * Каталог назван с точки: любой другой подкаталог `.ui_builder/plugins` билдер считает плагином
 * или доменом, а этот пропускает.
 *
 * @module plugins/.shared/vitest
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Корень монорепозитория: `.shared` → `plugins` → `.ui_builder` → проект → `projects` → корень. */
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../..');

const source = (relative: string): string => path.join(repoRoot, relative);

/**
 * Пакет контракта и вкладываемые пакеты резолвятся в ИСХОДНИКИ, а не в `dist` — как у билдера:
 * иначе между правкой контракта и прогоном тестов плагина стояла бы сборка пакета, и половину
 * времени плагин проверялся бы против вчерашнего контракта.
 *
 * Порядок значим: подпути — раньше корня пакета.
 */
export const sourceAliases = {
  '@reformer/builder-plugin-api/internal': source(
    'packages/reformer-builder-plugin-api/src/internal.ts'
  ),
  '@reformer/builder-plugin-api/tooling': source(
    'packages/reformer-builder-plugin-api/src/tooling.ts'
  ),
  '@reformer/builder-plugin-api': source('packages/reformer-builder-plugin-api/src/index.ts'),
  '@reformer/builder-toolkit': source('packages/reformer-builder-toolkit/src/index.ts'),
  '@reformer/rjsf-kit-theme': source('packages/rjsf-kit-theme/src/index.ts'),
};
