# Diagnostic codes

Every finding of the server carries a stable code. The text may change between versions; the code
does not — a host with its own language picks its text by the code. Codes come in three families:

- `RF0xx` — the codes of `validate_form`. In `kind="bundle"` a finding of the judge is wrapped into
  an `RF` code and keeps its own code at the start of the message (`RF014 … unknown-key: …`).
- `C1`–`C13` — cross-checks of the intent against the layout it builds.
- codes of reading and of the judge (`unknown-key`, `unplaced`, …) — what `form_build` prints first in
  a finding line, `<code> at <place>: <what is wrong> → <what to do>`, and what `@reformer/mcp/intent`
  returns in `problems`, `notices`, `errors` and `warnings`.

The list is complete: a test checks it against the code.

## RF — validate_form

| Code | Name | Meaning | What to do |
| --- | --- | --- | --- |
| `RF001` | INVALID_API_USAGE | An API used against its signature or context; also C1, C9, C12 and module notes of `bundle` | Follow the suggestion; check the signature with `get_symbol_docs` |
| `RF002` | UNKNOWN_SYMBOL | An `@reformer/*` symbol that does not exist | Take a suggested name or find it: `list_symbols`, `choose_api` |
| `RF003` | WRONG_PACKAGE | A symbol imported from the wrong package or subpath | Import from the path the diagnostic names |
| `RF004` | VALIDATION_OUTSIDE_SCHEMA | A validation operator outside the validation schema; also C4 and `lost-message` | Move the call into the validation schema; fix the rule target or its message |
| `RF005` | BEHAVIOR_OUTSIDE_SCHEMA | A behavior operator outside the behavior schema; also C5 | Move the call into the behavior schema; fix the target or source |
| `RF006` | BEHAVIOR_CYCLE | A cycle in computed fields; also C7 | Break the cycle: one field must not compute from itself through others |
| `RF007` | INVALID_RENDER_SCHEMA | A wrong layout or form document; also C6, C8, C10, C11, C13, `unplaced` | Fix the node the diagnostic points to |
| `RF008` | UNKNOWN_COMPONENT | A component that is not registered or not in the kit; also C2, `unknown-component`, `component-props` | Use a kit component or register yours; props from its list |
| `RF009` | UNKNOWN_DATASOURCE | A data source that is not declared; also C3 | Declare it in `dataSources` or fix the name |
| `RF010` | DEPRECATED_API | Deprecated or removed API of the previous form contract | Use the named replacement; recipe `find_recipe unified-contract` |
| `RF011` | LAYOUT_FILE_NAME | A form module file named outside the canon | Rename to the expected name |
| `RF012` | LAYOUT_FILE_MISSING | A required file of the module set is missing | Add the named file |
| `RF013` | LAYOUT_FILE_EXTRA | A file beyond the canonical module set | Move its content where the diagnostic says |
| `RF014` | INTENT_RECORD | An intent record not read: a reading problem code below | Rewrite the record as the expected sample shows |
| `RF015` | ENVIRONMENT | The environment cannot build the form: no core index or kit catalog | Install `@reformer/core` and `@reformer/ui-kit` in the project |
| `RF016` | NOT_ON_TARGET | A rule the target does not run (`not-on-target`), or a record the form document cannot keep (`not-in-document`) | Change the target or move the rule where the target runs it |

## C — cross-checks

| Code | Meaning |
| --- | --- |
| `C1` | A layout binding leads to a field that is not in the model |
| `C2` | A layout component is not registered |
| `C3` | A data source is used but not declared |
| `C4` | A validation rule targets a field that does not exist |
| `C5` | A behavior targets or reads a field that does not exist |
| `C6` | A selector of a node rule or visibility is not in the layout — the rule would do nothing |
| `C7` | The compute graph has a cycle |
| `C8` | An array node is built wrong: no row template, or an `initialValue` whose keys differ from the row fields |
| `C9` | A dead declaration — declared and never used (a warning) |
| `C10` | Two nodes share a `testId` |
| `C11` | A layout reference leads to nothing declared |
| `C12` | An own operator is not declared or cannot be imported |
| `C13` | Steps mixed with other nodes in one container |

## Reading problems — the record is not read

| Code | Meaning |
| --- | --- |
| `intent-unreadable` | The input is not an intent object: a string that is not JSON, an array, a number |
| `not-an-object` | A list entry is not an object: a field, array, rule, behavior, visibility, step or node |
| `missing-key` | A required key is missing: a field name, a rule target, a behavior kind, a node reference |
| `unknown-key` | A key the record does not have; the hint names the nearest allowed one |
| `key-conflict` | Two synonyms of one key with different values, or an inline description against the declaration |
| `prop-unsupported` | A property the component does not have |
| `invalid-value` | A value of the wrong kind: `required` not a boolean, a message parameter an object |
| `unknown-kind` | A behavior kind the contract does not know |
| `duplicate` | The same path declared twice |
| `inert-behavior` | A link that would build and never fire |

## Reading warnings — read, but not as written

| Code | Meaning |
| --- | --- |
| `consumer` | The intent's own `warnings` (from `plan_form`), kept as they are |
| `intent-string` | The intent came as a string — parsed as JSON |
| `keys-renamed` | Keys brought to the contract names |
| `target-unknown` | An unknown target — `core` taken |
| `type-default` | A field without a type — `string` taken |
| `type-unknown` | An unknown field type — `string` taken |
| `type-is-component` | `type` holds a component name — read as the component |
| `component-default` | A field without a component — the default for its type taken |
| `component-normalized` | A component or its props brought to the kit (case, synonyms, stub props) |
| `array-as-field` | A field with rows — read as an array |
| `array-duplicate` | An array written both in `fields` and in `arrays` — the `arrays` entry used |
| `layout-kind-unknown` | A node `kind` that is a component name — read as a container drawn by it |
| `required-lifted` | `required: true` on fields — a `required()` rule added to validation |
| `item-interface-default` | An array without `itemInterfaceName` — a default name given |
| `initial-value-default` | An array without `initialValue` — an empty list taken |
| `unnamed-dropped` | Records without a name dropped |
| `no-fields` | No field and no text — the module would be an empty shell |
| `intent-as-node` | The intent is a layout node — read as `layoutRoot` |
| `step-as-key` | One step under `step` — read as `steps` of one step |
| `steps-as-object` | `steps` is an object — read as a list of one step |
| `layout-as-list` | The layout is a list — read as the children of the root container |
| `rules-in-fields` | Validation rules inside `fields` — moved to `validation` |
| `rules-on-fields` | Checks written on fields — moved to `validation` |
| `inline-fields` | Fields described inside steps or layout nodes — declared in `fields` |
| `inline-arrays` | Arrays described inside steps or layout nodes — declared in `arrays` |
| `inline-merged` | Inline descriptions completed declarations already in `fields`/`arrays` |
| `bare-refs` | Layout nodes holding only a name — read as field references |
| `reset-as-on-change` | A `resetWhen` that reads no model field — written as a reset on change |
| `computed-toggle-replaced` | A toggle that would make a computed field editable — replaced |
| `prop-lifted` | A component prop written next to the field — moved into `componentProps` |
| `value-coerced` | A value brought to its kind: `required: "true"`, a number in `params` |
| `list-as-map` | A list written as a map `{ name: record }` — read as a list |
| `steps-ignored` | `steps` next to `layoutRoot` — the layout is `layoutRoot`, `steps` not read |
| `each-lifted` | A rule on a row field path — read as a rule of every row (`each`) |
| `rule-empty-dropped` | A rule without checks (`"rules": []`) — dropped |

## Judge

| Code | Kind | Meaning |
| --- | --- | --- |
| `unplaced` | error | A field or array is declared but not in the layout: the user would not see it |
| `lost-message` | error | An issue code has no text of its own, or two |
| `unknown-component` | error | The component is not in the kit |
| `environment` | error | The environment cannot build the module: no core index or kit catalog |
| `not-on-target` | error | A rule the chosen target does not run: visibility and node rules on core |
| `not-in-document` | error | A record the form document has no place for: module code |
| `module-note` | warning | A note from printing the module — e.g. layout texts to write in the JSX on core |
| `component-props` | warning | Props the component does not have — they would go to the DOM |
| `not-kept` | warning | The form document will not keep it: initial values, a data source without values |
