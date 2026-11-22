# RJSF (react-jsonschema-form 6.10.1 + ajv8)

`@rjsf/core` + `@rjsf/utils` + `@rjsf/validator-ajv8`, written from the spec, `BENCH-CONTRACT.md`,
`src/shared/**` and the official RJSF documentation only.

```
theme/            bench theme for RJSF — reusable by every form of the benchmark
  index.ts        withTheme(benchTheme) → BenchForm
  templates.tsx   FieldTemplate, ObjectFieldTemplate, ArrayFieldTemplate, ArrayFieldItemTemplate,
                  BaseInputTemplate (text/number/date), ButtonTemplates.SubmitButton
  widgets.tsx     CheckboxWidget, SelectWidget, RadioWidget, TextareaWidget, masked, captcha,
                  remoteSelect (options from formContext), computed (read-only value)
  fieldPath.ts    contract path (testid) from the RJSF field id; the one shown error of a field;
                  BenchFormContext (what the theme reads from formContext)
registration/
  main.tsx                mountBench('registration', RegistrationForm)
  RegistrationForm.tsx    the page: Form props, async checks, submit, reset, invite prefill
  schema.ts               JSON Schema, uiSchema, transformErrors, customValidate
  RegistrationLayout.tsx  root ObjectFieldTemplate (account fields in the grid)
credit/
  main.tsx          mountBench('credit', CreditForm)
  CreditForm.tsx    the wizard: one <Form> per step, page state, server data, SMS check, submit
  schemas.ts        JSON Schemas of the six steps (conditional fields as root allOf if/then)
  uiSchemas.ts      uiSchemas generated from the shared field metadata + per-step layout/order
  layouts.tsx       root ObjectFieldTemplates of steps 1, 2, 4 (sections over top-level fields)
  validation.ts     transformErrors (one message, spec order) and per-step customValidate
  data.ts           form data shape; resets, copies, computed values; quiet-field bookkeeping
```

Docs root: <https://rjsf-team.github.io/react-jsonschema-form/docs/> (below: `…/docs/`). The site
publishes only the current 6.x docs (v6.11.1 at the time of writing); where 6.10.1 differs, the
row or deviation says so (`requiredBooleanDefault`, deviation 21).

## Patterns and where they are documented

### Theme

| Pattern                                                                                                                                                                          | Where                                                      | Docs                                                                                                                                                                                                                                                                                                                                               |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Theme as `withTheme(ThemeProps)` with `templates` + `widgets`                                                                                                                    | `theme/index.ts`                                           | [custom-themes](https://rjsf-team.github.io/react-jsonschema-form/docs/advanced-customization/custom-themes)                                                                                                                                                                                                                                       |
| `FieldTemplate` from `label`, `rawErrors`, `hideError`, `hidden`, `children` → `FieldFrame`; containers and computed values pass through                                         | `theme/templates.tsx`                                      | [custom-templates#fieldtemplate](https://rjsf-team.github.io/react-jsonschema-form/docs/advanced-customization/custom-templates#fieldtemplate)                                                                                                                                                                                                     |
| `ObjectFieldTemplate` renders `properties[].content`; a nested object with its own `title` is a `Section`                                                                        | `theme/templates.tsx`                                      | [custom-templates#objectfieldtemplate](https://rjsf-team.github.io/react-jsonschema-form/docs/advanced-customization/custom-templates#objectfieldtemplate)                                                                                                                                                                                         |
| `ArrayFieldTemplate` (`items`, `onAddClick`, `title`) → `ArrayFrame`; `ArrayFieldItemTemplate` (`children`, `index`, `buttonsProps.onRemoveItem`, `parentUiSchema`) → `ArrayRow` | `theme/templates.tsx`                                      | [custom-templates#arrayfieldtemplate](https://rjsf-team.github.io/react-jsonschema-form/docs/advanced-customization/custom-templates#arrayfieldtemplate), [custom-templates#arrayfielditemtemplate](https://rjsf-team.github.io/react-jsonschema-form/docs/advanced-customization/custom-templates#arrayfielditemtemplate)                         |
| `BaseInputTemplate` behind text/password/email/date/number widgets, by `getInputProps(...).type`; `onChangeOverride`, `options.emptyValue`                                       | `theme/templates.tsx`                                      | [custom-templates#baseinputtemplate](https://rjsf-team.github.io/react-jsonschema-form/docs/advanced-customization/custom-templates#baseinputtemplate), [custom-widgets-fields#customizing-widgets-text-input](https://rjsf-team.github.io/react-jsonschema-form/docs/advanced-customization/custom-widgets-fields#customizing-widgets-text-input) |
| `ButtonTemplates.SubmitButton` with `getSubmitButtonOptions`                                                                                                                     | `theme/templates.tsx`                                      | [custom-templates#submitbutton](https://rjsf-team.github.io/react-jsonschema-form/docs/advanced-customization/custom-templates#submitbutton)                                                                                                                                                                                                       |
| Replacing core widgets by registry name (`CheckboxWidget`, `SelectWidget`, `RadioWidget`, `TextareaWidget`)                                                                      | `theme/widgets.tsx`                                        | [custom-widgets-fields#customizing-the-default-fields-and-widgets](https://rjsf-team.github.io/react-jsonschema-form/docs/advanced-customization/custom-widgets-fields#customizing-the-default-fields-and-widgets)                                                                                                                                 |
| Custom widgets registered by name, picked with `ui:widget: 'masked' \| 'captcha' \| 'remoteSelect' \| 'computed'`                                                                | `theme/widgets.tsx`, `*/schema*.ts`, `credit/uiSchemas.ts` | [custom-widgets-fields#custom-component-registration](https://rjsf-team.github.io/react-jsonschema-form/docs/advanced-customization/custom-widgets-fields#custom-component-registration)                                                                                                                                                           |
| Widget options through `ui:options` (`mask`, `optionsFrom`, `addLabel`, `rowTitle`)                                                                                              | `schema.ts`, `credit/uiSchemas.ts`                         | [custom-widgets-fields#custom-widget-options](https://rjsf-team.github.io/react-jsonschema-form/docs/advanced-customization/custom-widgets-fields#custom-widget-options)                                                                                                                                                                           |
| Enum option encoding: `enumOptionValueEncoder/Decoder`, `enumOptionSelectedValue`, `getOptionValueFormat`                                                                        | `theme/widgets.tsx`                                        | [utility-functions](https://rjsf-team.github.io/react-jsonschema-form/docs/api-reference/utility-functions), [uiSchema#optionvalueformat](https://rjsf-team.github.io/react-jsonschema-form/docs/api-reference/uiSchema#optionvalueformat)                                                                                                         |
| Context-aware widgets/templates read `registry.formContext` (`options`, `quiet`)                                                                                                 | `theme/fieldPath.ts`, `theme/widgets.tsx`                  | [form-props#formcontext](https://rjsf-team.github.io/react-jsonschema-form/docs/api-reference/form-props#formcontext)                                                                                                                                                                                                                              |
| Ids built from `idPrefix` + `idSeparator` (`registry.globalFormOptions`) → contract path                                                                                         | `theme/fieldPath.ts`                                       | [form-props#idseparator](https://rjsf-team.github.io/react-jsonschema-form/docs/api-reference/form-props#idseparator)                                                                                                                                                                                                                              |

### Registration page

| Pattern                                                                                                                                                                                                                                      | Where                                 | Docs                                                                                                                                                                                                                                                                                                                                                                                        |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Schema, uiSchema, validator, hooks declared at module scope, as in every docs example                                                                                                                                                        | `schema.ts`, `RegistrationForm.tsx`   | [validation](https://rjsf-team.github.io/react-jsonschema-form/docs/usage/validation)                                                                                                                                                                                                                                                                                                       |
| Rules as JSON Schema: `required`, `minLength`, `maxLength`, `pattern`, `format: 'email'`, `enum: [true]`                                                                                                                                     | `schema.ts`                           | [validation](https://rjsf-team.github.io/react-jsonschema-form/docs/usage/validation)                                                                                                                                                                                                                                                                                                       |
| Empty input → `undefined`, so `required` rejects an empty string field                                                                                                                                                                       | `theme/templates.tsx`, `schema.ts`    | [validation#the-case-of-empty-strings](https://rjsf-team.github.io/react-jsonschema-form/docs/usage/validation#the-case-of-empty-strings), [uiSchema#emptyvalue](https://rjsf-team.github.io/react-jsonschema-form/docs/api-reference/uiSchema#emptyvalue)                                                                                                                                  |
| Labels from schema `title`, placeholders from `ui:placeholder`, `ui:widget: 'password'`                                                                                                                                                      | `schema.ts`                           | [uiSchema#placeholder](https://rjsf-team.github.io/react-jsonschema-form/docs/api-reference/uiSchema#placeholder), [uiSchema#widget](https://rjsf-team.github.io/react-jsonschema-form/docs/api-reference/uiSchema#widget)                                                                                                                                                                  |
| Per-form layout with `ui:ObjectFieldTemplate`                                                                                                                                                                                                | `schema.ts`, `RegistrationLayout.tsx` | [custom-templates#objectfieldtemplate](https://rjsf-team.github.io/react-jsonschema-form/docs/advanced-customization/custom-templates#objectfieldtemplate)                                                                                                                                                                                                                                  |
| Spec messages and «first violated rule» via `transformErrors` (by `name` = ajv keyword, `property`)                                                                                                                                          | `schema.ts`                           | [validation#custom-error-messages](https://rjsf-team.github.io/react-jsonschema-form/docs/usage/validation#custom-error-messages), [form-props#transformerrors](https://rjsf-team.github.io/react-jsonschema-form/docs/api-reference/form-props#transformerrors)                                                                                                                            |
| Password confirmation with `customValidate`, using its 4th argument `errorSchema`                                                                                                                                                            | `schema.ts`                           | [validation#custom-validation-rules](https://rjsf-team.github.io/react-jsonschema-form/docs/usage/validation#custom-validation-rules)                                                                                                                                                                                                                                                       |
| Validation on submit by default, `liveValidate="onChange"` after the first attempt                                                                                                                                                           | `RegistrationForm.tsx`                | [validation#live-validation](https://rjsf-team.github.io/react-jsonschema-form/docs/usage/validation#live-validation), [form-props#livevalidate](https://rjsf-team.github.io/react-jsonschema-form/docs/api-reference/form-props#livevalidate)                                                                                                                                              |
| Async (server) errors through `extraErrors`, made blocking with `extraErrorsBlockSubmit`                                                                                                                                                     | `RegistrationForm.tsx`                | [validation#async-validation](https://rjsf-team.github.io/react-jsonschema-form/docs/usage/validation#async-validation), [form-props#extraerrors](https://rjsf-team.github.io/react-jsonschema-form/docs/api-reference/form-props#extraerrors), [form-props#extraerrorsblocksubmit](https://rjsf-team.github.io/react-jsonschema-form/docs/api-reference/form-props#extraerrorsblocksubmit) |
| Writing an `ErrorSchema` with `ErrorSchemaBuilder`; `toErrorList`                                                                                                                                                                            | `RegistrationForm.tsx`                | [utility-functions#errorschema-builder-class](https://rjsf-team.github.io/react-jsonschema-form/docs/api-reference/utility-functions#errorschema-builder-class)                                                                                                                                                                                                                             |
| `onSubmit` (sync rules passed) / `onError` (they did not) / `onChange(data, id)`                                                                                                                                                             | `RegistrationForm.tsx`                | [form-props#onsubmit](https://rjsf-team.github.io/react-jsonschema-form/docs/api-reference/form-props#onsubmit), [form-props#onerror](https://rjsf-team.github.io/react-jsonschema-form/docs/api-reference/form-props#onerror), [form-props#onchange](https://rjsf-team.github.io/react-jsonschema-form/docs/api-reference/form-props#onchange)                                             |
| Own buttons as Form `children` (replace the default submit)                                                                                                                                                                                  | `RegistrationForm.tsx`                | [form-props#children](https://rjsf-team.github.io/react-jsonschema-form/docs/api-reference/form-props#children)                                                                                                                                                                                                                                                                             |
| Uncontrolled form: `initialFormData` + programmatic `reset()` through a ref                                                                                                                                                                  | `RegistrationForm.tsx`                | [form-props#initialformdata](https://rjsf-team.github.io/react-jsonschema-form/docs/api-reference/form-props#initialformdata), [v6 upgrade guide](https://rjsf-team.github.io/react-jsonschema-form/docs/migration-guides/v6.x%20upgrade%20guide#initialformdata-prop-added-to-form)                                                                                                        |
| `noHtml5Validate`, `showErrorList={false}`, `focusOnFirstError` left off                                                                                                                                                                     | `RegistrationForm.tsx`                | [validation#html5-validation](https://rjsf-team.github.io/react-jsonschema-form/docs/usage/validation#html5-validation), [form-props#showerrorlist](https://rjsf-team.github.io/react-jsonschema-form/docs/api-reference/form-props#showerrorlist), [form-props#focusonfirsterror](https://rjsf-team.github.io/react-jsonschema-form/docs/api-reference/form-props#focusonfirsterror)       |
| Required boolean starts as `false`: built into `getDefaultFormState` in 6.10.1; the current docs (6.11) describe it as `experimental_defaultFormStateBehavior.requiredBooleanDefault`, default `populateFalse` (not set here, not in 6.10.1) | —                                     | [form-props#requiredbooleandefault](https://rjsf-team.github.io/react-jsonschema-form/docs/api-reference/form-props#requiredbooleandefault)                                                                                                                                                                                                                                                 |

### Credit page (wizard)

| Pattern                                                                                                                                                                                                                                                                                     | Where                                        | Docs                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Controlled form: `formData` from page state, `onChange(data, id)` writes it back                                                                                                                                                                                                            | `credit/CreditForm.tsx`                      | [form-props#formdata](https://rjsf-team.github.io/react-jsonschema-form/docs/api-reference/form-props#formdata), [form-props#onchange](https://rjsf-team.github.io/react-jsonschema-form/docs/api-reference/form-props#onchange)                                                                                                                                                                              |
| One `<Form>` per step (own schema/uiSchema/hooks), `key` per step; «Далее» is the step form's submit (`onSubmit` / `onError`), buttons as Form `children`                                                                                                                                   | `credit/CreditForm.tsx`                      | [form-props#onsubmit](https://rjsf-team.github.io/react-jsonschema-form/docs/api-reference/form-props#onsubmit), [form-props#onerror](https://rjsf-team.github.io/react-jsonschema-form/docs/api-reference/form-props#onerror), [form-props#children](https://rjsf-team.github.io/react-jsonschema-form/docs/api-reference/form-props#children)                                                               |
| Conditional fields: root `allOf` of `if`/`then`, one entry per condition (`if` lists its property in `required`); RJSF resolves it in `retrieveSchema`, renders the active `then`, clears data of a switched-off one                                                                        | `credit/schemas.ts`                          | [form-props#allof](https://rjsf-team.github.io/react-jsonschema-form/docs/api-reference/form-props#allof) (if-then-else in `allOf`, «one `allOf` entry per `enum` value»), [validation](https://rjsf-team.github.io/react-jsonschema-form/docs/usage/validation#precompiled-validators) («resolves dependencies, if-then-else … via `retrieveSchema()`»)                                                      |
| Conditional required (`additionalIncome > 0` → source required) as `if`/`then` `required`                                                                                                                                                                                                   | `credit/schemas.ts`                          | same                                                                                                                                                                                                                                                                                                                                                                                                          |
| Copy target read-only while the copy is on: `readOnly` added by the `then`                                                                                                                                                                                                                  | `credit/schemas.ts`                          | [uiSchema#readonly](https://rjsf-team.github.io/react-jsonschema-form/docs/api-reference/uiSchema#readonly) («equivalent to setting `readOnly` in the schema»)                                                                                                                                                                                                                                                |
| Array rows: item `default` (row on «Добавить»), array `default` (first row when the flag's `then` switches on); `ui:options.orderable: false`                                                                                                                                               | `credit/schemas.ts`, `credit/uiSchemas.ts`   | [json-schema/arrays](https://rjsf-team.github.io/react-jsonschema-form/docs/json-schema/arrays), [uiSchema](https://rjsf-team.github.io/react-jsonschema-form/docs/api-reference/uiSchema) (`ui:options` of array items)                                                                                                                                                                                      |
| A required nested object is created as `{}` by RJSF (so its own `required` fields are checked)                                                                                                                                                                                              | `credit/schemas.ts`                          | [form-props#emptyobjectfields](https://rjsf-team.github.io/react-jsonschema-form/docs/api-reference/form-props#emptyobjectfields)                                                                                                                                                                                                                                                                             |
| Static choices: `enum` + `ui:enumNames`, `ui:widget: 'radio'`, `ui:optionValueFormat: 'realValue'`                                                                                                                                                                                          | `credit/schemas.ts`, `credit/uiSchemas.ts`   | [uiSchema#enumnames](https://rjsf-team.github.io/react-jsonschema-form/docs/api-reference/uiSchema#enumnames), [uiSchema#optionvalueformat](https://rjsf-team.github.io/react-jsonschema-form/docs/api-reference/uiSchema#optionvalueformat)                                                                                                                                                                  |
| Server option lists (regions, cities, car models, property types) in `formContext`, read by a custom widget — the schema never changes                                                                                                                                                      | `credit/CreditForm.tsx`, `theme/widgets.tsx` | [form-props#formcontext](https://rjsf-team.github.io/react-jsonschema-form/docs/api-reference/form-props#formcontext)                                                                                                                                                                                                                                                                                         |
| Computed values C.1–C.8 as `readOnly` schema properties with `ui:widget: 'computed'`, written by the page in `onChange`                                                                                                                                                                     | `credit/schemas.ts`, `credit/data.ts`        | [form-props#onchange](https://rjsf-team.github.io/react-jsonschema-form/docs/api-reference/form-props#onchange), [custom-widgets-fields](https://rjsf-team.github.io/react-jsonschema-form/docs/advanced-customization/custom-widgets-fields)                                                                                                                                                                 |
| Step layouts with sections over top-level fields (`ui:ObjectFieldTemplate`); property order of `then` fields with `ui:order`                                                                                                                                                                | `credit/layouts.tsx`, `credit/uiSchemas.ts`  | [custom-templates#objectfieldtemplate](https://rjsf-team.github.io/react-jsonschema-form/docs/advanced-customization/custom-templates#objectfieldtemplate), [uiSchema#order](https://rjsf-team.github.io/react-jsonschema-form/docs/api-reference/uiSchema#order)                                                                                                                                             |
| One message per field (first rule in `CREDIT_MESSAGES` order) with `transformErrors`                                                                                                                                                                                                        | `credit/validation.ts`                       | [validation#custom-error-messages](https://rjsf-team.github.io/react-jsonschema-form/docs/usage/validation#custom-error-messages)                                                                                                                                                                                                                                                                             |
| Cross-field rules with `customValidate`, run only when the field's schema rules passed (4th argument `errorSchema`), array rows through the error handler tree                                                                                                                              | `credit/validation.ts`                       | [validation#custom-validation-rules](https://rjsf-team.github.io/react-jsonschema-form/docs/usage/validation#custom-validation-rules)                                                                                                                                                                                                                                                                         |
| Reveal per step: `liveValidate="onChange"` after the step's first «Далее»                                                                                                                                                                                                                   | `credit/CreditForm.tsx`                      | [validation#live-validation](https://rjsf-team.github.io/react-jsonschema-form/docs/usage/validation#live-validation)                                                                                                                                                                                                                                                                                         |
| SMS code server check as `extraErrors` + `extraErrorsBlockSubmit`; `ErrorSchemaBuilder`                                                                                                                                                                                                     | `credit/CreditForm.tsx`                      | [validation#async-validation](https://rjsf-team.github.io/react-jsonschema-form/docs/usage/validation#async-validation), [form-props#extraerrorsblocksubmit](https://rjsf-team.github.io/react-jsonschema-form/docs/api-reference/form-props#extraerrorsblocksubmit)                                                                                                                                          |
| «Отправить» checks all steps: earlier (unmounted) steps through the validator's `validateFormData` with each step's schema, `customValidate`, `transformErrors`, uiSchema; the first invalid step is opened and its Form validated with `validateForm()` on a ref (errors shown, `onError`) | `credit/CreditForm.tsx`                      | [validation#validate-form-programmatically](https://rjsf-team.github.io/react-jsonschema-form/docs/usage/validation#validate-form-programmatically); `validateFormData` — the `ValidatorType` interface of `@rjsf/utils` that `Form` itself calls on submit ([validation](https://rjsf-team.github.io/react-jsonschema-form/docs/usage/validation): a validator «must fulfill the `ValidatorType` interface») |

### Optimisation budget

Used only what the docs show: schema, uiSchema, validator and the themed `BenchForm` are module-level
constants. Not used: `useMemo`/`useCallback`/`memo` in the page or theme, the experimental
`experimental_componentUpdateStrategy` (default `customDeep`), precompiled validators, React Compiler.
The validator is the default runtime `@rjsf/validator-ajv8` export. `liveValidate` is `onChange`
(not `onBlur`) because the contract wants every change re-validated. The credit page keeps the latest
values in a `useRef` (RJSF can report several changes before the page re-renders) — state, not
memoization.

## Deviations

Places where the contract asks for something RJSF does not do natively, and what was done.

1. **Async validation.** RJSF has none, only display of `extraErrors`. The docs example sets them
   after a backend call on submit; the page also runs the checks itself after each change once the
   first submit attempt has happened:
   - on change (`onChange` with a field `id`, after the first attempt): the changed field's previous
     verdict is dropped; if the new value passed the field's sync rules, the shared client is called
     and a definite `false` becomes `extraErrors` for that field;
   - on a submit attempt with sync errors (`onError`): fields that passed their sync rules are
     checked, so their server errors show next to the sync ones;
   - on a submit attempt without sync errors (`onSubmit`): all checks are awaited (pending ones joined
     through the client), then `api.register`. A standing server error blocks earlier, through
     `extraErrorsBlockSubmit`.

   Whether a field passed its sync rules is read from the errors RJSF reports. RJSF merges
   `extraErrors` into them, so the field's own async message, stale once the value has changed, is
   left out of that test. Results are applied only while the checked value is still in the field and
   no reset happened since. `undefined` (superseded) is no verdict.

2. **Validation reveal.** There is no `afterFirstSubmit` mode. `liveValidate` is page state, switched
   on by the first `onSubmit`/`onError` and off by «Очистить», as the contract suggests. Live
   validation re-validates the whole form with ajv on each change; that is also why a change of
   `password` re-checks `confirmPassword` with no extra code.
3. **One message per field, spec order.** ajv (`allErrors: true`) reports every failed keyword, in
   schema order. `transformErrors` keeps one error per field: the lowest in a per-field rule table
   copied from the spec, with its text from `shared/messages`. Note that ajv8 errors give
   `required` as `username` and the other keywords as `.username`; both forms are normalised. The
   cross-field rule (`customValidate`) runs only when the field's schema rules passed.
4. **Empty values.** RJSF stores an emptied input as `undefined` (the field is absent), which is what
   makes `required` reject an empty string. So the form data is `Partial<RegistrationValues>`, and the
   initial data is `{}`, not `REGISTRATION_INITIAL`: `''` would pass `required` and show the
   `minLength` message instead. `acceptTerms` still starts as `false` because RJSF sets that default
   itself (`requiredBooleanDefault`). On submit the schema has proved every field present, so the data
   goes to `toRegistrationPayload` as `RegistrationValues`.
5. **«Принять условия».** `enum: [true]`, not `const: true`: RJSF uses `const` as a default
   (`constAsDefaults`), which would pre-check the box.
6. **Password strength** is `isStrongPassword` rewritten as the lookahead pattern
   `^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)`. JSON Schema needs a regex, not a function.
7. **Reset.** `reset()` restores `initialFormData` and clears RJSF's errors. `liveValidate` and
   `extraErrors` are page state and are cleared next to it. `reset()` calls the `onChange` it read
   _before_ re-rendering, that is the handler from before «Очистить», with the old phase. Only changes
   that carry a field `id` (user edits) trigger checks; `reset()` passes none.
8. **Invite prefill.** `initialFormData` is read when the Form mounts, so with `?invite=` the page
   renders the `Page` at once and mounts the Form when the prefill has arrived.
9. **Form props a theme cannot carry.** The docs' «Overriding other Form props» mentions setting
   e.g. `showErrorList` in a theme, but `ThemeProps` in 6.10.1 is typed as only
   `fields | templates | widgets | _internalFormWrapper`. So `idSeparator="-"`, `noHtml5Validate`
   and `showErrorList={false}` are passed by the page.
10. **Typing.** `ErrorSchema<any>` cannot be written as an object literal under strict TS (the docs'
    own `extraErrors` example fails to type-check), so `extraErrors` is written with
    `ErrorSchemaBuilder`. uiSchema/ErrorSchema are untyped (`any`) because `withTheme` yields a
    `FormProps<any>` component.
11. **Markup.** The page has the same 34 elements under `<main>` as the baseline, with no extra
    wrappers: the root field and object templates render fragments. Attribute differences only: the
    form has `class="rjsf"` (RJSF falls back to it for an empty `className`); text inputs get
    `type="text"` (`getInputProps`) and `value=""` (controlled). `name` is RJSF's
    (`htmlName || id`, e.g. `root-username`), as in the core templates.
12. **Buttons of arrays.** The shared `ArrayFrame`/`ArrayRow` own the «Добавить»/«Удалить» markup
    (contract testids), so the array templates call `onAddClick` / `buttonsProps.onRemoveItem`
    directly; core `AddButton`/`RemoveButton`/`ArrayFieldItemButtonsTemplate` are not rendered. The
    phone widget is the generic `masked` widget with `ui:options.mask`.

### Credit page

13. **Wizard.** RJSF has none. Each step is a separate `<Form>` over the step's slice of the page
    values (`stepData`), remounted per step; the page merges what the step reports back
    (`applyStepData`, keys exactly as RJSF reports them, so the controlled round trip finds nothing
    changed). No `omitExtraData`/`liveOmit`: they would strip data RJSF keeps for hidden fields. The
    step indicator is rendered right before the `<form>` (RJSF renders fields before its
    `children`), the nav buttons are the form's `children` — the same element count as the
    baseline on every step.
14. **Conditionals as `allOf` + `if`/`then`, not `dependencies` + `oneOf`.** The docs' dynamic
    `dependencies` resolve the same on screen, but RJSF validates the _root_ schema on submit, and ajv
    then reports the errors of every non-matching `oneOf` branch (`enum` on the controlling field,
    `required` of other branches' hidden fields). With `if`/`then` a failed `then` reports only its
    own fields' errors plus one field-less `if` error, which `transformErrors` drops.
15. **Hidden fields reset.** Done by RJSF itself: when a `then` switches off, the retrieved schema
    changes and `processPendingChange` runs `sanitizeDataForNewSchema`, which sets the fields of the
    old branch to `undefined` (= the initial empty value). Switching an array's flag off clears the
    array the same way; switching it on fills the array `default` (one empty row).
16. **Copies, dependent resets, computed values** are page logic in `onChange` (`data.ts`), driven
    by the shared tables `CREDIT_COPIES`, `CREDIT_RESETS` and the C.1–C.8 formulas, applied only for
    rules whose source is on the reporting step, writing a value only when it changed. The residence
    address is copied while `sameAsRegistration` is set (hidden, kept as extra data); unsetting the
    flag gives the empty initial address. A copy that RJSF's sanitizer keeps on the way back (old
    branch had no `residenceAddress`) is replaced by the page in the same change.
17. **Payment ≤ 50 % of income** is checked on the computed `paymentToIncomeRatio` of step 4's data
    (`customValidate` sees only the step's data). RJSF validates a change before the page recomputes
    C.7, so that first pass sees the previous ratio; the page's recomputed `formData` makes RJSF
    validate again (controlled form), and that result is what is shown.
18. **Quiet fields** (BENCH-CONTRACT §8: a field that appears after a failed «Далее» stays quiet until
    changed or the next «Далее»). RJSF live-validates the whole step, so the page keeps a set of quiet
    contract paths (`nextQuiet`: on screen now, not before, from `CREDIT_VISIBILITY` and array row
    counts; a change of the field or «Далее» removes it) and passes it in `formContext`; the theme
    hides those fields' errors. Known limit: after a row removal, quiet paths are not shifted to the
    rows' new indexes (only the paths that left the screen are dropped).
19. **Server option lists.** RJSF's documented way to change options is the schema (`enum`/`oneOf`),
    which rebuilds `schemaUtils` and recompiles ajv on every list. Instead the lists are in
    `formContext.options` and a `remoteSelect` widget reads them; the field's schema is a plain
    string. Loading is an effect per key (region, brand) through the shared client.
20. **Empty values.** As in registration, empty fields are absent (RJSF's `undefined`), so the shared
    initial values and the `?application=1` data go through `toFormData` (drops `''`, `null`, `[]`).
    `toCreditPayload` reads absent as empty. A nested object that must be checked is listed in its
    parent's `required` — RJSF only creates `{}` for a _required_ object property; an absent one
    would skip its fields' `required`.
21. **`optionValueFormat` per field.** The docs allow it in `ui:globalOptions`, but in 6.10.1
    `StringField` builds widget options with `getUiOptions(uiSchema)` without the global ones, so a
    string enum widget never sees it there; it is set on each choice field.
22. **Theme: object title.** `ObjectFieldTemplateProps.title` falls back to the property name or the
    array row title (`Имущество-1`), so the theme frames a nested object only when it has its own
    `ui:title`/schema `title`.
23. **«Отправить» validates every step** (BENCH-CONTRACT §8: a cross-step rule can go stale, e.g.
    step 4's payment ratio after step 5 changed the rate). Steps are separate, unmounted Forms, so
    there is no Form to ask: on step 6's submit (`onSubmit`, and `onError` too — an earlier invalid
    step wins over step 6's own errors) the page validates steps 1–5 with
    `validator.validateFormData(data, schema, customValidate, transformErrors, uiSchema)` — what
    `Form.validate` runs on submit, on the step's slice with absent fields dropped
    (`JSON.parse(JSON.stringify(…))`, as `Form.validate` does). The page keeps C.1–C.8 current for
    all steps, so the stale ratio fails here. The first invalid step is opened and, once its Form has
    mounted, `validateForm()` (documented ref method) shows its errors and calls `onError`, which
    makes the step live. Only when all steps pass does the SMS check run and the application post.
    Cost: up to five ajv runs at submit; a step root schema whose ajv entry was replaced by another
    step's (`handleSchemaUpdate` keeps one root per validator) is compiled again.

### Behaviour worth knowing for the numbers

- Every change re-validates the whole step with ajv once live (`liveValidate`), plus once more when
  the page changes the data it hands back (a computed value, a copy, a reset): RJSF's
  `getSnapshotBeforeUpdate` sees `formData` differing from its state and re-runs
  `getStateFromProps` with live validation. Before the reveal there is no ajv run on change.
- Each controlled round trip also runs `getDefaultFormState` + `retrieveSchema` and deep-compares
  the props (`customDeep`); fields re-render only where their props changed (memoized `SchemaField`).
- When an `if` flips (loan type, employment status, a flag), the live-validation schema is a new
  retrieved-schema object, so ajv compiles it (ajv caches by object identity; flipping back produces
  a new object again).
- `formContext` changes (a list loaded, the quiet set changed) give a new registry, which re-renders
  every field of the step.
- Number fields depend on the browser locale. RJSF's `getInputProps` (used by `BaseInputTemplate`,
  as in the docs' template) falls back to `type="text"` when the locale's decimal separator is not
  `.`: in a `ru-RU` browser number fields render the shared `TextInput` and RJSF's `NumberField`
  converts the string; in `en-US` they render `NumberInput` and the theme parses with
  `parseNumberInput`. Both paths pass conformance. `NumberField` and `getInputProps` build an
  `Intl.NumberFormat` (`getDecimalSeparator`) on every render of a number field either way. The
  Playwright config pins no `locale`, so the bench follows the machine's.
