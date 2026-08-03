/**
 * Загрузка runtime-bundle клиента на бутстрапе. Launcher (`bin/reformer-builder.mjs`) отдаёт
 * `GET {BASE_URL}__reformer-builder/runtime.json` = `{ catalog, config }` (каждое `null`, если не
 * передано). Здесь: фетч (нет launcher / dev-сервер / hosted → 404/не-JSON → тихий fallback),
 * валидация конфига (AJV по {@link './runtime-config.schema.json'}) и каталога (реюз
 * {@link '../catalog/contract'.validateCatalog}), установка {@link '../config/state'}.
 *
 * Отсутствующий bundle ⇒ дефолты (билдер работает как сейчас). Present-but-invalid ⇒ `throw`
 * {@link RuntimeBundleError} → экран `BootError` (fail visible).
 *
 * @module reformer-builder/config/load
 */

import Ajv, { type ValidateFunction } from 'ajv';
import type { CatalogJson } from '../catalog/types';
import { validateCatalog } from '../catalog/contract';
import configSchema from './runtime-config.schema.json';
import type { RuntimeConfig } from './types';
import { setClientCatalog, setRuntimeConfig } from './state';

/** URL, по которому launcher отдаёт клиентский bundle (относительно `BASE_URL`). */
export const RUNTIME_BUNDLE_PATH = '__reformer-builder/runtime.json';

/** Сырой bundle от launcher'а. */
interface RuntimeBundle {
  catalog: unknown;
  config: unknown;
}

/** Ошибка валидации переданного клиентом файла — показывается на экране `BootError`. */
export class RuntimeBundleError extends Error {
  readonly source: 'config' | 'catalog';
  readonly errors: string[];

  constructor(source: 'config' | 'catalog', errors: string[]) {
    super(
      `Невалидный ${source === 'config' ? 'конфиг билдера' : 'каталог компонентов'}:\n` +
        errors.map((e) => `  • ${e}`).join('\n')
    );
    this.name = 'RuntimeBundleError';
    this.source = source;
    this.errors = errors;
  }
}

let configValidateFn: ValidateFunction | null = null;

/** Провалидировать runtime-конфиг против контракта (AJV draft-07). */
export function validateRuntimeConfig(json: unknown): { valid: boolean; errors: string[] } {
  if (!configValidateFn) {
    const ajv = new Ajv({ allErrors: true, strict: false });
    configValidateFn = ajv.compile(configSchema);
  }
  const valid = configValidateFn(json);
  const errors = (configValidateFn.errors ?? []).map((e) =>
    `${e.instancePath || '/'} ${e.message ?? ''}`.trim()
  );
  return { valid: Boolean(valid), errors };
}

/** Базовый URL приложения (с завершающим `/`); на hosted-сборке — `/ReFormer/builder/`. */
function baseUrl(): string {
  const base = import.meta.env.BASE_URL || '/';
  return base.endsWith('/') ? base : `${base}/`;
}

/** Забрать bundle у launcher'а; нет launcher'а / не-JSON-ответ ⇒ `null` (fallback на дефолты). */
async function fetchRuntimeBundle(): Promise<RuntimeBundle | null> {
  let res: Response;
  try {
    res = await fetch(`${baseUrl()}${RUNTIME_BUNDLE_PATH}`, { cache: 'no-cache' });
  } catch {
    // Сетевой сбой / нет сервера endpoint'а — работаем на дефолтах.
    return null;
  }
  if (!res.ok) return null;
  const ct = res.headers.get('content-type') ?? '';
  if (!ct.includes('application/json')) return null; // dev/hosted SPA-fallback отдаёт index.html
  try {
    const json = (await res.json()) as Partial<RuntimeBundle> | null;
    if (!json || typeof json !== 'object') return null;
    return { catalog: json.catalog ?? null, config: json.config ?? null };
  } catch {
    return null;
  }
}

/**
 * Загрузить и применить клиентский bundle. Ставит `config`/`catalog` в {@link '../config/state'}.
 * Должно вызываться ДО инициализации графа `store`/`catalog`. Бросает {@link RuntimeBundleError} при
 * невалидном переданном файле.
 */
export async function loadRuntimeBundle(): Promise<void> {
  const bundle = await fetchRuntimeBundle();
  if (!bundle) return; // нет launcher'а / нет файлов — дефолты

  if (bundle.config != null) {
    const { valid, errors } = validateRuntimeConfig(bundle.config);
    if (!valid) throw new RuntimeBundleError('config', errors);
    setRuntimeConfig(bundle.config as RuntimeConfig);
  }

  if (bundle.catalog != null) {
    const { valid, errors } = validateCatalog(bundle.catalog);
    if (!valid) throw new RuntimeBundleError('catalog', errors);
    setClientCatalog(bundle.catalog as CatalogJson);
  }
}
