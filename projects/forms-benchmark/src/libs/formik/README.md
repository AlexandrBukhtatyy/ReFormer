# Formik + Yup

Formik 2.4.9 with Yup 1.7.1. Only public APIs are used. Optimisations are limited to what the docs
recommend: field elements are passed to `<Formik>` as static children (tutorial, final example), and
the credit form, which has 70+ fields, uses `<FastField>` for independent fields (FastField docs: "large
forms (~30+ fields)").

```
kit/                    Formik ↔ shared primitives, used by both forms
  binding.tsx           useBenchField (useField) / FastBenchField (<FastField>) → Bound field;
                        reveal rule; SubmitAttempts context
  fields.tsx            views (FieldFrame + shared control) for text, textarea, masked, date, select,
                        radio, checkbox; TextField, MaskedField, CheckboxField; ComputedField
  number.tsx            number view (number | null ⇄ input string); own module: imports the credit domain
  captcha.tsx           CaptchaField; own module: the widget talks to the registration API
  serverCheck.ts        async Yup test that runs only after the field's sync rules pass
registration/
  schema.ts             Yup schema (rules and messages in the spec's order)
  RegistrationForm.tsx  <Formik> + <Form> + fields, submit → status, invite → enableReinitialize
credit/
  schema.ts             one Yup schema per wizard step
  CreditForm.tsx        Wizard (MultistepWizard example), StepAttempts, computed values, submit
  steps.tsx             the six steps in the baseline's markup order; arrays through <FieldArray>
  fields.tsx            CREDIT_FIELDS metadata → kit view; FastCreditField / CreditField;
                        Selects with API options; copies; conditional sections
  changes.ts            user changes that move other fields: one setValues(updater) each
```

## Patterns and the docs that recommend them

### Both forms

| Pattern                                                                                                                  | Where                                      | Docs                                                                                                                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `<Formik initialValues validationSchema onSubmit>`, with `<Form>` and the fields as children elements, not a render prop | `RegistrationForm.tsx`, `CreditForm.tsx`   | [Tutorial → Leveraging React Context](https://formik.org/docs/tutorial#leveraging-react-context)                                                                                                                               |
| A Yup object schema in `validationSchema`, declared once at module level                                                 | `*/schema.ts`                              | [Validation guide → validationSchema](https://formik.org/docs/guides/validation#validationschema), [`validationSchema`](https://formik.org/docs/api/formik#validationschema-schema----schema)                                  |
| Default `validateOnChange` / `validateOnBlur` (whole schema validated on each change/blur)                               | (defaults)                                 | [When does validation run?](https://formik.org/docs/guides/validation#when-does-validation-run), [`validateOnChange`](https://formik.org/docs/api/formik#validateonchange-boolean)                                             |
| Reusable input components built on `useField` (`{...field}` spread on the shared control)                                | `kit/fields.tsx`, `kit/binding.tsx`        | [`useField`](https://formik.org/docs/api/useField), [Tutorial: "you can and should build reusable input primitive components"](https://formik.org/docs/tutorial#leveraging-react-context)                                      |
| Checkbox through `type: 'checkbox'` → `field.checked`, boolean value                                                     | `checkboxView`                             | [`useField` → FieldHookConfig `type`](https://formik.org/docs/api/useField#fieldhookconfigvalue), [Tutorial `MyCheckbox`](https://formik.org/docs/tutorial#leveraging-react-context)                                           |
| Value-based binding with `setFieldValue` / `setFieldTouched` (captcha widget, number input)                              | `captchaView`, `numberView`                | [`useField` → FieldHelperProps](https://formik.org/docs/api/useField#fieldhelperprops)                                                                                                                                         |
| Reading form state (`submitCount`, `status`, `values`) in a child with `useFormikContext`                                | kit, `CreditForm.tsx`, `credit/fields.tsx` | [`useFormikContext`](https://formik.org/docs/api/useFormikContext)                                                                                                                                                             |
| Async `onSubmit` (Formik waits for validation, async tests included, and manages `isSubmitting`)                         | `submitRegistration`, `submitApplication`  | [`onSubmit`](https://formik.org/docs/api/formik#onsubmit-values-values-formikbag-formikbag--void--promiseany)                                                                                                                  |
| Server response kept in `status` via `setStatus`                                                                         | `RegistrationResult`, `CreditResult`       | [`status`](https://formik.org/docs/api/formik#status-any), [`setStatus`](https://formik.org/docs/api/formik#setstatus-status-any--void)                                                                                        |
| Prefill (invite, `?application=1`) delivered as new `initialValues` with `enableReinitialize`                            | both forms                                 | [`enableReinitialize`](https://formik.org/docs/api/formik#enablereinitialize-boolean), [`initialValues`](https://formik.org/docs/api/formik#initialvalues-values)                                                              |
| Yup `string().required/min/max/length/matches/email`, `number().required/min/max`                                        | `*/schema.ts`                              | [string](https://github.com/jquense/yup#string), [number](https://github.com/jquense/yup#number)                                                                                                                               |
| Consents and terms: `boolean().oneOf([true], …)`                                                                         | `*/schema.ts`                              | [Tutorial (`acceptedTerms`)](https://formik.org/docs/tutorial#leveraging-react-context), [Schema.oneOf](https://github.com/jquense/yup#schemaoneofarrayofvalues-arrayany-message-string--function-schema-alias-equals)         |
| Custom sync rules `.test(name, message, fn)`; cross rules read siblings through `this.parent`                            | `*/schema.ts`                              | [Schema.test](https://github.com/jquense/yup#schematestname-string-message-string--function--any-test-function-schema)                                                                                                         |
| Async rule `.test(…, async fn)` gated by `isValidSync` on the field's sync-only schema                                   | `kit/serverCheck.ts`                       | [Schema.test](https://github.com/jquense/yup#schematestname-string-message-string--function--any-test-function-schema), [Schema.isValidSync](https://github.com/jquense/yup#schemaisvalidsyncvalue-any-options-object-boolean) |

### Registration only

| Pattern                                                                                                      | Where                                                          | Docs                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Errors revealed by `submitCount > 0` (contract's afterFirstSubmit; `handleReset` sets it back to 0)          | `useBenchField` (no `SubmitAttempts` provider → `submitCount`) | [`submitCount`](https://formik.org/docs/api/formik#submitcount-number)                                                 |
| `<Form>`: native submit/reset events go to `handleSubmit` / `handleReset`; reset via a `type="reset"` button | `RegistrationForm.tsx`                                         | [`<Form />`](https://formik.org/docs/api/form), [`handleReset`](https://formik.org/docs/api/formik#handlereset---void) |
| Password confirmation: `oneOf([ref('password')])`                                                            | `registration/schema.ts`                                       | [ref](https://github.com/jquense/yup#refpath-string-options--contextprefix-string--ref)                                |

### Credit only

| Pattern                                                                                                                                                                                                                                       | Where                                                         | Docs                                                                                                                                                                                |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Wizard: one `<Formik>` for all steps, `validationSchema` = the current step's schema, «Далее» is the step's submit (`type="submit"`), `onSubmit` moves forward, «Назад» moves back without validation; only the current step is rendered      | `Wizard` in `CreditForm.tsx`, `CREDIT_STEP_SCHEMAS`           | [MultistepWizard example](https://github.com/jaredpalmer/formik/blob/main/examples/MultistepWizard.js)                                                                              |
| `<FastField>` for fields that render only their own slice (value, error), cross-rule fields included                                                                                                                                          | `FastCreditField` → `FastBenchField`; `ComputedField`         | [`<FastField />`](https://formik.org/docs/api/fastfield) ("When to use"; re-renders on "changes to `values.firstName`, `errors.firstName`, `touched.firstName`, or `isSubmitting`") |
| `useField` for fields whose rendering reads other state (options from another field or from the API, read-only copy)                                                                                                                          | `CreditField`                                                 | [`useField`](https://formik.org/docs/api/useField), [`<FastField />`](https://formik.org/docs/api/fastfield) (when not to use it)                                                   |
| Conditional rules: `when(sibling, { is, then })`; a hidden field has no rules                                                                                                                                                                 | `credit/schema.ts`                                            | [Schema.when](https://github.com/jquense/yup#schemawhenkeys-string--string-builder-object--values-any-schema--schema-schema)                                                        |
| Arrays: `<FieldArray>` render prop with `push` / `remove`, row fields named `properties.${i}.type`; `array().of(object(...))`                                                                                                                 | `ArrayBlock` in `steps.tsx`, `credit/schema.ts`               | [`<FieldArray />`](https://formik.org/docs/api/fieldarray), [array.of](https://github.com/jquense/yup#arrayoftype-schema-this)                                                      |
| Values that follow other fields kept in Formik values by an effect with `useFormikContext` + `setFieldValue`: computed C.1–C.8 (`shouldValidate: false`), `emailAdditional` = `email`, residence = registration address while the flag is set | `CreditCalculations`, `EmailAdditionalField`, `ResidenceCopy` | [Dependent fields example](https://github.com/jaredpalmer/formik/tree/main/examples/dependent-fields), [`<Formik>` → `setFieldValue`](https://formik.org/docs/api/formik)           |
| Options loaded by another field's value in an effect with an "is current" flag (car models by brand, cities by region)                                                                                                                        | `useLoadedOptions` in `credit/fields.tsx`                     | [Dependent fields with async request example](https://github.com/jaredpalmer/formik/tree/main/examples/dependent-fields-async-api-request)                                          |
| A user change that also moves other fields is one `setValues(updater)`: hidden section reset, model/city reset, copy toggles, array flags                                                                                                     | `credit/changes.ts`                                           | [`<Formik>` → `setValues` (takes `React.SetStateAction`)](https://formik.org/docs/api/formik)                                                                                       |
| `isSubmitting` is set "as soon as submission is attempted": FastField re-renders on it                                                                                                                                                        | (Formik)                                                      | [`isSubmitting`](https://formik.org/docs/api/formik#issubmitting-boolean)                                                                                                           |

## FastField or useField: which credit fields use which

`FastCreditField` (`<FastField>`) is used where the docs' condition holds: the field "does not change
behavior or render anything that is based on updates to another `<Field />`'s slice of Formik state". It
renders only its own value and error. That includes the five cross-rule fields (`loanAmount` — mortgage
limit, `workExperienceCurrent` ≤ `workExperienceTotal`, `monthlyIncome` — payment ≤ 50 % of income,
`additionalIncomeSource` — required while `additionalIncome > 0`, `existingLoans[i].remainingAmount` ≤ the
row's `amount`). The schema reads the other fields, but the result lands in `errors.<name>`, the field's own
slice, and the docs list a change of `errors.<name>` as a FastField re-render trigger. The conformance tests
that change the other side of each rule after a failed «Далее» check that the message follows.
A FastField may still drive other fields. `loanType`, `employmentStatus`,
`carBrand`, the copy flags and the array flags write the dependent fields from their change handler through
`setValues`. FastField's `form` bag keeps working imperative methods, and the updater gets Formik's current
values.

`CreditField` (`useField`) is used for the 7 fields whose rendering reads other state. FastField would leave
them stale, because it re-renders only for its own slice and ignores new props as well:

| Field                                                   | What its rendering reads                               |
| ------------------------------------------------------- | ------------------------------------------------------ |
| `carModel`                                              | options loaded by `carBrand`                           |
| `registrationAddress.region`, `residenceAddress.region` | options from the API (`getRegions`) arrive after mount |
| `registrationAddress.city`, `residenceAddress.city`     | options loaded by the region                           |
| `emailAdditional`                                       | copy of `email` and read only while `sameEmail`        |
| `properties[i].type`                                    | options from the API (`getDictionaries`)               |

Computed values are FastFields too (`ComputedField`): they render only their own value. A probe with the
shared render counter showed the effect. While typing in a FastField on step 2, only that field's control
re-renders per keystroke.
The other FastFields re-render once, when the first validation fills their `errors` slice. Fields bound with
`useField` re-render about twice per keystroke (value, then validation result).

## Deviations and notes

1. **Error reveal by `submitCount`, not `touched`.** The docs' examples show `touched && error`. The
   contract requires afterFirstSubmit and names `submitCount > 0` as the Formik equivalent. Formik still
   validates from the first keystroke, server checks included. Errors are only hidden until the first
   submit. This implementation therefore calls the check APIs before the first submit, where a library that
   validates only after submit makes no calls.
2. **Per-step reveal: `StepAttempts` + `SubmitAttempts` context (credit).** The MultistepWizard example
   reveals errors by `touched` and calls `setTouched({})` after each step. The contract instead wants errors
   after the first «Далее» on _this_ step, so `StepAttempts` subtracts the `submitCount` at the step's entry.
   It uses React's documented "adjust state while rendering when a prop changes" pattern. No `resetForm` is
   needed in either direction.
   The count reaches the fields through a React context, not through FastField's `form.submitCount`. The
   FastField docs say `submitCount` does not update a FastField, and a context update reaches the consumer
   regardless of `shouldComponentUpdate`. The context value changes only on «Далее» and on step change.
3. **Field that appears after a failed «Далее» (credit, contract §8).** It stays quiet until it is changed or
   «Далее» is pressed again. The kit keeps this in local state: the attempt count at mount, plus an
   "edited" flag set by its change handler. Formik's [instant feedback
   example](https://github.com/jaredpalmer/formik/tree/main/examples/instant-feedback) keeps local state
   (`didFocus`) for the same purpose. Since inactive steps and hidden sections are unmounted, re-entering a
   step also makes it quiet.
4. **User-driven multi-field changes go through `setValues(updater)`, not effects.** Formik validates with
   the values of the last render (`setFieldValue` validates `setIn(state.values, …)`). Two
   `setFieldValue` calls in one handler would therefore validate a snapshot without the other change. One
   `setValues(v => next)` applies to Formik's current state and validates `next` once. Effects would also
   fire when `?application=1` loads, and per CREDIT_RESETS loading is not a change.
   Rules of the form "while X holds" use the docs' effect pattern: copies while a flag is set, and computed
   values.
5. **Computed values cost one more Formik update.** The dependent-fields pattern stores C.1–C.8 from an
   effect, so a change that affects them causes a second Formik update after the first render. The effect
   uses `setFieldValue(name, value, false)`. The payload does not use the stored values: `toCreditPayload`
   recomputes them.
6. **C.7 rule in Yup.** `monthlyIncome.paymentRatio` needs the whole application (loan, region, property
   rows, incomes). Formik hands Yup a copy of the values in which `''` became `undefined`. The test therefore
   passes `this.parent` through the shared normalizer `toCreditPayload`, which accepts loose values, and then
   `paymentRatioTooHigh`. Re-wiring C.1/C.2/C.6/C.7 here would duplicate the shared formula.
7. **Number inputs bind through `setFieldValue`, not `handleChange`.** `handleChange` turns an empty number
   input into `''`. The contract wants `null`, so the view uses the shared `parseNumberInput` /
   `formatNumberInput`.
8. **Wizard markup outside a render prop.** The example renders its navigation inside `<Formik>{formik =>
…}`, so the navigation re-renders on every Formik update. Here `WizardShell` and the step element are
   static children (tutorial style). The "Назад" handler needs only the wizard's own state, because values
   stay in Formik. As in the example, `handleSubmit` is `async`, so Formik dispatches `SUBMIT_SUCCESS` after
   the transition.
9. **Registration DOM: `<ResetButton type="reset" />` and `action="#"`.** The baseline uses the default
   `type="button"`. The shared `ResetButton` accepts the prop, and `type="reset"` lets `<Form>`'s built-in
   `onReset` call `handleReset`. Without it, a separate context-consuming wrapper would be needed, and it would
   re-render the button on every keystroke. `<Form>` adds `action="#"` (Formik's own default, for iOS), in
   the credit form too. Element structure and all other attributes match the baselines.
10. **One message per field relies on the order of synchronous errors.** Yup's README warns that "test
    execution order cannot be guaranteed", but only because async tests resolve later. In Yup 1.7.1:
    - `Schema.runTests` collects synchronous test errors in declaration order.
    - The object schema sorts errors by key with a stable sort.
    - Formik's `yupToFormErrors` keeps the first error per path.
    - An empty string reaches Yup as `undefined` (Formik's `prepareDataForValidation`), so `required` fails
      among Yup's initial tests and the other rules do not run.

    Each async test is declared last and gated (`withServerCheck`). As a result, the shown message is always
    the first violated rule in the spec's order.

11. **Known Formik limitation: stale validation results can win.** Every change runs a whole-schema
    `validateForm`, and Formik applies each result when it resolves, with no check for stale results
    (`validateFormWithHighPriority` in 2.4.9). The shared client resolves a superseded check immediately, so
    results normally arrive in order. They can arrive out of order in one case: an earlier validation is
    waiting on a server check, and the next edit makes the field fail its sync rules, so no new check
    supersedes it.
    Verified in the browser on registration: after the first submit, type `joh`, then Backspace to `jo`.
    «Минимум 3 символа» appears, and about 320 ms later the `joh` validation resolves and replaces it with "no
    error". The same applies to the SMS code. The conformance scenarios do not hit this. Working around it
    would need machinery outside Formik's public validation API, so it is left as is.
12. **`<FieldArray>` validates again after every change of its array.** With the documented default
    `validateOnChange`, its `componentDidUpdate` runs `validateForm` whenever the array value changes. That
    includes typing in a row field, which `setFieldValue` has already validated, so each keystroke in a row
    runs the step schema twice. The render prop also re-renders the array frame and rows on every Formik
    update. Both are left at the documented defaults.
13. **«Отправить» re-checks the earlier steps (contract §8), beyond the MultistepWizard example.** In the
    example the last step's submit sees only the last step's `validationSchema`. A cross-step rule can
    go stale, though: `monthlyIncome.paymentRatio` (step 4) reads the property discount of step 5. So
    once Formik has validated step 6 and called `onSubmit`, the wizard checks steps 1–5 against their own
    schemas with `validateYupSchema` (Formik's exported Yup adapter, the one `validationSchema` uses:
    `''` → `undefined`, `abortEarly: false`). If they all pass, it POSTs. Otherwise it moves to the first
    invalid step and, once that step is on screen with its schema, calls `submitForm()`
    ([`submitForm`](https://formik.org/docs/api/formik#submitform---promise)). That is the step's own
    «Далее»: Formik validates the step and counts an attempt, so the kit's reveal rule shows the errors,
    and fields that appear later stay quiet as usual. A ref carries the request across the step change.
    The effect that consumes it runs after the commit, when `validationSchema` already is the step's.
    The valid path costs five extra schema validations per «Отправить», about one whole-form validation.
