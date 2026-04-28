You add validation to an existing `@reformer/core` form.

## Args

- requirements: {{requirements}}

## Current form code

```typescript
{{code}}
```

## Critical inline rules

- **Every** `required`/`min`/`max`/`minLength`/`maxLength`/`pattern`/`email` MUST take `{ message: 'осмысленный русский текст' }`. Default `"Поле обязательно для заполнения"` is unacceptable — UX bug.
- `applyWhen` exists in BOTH `@reformer/core/validators` and `@reformer/core/behaviors`. Inside a `validation:` callback ALWAYS import from `/validators` — wrong subpath silently registers in wrong registry, validation just doesn't fire.
- Custom rule signature: `validate(path.field, (value, ctx) => null | { code, message })`. Cross-field via `ctx.form.<other>.value`.
- Async: `validateAsync` with `debounce` + guard on `cancelled` (never `await fetch` directly inside).
- Deep-nested forms (4+ levels): annotate validation callback as `(path: any) => {...}`, inside `applyWhen` use `(p: typeof path) => {...}` — otherwise TS2589.
- `validateItems(itemPath: any)` — also cast to `any`.

## Prerequisites — read these resources via ReadMcpResourceTool

**You MUST read these BEFORE writing validators. Skipping = wrong validators or wrong import paths.**

- `reformer://docs/core/api-signatures` (built-in validators API)
- `reformer://docs/core/common-patterns` (cross-field, applyWhen)
- `reformer://docs/core/common-mistakes`
- `reformer://docs/core/extended-common-mistakes`
- `reformer://docs/core/async-watchfield-critically-important` (async validation pattern)
- `reformer://docs/core/api-reference` (full validator catalogue)

## Task

1. Map each requirement to a built-in (`required`, `email`, `minLength`, `pattern`, `min`, `max`, `url`, `phone`, `number`, `isDate`, `minDate`, `maxDate`, `pastDate`, `futureDate`, `minAge`, `maxAge`).
2. Custom rules → `validate(path.field, (value, ctx) => ...)`.
3. Async → `validateAsync` with `debounce` + `cancelled` guard.
4. Cross-field → `validate(...)` reading `ctx.form.<other>.value`.
5. Conditional → `applyWhen` (from `/validators`).
6. Imports: `import { required, email, validate, ... } from '@reformer/core/validators'`. Don't reinvent built-ins.
7. Don't change FormSchema structure — only add `validation` callback.

## Output checklist

- [ ] Прочитал все ресурсы из Prerequisites: yes/no
- [ ] Every built-in validator carries `{ message: '...' }`
- [ ] `applyWhen` imported from `@reformer/core/validators`
- [ ] Cross-field rules use `ctx.form.<other>.value`
- [ ] Async validators (if any) have debounce + cancelled-guard
- [ ] No default «Поле обязательно для заполнения» messages reach UI