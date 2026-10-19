/**
 * `reformer-plugin catalog [каталог] [--config <файл>] [--check]`: каталог кита из его типов.
 *
 * Без `--check` — генерирует каталог по конфигу кита (`catalog.config.mjs`) и пишет файл `out`
 * конфига (по умолчанию `catalog.json`). Каталог перед записью проходит ту же проверку контракта,
 * что у реестра китов билдера: не прошедший не пишется, прошлый файл остаётся.
 *
 * С `--check` — ничего не пишет и сверяет файл с тем, что дают типы: расхождение — отказ
 * `catalog-drift` с диффом. Так кит держит каталог в репозитории и узнаёт в CI, что обновлённая
 * дизайн-система или правка обёртки требуют перегенерации.
 *
 * Логика — в `../catalog` (программный вход `@reformer/builder-plugin-cli/catalog`); здесь только
 * запись файла и форма результата команды.
 *
 * @module @reformer/builder-plugin-cli/commands/catalog
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import {
  checkKitCatalog,
  formatCatalogDiff,
  generateKitCatalog,
  type KitCatalogStats,
} from '../catalog/index.js';
import type { Finding } from './findings.js';

export interface CatalogCommandOptions {
  /** Каталог кита — там лежит конфиг. */
  readonly dir: string;
  /** Явный файл конфига. */
  readonly configFile?: string;
  /** Только сверить файл каталога с типами, не записывая. */
  readonly check?: boolean;
}

export type CatalogCommandResult =
  | {
      readonly ok: true;
      readonly outFile: string;
      /** `true` — файл записан; `false` — только сверен (`--check`). */
      readonly written: boolean;
      readonly stats: KitCatalogStats;
      readonly notices: readonly string[];
    }
  | {
      readonly ok: false;
      readonly findings: readonly Finding[];
      /** Строки диффа для `catalog-drift`; иначе пусто. */
      readonly diff: readonly string[];
      readonly notices: readonly string[];
    };

/** Генерирует (или сверяет) каталог кита. Ничего не бросает: отказы — данные. */
export async function runCatalog(options: CatalogCommandOptions): Promise<CatalogCommandResult> {
  const source = {
    dir: options.dir,
    ...(options.configFile === undefined ? {} : { configFile: options.configFile }),
  };
  if (options.check === true) {
    const checked = await checkKitCatalog(source);
    if (!checked.ok) {
      return {
        ok: false,
        findings: checked.findings,
        diff: formatCatalogDiff(checked.diff),
        notices: checked.notices,
      };
    }
    return {
      ok: true,
      outFile: checked.outFile,
      written: false,
      stats: checked.stats,
      notices: checked.notices,
    };
  }

  const generated = await generateKitCatalog(source);
  if (!generated.ok) {
    return { ok: false, findings: generated.findings, diff: [], notices: generated.notices };
  }
  try {
    await mkdir(dirname(generated.outFile), { recursive: true });
    await writeFile(generated.outFile, generated.text);
  } catch (error) {
    return {
      ok: false,
      diff: [],
      notices: generated.notices,
      findings: [
        {
          code: 'catalog-config-invalid',
          message: `out: каталог не записан в «${generated.outFile}»: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
    };
  }
  return {
    ok: true,
    outFile: generated.outFile,
    written: true,
    stats: generated.stats,
    notices: generated.notices,
  };
}
