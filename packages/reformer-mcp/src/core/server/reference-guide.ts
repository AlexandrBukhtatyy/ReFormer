/**
 * Тексты справочного канала — сервера в профиле `browser` (воркер конструктора).
 *
 * У воркера семь справочных инструментов и нет `form_build`: форму собирает хост своим
 * инструментом. Тексты Node-сервера — путь «form.intent.json → form_build» — там были бы советом,
 * которому модель не может последовать. Раньше воркер не отдавал `instructions` вовсе, а гайд
 * `reformer://guide` падал на запасной текст про `form_build`: самодокументации MCP в корпусе
 * браузера нет (фаза 5 аудита, ReFormer-11oe.6).
 *
 * Тексты называют только инструменты профиля `browser`: это проверяет `tests/worker-texts.test.ts`.
 *
 * @module reformer-mcp/core/server/reference-guide
 */

/** `instructions` воркера: что это за сервер и какой инструмент на какой вопрос. */
export const REFERENCE_INSTRUCTIONS =
  'ReFormer library reference: it explains the API and checks form code; it writes no files and ' +
  'builds no forms — the host does. Which operator fits a requirement: choose_api ' +
  '{"requirement":"…"}. Operator, example and rules for one step: get_context {"task":"…"}. A ' +
  'worked example: find_recipe {"topic":"…"}. Docs by words: search_docs {"query":"…"}; one ' +
  'symbol: get_symbol_docs {"symbol":"…"}; names: list_symbols. Check before running: ' +
  'validate_form (kind code, json-schema, bundle, layout, behaviors). Map: reformer://guide.';

/** `reformer://guide` воркера: та же карта, подробнее. */
export const REFERENCE_GUIDE = [
  '# ReFormer — library reference',
  '',
  'This server explains the ReFormer API and checks form code. It writes no files and builds no',
  'forms: the host that connected it builds them with its own tools.',
  '',
  '| Question | Call |',
  '| --- | --- |',
  '| which operator fits a requirement | `choose_api {"requirement":"field B only when A is filled"}` |',
  '| operator, signature, example and rules for one step | `get_context {"task":"…"}` |',
  '| a worked example of a scenario | `find_recipe {"topic":"wizard"}` (also form-array, copy-from, json-schema) |',
  '| a doc section by words | `search_docs {"query":"…"}` → `reformer://docs/<package>/<slug>` |',
  '| one public symbol | `get_symbol_docs {"symbol":"createForm"}`; names: `list_symbols {"nameContains":"…"}` |',
  '',
  '`validate_form` checks before running:',
  '',
  '- `kind: "code"` — TypeScript: unknown or wrongly imported @reformer symbols, deprecated API;',
  '- `kind: "json-schema"` — a renderer-json form document (`{ "format": 2, "root": … }`);',
  '- `kind: "bundle"` — a FormIntent, judged by the same rules as the build;',
  '- `kind: "layout"` — file names of a form module; `kind: "behaviors"` — compute cycles.',
  '',
  'All packages and their sections: `reformer://catalog`.',
].join('\n');
