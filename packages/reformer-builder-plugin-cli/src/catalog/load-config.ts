/**
 * Загрузка и проверка формы конфига генератора каталога.
 *
 * Конфиг — `catalog.config.mjs` (с `// @ts-check` и `defineKitCatalog` его проверяет редактор)
 * или `catalog.config.json`. Форма проверяется здесь целиком, до TypeScript и интроспекции:
 * опечатка в ключе (`categoris`) иначе молча выключила бы раздел палитры, а значение не того
 * типа уронило бы генератор исключением вместо понятного отказа.
 *
 * @module @reformer/builder-plugin-cli/catalog/load-config
 */

import { readFile, stat } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { pathToFileURL } from 'node:url';

import type { Finding } from '../commands/findings.js';
import type { KitCatalogConfig } from './config.js';

/** Имена конфига по умолчанию, в порядке поиска. */
export const CATALOG_CONFIG_FILES: readonly string[] = [
  'catalog.config.mjs',
  'catalog.config.js',
  'catalog.config.json',
];

export type LoadedCatalogConfig =
  | {
      readonly ok: true;
      readonly config: KitCatalogConfig;
      /** Абсолютный путь файла конфига. */
      readonly file: string;
    }
  | { readonly ok: false; readonly findings: readonly Finding[] };

async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Находит и загружает конфиг: явный файл либо первый из {@link CATALOG_CONFIG_FILES} в `dir`.
 * Ничего не бросает: отказы — замечания `catalog-config-invalid`.
 */
export async function loadKitCatalogConfig(
  dir: string,
  explicit?: string
): Promise<LoadedCatalogConfig> {
  let file: string | undefined = explicit;
  if (file === undefined) {
    for (const name of CATALOG_CONFIG_FILES) {
      if (await isFile(join(dir, name))) {
        file = join(dir, name);
        break;
      }
    }
  }
  const fail = (message: string, where?: string): LoadedCatalogConfig => ({
    ok: false,
    findings: [
      { code: 'catalog-config-invalid', message, ...(where === undefined ? {} : { file: where }) },
    ],
  });
  if (file === undefined) {
    return fail(`в каталоге нет конфига каталога (${CATALOG_CONFIG_FILES.join(', ')})`);
  }
  const shown = basename(file);
  if (!(await isFile(file))) return fail(`конфига «${file}» нет`, shown);

  let value: unknown;
  try {
    if (file.endsWith('.json')) {
      value = JSON.parse(await readFile(file, 'utf8')) as unknown;
    } else {
      // Метка времени в адресе — чтобы повторная загрузка в одном процессе (тесты, dev) читала
      // файл заново, а не модуль из кеша загрузчика.
      const url = `${pathToFileURL(file).href}?t=${String((await stat(file)).mtimeMs)}`;
      const module = (await import(url)) as { default?: unknown };
      value = module.default;
    }
  } catch (error) {
    return fail(`конфиг не загружается: ${describe(error)}`, shown);
  }

  const problems = checkKitCatalogConfig(value);
  if (problems.length > 0) {
    return {
      ok: false,
      findings: problems.map((message) => ({
        code: 'catalog-config-invalid',
        message,
        file: shown,
      })),
    };
  }
  return { ok: true, config: value as KitCatalogConfig, file };
}

// ── Проверка формы ───────────────────────────────────────────────────────────────

type Check = (value: unknown, path: string, problems: string[]) => void;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const str: Check = (value, path, problems) => {
  if (typeof value !== 'string' || value === '') problems.push(`${path}: нужна непустая строка`);
};

const strings: Check = (value, path, problems) => {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || item === '')) {
    problems.push(`${path}: нужен массив непустых строк`);
  }
};

const object: Check = (value, path, problems) => {
  if (!isRecord(value)) problems.push(`${path}: нужен объект`);
};

function recordOf(check: Check): Check {
  return (value, path, problems) => {
    if (!isRecord(value)) {
      problems.push(`${path}: нужен объект`);
      return;
    }
    for (const [key, item] of Object.entries(value)) check(item, `${path}.${key}`, problems);
  };
}

function shape(fields: Readonly<Record<string, Check>>, required: readonly string[] = []): Check {
  return (value, path, problems) => {
    if (!isRecord(value)) {
      problems.push(`${path}: нужен объект`);
      return;
    }
    for (const key of required) {
      if (value[key] === undefined) problems.push(`${path}.${key}: обязателен`);
    }
    for (const [key, item] of Object.entries(value)) {
      const check = fields[key];
      if (check === undefined) {
        problems.push(`${path}.${key}: неизвестный ключ`);
        continue;
      }
      if (item !== undefined) check(item, `${path}.${key}`, problems);
    }
  };
}

function oneOf(...allowed: readonly unknown[]): Check {
  return (value, path, problems) => {
    if (!allowed.includes(value)) {
      problems.push(`${path}: допустимо ${allowed.map((v) => JSON.stringify(v)).join(' | ')}`);
    }
  };
}

const GROUPS = ['Control', 'Options', 'Textfield', 'Behavior', 'State'];

const kitCheck: Check = (value, path, problems) => {
  if (!isRecord(value)) {
    problems.push(`${path}: нужен объект`);
    return;
  }
  str(value.id, `${path}.id`, problems);
  const palette = value.palette;
  if (palette !== undefined) {
    if (!isRecord(palette)) problems.push(`${path}.palette: нужен объект`);
    else {
      for (const key of Object.keys(palette)) {
        if (key === 'glyphs') recordOf(str)(palette[key], `${path}.palette.glyphs`, problems);
        else if (key === 'categoryByName' || key === 'order') {
          problems.push(`${path}.palette.${key}: разделы палитры задаёт ключ categories конфига`);
        } else problems.push(`${path}.palette.${key}: неизвестный ключ`);
      }
    }
  }
};

const fieldCheck = shape(
  {
    exportName: str,
    propsFrom: str,
    value: str,
    description: str,
    onChangeDescription: str,
    seam: strings,
    runtimeProps: recordOf(object),
    variantGroup: str,
    variant: str,
    classGroups: strings,
  },
  ['value']
);

const recordCheck = shape({
  exportName: str,
  propsFrom: str,
  subpath: str,
  variantGroup: str,
  variant: str,
  classGroups: strings,
});

const groupsCheck: Check = (value, path, problems) => {
  if (typeof value === 'function') return;
  recordOf(oneOf(...GROUPS))(value, path, problems);
};

const fieldWrapperCheck: Check = (value, path, problems) => {
  if (value === 'reformer' || value === false) return;
  if (!isRecord(value)) {
    problems.push(`${path}: допустимо 'reformer' | false | объект схем пропсов`);
    return;
  }
  recordOf(object)(value, path, problems);
};

const configCheck = shape(
  {
    entry: str,
    tsconfig: str,
    out: str,
    schemaRef: str,
    version: str,
    kit: kitCheck,
    ownership: shape({ packages: strings }),
    fields: recordOf(fieldCheck),
    fieldWrapper: fieldWrapperCheck,
    fieldSeam: recordOf(object),
    records: recordOf(recordCheck),
    statics: recordOf(str),
    parts: recordOf(str),
    categories: recordOf(strings),
    palette: strings,
    limited: recordOf(str),
    service: strings,
    exclude: strings,
    leaves: strings,
    unclassified: oneOf('service', 'refuse'),
    props: shape({
      pick: recordOf(strings),
      omit: recordOf(strings),
      override: recordOf(recordOf(object)),
      groups: groupsCheck,
    }),
  },
  ['entry', 'kit']
);

/** Проблемы формы конфига; пусто — форма годна. */
export function checkKitCatalogConfig(value: unknown): string[] {
  const problems: string[] = [];
  if (!isRecord(value)) {
    return ['конфиг — не объект: export default defineKitCatalog({ … }) или JSON-объект'];
  }
  configCheck(value, 'config', problems);
  return problems.map((problem) => problem.replace(/^config\./, ''));
}
