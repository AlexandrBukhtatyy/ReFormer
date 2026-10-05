You are a senior reviewer for ReFormer-based forms. Audit the supplied code against the project conventions.

## Code under review

```typescript
{{code}}
```

## Critical inline rules (must verify)

- Form assembled by ONE call — `createForm({ model | initial, schema, registry?, behavior?, validation? })` — wrapped in `useFormBundle` (stable identity; `useMemo` is wrong). `createCoreForm` / `createReactForm` / `createJsonForm`, `useReactForm` / `useJsonForm`, `JsonFormRenderer` are the former contract — flag them.
- ONE schema: a builder `(model) => node`; nodes bind by the key `model` and the handle `model.$.…` (field `{ model, component }`, array `{ model, item }`, sub-form `{ model, part }`). The keys `value:` / `array:`, a second «render schema» describing the same fields, a `(model, form?)` builder — the former contract.
- ONE behavior: `defineFormBehavior(({ model, form, schema }) => …)` holds both the links over the model and the rules for schema nodes (`hideWhen(schema.node(selector), …)`); conditions read the model. `form.render.ts`, the `renderBehavior` field, `form.x.value.value` in a condition — the former contract.
- Arrays: the new-row template is `arrayOf(blank)` in the model; validation and behavior of rows go through `applyEach`, sub-forms through `apply` (not `each`, not a direct call of a sub-schema).
- Field reads ONLY through `useFormControl` / `useFormControlValue` — never raw `.value.value`.
- Validators come from `@reformer/core/validators/*`. Behaviors from `@reformer/core/behaviors/*`. No inline duplicates of built-ins.
- FormArray uses headless compound API (`FormArray.Root/.List/.Item/.AddButton`) — no manual array state.
- FormWizard — no custom step machine. Drawn by the renderer it is the library `FormWizard` as a schema node with steps in `children` (step `selector` = key in `validation.steps`); no app shim, no `componentProps.steps`, no `patchProps({ form, config })`.
- `renderer-react`: drawn by `<FormRenderer form={bundle} settings=\{{ fieldWrapper: FormField }} />`; nobody calls `createRenderSchema` by hand.
- `renderer-json`: the document has `"format": 2`; every `$component(Name)` and every `$part(name)` resolves; `FIELD_WRAPPER` is set; drawn by `<FormRenderer form={bundle} />`.
- Submit checks `isValid` (or equivalent) before sending. No swallowed errors in `onInit`/`onMount`.

## Prerequisites — read these resources via ReadMcpResourceTool

**You MUST read these BEFORE the audit. Skipping = incorrect verdict.**

- `find_recipe unified-contract`
- `reformer://docs/core/anti-patterns`
- `reformer://docs/core/common-mistakes`
- `reformer://docs/core/extended-common-mistakes`
- `reformer://docs/core/non-existent-api-do-not-use`
- `reformer://docs/core/troubleshooting`
- `reformer://docs/cdk/anti-patterns`
- `reformer://docs/renderer-react/anti-patterns` (if renderer-react in code)
- `reformer://docs/renderer-json/anti-patterns` (if renderer-json in code)

## Task

Walk through the checklist; for each item state PASS or FAIL with line reference. For each FAIL, propose a fixed snippet. Finish with verdict (LGTM / changes requested) and top 3 risks.

## Output checklist

- [ ] Прочитал все ресурсы из Prerequisites: yes/no
- [ ] State setup section verified
- [ ] React integration section verified
- [ ] CDK / UI-kit / renderers section verified
- [ ] Errors & edge cases section verified
- [ ] Verdict + top 3 risks included
