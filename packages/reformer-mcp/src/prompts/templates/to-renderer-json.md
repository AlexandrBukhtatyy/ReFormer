You migrate a form from `@reformer/renderer-react` (TS RenderSchema) to `@reformer/renderer-json` (JSON schema + Registry).

## Current TS code

```typescript
{{code}}
```

## Critical inline rules

- **Field node**: `{ component: path.email }` → `{ model: 'email', component: 'Input' }`.
- **Box container**: `{ component: Box, componentProps: { children: [...] } }` → `{ component: 'Box', children: [...] }` (children OUTSIDE componentProps).
- **Section container**: `{ component: Section, componentProps: { title, children: [...] } }` → `{ component: 'Section', componentProps: { title }, children: [...] }`.
- **Registry** via `defineRegistry`: every component name in JSON MUST be registered as `reg.field`/`reg.container`. `FIELD_WRAPPER` MUST be set.
- **Constants** (LOAN_TYPES, GENDERS) via `reg.source('LOAN_TYPES', LOAN_TYPES)`; in JSON reference by string `{ options: 'LOAN_TYPES' }`. Never inline arrays in JSON.
- **Item-label functions** via `reg.source('LABEL_FN', fn)`.
- **Arrays via `$template`**: `{ component: 'PropertyArray', componentProps: { itemComponent: { $template: { ... } } } }`. Inside template selectors omit parent prefix.
- **Behavior does NOT migrate to JSON** — stays a TS function `RenderBehaviorFn<T>` applied to the final `RenderSchemaProxy` (apply after `createRenderSchemaFromJson` + `createRenderSchema`).
- **`control` prop** (e.g. for `RendererFormArraySection`): `{ control: 'fieldName' }` — string FieldPath. Array indices in `control` not supported.
- **`version: '1.0'`** is required.

## Prerequisites — read these resources via ReadMcpResourceTool

**You MUST read these BEFORE writing JSON. Skipping = unregistered components / wrong shape.**

- `reformer://docs/renderer-json/quick-start`
- `reformer://docs/renderer-json/key-concepts`
- `reformer://docs/renderer-json/components-and-exports`
- `reformer://docs/renderer-json/key-concepts-2`
- `reformer://docs/renderer-json/key-concepts-3`
- `reformer://docs/renderer-json/builder-api`
- `reformer://docs/renderer-json/template-template-arrays`
- `reformer://docs/renderer-json/source`
- `reformer://docs/renderer-json/control`
- `reformer://docs/renderer-json/migration-from-ts-renderschema`
- `reformer://docs/renderer-json/anti-patterns`

## Task

1. Convert TS RenderSchema into `JsonFormSchema`.
2. Fill the registry (components + sources + FIELD_WRAPPER).
3. Migrate arrays via `$template` + `RendererFormArraySection`.
4. Keep behavior as TS — apply to proxy after `createRenderSchemaFromJson` + `createRenderSchema`.
5. Add `version: '1.0'`.
6. Final list: which components must be registered.

## Output checklist

- [ ] Прочитал все ресурсы из Prerequisites: yes/no
- [ ] All component names in JSON registered in `defineRegistry`
- [ ] `FIELD_WRAPPER` set
- [ ] Constants moved to `reg.source` (no inline arrays in JSON)
- [ ] Box children OUTSIDE componentProps
- [ ] Section children OUTSIDE componentProps
- [ ] Arrays use `$template`
- [ ] Behavior stays TS, applied to proxy
- [ ] `version: '1.0'` present
- [ ] Components-to-register list at end