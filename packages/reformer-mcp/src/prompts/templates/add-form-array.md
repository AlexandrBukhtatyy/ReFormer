You add an array of repeating rows to a form built with `form_build`.

## Requirements

{{requirements}}

## Current form

{{code}}

## Steps

1. Read `<dir>/form.intent.json`; get `form_build {"grammar":"arrays"}`.
2. Add a record to `arrays`: `name`, `itemInterfaceName`, `initialValue` (`[]` or start rows) and
   `itemFields` — the fields of one row. Place it in `layoutRoot`: `{"kind":"array","ref":"<name>"}`.
3. Rules of a row: rows in `validation` with `"each":"<name>"`; links inside a row: `behavior` with
   `"each":"<name>"` (the row in `expr` is `item`); totals over rows: `compute` over
   `model.<name>.map(...)` — a model array has no `reduce` or `filter` before `map(...)` or `toArray()`.
4. `form_build {"dir":"<dir>"}`. On ✗ fix the intent and build again; done on ✓.
