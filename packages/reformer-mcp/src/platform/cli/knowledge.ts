/**
 * Знание, собранное из того, что доступно процессу Node: диск и (при наличии) компилятор.
 *
 * Один экземпляр на процесс, пока не изменились артефакты пакетов. Отпечаток — места установки
 * пакетов и время изменения их `llms-index.json`, `llms.txt` и каталога кита; он проверяется не
 * чаще раза в секунду. Пересобрали пакет посреди сессии — следующий вызов инструмента увидит новый
 * индекс без перезапуска сервера. Раньше знание жило до конца процесса: грамматика и кросс-проверка
 * судили по старому индексу, а компилятор — по новым `.d.ts` (аудит 2026-11, C4).
 *
 * @module reformer-mcp/platform/cli/knowledge
 */

import { readFileSync, statSync } from 'fs';
import { join } from 'path';
import { BUILD_ID } from '../../build-info.js';
import { KNOWN_PACKAGES, OWN_PACKAGE } from '../../core/docs/packages.js';
import { createKnowledge, type Knowledge } from '../../core/knowledge.js';
import type { PublicSymbol } from '../../core/index/public-symbol.js';
import type { PlatformStatus } from '../../core/status.js';
import { createCliDocsSource, docsPaths } from './docs-source.js';
import { createCliIndexSource } from './index-source.js';
import { createCliRecipeSource } from './recipe-source.js';
import { createCliSpecSource } from './spec-source.js';
import { createCliIssueSink } from './issue-sink.js';
import { createCliFormWorkspace, describeTypecheck } from './form-workspace.js';
import {
  defaultPackageBases,
  locatePackage,
  locatePackages,
  serverDirectory,
} from './package-locator.js';
import { clearKnowledgeProblems, knowledgeProblems } from './problems.js';
import { loadUiKitCatalog, uiKitCatalogSummary } from './ui-kit-catalog.js';

/**
 * Разбор AST — только как фолбэк для пакета без индекса.
 *
 * Импорт динамический: модуль тянет `typescript`, и грузить его на старте ради случая,
 * которого обычно нет, незачем. Отсутствие пакета (он в optionalDependencies) не ошибка —
 * вызывающий трактует это как «символов нет».
 */
async function parseSymbolsFallback(pkg: string): Promise<PublicSymbol[]> {
  const mod = await import('./symbols-parser.js');
  return mod.getPublicSymbols(pkg);
}

const ARTIFACTS = ['llms-index.json', 'llms.txt', 'component-catalog.json'];
/** Как часто сверять отпечаток артефактов. */
const FINGERPRINT_INTERVAL_MS = 1000;

function mtimeOf(path: string): number {
  try {
    return statSync(path).mtimeMs;
  } catch {
    return -1;
  }
}

/** Отпечаток артефактов знания: где стоят пакеты и когда менялись их файлы. */
function artifactsFingerprint(): string {
  const parts: string[] = [];
  for (const pkg of KNOWN_PACKAGES) {
    for (const location of locatePackages(pkg)) {
      for (const file of ARTIFACTS) {
        parts.push(`${location.root}/${file}@${mtimeOf(join(location.root, file))}`);
      }
    }
  }
  for (const path of docsPaths(OWN_PACKAGE)) parts.push(`${path}@${mtimeOf(path)}`);
  return parts.join('|');
}

/** Версия и метка сборки самого сервера: `package.json` рядом с модулем и время его сборки. */
function serverIdentity(): PlatformStatus['server'] {
  const own = locatePackage(OWN_PACKAGE, [serverDirectory()]);
  let version = own?.version ?? '0.0.0';
  if (!own) {
    try {
      version = JSON.parse(
        readFileSync(join(serverDirectory(), '../../../package.json'), 'utf-8')
      ).version;
    } catch {
      // версия неизвестна
    }
  }
  return { version, buildId: BUILD_ID };
}

/** Часть статуса, которую знает только CLI. */
export function cliPlatformStatus(): PlatformStatus {
  const bases = defaultPackageBases();
  const catalog = uiKitCatalogSummary();
  return {
    profile: 'node',
    server: serverIdentity(),
    packages: KNOWN_PACKAGES.map((name) => {
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
    },
    bases,
    problems: knowledgeProblems(),
  };
}

let cached: Knowledge | null = null;
let cachedFingerprint = '';
let checkedAt = 0;

/** Знание процесса. Пересобирается, когда изменились артефакты пакетов. */
export function cliKnowledge(): Knowledge {
  const now = Date.now();
  if (cached && now - checkedAt < FINGERPRINT_INTERVAL_MS) return cached;
  checkedAt = now;
  const fingerprint = artifactsFingerprint();
  if (cached && fingerprint === cachedFingerprint) return cached;
  cachedFingerprint = fingerprint;
  // Проблемы прежнего знания описывали файлы, которых уже нет.
  clearKnowledgeProblems();
  cached = createKnowledge({
    docs: createCliDocsSource(),
    index: createCliIndexSource(),
    recipes: createCliRecipeSource(),
    spec: createCliSpecSource(),
    issues: createCliIssueSink(),
    forms: createCliFormWorkspace(),
    symbolsFallback: parseSymbolsFallback,
    uiKitCatalog: async () => loadUiKitCatalog(),
    status: cliPlatformStatus,
  });
  return cached;
}

/** Только для тестов — пересоздать знание (сбрасывает все кэши разом). */
export function __resetCliKnowledge(): void {
  cached = null;
  cachedFingerprint = '';
  checkedAt = 0;
}
