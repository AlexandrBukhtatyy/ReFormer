/**
 * Статус локальной стороны: какие пакеты `@reformer/*` стоят у проекта, есть ли проверка типов и
 * каталог кита.
 *
 * Клиент присылает его сервису в каждом вызове; сервис подставляет в поле `server` себя и отдаёт
 * статус ресурсом `reformer://status`. Знания (корпуса документации) у клиента нет — поэтому здесь
 * только то, что видно с диска.
 *
 * @module @reformer/mcp/local/status
 */

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import type { PlatformStatus } from '../contract/status.js';
import { describeTypecheck } from './form-workspace.js';
import { defaultPackageBases, locatePackage } from './package-locator.js';
import { knowledgeProblems } from './problems.js';
import { kitCatalogSummary } from './kit-catalog.js';

/** Пакеты, о версиях которых клиент сообщает сервису. Порядок — как у знания сервиса. */
export const REPORTED_PACKAGES = [
  '@reformer/core',
  '@reformer/cdk',
  '@reformer/ui-kit',
  '@reformer/renderer-react',
  '@reformer/renderer-json',
  '@reformer/form-registry',
  '@reformer/mcp',
] as const;

/** Версия самого клиента — из его `package.json` (от `dist/local/` — два уровня вверх). */
function ownVersion(): string {
  try {
    const path = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'package.json');
    return (JSON.parse(readFileSync(path, 'utf-8')) as { version?: string }).version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

/** Статус локальной стороны; `server` — сам клиент, сервис заменит его собой. */
export function localPlatformStatus(): PlatformStatus {
  const bases = defaultPackageBases();
  const catalog = kitCatalogSummary();
  return {
    profile: 'node',
    server: { version: ownVersion(), buildId: null },
    packages: REPORTED_PACKAGES.map((name) => {
      const location = locatePackage(name, bases);
      return {
        name,
        root: location?.root ?? null,
        version: location?.version ?? null,
        via: location?.via ?? null,
      };
    }),
    typecheck: describeTypecheck(),
    uiKitCatalog: {
      found: catalog.path !== null,
      components: catalog.components,
      source: catalog.path,
      package: catalog.package,
      framework: catalog.framework,
    },
    bases,
    problems: knowledgeProblems(),
  };
}
