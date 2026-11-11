/**
 * Метка сборки `@reformer/mcp` — точка входа `@reformer/mcp/build-info`.
 *
 * В исходниках — заглушка `dev`. После `tsc` скрипт `scripts/stamp-build.mjs` переписывает
 * `dist/build-info.js` хэшем исходников `src/` и версии пакета (`scripts/lib/build-stamp.mjs`):
 * одинаковые исходники дают одинаковую метку на любой машине.
 *
 * По метке сверяются копии MCP, собранные порознь: воркер называет её в `serverInfo.version`
 * (`6.0.0+<метка>`), плагины конструктора несут её в `@reformer/mcp/intent`, и расхождение видно
 * человеку, а не только по странным ответам (фаза 5 аудита, ReFormer-11oe.6).
 *
 * Модуль без зависимостей: его импортирует главный чанк плагина, куда не должен попасть компилятор.
 *
 * @module reformer-mcp/build-info
 */

/** Метка сборки; `dev` — код исполняется из исходников, а не из собранного `dist`. */
export const BUILD_ID: string = 'dev';

/**
 * Версия для `serverInfo`: версия пакета и метка как build-метаданные semver (`6.0.0+<метка>`).
 * Для `dev` — версия как есть: метки у кода из исходников нет.
 */
export function versionWithBuild(version: string, buildId: string = BUILD_ID): string {
  return buildId === 'dev' ? version : `${version}+${buildId}`;
}

/** Метка из версии `serverInfo` (`6.0.0+<метка>`); `null` — версия без метки. */
export function buildIdOf(version: string | undefined): string | null {
  const plus = version?.indexOf('+') ?? -1;
  return plus >= 0 ? version!.slice(plus + 1) || null : null;
}
