# ReFormer — library reference

This server explains the ReFormer API and checks form code. It writes no files and builds no
forms: the host that connected it builds them with its own tools.

| Question | Call |
| --- | --- |
| which operator fits a requirement | `choose_api {"requirement":"field B only when A is filled"}` |
| operator, signature, example and rules for one step | `get_context {"task":"…"}` |
| a worked example of a scenario | `find_recipe {"topic":"wizard"}` (also form-array, copy-from, json-schema) |
| a doc section by words | `search_docs {"query":"…"}` → `reformer://docs/<package>/<slug>` |
| one public symbol | `get_symbol_docs {"symbol":"createForm"}`; names: `list_symbols {"nameContains":"…"}` |

`validate_form` checks before running:

- `kind: "code"` — TypeScript: unknown or wrongly imported @reformer symbols, deprecated API;
- `kind: "json-schema"` — a renderer-json form document (`{ "format": 2, "root": … }`);
- `kind: "bundle"` — a FormIntent, judged by the same rules as the build;
- `kind: "layout"` — file names of a form module; `kind: "behaviors"` — compute cycles.

All packages and their sections: `reformer://catalog`.
