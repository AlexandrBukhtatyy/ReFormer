/**
 * Список пакетов `@reformer/*`, о которых знает сервер, и нормализация имени пакета.
 *
 * Отделено от чтения документации намеренно: сам список — это знание о библиотеке, одинаковое
 * в любой среде, а вот КАК до него добраться (диск, бандл, папка проекта) решает платформа.
 *
 * @module reformer-mcp/core/docs/packages
 */

/**
 * Known @reformer/* packages with `llms.txt`. Order matters for default
 * "all-packages" iteration: core first, dependents after.
 */
export const KNOWN_PACKAGES = [
  '@reformer/core',
  '@reformer/cdk',
  '@reformer/ui-kit',
  '@reformer/renderer-react',
  '@reformer/renderer-json',
  '@reformer/mcp',
] as const;

export type ReformerPackage = (typeof KNOWN_PACKAGES)[number];

/** Default package used by legacy single-package APIs. */
export const DEFAULT_PACKAGE: ReformerPackage = '@reformer/core';

/** Имя собственного пакета — его `llms.txt` лежит рядом с сервером, а не в CWD проекта. */
export const OWN_PACKAGE: ReformerPackage = '@reformer/mcp';

/**
 * Привести значение аргумента `package` к полному имени пакета.
 *
 * Принимает и `@reformer/core`, и короткое `core`. Короткая форма нужна с тех пор, как из
 * схем инструментов убрали `enum` со списком пакетов: он повторялся в четырёх инструментах и
 * стоил токенов в каждом подключении, а с ростом числа пакетов дорожал бы линейно. Раз enum
 * больше не подсказывает форму записи, сервер обязан понимать обе.
 *
 * `null` — «не ограничивать» (пусто, `*` или неизвестное имя): молча сузить выдачу до пустой
 * из-за опечатки в имени пакета хуже, чем поискать везде.
 */
export function normalizePackage(value: unknown): ReformerPackage | null {
  if (typeof value !== 'string') return null;
  const raw = value.trim();
  if (!raw || raw === '*') return null;
  const full = (raw.startsWith('@reformer/') ? raw : `@reformer/${raw}`) as ReformerPackage;
  return (KNOWN_PACKAGES as readonly string[]).includes(full) ? full : null;
}

/**
 * `@reformer/<name>` → имя каталога в `packages/` монорепо.
 *
 * Живёт здесь, а не в платформенном загрузчике, потому что это факт о раскладке репозитория,
 * одинаковый для всех сред: и резолв путей на диске, и сборка браузерного артефакта обязаны
 * называть каталоги одинаково, иначе артефакт соберётся не из тех файлов.
 */
export function packageDirName(pkg: string): string {
  const tail = pkg.replace(/^@reformer\//, '');
  return tail === 'core' ? 'reformer' : `reformer-${tail}`;
}
