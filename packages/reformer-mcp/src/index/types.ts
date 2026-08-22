/**
 * Контракт `llms-index.json` — артефакта, который каждый пакет `@reformer/*` публикует рядом
 * с `llms.txt`.
 *
 * Собирается на билде (`scripts/generate-llms-txt/index-builder.js`); здесь — только форма,
 * которую читает сервер. Ломающее изменение формата → `INDEX_SCHEMA_VERSION` + 1, и загрузчик
 * обязан отбросить индекс более новой мажорной версии, а не пытаться его понять.
 */

/** Версия схемы, которую понимает этот сервер. */
export const SUPPORTED_INDEX_SCHEMA = 1;

/** Разобранный anti-pattern: код «как не надо» + пояснения + правильный вариант. */
export interface IndexedAntiPattern {
  /** Пояснение из строки с маркером ❌ — почему так нельзя. */
  why?: string;
  /** Код неправильного варианта. */
  bad?: string;
  /** Пояснение из строки с маркером ✅. */
  correctNote?: string;
  /** Код правильного варианта. Может отсутствовать: иногда он выражен только прозой. */
  correct?: string;
  /** Секция без код-блоков — сохранена как есть, структуру не выдумываем. */
  note?: string;
}

/** Тема = один файл `docs/llms/NN-<topic>.md`. */
export interface IndexedTopic {
  /** Стем файла (`validation`) — стабильный id. Заголовок для этого не годится: `slugify` вырезает кириллицу. */
  id: string;
  file: string;
  title: string;
  /** Первый содержательный абзац — назначение темы. */
  purpose: string;
  keyConcepts: string[];
  api: string;
  patterns: Array<{ lang: string | null; code: string }>;
  antiPatterns: IndexedAntiPattern[];
  examples: Array<{ lang: string | null; code: string }>;
  troubleshooting: string[];
  seeAlso: string[];
  /** Куда идти за полным текстом: слаги те же, что у `reformer://docs/<pkg>/<slug>`. */
  sections: Array<{ heading: string; slug: string }>;
  /** Частотные термы темы: `[терм, частота]`. */
  terms: Array<[string, number]>;
  /** Пакет-владелец. Проставляется загрузчиком при слиянии. */
  package: string;
}

/** Публичный символ пакета. */
export interface IndexedSymbol {
  name: string;
  kind: string;
  signature: string;
  /** Первое предложение описания. */
  summary: string;
  description?: string;
  params: Array<[string, string]>;
  returns?: string;
  /** Канонический (первый) `@example`. Полный список остаётся в llms.txt. */
  example?: string;
  examplesCount: number;
  deprecated?: string;
  /** Связанные символы из `@see {@link …}`. */
  related?: string[];
  /** Темы, в которых символ упоминается. */
  topics?: string[];
  /** Сколько раз встречается в эталонных формах монорепо — сигнал популярности для ранжирования. */
  usage?: number;
  /**
   * Спецификаторы импорта, из которых символ доступен: `.`, `./behaviors`, `./validation`.
   * Не все символы видны из корня: `validate` живёт только в `@reformer/core/validation`,
   * и импорт его из `@reformer/core` — ошибка, которую `tsc` покажет лишь при сборке
   * проекта потребителя.
   */
  entries?: string[];
  sourcePath: string;
  package: string;
}

/** Файл `llms-index.json` одного пакета. */
export interface PackageIndex {
  schemaVersion: number;
  package: string;
  version: string;
  topics: IndexedTopic[];
  symbols: IndexedSymbol[];
}

/** Слитый индекс всех установленных пакетов. */
export interface MergedIndex {
  /** Пакеты, чьи индексы удалось прочитать: имя → версия. */
  packages: Map<string, string>;
  /** Пакеты без индекса — по ним сервер падает на разбор AST. */
  withoutIndex: string[];
  symbols: IndexedSymbol[];
  topics: IndexedTopic[];
  /** Быстрый доступ по имени; при коллизии имён порядок — как в KNOWN_PACKAGES. */
  byName: Map<string, IndexedSymbol[]>;
}
