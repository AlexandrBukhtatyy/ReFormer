/**
 * Справочники генератора, как их видит CLI в монорепо: каталог компонентов из
 * `packages/reformer-ui-kit/component-catalog.json` и операторы ядра из его `llms-index.json`.
 *
 * Оба файла закоммичены, поэтому тесты генератора детерминированы: golden-снимки сравнивают вывод
 * с тем, что даёт текущий кит и текущее ядро.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { coreOperatorsOf, type FormCatalogs } from '../../src/core/generate/catalogs';
import { uiKitFromCatalog } from '../../src/core/generate/ui-kit-components';
import { cliKnowledge } from '../../src/platform/cli/knowledge';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');

/** Каталог компонентов кита в монорепо. */
export const UI_KIT_CATALOG_PATH = resolve(
  repoRoot,
  'packages/reformer-ui-kit/component-catalog.json'
);

/** Справочники монорепо. */
export const CATALOGS: FormCatalogs = {
  uiKit: uiKitFromCatalog(JSON.parse(readFileSync(UI_KIT_CATALOG_PATH, 'utf8'))),
  core: coreOperatorsOf(cliKnowledge()),
};
