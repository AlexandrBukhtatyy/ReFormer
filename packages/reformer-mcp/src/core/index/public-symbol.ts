/**
 * Контракт публичного символа — общий для обоих источников.
 *
 * Тип объявлен здесь, а не рядом с разбором AST, потому что источников у него два: индекс
 * (`llms-index.json`, массовый путь) и парсер TypeScript (фолбэк для пакетов без индекса).
 * Пока тип жил в парсере, ядро вынуждено было импортировать Node-модуль ради одного
 * `import type` — стирается при компиляции, но в графе зависимостей выглядит как нарушение,
 * и первый же браузерный бандлер попытался бы его резолвить.
 *
 * @module reformer-mcp/core/index/public-symbol
 */

/** A single public symbol extracted from a package's `src/index.ts`. */
export interface PublicSymbol {
  /** Symbol name as exported. */
  name: string;
  /** Kind of declaration. */
  kind: 'function' | 'class' | 'interface' | 'type' | 'enum' | 'const' | 'unknown';
  /** Source-text signature, with bodies/initializers stripped. */
  signature: string;
  /** Leading description text from the JSDoc block. */
  description: string;
  /** All JSDoc tags in source order. */
  tags: SymbolTag[];
  /** Repo-relative path of the file declaring this symbol. */
  sourcePath: string;
  /** Package this symbol belongs to (e.g. "@reformer/cdk"). */
  package: string;
}

export interface SymbolTag {
  tag: string;
  name?: string;
  text: string;
}
