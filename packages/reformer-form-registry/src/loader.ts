/**
 * Загрузка частей формы и сборка готового к монтированию бандла.
 *
 * Граница «данные / код» проходит здесь и она жёсткая: `DataSource` умеет `http`, `CodeSource` —
 * нет. Загружать код по сети означало бы исполнять то, что отдал сервер; вариант `http` для кода
 * не «пока не реализован», а сознательно отсутствует в типах.
 *
 * @module reformer/form-registry/loader
 */

import type { FormFlowConfig, FormModel } from '@reformer/core';
import type { FormBehavior } from '@reformer/core/behaviors';
import {
  composeRegistries,
  migrateJsonSchema,
  type ComponentRegistry,
  type JsonFormSchema,
} from '@reformer/renderer-json';
import type { SchemaCache } from './cache';
import { assertFormSchemaShape, fetchJson } from './net';
import { preflight, formatPreflight, type PreflightResult } from './preflight';
import type {
  CodeSource,
  DataSource,
  FormBehaviorFactory,
  FormEntry,
  FormValidation,
} from './types';

/** Всё, что нужно, чтобы синхронно собрать форму. */
export interface LoadedForm<T extends object = Record<string, unknown>> {
  /** Документ схемы — всегда формата 2: прежний формат загрузчик переводит при загрузке. */
  schema: JsonFormSchema<T>;
  /** Базовый реестр, скомпонованный с расширением записи. */
  registry: ComponentRegistry;
  initial?: T;
  makeModel?: () => FormModel<T>;
  /** Поведение формы либо его фабрика от настроек места монтирования. */
  behavior?: FormBehavior<T> | FormBehaviorFactory<T>;
  validation?: FormValidation<T>;
  flow?: FormFlowConfig<T>;
  /** Результат проверок; `undefined` — preflight отключён. */
  preflight?: PreflightResult;
}

/** Ошибка загрузки части формы — с указанием, какой именно. */
export class FormLoadError extends Error {
  constructor(
    readonly entryKey: string,
    readonly part: string,
    message: string,
    override readonly cause?: unknown
  ) {
    super(`[form-registry] ${entryKey}: ${part} — ${message}`);
    this.name = 'FormLoadError';
  }
}

/** Загрузилось, но не прошло проверки. Отдельный тип: причина принципиально иная. */
export class FormPreflightError extends Error {
  constructor(
    readonly entryKey: string,
    readonly result: PreflightResult
  ) {
    super(formatPreflight(entryKey, result));
    this.name = 'FormPreflightError';
  }
}

export const entryKeyOf = (e: Pick<FormEntry, 'id' | 'version'>): string => `${e.id}@${e.version}`;

export interface LoadFormOptions {
  /** Кэш схем. Без него сетевые источники тянутся заново при каждой сборке. */
  cache?: SchemaCache;
  signal?: AbortSignal;
  /**
   * `'error'` (по умолчанию) — непройденный preflight бросает; `'warn'` — только диагностика;
   * `'off'` — не проверять.
   */
  preflight?: 'error' | 'warn' | 'off';
  /**
   * Имена компонентов-визардов для перевода документа прежнего формата: их `componentProps.steps`
   * становятся детьми узла. По умолчанию — `DEFAULT_STEP_HOSTS` из `@reformer/renderer-json`.
   */
  stepHosts?: readonly string[];
  /**
   * @param d.level - Серьёзность проблемы. В режиме `'error'` диагностики рассылаются ДО броска,
   *   поэтому уровень здесь не выводится из режима и передаётся явно.
   */
  onDiagnostic?: (d: {
    code: string;
    message: string;
    entryKey: string;
    level?: 'error' | 'warn';
  }) => void;
  /** Подменяемо в тестах. */
  fetchImpl?: typeof fetch;
}

/** Ключ кэша сетевого источника. Владелец в ключе — хранилище общее на origin. */
const netKey = (entry: Pick<FormEntry, 'owner' | 'id' | 'version'>, part: string): string =>
  `${entry.owner}/${entry.id}@${entry.version}#${part}`;

async function loadData<T>(
  src: DataSource<T> | undefined,
  entry: Pick<FormEntry, 'owner' | 'id' | 'version'>,
  part: string,
  opts: LoadFormOptions
): Promise<T | undefined> {
  if (!src) return undefined;
  const key = entryKeyOf(entry);
  if (src.kind === 'inline') return src.value;
  if (src.kind === 'module') {
    try {
      return await src.load();
    } catch (e) {
      throw new FormLoadError(key, part, 'модуль не загрузился', e);
    }
  }

  // ── http
  const fetchOne = async (
    etag: string | undefined,
    signal: AbortSignal
  ): Promise<{ data: T; etag?: string; notModified: boolean }> => {
    const res = await fetchJson<T>(src.url, {
      init: src.init,
      signal,
      etag,
      fetchImpl: opts.fetchImpl,
    });
    // Структурная проверка ДО кэша: класть чужой JSON в кэш — значит закрепить ошибку.
    if (!res.notModified && part === 'schema') assertFormSchemaShape(src.url, res.data);
    return res;
  };

  try {
    if (opts.cache) return await opts.cache.get<T>(netKey(entry, part), fetchOne, opts.signal);
    const res = await fetchOne(undefined, opts.signal ?? new AbortController().signal);
    return res.data;
  } catch (e) {
    throw new FormLoadError(key, part, `не загрузилось по сети (${src.url})`, e);
  }
}

async function loadCode<T>(
  src: CodeSource<T> | undefined,
  entryKey: string,
  part: string
): Promise<T | undefined> {
  if (!src) return undefined;
  if (src.kind === 'inline') return src.value;
  try {
    return await src.load();
  } catch (e) {
    throw new FormLoadError(entryKey, part, 'модуль не загрузился', e);
  }
}

/**
 * Загружает все части записи, компонует реестр и проверяет результат.
 *
 * Документ схемы прежнего формата переводится в формат 2 (`migrateJsonSchema`).
 *
 * @param entry - Запись реестра.
 * @param baseRegistry - Базовый реестр компонентов (общее ядро приложения).
 * @returns Готовый {@link LoadedForm} — остаётся синхронно собрать форму.
 * @throws {FormLoadError} Часть не загрузилась.
 * @throws {FormPreflightError} Загрузилось, но не прошло проверки (при `preflight: 'error'`).
 */
export async function loadForm<T extends object>(
  entry: FormEntry<T>,
  baseRegistry: ComponentRegistry,
  opts: LoadFormOptions = {}
): Promise<LoadedForm<T>> {
  const key = entryKeyOf(entry);

  const [rawSchema, own, initial, makeModel, behavior, validation, flow] = await Promise.all([
    loadData(entry.schema, entry, 'schema', opts),
    loadCode(entry.registry, key, 'registry'),
    loadData(entry.initial, entry, 'initial', opts),
    loadCode(entry.model, key, 'model'),
    loadCode(entry.behavior, key, 'behavior'),
    loadCode(entry.validation, key, 'validation'),
    loadCode(entry.flow, key, 'flow'),
  ]);

  if (!rawSchema) throw new FormLoadError(key, 'schema', 'схема не загрузилась');
  if (!initial && !makeModel) {
    throw new FormLoadError(
      key,
      'model',
      'нужны либо `initial` (начальные значения), либо `model` (фабрика модели)'
    );
  }
  // Сборка `createForm` читает только формат 2, а документ приходит откуда угодно — из бандла, по
  // сети, из постоянного кэша, — и там вполне может лежать прежний формат: кэш переживает выкладку.
  // Поэтому перевод делается здесь, на каждой загрузке, а не при записи в кэш.
  const schema = migrateJsonSchema<T>(
    rawSchema,
    opts.stepHosts ? { stepHosts: opts.stepHosts } : {}
  );

  // Расширение записи перекрывает базу — last-wins, как у Object.assign.
  const registry = own ? composeRegistries(baseRegistry, own) : baseRegistry;

  let checked: PreflightResult | undefined;
  const mode = opts.preflight ?? 'error';
  if (mode !== 'off') {
    checked = preflight<T>({ entry, schema, registry, initial, flow });
    for (const p of checked.problems) {
      opts.onDiagnostic?.({ code: p.code, message: p.message, entryKey: key, level: p.level });
    }
    if (!checked.ok && mode === 'error') throw new FormPreflightError(key, checked);
  }

  return {
    schema,
    registry,
    initial,
    makeModel,
    behavior,
    validation,
    flow,
    preflight: checked,
  };
}
