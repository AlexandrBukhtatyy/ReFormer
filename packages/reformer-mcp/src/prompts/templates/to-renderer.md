You switch a form built with `form_build` to `{{target}}`: {{targetLabel}}.

## Current form

{{code}}

## Steps

1. In `<dir>/form.intent.json` set `"target":"{{target}}"`. Fields, layout, validation and behavior stay
   as they are: the contract of the form is the same for every stack.
2. If the form was on `core`, `index.tsx` holds your JSX markup and form_build keeps it. Move what you
   still need from it (data loading, submit) to `api.ts` and the `nodes` section of the intent
   (`onComponentEvent` for submit), then delete `index.tsx` so the build writes the renderer assembly.
3. Rules for schema nodes now work: a block shown only in some case is `visibility` on a container
   `selector` instead of a JSX condition.
4. `form_build {"dir":"<dir>"}`. On ✗ fix the intent and build again; done on ✓.

{{targetNote}}
