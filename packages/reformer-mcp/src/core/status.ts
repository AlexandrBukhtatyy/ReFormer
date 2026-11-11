/**
 * Состояние знания сервера — ресурс `reformer://status`.
 *
 * Зачем. Сервер, который не нашёл пакеты `@reformer/*`, раньше отвечал тем же голосом, что и
 * исправный: пустая справка выглядела как «ничего не найдено», а проверка импортов объявляла
 * несуществующим код, который напечатал сам генератор. Замеры на таком сервере судили окружение,
 * а записи прогонов этого не видели. Статус делает окружение видимым: какие пакеты найдены и
 * откуда, есть ли у них индекс и документация, доступна ли проверка типов и что не прочиталось.
 *
 * Платформа отдаёт то, что знает только она ({@link PlatformStatus}: пути, версии, компилятор,
 * проблемы чтения), остальное выводится из самого знания — так статус одинаково устроен у CLI и
 * у воркера.
 *
 * @module reformer-mcp/core/status
 */

import { KNOWN_PACKAGES } from './docs/packages.js';
import type { Knowledge } from './knowledge.js';

/** Что не прочиталось или не нашлось: источник и подробность. */
export interface KnowledgeProblem {
  /** Кто сообщил: `index:@reformer/core`, `typecheck`, `ui-kit-catalog`, … */
  readonly source: string;
  readonly detail: string;
}

/** Где платформа нашла пакет. */
export interface PackageLocationStatus {
  readonly name: string;
  /** Корень пакета; `null` — не найден ни от одной базы поиска. */
  readonly root: string | null;
  readonly version: string | null;
  /** Как найден: `node_modules`, `self`, `workspace`, `resolve`, `bundle`. */
  readonly via: string | null;
}

/** Часть статуса, которую знает только платформа. */
export interface PlatformStatus {
  readonly profile: 'node' | 'browser';
  /**
   * Сервер: версия, метка сборки кода (`@reformer/mcp/build-info`; `dev` — из исходников) и, где
   * корпус вшит, хэш корпуса из его манифеста — по ним сверяются копии MCP, собранные порознь.
   */
  readonly server: {
    readonly version: string;
    readonly buildId: string | null;
    readonly corpusHash?: string | null;
  };
  /** Пакеты, как их нашла платформа. В браузере — то, что вшито в артефакт. */
  readonly packages: readonly PackageLocationStatus[];
  /** Проверка типов `form_build`: у браузера её нет вовсе. */
  readonly typecheck: { readonly available: boolean; readonly detail: string };
  /** Каталог компонентов `@reformer/ui-kit`. */
  readonly uiKitCatalog: {
    readonly found: boolean;
    readonly components: number;
    readonly source: string | null;
  };
  /** Базы поиска пакетов, по порядку (CLI). */
  readonly bases?: readonly string[];
  readonly problems: readonly KnowledgeProblem[];
}

/** Источник части статуса платформы. */
export type PlatformStatusSource = () => PlatformStatus;

/** Пакет в итоговом статусе: где найден и что из его артефактов прочиталось. */
export interface PackageStatus extends PackageLocationStatus {
  /** Версия индекса `llms-index.json`; `null` — индекса нет или схема не поддержана. */
  readonly index: string | null;
  /** `llms.txt` прочитан. */
  readonly docs: boolean;
  /** Файлов `docs/llms`. */
  readonly recipes: number;
}

export interface KnowledgeStatus {
  readonly profile: PlatformStatus['profile'];
  readonly server: PlatformStatus['server'];
  /** Все библиотечные пакеты найдены и у каждого есть индекс. */
  readonly ready: boolean;
  readonly packages: readonly PackageStatus[];
  readonly typecheck: PlatformStatus['typecheck'];
  readonly uiKitCatalog: PlatformStatus['uiKitCatalog'];
  readonly bases?: readonly string[];
  readonly problems: readonly KnowledgeProblem[];
}

/**
 * Пакеты, без которых генератор форм работает вслепую: их индексы дают правила, операторы и
 * компоненты. Остальные (`@reformer/form-registry`, сам MCP) статус показывает, но готовность от
 * них не зависит.
 */
export const REQUIRED_PACKAGES: readonly string[] = [
  '@reformer/core',
  '@reformer/cdk',
  '@reformer/ui-kit',
  '@reformer/renderer-react',
  '@reformer/renderer-json',
];

/** Собрать статус: часть платформы + то, что прочиталось в знание. */
export function describeKnowledge(k: Knowledge, platform: PlatformStatus): KnowledgeStatus {
  const located = new Map(platform.packages.map((entry) => [entry.name, entry]));
  const withDocs = new Set<string>(k.docs.packages());
  const packages: PackageStatus[] = KNOWN_PACKAGES.map((name) => {
    const place = located.get(name);
    let recipes = 0;
    try {
      recipes = k.recipes.list(name).filter((file) => file.endsWith('.md')).length;
    } catch {
      recipes = 0;
    }
    return {
      name,
      root: place?.root ?? null,
      version: place?.version ?? null,
      via: place?.via ?? null,
      index: k.index.packages.get(name) ?? null,
      docs: withDocs.has(name),
      recipes,
    };
  });
  const ready = REQUIRED_PACKAGES.every((name) => {
    const entry = packages.find((p) => p.name === name);
    return entry !== undefined && entry.index !== null;
  });
  return {
    profile: platform.profile,
    server: platform.server,
    ready,
    packages,
    typecheck: platform.typecheck,
    uiKitCatalog: platform.uiKitCatalog,
    ...(platform.bases ? { bases: platform.bases } : {}),
    problems: platform.problems,
  };
}

/** Строка для ответа инструмента: почему знание неполное. Пустая — всё на месте. */
export function knowledgeGaps(status: KnowledgeStatus): string[] {
  const gaps: string[] = [];
  for (const name of REQUIRED_PACKAGES) {
    const entry = status.packages.find((p) => p.name === name);
    if (!entry || entry.root === null) {
      if (status.profile === 'node') gaps.push(`${name} not found`);
      else if (!entry?.index) gaps.push(`${name}: no index in the bundle`);
    } else if (entry.index === null) {
      gaps.push(`${name} found at ${entry.root}, but its llms-index.json is missing or unreadable`);
    }
  }
  return gaps;
}
