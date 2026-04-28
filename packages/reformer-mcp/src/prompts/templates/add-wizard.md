You convert a single-page form into a multi-step wizard via `@reformer/cdk` `FormWizard`.

## Args

- steps: {{steps}}

## Current form code

```typescript
{{code}}
```

## Critical inline rules

- `STEPS` array: `{ name, title, icon?, component }`. `component` — separate React component holding fields of that step.
- `STEP_VALIDATIONS: { <stepName>: (path) => { /* validate(...) for this step */ } }` — `goToNextStep()` validates only this step.
- `fullValidation` — separate function that validates everything (incl. cross-step) — runs before submit.
- Don't rename fields when grouping by step — only visual grouping.
- Don't duplicate validation: if a field is in `STEP_VALIDATIONS[stepX]`, don't repeat it in `fullValidation` (use `apply([...])` for reuse).
- Conditional steps: filter `steps` array dynamically OR `useRef<FormWizardHandle>().goToStep(n)`.

## Visual baseline (do NOT skip — minimum-viable wizard looks cheap)

- **Step indicator strip** with icons + en-dashes between chips. Chips MUST be `<button>` with `onClick` (clickable to completed steps), not `<div>`.
- **Step section card wrap**: `bg-white border rounded-xl shadow-sm p-6 space-y-4`.
- **Page container**: `max-w-4xl mx-auto p-6 space-y-6`.
- **Footer with progress text** under nav buttons (`Шаг N из M • X% завершено`).
- **Nav buttons**: `← Назад` / `Далее →` with arrows.
- **testId convention**: `step-indicator`, `step-chip-{N}` (with `data-current`/`data-completed`), `step-progress`, `wizard-prev`/`wizard-next`/`wizard-submit`.
- Icons via `lucide-react`: `Coins, User, Phone, Briefcase, FileText, CheckSquare`.

## Prerequisites — read these resources via ReadMcpResourceTool

**You MUST read these BEFORE building the wizard. Skipping = wrong API or visual regression.**

- `reformer://docs/core/multi-step-form-validation`
- `reformer://docs/cdk/formwizard-indicator`
- `reformer://docs/cdk/formwizard-actions`
- `reformer://docs/cdk/formwizard-progress`
- `reformer://docs/cdk/external-control-via-ref-2`
- `reformer://docs/cdk/conditional-dynamic-step-count-in-formwizard`
- `reformer://docs/cdk/externally-controlled-wizard-via-useref-formwizardhandle`
- `reformer://docs/cdk/formwizardhandle-gotostep-false`
- `reformer://docs/cdk/multi-step-submit`

## Task

1. Split existing fields into steps per requirements.
2. Build `STEPS` + `STEP_VALIDATIONS` + `fullValidation`.
3. Wrap JSX in `<FormWizard form steps stepValidations fullValidation>` with `Indicator` + `Step` + `Actions`.
4. Add full visual baseline (step indicator strip with icons + dashes, card wrap, progress text, nav arrows).

## Output checklist

- [ ] Прочитал все ресурсы из Prerequisites: yes/no
- [ ] STEPS array shape correct
- [ ] STEP_VALIDATIONS map covers all step fields
- [ ] fullValidation includes cross-step rules
- [ ] No duplicate validation between step and full
- [ ] Step indicator strip = clickable chips with icons + en-dashes
- [ ] Step section card wrap applied
- [ ] Progress text under nav buttons
- [ ] testIds present per convention