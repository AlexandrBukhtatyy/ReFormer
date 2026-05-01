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
- Custom rule signature: `validate(path.field, (value, ctx) => null | { code, message })`. **Cross-field validations** — use `validateTree<TForm>((ctx) => { const form = ctx.form.getValue(); ... }, { targetField: 'X' })` instead of `validate(path.X, (value, ctx) => ctx.form.Y.value.value)`. validateTree даёт типизированный snapshot формы; access через `ctx.form.X.value.value` — implementation-detail, не публичный API.
- Async: `validateAsync` with `debounce` + guard on `cancelled` (never `await fetch` directly inside).
- **TS2589 на 70+ полевых формах** — `(path: any)` workaround NOT default. Сначала: попробуй `(path)` без annotation — TS обычно справляется. Падает только в редких case'ах (например, `min`/`max` с `number | null` полем, ждут `number | undefined`). Если падает: (a) сначала **проверь типы формы** — может, `number | null` уместно поменять на `number | undefined` в types.ts, тогда `(path)` сработает; (b) если поменять нельзя — **сузь cast до конкретного call-site** (`min(path.X as never, …)`), а НЕ на весь параметр callback'а.
- **TYPED schema generic — обязательно**. `ValidationSchemaFn<T>` параметризован form-interface'ом. Передай свой type: `const validation: ValidationSchemaFn<MyForm> = (path) => {...}`. Без generic'а или с `<any>` — silent fail на опечатках в имени поля + TS теряет автодополнение.
- **Inline callback OK для коротких, extract module-level для содержательных**. Inline нормально для `applyWhen`-предиката (`(t) => t === 'mortgage'`), 1-line `validate` (`(v: boolean) => v === true ? null : {...}`). Extract обязателен для: callback >5 строк, cross-field validateTree с branching, async-валидаторов с try/catch, повторно используемых проверок. Module-level `function validateLoanCap(form: MyForm): ValidationError | null { ... }` + reference в schema — улучшает читаемость и type-inference.

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
- [ ] Cross-field rules use **`validateTree<TForm>`** (с `targetField`), а не `validate(path.X, (v, ctx) => ctx.form.Y.value.value)`
- [ ] Async validators (if any) have debounce + cancelled-guard
- [ ] No default «Поле обязательно для заполнения» messages reach UI
- [ ] **Schema generic зафиксирован**: `ValidationSchemaFn<MyForm>` (НЕ `<any>`, НЕ опущен) — без него silent fail на опечатках имён полей
- [ ] **Содержательные callback'и (>5 lines) extracted module-level** как типизированные функции с явной сигнатурой `(form: MyForm) => ValidationError | null`; inline OK только для коротких predicates / single validate