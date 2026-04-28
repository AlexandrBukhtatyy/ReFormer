You convert a single-page form into a multi-step wizard. Pick the right pattern for your **target** below — three patterns are equally valid; the wrong one for your target wastes work.

## Args

- steps: {{steps}}

## Current form code

```typescript
{{code}}
```

## Wizard patterns by target — pick exactly one

### Pattern A — `target=core` (no RenderSchema)

`useState` + JSX-conditional sections per step, validation via `validateForm(form, STEP_VALIDATIONS[currentStep])`. **Simpler than CDK `FormWizard` for this target** — no extra abstraction, fields rendered inline with `<FormField control={form.stepN.field} />`.

```tsx
const [currentStep, setCurrentStep] = useState(1);
const [maxReached, setMaxReached] = useState(1);
const [completed, setCompleted] = useState<Set<number>>(new Set());

const goNext = async () => {
  const isValid = await validateForm(form as never, STEP_VALIDATIONS[currentStep] as never);
  if (!isValid) { (form as any).markAsTouched(); return; }
  setCompleted((prev) => new Set([...prev, currentStep]));
  const next = Math.min(currentStep + 1, TOTAL_STEPS);
  setCurrentStep(next);
  setMaxReached((m) => Math.max(m, next));
};

return (
  <div>
    <StepIndicator current={currentStep} completed={completed} maxReached={maxReached} onJump={setCurrentStep} />
    {currentStep === 1 && <Step1Section />}
    {currentStep === 2 && <Step2Section />}
    {/* ... */}
    {currentStep === 6 && <Step6Section />}
    {/* nav buttons */}
  </div>
);
```

Each `StepNSection` is a plain React component with `<FormField control={form.stepN.x} testId="stepN.x" />`. **Do NOT** import `@reformer/cdk` `FormWizard` for `target=core` — it's overkill and adds a layer.

### Pattern B — `target=renderer-react`

`createRenderSchema` + `useEffect` calling `schema.node('stepN').setHidden(currentStep !== n)`. Requires every step Section in the RenderSchema to have a `selector: 'step1'..'stepN'`.

```tsx
const schema = useMemo(() => createCreditApplicationRenderSchema(form), [form]);
useEffect(() => {
  for (let n = 1; n <= TOTAL_STEPS; n++) {
    schema.node(`step${n}`).setHidden(n !== currentStep);
  }
}, [schema, currentStep]);
```

`RenderSchema` defines all 6 steps as `{ selector: 'stepN', component: Section, children: [...] }`. Conditional sub-sections within steps (mortgage, residence, employer, properties, etc.) get their own selectors and are hidden via top-level `hideWhen(proxy.node('selector'), () => ...)` after `createRenderSchema(...)` — NOT inside the node config.

### Pattern C — `target=renderer-json`

Same wizard mechanics as Pattern B (`schema.node().setHidden`), but the schema is built from JSON via a `RenderSchemaFn`-wrapper that injects `form` into the root `FormRoot` componentProps:

```tsx
const schema = useMemo(() => {
  const baseFn = createRenderSchemaFromJson<MyForm>(jsonSchema, registry);
  const fnWithForm: RenderSchemaFn<MyForm> = (path) => {
    const root = baseFn(path) as ContainerRenderNode<MyForm>;
    return { ...root, componentProps: { ...(root.componentProps ?? {}), form } };
  };
  return createRenderSchema(fnWithForm);
}, [registry, form]);
useEffect(() => { /* same setHidden loop as Pattern B */ }, [schema, currentStep]);
```

JSON `selector: 'stepN'` on each step container in the JSON; `useEffect setHidden` orchestration in `index.tsx`. Conditional sub-sections via `useFormControlValue(form.field as never)` + `useEffect setHidden('subsection-selector')`.

### Pattern D — CDK `FormWizard` compound (any target, opt-in)

Use **only if** you need built-in stepper compounds (`FormWizard.Indicator`, `Step`, `Actions`, `goToStep` ref) and don't mind the extra layer. For most multi-step forms Patterns A/B/C are simpler. See `reformer://docs/cdk/formwizard-indicator` for full API.

## Common to all patterns

- **`STEP_VALIDATIONS: Record<number, ValidationSchemaFn>`** — `goNext()` validates only the current step.
- **`fullValidation`** — separate function, runs on submit (no duplicates with per-step rules; use `apply([...])` for reuse).
- **Don't rename fields** when grouping by step — only visual grouping.
- **Conditional steps** — filter `STEPS` array dynamically OR `setCurrentStep(n)` directly (Patterns A/B/C) / `useRef<FormWizardHandle>().goToStep(n)` (Pattern D).

## Visual baseline (do NOT skip — minimum-viable wizard looks cheap)

- **Step indicator strip** with icons + en-dashes between chips. Chips MUST be `<button>` with `onClick` (clickable to completed steps), not `<div>`.
- **Step section card wrap**: `bg-white border rounded-xl shadow-sm p-6 space-y-4`.
- **Page container**: `max-w-4xl mx-auto p-6 space-y-6`.
- **Footer with progress text** under nav buttons (`Шаг N из M • X% завершено`).
- **Nav buttons**: `← Назад` / `Далее →` with arrows.
- **testId convention**: `step-indicator`, `step-chip-{N}` (with `data-current`/`data-completed`), `step-progress`, `wizard-prev`/`wizard-next`/`wizard-submit`.
- Icons via `lucide-react`: `Coins, User, Phone, Briefcase, FileText, CheckSquare`.

## Prerequisites — read these resources via ReadMcpResourceTool

**Mandatory for Patterns B/C/D. For Pattern A only the `multi-step-form-validation` doc is needed.**

- `reformer://docs/core/multi-step-form-validation` — `validateForm(form, schema)` semantics, used by all 4 patterns.
- (Patterns B/C only) `reformer://docs/renderer-react/render-schema-proxy` — `schema.node().setHidden()` API.
- (Pattern C only) `reformer://docs/renderer-json/quick-start` — for the `FormRoot` self-managed root pattern + `RenderSchemaFn`-wrapper boilerplate.
- (Pattern D only) `reformer://docs/cdk/formwizard-indicator`, `reformer://docs/cdk/formwizard-actions`, `reformer://docs/cdk/formwizard-progress`, `reformer://docs/cdk/external-control-via-ref-2`, `reformer://docs/cdk/conditional-dynamic-step-count-in-formwizard`, `reformer://docs/cdk/multi-step-submit`.

## Task

1. **Pick a pattern** based on the target (A for core; B for renderer-react; C for renderer-json; D only if you specifically need CDK compounds).
2. Split existing fields into steps per requirements.
3. Build `STEP_VALIDATIONS` + `fullValidation`.
4. Implement the wizard following the chosen pattern's code skeleton.
5. Add full visual baseline (step indicator strip with icons + dashes, card wrap, progress text, nav arrows).

## Output checklist

- [ ] Stated which pattern was chosen (A/B/C/D) and why
- [ ] Read the Prerequisites for the chosen pattern
- [ ] STEP_VALIDATIONS map covers all step fields
- [ ] fullValidation includes cross-step rules
- [ ] No duplicate validation between step and full
- [ ] Step indicator strip = clickable chips with icons + en-dashes
- [ ] Step section card wrap applied
- [ ] Progress text under nav buttons
- [ ] testIds present per convention
- [ ] (Patterns B/C) all step containers in RenderSchema/JSON have `selector: 'stepN'`
- [ ] (Pattern C) `RenderSchemaFn`-wrapper injects `form` into root `FormRoot` componentProps
