/**
 * Генератор каталога кита из TypeScript-типов — программный вход `reformer-plugin catalog`.
 *
 * Каталог кита (`component-catalog.json`, контракт SDK) — то, что дизайн-система рассказывает
 * о себе билдеру: записи компонентов с пропсами и блок `kit`. Руками такой каталог неизбежно
 * отстаёт от кода; здесь набор пропсов выводится из типов входа кита, а конфиг
 * (`catalog.config.mjs`, см. `./catalog-config`) решает только то, чего типы не знают: роли,
 * палитру, поля и их значения.
 *
 * Генератор живёт в CLI, а не в SDK: SDK — контракт данных без TypeScript в рантайме. Результат
 * проверяется той же проверкой каталога, которой реестр китов билдера принимает кит
 * (`loadCatalogValidator` из `@reformer/builder-plugin-api/tooling`), — до записи файла.
 *
 * @example
 * ```ts
 * import { checkKitCatalog, generateKitCatalog } from '@reformer/builder-plugin-cli/catalog';
 *
 * const result = await generateKitCatalog({ dir: './my-kit' });
 * if (result.ok) await writeFile(result.outFile, result.text);
 * ```
 *
 * @module @reformer/builder-plugin-cli/catalog
 */

import { readFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';

import {
  CATALOG_CONTRACT_VERSION,
  loadCatalogValidator,
  SUPPORTED_CATALOG_CONTRACT_VERSIONS,
} from '@reformer/builder-plugin-api/tooling';
import type * as TS from 'typescript';

import type { Finding } from '../commands/findings.js';
import type { KitCatalogConfig } from './config.js';
import { diffCatalogs, type CatalogDiffEntry } from './drift.js';
import { assembleCatalog, serializeCatalog, type GeneratedCatalog } from './emit.js';
import { KitIntrospector } from './introspect.js';
import { checkKitCatalogConfig, loadKitCatalogConfig } from './load-config.js';
import { createCatalogProgram, loadTypeScript, type TypeScriptModule } from './program.js';
import { buildRecords } from './records.js';

export type {
  CatalogPropSchema,
  KitCatalogConfig,
  KitCatalogDescriptor,
  KitFieldConfig,
  KitPropGroupRule,
  KitPropsConfig,
  KitPropsSelector,
  KitRecordConfig,
  OptionsPropOptions,
} from './config.js';
export {
  defineKitCatalog,
  FIELD_WRAPPER_PRESETS,
  groupByName,
  optionsProp,
  REFORMER_FIELD_WRAPPER,
  SEAM_RUNTIME_PROPS,
} from './config.js';
export { diffCatalogs, formatCatalogDiff, type CatalogDiffEntry } from './drift.js';
export type { GeneratedCatalog } from './emit.js';
export { CATALOG_CONFIG_FILES, checkKitCatalogConfig } from './load-config.js';
export type { TypeScriptModule } from './program.js';

/** Параметры генерации. */
export interface KitCatalogOptions {
  /** Каталог кита: в нём ищется конфиг, от него считаются пути конфига, переданного объектом. */
  readonly dir: string;
  /** Файл конфига; по умолчанию `catalog.config.mjs`/`.js`/`.json` в `dir`. */
  readonly configFile?: string;
  /** Конфиг объектом — вместо файла (программный вызов, тесты). */
  readonly config?: KitCatalogConfig;
  /** Модуль TypeScript; по умолчанию грузится из каталога кита, затем рядом с CLI. */
  readonly typescript?: TypeScriptModule;
  /** Хост компилятора — для фикстур в памяти. */
  readonly compilerHost?: TS.CompilerHost;
  /** Форматировать prettier'ом кита, если он есть (по умолчанию да). */
  readonly prettier?: boolean;
}

/** Сводка сгенерированного каталога. */
export interface KitCatalogStats {
  readonly records: number;
  readonly palette: number;
  readonly props: number;
}

export type KitCatalogResult =
  | {
      readonly ok: true;
      readonly catalog: GeneratedCatalog;
      /** Текст файла каталога. */
      readonly text: string;
      /** Куда его писать (`out` конфига). */
      readonly outFile: string;
      readonly stats: KitCatalogStats;
      /** Не отказы, а то, что стоит знать: записи без роли, без выведенных пропсов. */
      readonly notices: readonly string[];
    }
  | {
      readonly ok: false;
      readonly findings: readonly Finding[];
      readonly notices: readonly string[];
    };

/** Сколько ошибок контракта каталога показывать. */
const CATALOG_ERRORS_SHOWN = 5;

function slash(path: string): string {
  return path.replace(/\\/g, '/');
}

/** Генерирует каталог кита в память. Файл не пишет; ничего не бросает — отказы данными. */
export async function generateKitCatalog(options: KitCatalogOptions): Promise<KitCatalogResult> {
  // ── Конфиг ──
  let config: KitCatalogConfig;
  let configFile: string;
  if (options.config !== undefined) {
    configFile = options.configFile ?? join(options.dir, 'catalog.config.mjs');
    const problems = checkKitCatalogConfig(options.config);
    if (problems.length > 0) {
      return {
        ok: false,
        notices: [],
        findings: problems.map((message) => ({
          code: 'catalog-config-invalid',
          message,
          file: basename(configFile),
        })),
      };
    }
    config = options.config;
  } else {
    const loaded = await loadKitCatalogConfig(options.dir, options.configFile);
    if (!loaded.ok) return { ok: false, findings: loaded.findings, notices: [] };
    config = loaded.config;
    configFile = loaded.file;
  }
  // Абсолютный путь — несущее: происхождение пропа «исходники кита» сверяется с абсолютными
  // путями файлов программы, и при относительном `dir` (`'.'`) пропсы обёрток кита читались бы
  // пропсами чужого пакета и молча уходили бы в `x-inherits`.
  const baseDir = resolve(options.config !== undefined ? options.dir : dirname(configFile));
  const shownConfig = basename(configFile);
  const fail = (finding: Finding): KitCatalogResult => ({
    ok: false,
    findings: [finding],
    notices: [],
  });

  const version = config.version ?? CATALOG_CONTRACT_VERSION;
  if (!SUPPORTED_CATALOG_CONTRACT_VERSIONS.includes(version)) {
    return fail({
      code: 'catalog-config-invalid',
      message: `version: версии контракта «${version}» нет среди поддерживаемых (${SUPPORTED_CATALOG_CONTRACT_VERSIONS.join(', ')})`,
      file: shownConfig,
    });
  }

  // ── TypeScript и программа ──
  const ts = options.typescript ?? loadTypeScript(baseDir);
  if (ts === undefined) {
    return fail({
      code: 'typescript-missing',
      message:
        'TypeScript не найден ни в каталоге кита, ни рядом с CLI — генератор читает типы кита ' +
        'компилятором: npm install -D typescript',
    });
  }
  const host = options.compilerHost;
  const fileExists = (file: string): boolean =>
    host === undefined ? ts.sys.fileExists(file) : host.fileExists(file);
  const readText = (file: string): string | undefined =>
    host === undefined ? ts.sys.readFile(file) : host.readFile(file);

  const entry = slash(resolve(baseDir, config.entry));
  const defaultTsconfig = slash(join(baseDir, 'tsconfig.json'));
  const tsconfig =
    config.tsconfig !== undefined
      ? slash(resolve(baseDir, config.tsconfig))
      : fileExists(defaultTsconfig)
        ? defaultTsconfig
        : undefined;
  const created = createCatalogProgram(ts, { entry, tsconfig, host });
  if (!created.ok) {
    return fail({ code: 'catalog-config-invalid', message: created.message, file: shownConfig });
  }

  // ── Интроспекция и записи ──
  const introspector = new KitIntrospector(ts, created.program, {
    kitDir: slash(baseDir),
    ownPackages: new Set(config.ownership?.packages ?? []),
    fileExists,
    readFile: readText,
  });
  const exported = introspector.exportsOf(entry);
  if (exported === undefined) {
    return fail({
      code: 'catalog-config-invalid',
      message: `вход кита «${config.entry}» не попал в программу TypeScript`,
      file: shownConfig,
    });
  }
  const built = buildRecords({
    ts,
    config,
    introspector,
    exports: exported.exports,
    configFile: shownConfig,
  });
  const notices = [...built.notices];
  if (exported.unresolved.length > 0) {
    notices.push(`реэкспорты не разрешились (модуль не найден): ${exported.unresolved.join(', ')}`);
  }
  if (built.findings.length > 0) return { ok: false, findings: built.findings, notices };

  // ── Каталог ──
  const { palette: kitPalette, ...kitRest } = config.kit;
  const palette = {
    ...(Object.keys(built.categoryByName).length === 0
      ? {}
      : { categoryByName: built.categoryByName }),
    ...(built.order.length === 0 ? {} : { order: built.order }),
    ...(kitPalette?.glyphs === undefined ? {} : { glyphs: { ...kitPalette.glyphs } }),
  };
  const catalog = assembleCatalog({
    ...(config.schemaRef === undefined ? {} : { schemaRef: config.schemaRef }),
    version,
    kit: { ...kitRest, ...(Object.keys(palette).length === 0 ? {} : { palette }) },
    components: built.components,
  });

  const validate = await loadCatalogValidator();
  const check = validate(catalog);
  if (!check.valid) {
    return {
      ok: false,
      notices,
      findings: [
        {
          code: 'kit-invalid-catalog',
          message: `каталог не проходит контракт: ${check.errors.slice(0, CATALOG_ERRORS_SHOWN).join('; ')}`,
          file: shownConfig,
        },
      ],
    };
  }

  const outFile = resolve(baseDir, config.out ?? 'catalog.json');
  const text = await serializeCatalog(catalog, {
    dir: baseDir,
    outFile,
    ...(options.prettier === undefined ? {} : { prettier: options.prettier }),
  });
  const props = catalog.components.reduce((count, record) => {
    const properties = (record.propsSchema as { properties?: object }).properties;
    return count + (properties === undefined ? 0 : Object.keys(properties).length);
  }, 0);
  return {
    ok: true,
    catalog,
    text,
    outFile,
    notices,
    stats: { records: catalog.components.length, palette: built.paletteCount, props },
  };
}

export type KitCatalogCheckResult =
  | {
      readonly ok: true;
      readonly outFile: string;
      readonly stats: KitCatalogStats;
      readonly notices: readonly string[];
    }
  | {
      readonly ok: false;
      readonly findings: readonly Finding[];
      /** Расхождения файла с типами; пусто, если до сравнения не дошло. */
      readonly diff: readonly CatalogDiffEntry[];
      readonly notices: readonly string[];
    };

/**
 * Совпадает ли файл каталога с тем, что дают типы кита. Сравнение структурное: форматирование
 * и порядок ключей объекта не влияют. Расхождение — отказ `catalog-drift` с диффом.
 */
export async function checkKitCatalog(options: KitCatalogOptions): Promise<KitCatalogCheckResult> {
  const generated = await generateKitCatalog({ ...options, prettier: false });
  if (!generated.ok) return { ...generated, diff: [] };
  const shown = basename(generated.outFile);
  let text: string;
  try {
    text = await readFile(generated.outFile, 'utf8');
  } catch {
    return {
      ok: false,
      diff: [],
      notices: generated.notices,
      findings: [
        {
          code: 'catalog-drift',
          message: 'файла каталога нет — сгенерируйте его: reformer-plugin catalog',
          file: shown,
        },
      ],
    };
  }
  let current: unknown;
  try {
    current = JSON.parse(text) as unknown;
  } catch (error) {
    return {
      ok: false,
      diff: [],
      notices: generated.notices,
      findings: [
        {
          code: 'catalog-drift',
          message: `файл каталога — не JSON (${error instanceof Error ? error.message : String(error)})`,
          file: shown,
        },
      ],
    };
  }
  const diff = diffCatalogs(current, generated.catalog);
  if (diff.length === 0) {
    return {
      ok: true,
      outFile: generated.outFile,
      stats: generated.stats,
      notices: generated.notices,
    };
  }
  return {
    ok: false,
    diff,
    notices: generated.notices,
    findings: [
      {
        code: 'catalog-drift',
        message:
          `каталог разошёлся с типами кита (расхождений: ${String(diff.length)}) — ` +
          'перегенерируйте: reformer-plugin catalog',
        file: shown,
      },
    ],
  };
}
