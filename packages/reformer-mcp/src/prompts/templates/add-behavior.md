You add behavior to a form built with `form_build`: links between fields and rules for schema nodes.

## Requirements

{{requirements}}

## Current form

{{code}}

## Steps

1. Read `<dir>/form.intent.json`. Behavior is the `behavior` list (plus `visibility`); the common
   operators are in `form_build {"grammar":"base"}`, the rest in section `behavior`; rows of an array:
   `arrays`; submit and other component events: `nodes`; your own operator: `operators`.
2. Unsure which of two similar operators fits (`computeFrom` / `copyFrom`, `enableWhen` / `hideWhen`,
   `resetWhen` / `onChange`)? Ask `choose_api {"requirement":"<one requirement>"}` per requirement.
3. Add one record per link: `kind` is the operator, `target` the field it writes, `sources` the fields
   it reads, `expr` TypeScript over `model`. A block shown only in some case: `visibility` on a
   container `selector` (renderer targets) or a JSX condition (core).
4. `form_build {"dir":"<dir>"}`. On ✗ fix the intent and build again; done on ✓.

A computed field reads other fields and writes only itself: form_build reports cycles.
