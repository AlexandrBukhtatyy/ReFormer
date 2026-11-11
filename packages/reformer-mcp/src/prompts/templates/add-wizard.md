You split a form built with `form_build` into wizard steps.

## Steps of the wizard

{{steps}}

## Current form

{{code}}

## Steps

1. Read `<dir>/form.intent.json`; get `form_build {"grammar":"wizard"}`.
2. Make the root of `layoutRoot` a `FormWizard` whose every child is a step:
   `{"kind":"container","component":"FormWizard","selector":"wizard","children":[{"kind":"step","title":"…","selector":"<key>","children":[…]}]}`.
   Every field and array stands in exactly one step; containers may sit inside a step. The step
   `selector` is the key of the step's validation.
3. Submit: section `nodes` — `onComponentEvent` on the wizard selector. On core write the steps in
   your JSX (`find_recipe wizard`).
4. `form_build {"dir":"<dir>"}`. On ✗ fix the intent and build again; done on ✓.
