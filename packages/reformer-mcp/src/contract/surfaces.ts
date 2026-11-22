/**
 * Поверхности сервера — значения `REFORMER_SURFACE`: `code-guided-dsl` (конструктор форм в
 * `execute` и чтение данных в `search`), `tools` (набор инструментов: сборка из intent, справка,
 * ресурсы и промпты), `code` (Code Mode: один `run_script`), `guided` (план и плоские правки для
 * малых моделей) и `code-guided` (API guided внутри `run_script`). Клиент выбирает поверхность, сервис
 * её отдаёт по пути `/mcp/<поверхность>`.
 *
 * @module @reformer/mcp/contract/surfaces
 */

export const SERVER_SURFACES = [
  'code-guided-dsl',
  'tools',
  'code',
  'guided',
  'code-guided',
] as const;

export type ServerSurface = (typeof SERVER_SURFACES)[number];

/**
 * Поверхность по умолчанию — `code-guided-dsl`. На замере «с MCP и без» (Claude Sonnet, 270
 * прогонов, страница документации «Замеры: с MCP и без») профиль прошёл 97% прогонов против 80% у
 * набора инструментов и у работы без сервера, и вышел быстрее и дешевле обоих. Набор инструментов
 * остаётся под `REFORMER_SURFACE=tools`: справка по API для своего кода, `validate_form`, ресурсы и
 * промпты есть только в нём.
 */
export const DEFAULT_SURFACE: ServerSurface = 'code-guided-dsl';

/**
 * Поверхность по значению `REFORMER_SURFACE`: пустое — {@link DEFAULT_SURFACE}, неизвестное имя —
 * `undefined` (вызывающий решает, что с ним делать; CLI предупреждает и берёт умолчание).
 */
export function surfaceFromEnv(value: string | undefined): ServerSurface | undefined {
  const name = value?.trim();
  if (!name) return DEFAULT_SURFACE;
  return SERVER_SURFACES.find((surface) => surface === name);
}
