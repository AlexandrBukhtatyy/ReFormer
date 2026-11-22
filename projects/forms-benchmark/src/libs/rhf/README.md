# rhf — React Hook Form + zod

React Hook Form 7.91.0, zod 4.6.7, @hookform/resolvers 6.0.2 (`zodResolver`). Written against the
official docs only (react-hook-form.com, zod.dev); behaviour per `BENCH-CONTRACT.md` §3 (and §8 for
the credit application).

```
kit/Field.tsx        Field (register + useFormState({ name })), ControllerField (useController) → FieldFrame
kit/zod.ts           serverCheck, afterSyncRules (`when`), requiredNumber, orEmpty, reportSection
kit/dependent.ts     setDependent (reset & copy targets: setValue + clearErrors), useCopies (subscribe)
registration/        schema.ts (zod rules, spec order), RegistrationForm.tsx, main.tsx
credit/              schema.ts (one zod schema for the wizard), CreditForm.tsx (useForm, wizard, submit),
                     steps.tsx (six steps, sections, arrays, computed values), fields.tsx (field by
                     CREDIT_FIELDS metadata, API Selects), main.tsx
```

## Patterns and the docs that recommend them

### React Hook Form — both forms

- `useForm({ resolver: zodResolver(schema) })`, all rules in the schema (rules passed to `register` are
  ignored when a resolver is set) — https://react-hook-form.com/docs/useform#resolver,
  https://github.com/react-hook-form/resolvers#zod
- `mode: 'onSubmit'` + `reValidateMode: 'onChange'` (defaults) = the contract's `afterFirstSubmit` —
  https://react-hook-form.com/docs/useform#mode, https://react-hook-form.com/docs/useform#reValidateMode
- `shouldFocusError: false` (contract: no focus on the first error) —
  https://react-hook-form.com/docs/useform#shouldFocusError
- Default `criteriaMode: 'firstError'`: one message per field, the first issue zod reports —
  https://react-hook-form.com/docs/useform#criteriaMode
- Uncontrolled `register` spread on the native primitives (`TextInput`, `MaskedInput`, `Checkbox`,
  `NumberInput`, `Select`, `RadioGroup`, …); `ref` reaches the real element, so the masked DOM value
  is what RHF reads — https://react-hook-form.com/docs/useform/register
- `register(name, { deps })` — a change re-validates the dependent field (registration: password →
  confirmation; credit: the `CREDIT_REVALIDATE` table) — https://react-hook-form.com/docs/useform/register
  (option `deps`)
- `useController` for value-based widgets (`CaptchaWidget`; credit: Selects with API options) —
  https://react-hook-form.com/docs/usecontroller,
  https://react-hook-form.com/advanced-usage/controlled-and-uncontrolled
- Error subscription in the field leaf: `useFormState({ control, name })` per field, nothing read from
  `formState` in the host except `isLoading`: "keep the host lean and move every read of form state
  into the component that renders it" —
  https://react-hook-form.com/advanced-usage/formprovider-performance,
  https://react-hook-form.com/docs/useformstate
- `get(errors, name)` to read a (possibly nested) field error —
  https://react-hook-form.com/advanced-usage/custom-hook-with-resolver (`get`/`set` helpers)
- `handleSubmit(onValid)` with an async `onValid` (docs' "Async" example); the resolver, async
  refinements included, is awaited before `onValid` runs (RHF 7.91 `handleSubmit` source) —
  https://react-hook-form.com/docs/useform/handlesubmit
- Saved data (invite prefill / `?application=1`) as async `defaultValues`; the form renders once
  `formState.isLoading` is false; a failed load falls back to empty values inside the function —
  https://react-hook-form.com/docs/useform#defaultValues,
  https://react-hook-form.com/advanced-usage/editing-saved-data
- Registration "Очистить" = `reset()` without arguments: back to the (possibly prefilled) defaults,
  errors and `isSubmitted` cleared — https://react-hook-form.com/docs/useform/reset

### React Hook Form — credit wizard

- **One `useForm` for all six steps** ("one form, several steps"), steps rendered conditionally, so
  inactive steps are unmounted and keep their values with `shouldUnregister: false` (the guide: "Don't
  set it to `true` here") — https://react-hook-form.com/advanced-usage/multi-step-forms,
  https://react-hook-form.com/docs/useform#shouldUnregister
- **"Далее" = `trigger(stepFields)`**: the resolver runs on the whole form, errors are updated only for
  the step's fields (top-level keys from `CREDIT_STEPS[i].keys`; groups and arrays whole). "Далее" is
  the form's submit button and `onSubmit` is `handleSubmit(onValid, onInvalid)` on the last step,
  `next()` otherwise — the guide's code. `onInvalid` moves to the first step holding an error (a
  cross-step rule can fail an earlier step) — https://react-hook-form.com/advanced-usage/multi-step-forms,
  https://react-hook-form.com/docs/useform/trigger
- **Per-step `afterFirstSubmit` via reactive `mode`** ("Both `mode` and `reValidateMode` are reactive",
  since v7.56): `mode` is `'onSubmit'` on a step until its first "Далее", `'onChange'` after it —
  https://react-hook-form.com/docs/useform#mode. See "Deviations" for why.
- `FormProvider` + `useFormContext` in the step components ("intended to be used in deeply nested
  structures"); the host reads no `formState` except `isLoading`, so the context value does not
  change while typing — https://react-hook-form.com/docs/formprovider,
  https://react-hook-form.com/docs/useformcontext,
  https://react-hook-form.com/advanced-usage/formprovider-performance
- **Conditional sections**: the controlling value read with `useWatch` in a small section component
  (not in the step) — https://react-hook-form.com/advanced-usage/conditional-fields,
  https://react-hook-form.com/docs/usewatch. Hidden fields are reset explicitly (contract), see below.
- **Computed values C.1–C.8**: `useWatch({ name: [...inputs], compute })` in a leaf component that
  renders `ReadonlyValue`; it re-renders only when the computed value changes (the docs' `compute`
  and field-array "Total" examples). Formulas from `shared/domain/credit`; computed values are not
  stored in the form (the payload normaliser computes them) — https://react-hook-form.com/docs/usewatch
- **Arrays**: `useFieldArray` with `field.id` as key; the flag's `onChange` does `append(emptyRow(),
{ shouldFocus: false })` / `remove()` (no index = remove all); full row objects from the shared
  factories ("append data is required and cannot be partial") —
  https://react-hook-form.com/docs/usefieldarray
- **Dependent resets** (`CREDIT_RESETS`: car model on brand change, city on region change; hidden
  conditional fields on loan type / employment change): `register(name, { onChange })` handler that
  calls `setValue(target, initial)` and `clearErrors(target)` if the target had an error.
  `onChange` runs only for user edits, so loading the application is not a "change" (domain rule) —
  https://react-hook-form.com/docs/useform/register (option `onChange`),
  https://react-hook-form.com/docs/useform/setvalue, https://react-hook-form.com/docs/useform/clearerrors,
  https://react-hook-form.com/docs/useform/getfieldstate. `resetField` is not used: it emits the whole
  form state and re-renders the host.
- **Copies** (`CREDIT_COPIES`: email → `emailAdditional` with `sameEmail`, registration → residence
  address with `sameAsRegistration`): `subscribe({ name: [flag, source], formState: { values: true } })`
  - `setValue` — subscribes without re-rendering and also sees `setValue` on the source (city reset)
    — https://react-hook-form.com/docs/useform/subscribe. The copied `emailAdditional` is `readOnly`
    ("use `readOnly` … to prevent user edits while preserving the value", register rules).
- **Number inputs**: `register(name, { setValueAs })` with the shared `parseNumberInput` (empty →
  `null`) — https://react-hook-form.com/docs/useform/register (option `setValueAs`). See "RHF notes".
- **Selects whose options load after mount** (city by region, car model by brand) use `useController`:
  a controlled `<select>` applies its value when the options arrive; a `register`ed one keeps what the
  DOM had when RHF wrote the value (no matching option yet → `''`). Options load in an effect with a
  stale-response guard, through the shared client (its cache/debounce, none added) —
  https://react-hook-form.com/docs/usecontroller, https://react.dev/learn/synchronizing-with-effects#fetching-data
- Region and property-type options (`getDictionaries`, `getRegions`) load once in the host at mount, in
  parallel with the application; `register`ed Selects (they are present long before steps 3 and 5).

### zod

- `import * as z from 'zod'`, `z.object`, string checks `.min()`, `.max()`, `.regex()`, `.length()`,
  number `.min()`/`.max()`, `z.enum` — https://zod.dev/api#strings, https://zod.dev/api#numbers,
  https://zod.dev/api#objects, https://zod.dev/api#enums
- Native email validator `z.email()` — https://zod.dev/api#emails
- `.pipe()`: `z.string().min(1).pipe(z.email())`, so an empty email reports "required", not the
  format (a failed first stage stops the pipe) — https://zod.dev/api#pipes
- Messages as the check's error parameter — https://zod.dev/error-customization
- `.refine()` for password strength, accepted checkboxes, the age range and required choices; async
  `.refine()` for the server checks (username/email/captcha, SMS code), run by `zodResolver` through
  `parseAsync` — https://zod.dev/api#refine
- `when` on the async refinements: run only after the field's sync rules passed (zod checks are
  continuable by default, so without it the server would be asked about `"jo"`) —
  https://zod.dev/api#when, https://zod.dev/api#abort
- Cross-field rules as object `.refine()` / `.superRefine()` with `path` = the field the user enters
  (confirm password; credit: mortgage limit, experience, payment ratio, income source, remaining debt
  per row) — https://zod.dev/api#path, https://zod.dev/api#superrefine
- `.nullable()` for `number | null` fields; "required" as `.refine(v => v !== null)` so the issue is
  continuable (`kit/zod.ts` `requiredNumber`) — https://zod.dev/api#nullables, https://zod.dev/api#refine
- Optional formatted fields as `z.union([z.literal(''), format])` (`orEmpty`) —
  https://zod.dev/api#unions
- `satisfies z.ZodType<Values, Values>`: the schema's input and output are the shared value types.

## Deviations

1. **With an invite / `?application=1` the form mounts after the saved data arrives** (`isLoading`
   gate). Controlled fields (captcha; credit API Selects) would get `undefined` on the first render
   during async `defaultValues`; the useController docs warn against that. The editing-saved-data
   guide's main example gates the same way ("render the form once the data is ready") —
   https://react-hook-form.com/advanced-usage/editing-saved-data. Without saved data, nothing is
   gated.
2. **The success result lives in `useState`**, not in RHF: the confirmation shows what the server
   returned, which RHF does not hold. Registration "Очистить" clears it together with `reset()`.
3. **Credit: per-step "submitted" state through `mode`.** RHF has one form-wide `isSubmitted`, set
   only by `handleSubmit`; `trigger` does not set it. With the guide's `trigger(stepFields)` and the
   contract's `onSubmit`/`onChange`, a field fixed after a failed "Далее" would keep its stale error.
   The guide itself uses `mode: 'onTouched'`, which validates before the first "Далее" (forbidden by
   §3). So the host keeps a set of steps where "Далее" was pressed and passes `mode: 'onChange'` for
   them, `'onSubmit'` otherwise (documented as reactive). The visible result is exactly the
   contract's: quiet until the step's first "Далее", then each change re-validates that field (and
   its `deps`); a field shown later in the step stays quiet until it is changed or "Далее" is pressed
   again (`onChange` validation reports only the changed field). The final "Отправить" is
   `handleSubmit`, after which `reValidateMode: 'onChange'` applies to all steps.
4. **Credit: conditional sections in `.superRefine()`, not `z.discriminatedUnion`.** The RHF
   conditional-fields page suggests a discriminated union; here there are three independent
   discriminators (loan type, employment status, residence flag) plus cross-step rules, which would
   need an intersection of three unions and a schema type different from the shared `CreditInput`
   that the form, the defaults and the payload normaliser use. Each conditional section is its own
   `z.object` with the field rules; the root `.superRefine()` applies it while the section is shown
   (shared `CREDIT_VISIBILITY` predicates) and reports its issues at the same paths. The shape keeps
   only the field types for those fields.
5. **Credit: `append(row, { shouldFocus: false })`.** RHF focuses the first input of an appended row by
   default; the contract has no focus moves and the other implementations do not move focus.
6. **Credit: hidden conditional fields are reset with `setValue`, not `shouldUnregister: true`.** The
   conditional-fields page drops a hidden value with `shouldUnregister: true` on the field. Here the
   steps are unmounted too, so that option would also drop the conditional fields' values on every
   step change (the multi-step guide: "Don't set it to `true` here"), and it leaves `undefined` (and
   removes the field's default) instead of the initial value the contract asks for. So the
   controlling field's `register` `onChange` resets the hidden fields (see "Dependent resets").

History: an earlier shared-client bug (a repeated check of an unchanged value superseded its
own pending check, losing the error) forced a names-scoped resolver wrapper; the client was fixed
and the plain `zodResolver(schema)` is used again.

Nothing else deviates: no `memo`/`useMemo`, no React Compiler, only public RHF/zod API, and no
DOM wrappers beyond `FieldFrame`.

## RHF notes for the benchmark report

- **Schema validation is whole-form.** `zodResolver` parses all values on every validation: each
  keystroke on a checked step (`onChange`) and each `trigger` runs the full credit schema (all six
  steps, the conditional sections, the cross rules; the SMS refinement only when the code passes its
  sync rules). RHF then keeps only the changed field's error ("Re-validation of an input will only
  occur one field at a time"). Before a step's first "Далее" nothing is validated.
- **`trigger([...])` and `clearErrors()` without a name re-render every error subscriber**; a single
  string name re-renders only that field (trigger docs, "Rules"). Single `deps` are passed as a string
  for that reason.
- **`setValueAs` runs on values RHF writes itself** (defaults on register, `setValue`), not only on
  the input's string — in RHF 7.91 `setFieldValue` passes every value through `getFieldValueAs`,
  although the register docs say it "does not transform `defaultValue` or `defaultValues`". The
  shared `parseNumberInput` is used as is: it already passes numbers and `null` through unchanged
  (no wrapper in this implementation). `valueAsNumber` is not used: an empty input would give `NaN`,
  a zod type issue that is not continuable and would skip every object-level rule.
- **`resetField` emits the whole form state** and re-renders the `useForm` host; dependent resets use
  `setValue` + `clearErrors(name)` (scoped) instead.
- **`useWatch` / `subscribe` with values clone the form values** on each change of a watched field
  (RHF hands subscribers a snapshot); this is RHF's cost of computed values.
