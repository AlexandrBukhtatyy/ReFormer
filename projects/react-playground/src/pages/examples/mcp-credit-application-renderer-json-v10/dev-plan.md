# dev-plan — target=renderer-json (iter-10)

## Picks

- **A1** wizard impl skipped — using A4 (manual useState) wrapped as plain section components, because B3 setHidden cascade is the documented pattern in playbook for renderer-json.
- **B3** target=renderer-json — `RenderSchemaFn`-wrapper injecting `form` into root `FormRoot` componentProps.

## Files

1. `types.ts` — copy from sibling A.
2. `schema.ts` — copy from sibling A (same `@reformer/core` schema/validation/behavior factory).
3. `data-fixture.ts` — copy from sibling A.
4. `registry.tsx` — define registry: ui-kit fields (Input/InputMask/Textarea/Select/Checkbox/RadioGroup), containers (Box/Section/FormRoot), `FIELD_WRAPPER` -> FormField. `FormRoot` has `__selfManagedChildren = true`. Sources for option arrays + label fns.
5. `render-schema.ts` — `JsonFormSchema` describing 6 step containers (each with `selector: 'stepN'`), conditional sub-section selectors (`mortgage-section`, `car-section`, etc.), array sections via `RendererFormArraySection` + `$template`. Leaf nodes: `model: 'fieldPath'` (Patch K), `componentProps.testId: 'stepN.fieldPath'`.
6. `index.tsx` — page: `useMemo` form, registry, schema with B3 wrapper. `useFormControlValue(form.X as never)` per condition + per-condition `useEffect` `schema.node('selector').setHidden(...)`. Wizard: `useState(currentStep)`. Step indicator `<button>` chips. Nav buttons. Fill-fake-data button.

## Patches verified

- Patch K (model not selector for fieldPath in JSON).
- Patch L (no raw effect + signal-write; useFormControlValue + useEffect bridge).
- Patch M (form.x.value.value double `.value` everywhere we read from callback).
- B3 (RenderSchemaFn-wrapper injects form into root).
- $template inline pattern for FormArray itemComponent.

## App.tsx registration

- Import default. ExamplePage union add `'mcp-credit-renderer-json-v10'`. examples[] entry. Route.

## Done criteria

- `tsc --noEmit` exit 0.
- All required testIds present.
