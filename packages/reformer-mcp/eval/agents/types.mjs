/**
 * Контракт адаптера агента. Адаптер выполняет один прогон сценария и сообщает, как он прошёл; судит
 * результат верификатор, а не адаптер.
 *
 * @typedef {object} AgentInput
 * @property {object} scenario - запись каталога сценариев
 * @property {string} target - `core` | `renderer-react` | `renderer-json`
 * @property {string} workspaceDirectory - рабочий каталог агента, вне репозитория
 * @property {string} runDirectory - каталог сырья прогона (`.tmp/mcp-runs/...`)
 * @property {string} prompt - задание целиком
 * @property {string|null} model
 * @property {{ id: string, withoutTools?: string[] }} approach
 * @property {string} serverPath - собранный сервер
 * @property {string} traceFile - журнал вызовов сервера
 * @property {{ timeoutMs: number, maxUsd: number, maxSteps: number }} limits
 * @property {Record<string, unknown>} [settings] - настройки агента из матрицы
 *
 * @typedef {object} AgentResult
 * @property {string|null} transcriptPath
 * @property {Array<{ name: string, ok: boolean }>} toolCalls
 * @property {object|null} usage
 * @property {number} costUsd
 * @property {number} durationMs
 * @property {'completed'|'timeout'|'maxSteps'|'budget'|'error'} exitReason
 * @property {string} finalText
 * @property {{ ok: boolean, problems: string[] }} isolation - нарушена изоляция → прогон не считается
 */

export {};
