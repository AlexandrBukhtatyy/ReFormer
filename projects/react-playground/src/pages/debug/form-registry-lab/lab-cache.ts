/**
 * Кэш схем стенда: выбор хранилища, срок свежести, журнал событий.
 *
 * Хранилище выбирается ЯВНО, а не через `pickStorage`. Автовыбор идёт `opfs → indexeddb → memory`
 * и асинхронно пробует каждого кандидата — для стенда это дважды неудобно: в headless-браузере
 * доступность OPFS нестабильна (и тест «L2 переживает F5» начал бы флакать), а асинхронность
 * заставила бы рендерить первый кадр вообще без кэша. Конструкторы стратегий синхронны, поэтому
 * кэш готов сразу.
 *
 * Свой namespace обязателен: `clear()` стирает namespace ЦЕЛИКОМ, и общий префикс задел бы записи
 * других страниц.
 *
 * @module react-playground/examples/form-registry-lab/lab-cache
 */

import { createSchemaCache, type CacheEvent, type SchemaCache } from '@reformer/form-registry';
import {
  createIndexedDbStorage,
  createMemoryStorage,
  createOpfsStorage,
  isIndexedDbAvailable,
  isOpfsAvailable,
  type StorageStrategy,
} from '@reformer/form-registry/storage';
import { createLogStore, type LogStore } from './lab-store';

const NAMESPACE = 'reformer-forms-lab/v1';

export type LabStorageKind = 'indexeddb' | 'opfs' | 'memory';

export interface LabStorageOption {
  kind: LabStorageKind;
  title: string;
  hint: string;
  available: () => boolean;
}

export const STORAGE_OPTIONS: readonly LabStorageOption[] = [
  {
    kind: 'indexeddb',
    title: 'IndexedDB',
    hint: 'Переживает F5. Предсказуемо доступен в headless — на нём и стоят e2e.',
    available: isIndexedDbAvailable,
  },
  {
    kind: 'opfs',
    title: 'OPFS',
    hint: 'Тоже переживает F5, быстрее на больших телах. Доступность зависит от браузера.',
    available: isOpfsAvailable,
  },
  {
    kind: 'memory',
    title: 'Только память',
    hint: 'L2 фактически отключён: после перезагрузки всё качается заново.',
    available: () => true,
  },
];

/** Готовые пресеты срока свежести. Ноль — «всё протухло», чтобы увидеть ветку 304. */
export const MAX_AGE_PRESETS: readonly { ms: number; title: string; hint: string }[] = [
  { ms: 5 * 60 * 1000, title: '5 минут', hint: 'Как по умолчанию: повторный монтаж бьёт в L1/L2.' },
  { ms: 10_000, title: '10 секунд', hint: 'Успеть посмотреть попадание, потом — ревалидацию.' },
  {
    ms: 0,
    title: '0 (всё протухло)',
    hint: 'Каждое чтение уходит в условный запрос: stale → 304.',
  },
];

export interface LabDiagnostic {
  code: string;
  message: string;
  /** Ключ кэша либо ключ записи — смотря кто сообщил. */
  source: string;
  level?: 'error' | 'warn';
}

/**
 * Диагностика живёт на уровне модуля, а события кэша — нет.
 *
 * Сюда стекается и то, что сообщает кэш (отказы L2), и то, что сообщает preflight через провайдер;
 * ни то ни другое к конкретному экземпляру кэша не привязано, и терять историю при смене настроек
 * незачем.
 */
export const diagnosticLog = createLogStore<LabDiagnostic>();

function storageOf(kind: LabStorageKind): StorageStrategy {
  const options = { namespace: NAMESPACE };
  if (kind === 'opfs') return createOpfsStorage(options);
  if (kind === 'indexeddb') return createIndexedDbStorage(options);
  return createMemoryStorage(options);
}

export interface LabCache {
  cache: SchemaCache;
  /** События ЭТОГО экземпляра. Счётчики `cache.stats()` считают ровно их же. */
  events: LogStore<CacheEvent>;
}

/**
 * Новый кэш под выбранные настройки.
 *
 * Экземпляр пересоздаётся при смене хранилища или срока свежести — иначе никак: и то и другое
 * замкнуто внутри `createSchemaCache`. Смена ссылки на кэш перезагружает смонтированные формы, и
 * на стенде это ровно то, что нужно увидеть.
 *
 * Журнал заводится ВМЕСТЕ с кэшем, а не общий на модуль. Общий пришлось бы чистить эффектом при
 * смене кэша, а эффекты родителя выполняются ПОСЛЕ детских — то есть чистка стирала бы события
 * загрузки, которая только что произошла, и журнал выглядел бы пустым именно тогда, когда он нужен.
 */
export function createLabCache(storage: LabStorageKind, maxAgeMs: number): LabCache {
  const events = createLogStore<CacheEvent>();
  const cache = createSchemaCache({
    storage: storageOf(storage),
    maxAgeMs,
    onEvent: (e) => events.push(e),
    onDiagnostic: (d) =>
      diagnosticLog.push({ code: d.code, message: d.message, source: d.key, level: 'warn' }),
  });
  return { cache, events };
}
