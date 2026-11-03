/**
 * Совместимостный фасад над слиянием индексов.
 *
 * Логика уехала в `core/index/merge.ts` (слияние, проверка схемы) и
 * `platform/cli/index-source.ts` (пути и чтение с диска). Здесь остался прежний API поверх
 * знания процесса — того же, что видят все остальные фасады.
 *
 * Именно поверх знания, а не поверх собственного кэша: два экземпляра слитого индекса означали
 * бы двойное слияние на старте и, что хуже, возможность разъехаться — сброс кэша в одном месте
 * не влиял бы на другое.
 *
 * Фасад временный, как и `utils/docs-parser.ts`: он держит потребителей неизменными, пока их
 * не перевели на фабрику `createKnowledge`.
 *
 * @module reformer-mcp/index/loader
 */

import { asPackageIndex } from '../core/index/merge.js';
import { cliKnowledge, __resetCliKnowledge } from '../platform/cli/knowledge.js';
import { createCliIndexSource } from '../platform/cli/index-source.js';
import type { MergedIndex, PackageIndex } from '../core/index/types.js';

/** Прочитать индекс одного пакета. `null` — нет файла, битый JSON или чужая версия схемы. */
export function loadPackageIndex(pkg: string): PackageIndex | null {
  return asPackageIndex(createCliIndexSource().read(pkg));
}

/** Слитый индекс всех установленных пакетов. */
export function getMergedIndex(): MergedIndex {
  return cliKnowledge().index;
}

/** Только для тестов — сбросить кэш слияния. */
export function __resetIndexCache(): void {
  __resetCliKnowledge();
}
