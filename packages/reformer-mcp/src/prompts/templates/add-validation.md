You add validation to a form built with `form_build`.

## Requirements

{{requirements}}

## Current form

{{code}}

## Steps

1. Read `<dir>/form.intent.json`. The rules are rows of its `validation` list; their grammar is in
   `form_build {"grammar":"base"}`. Rules across fields: section `cross`; server checks: `async`;
   rows of an array: `arrays`; your own rule: `operators`.
2. Add one row per rule: `{"target":"price","rules":["required({ code: 'price.required' })"],"message":"Enter the price"}`.
   The row's `message` goes to each of its checks; a check with its own text needs its own row with
   the same target. A rule that holds only in some case: `"when":"<condition over model>"` in the row.
3. `form_build {"dir":"<dir>"}`. On ✗ fix the intent and build again; done on ✓.

Messages come from the requirements, in their language. The build prints the rules, the message
dictionary and the wizard step rules itself — do not write `form.validation.ts` by hand.
