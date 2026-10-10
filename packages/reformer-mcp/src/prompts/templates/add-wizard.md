You convert a single-page form into a multi-step wizard. Two questions to answer in order:

1. **Which wizard implementation?** — pick by hierarchy (Section A).
2. **How does it meet the form?** — pick by who draws the markup (Section B).

## Args

- steps: {{steps}}

## Current form code

```typescript
{{code}}
```

---

## What does not depend on the choice

- **The assembly declares the steps**: `createForm({ …, flow: { steps: [{ id: 'loan', rules: loanRules }, { id: 'contacts', rules: contactsRules }, { id: 'confirm' }] }, validation: { extras: crossStepRules } })`. The `id` of a step is the `selector` of the step node in the schema, so reordering nodes does not desynchronise rules (a step without a node is a dev warning). Steps declared in JSX have only a `number`: step N is `flow.steps[N - 1]`, so keep `flow.steps` in step order. A step with no rules stays in the list without `rules` (`{ id: 'confirm' }`).
- **Navigation is a flow, not React state**: `bundle.flow` (`FormFlow` from `@reformer/core`) keeps `current`, `index`, `completed` as signals; `flow.next()` checks the current step's rules and returns `{ status: 'moved', from, to }` or `{ status: 'stayed', step, reason }`; `flow.goTo(id)` and `flow.previous()` move without a check (forward only to an unlocked step). The behavior gets it in its scope: `defineFormBehavior(({ model, flow }) => …)`. Nobody hand-rolls `makeValidationConfig(model)`, a `config` prop or a wizard ref — all of it is the former contract.
- **Submit is a form-level call**: `bundle.submit(handler)` runs the rules of every step plus `extras` once, calls `handler(model.get())` only when nothing blocks, and returns `SubmitResult` — `{ status: 'submitted', result }`, `{ status: 'invalid' | 'error' | 'cancelled', validation }` or `{ status: 'failed', error }`. `bundle.validate()` and `bundle.validateStep(id)` check without submitting.
- **Per-step schemas** are ordinary `defineValidation<Root>(({ model }) => { validate(model.$.x, [rules]); … })` functions (async via `validateAsync`, conditional via `validateWhen`, cross-field via `cross`, sub-forms via `apply`, arrays via `applyEach`). «Next» validates only the current step; submit runs every step plus `extras`. No duplicates between a step and `extras`.
- **Don't rename fields** when grouping by step — only visual grouping.

---

## Section A — Wizard implementation hierarchy (pick the highest applicable)

### A1 (DEFAULT) — `FormWizard` from `@reformer/ui-kit`

If the detected stack includes `@reformer/ui-kit`, **this is the default**. Opinionated, batteries-included wrapper around the CDK compound: step indicator + nav buttons + progress + accessibility + Russian-locale defaults wired by default. It is the ONLY implementation that works as a schema node out of the box (Section B2).

If `@reformer/ui-kit` is NOT in package.json, skip to A2.

### A2 — Project-custom wizard wrapper, if one exists in the consumer project

Some projects already have `src/components/AppWizard.tsx` or similar — a thin wrapper over CDK or a fully custom implementation matching the project's UX guidelines. If you find such a file (`src/components/`, `src/widgets/`, etc.), prefer it over building anew — consistency with existing app screens.

### A3 — `@reformer/cdk` `FormWizard` compound

Headless compound (`FormWizard.Root + Indicator + Step + Actions + Progress`) — full styling/UX control, you assemble the visual layer. Use when ui-kit doesn't fit, there is no project wrapper, and you want compound primitives (Indicator API, Actions slot, programmatic navigation through `bundle.flow`).

See `reformer://docs/cdk/formwizard-indicator`, `formwizard-actions`, `formwizard-progress`.

### A4 (last resort) — Manual `useState` wizard

Plain `const [currentStep, setCurrentStep] = useState(1)` with own step indicator and nav buttons. Only when A1–A3 are unavailable or the flow has constraints the compound cannot express (dynamic step skipping, custom routing integration).

### Decision flowchart

```
ui-kit (@reformer/ui-kit) in package.json?
  └─ Yes → A1 (FormWizard from @reformer/ui-kit) [DEFAULT]
  └─ No  → continue

Project-custom wizard wrapper in src/components/?
  └─ Yes → A2 (use it)
  └─ No  → A3 (CDK FormWizard compound headless)

Need flow constraints CDK/ui-kit can't express?
  └─ Yes → A4 (manual useState — last resort)
```

---

## Section B — How the wizard meets the form

### B1 — markup by hand in JSX (`target=core`)

`FormWizard` gets everything by props: the form and the flow of steps come from the bundle, step bodies are React components.

{{{{raw}}}}

```tsx
import { createForm } from '@reformer/core';
import { useFormBundle } from '@reformer/core/react';
import { FormWizard, type FormWizardStep } from '@reformer/ui-kit';

const steps: FormWizardStep<MyForm>[] = [
  // React FC: receives { control: FormProxy<T> } as a prop
  { number: 1, title: 'Кредит', icon: '💰', body: LoanStep },
  // static JSX: rendered as is
  { number: 2, title: 'Подтверждение', icon: '✓', body: <ConfirmationStep /> },
];

export function MyWizardPage() {
  const bundle = useFormBundle(() =>
    createForm<MyForm>({
      model: createMyModel(),
      schema: formSchema,
      behavior: formBehavior,
      validation: formValidation, // { extras: crossStepRules }
      flow: formFlow, // { steps: [{ id: 'loan', rules: loanRules }, { id: 'confirm' }] } — in step order
    })
  );

  const handleSubmit = async () => {
    const outcome = await bundle.submit(sendMyForm);
    if (outcome.status === 'invalid') showHint('Проверьте заполнение формы');
  };

  return (
    <FormWizard form={bundle.form} flow={bundle.flow} steps={steps} onSubmit={handleSubmit} />
  );
}
```

{{{{/raw}}}}

- A3: the compound's `<Step>` slot renders the active step's body; A4: a JSX conditional on `flow.index` (read through `useFormFlow(bundle.flow)` from `@reformer/core/react`). «Next» is `bundle.flow.next()`, submit is `bundle.submit(handler)`.
- Rules for schema nodes (`hideWhen`, `onComponentEvent`, `onMount`) are executed by the renderer and do nothing here: visibility, submit and data loading stay in JSX.

### B2 — `FormRenderer` draws the form (`target=renderer-react` and `target=renderer-json`)

The wizard is a **schema node**; the steps are its ordinary children. The library `FormWizard` builds steps from the child nodes (`selector`, `componentProps.title`, `componentProps.icon`) and takes the form and the flow of steps from the assembly itself.

```typescript
// form.schema.ts
import { Step } from '@reformer/cdk/form-wizard';
import { FormWizard, Input, SelectAsync } from '@reformer/ui-kit';

export const formSchema = (model: FormModel<MyForm>): FormSchemaNode => ({
  selector: 'wizard',
  component: FormWizard,
  children: [
    {
      selector: 'loan', // the id of the step in flow.steps
      component: Step,
      componentProps: { title: 'Кредит', icon: '💰' },
      children: [
        { model: model.$.loanType, component: SelectAsync, componentProps: { label: 'Тип' } },
      ],
    },
    {
      selector: 'contacts',
      component: Step,
      componentProps: { title: 'Контакты', icon: '📞' },
      children: [{ model: model.$.email, component: Input, componentProps: { label: 'Email' } }],
    },
  ],
});
```

```typescript
// form.behavior.ts — submit and other wizard events are rules for the node
import { defineFormBehavior, onComponentEvent } from '@reformer/core/behaviors';

export const formBehavior = defineFormBehavior<MyForm>(({ model, schema }) => {
  onComponentEvent(schema.node('wizard'), 'onSubmit', async () => {
    await submitMyForm(model.get());
  });
});
```

`renderer-json` — the same tree as data; register the library components in `registry.ts` (`reg.component('FormWizard', FormWizard)`, `reg.component('Step', Step)`):

```jsonc
{
  "format": 2,
  "root": {
    "selector": "wizard",
    "component": "$component(FormWizard)",
    "children": [
      {
        "selector": "loan",
        "component": "$component(Step)",
        "componentProps": { "title": "Кредит", "icon": "💰" },
        "children": [{ "model": "$model(loanType)", "component": "$component(SelectAsync)" }],
      },
    ],
  },
}
```

What is NOT needed any more — all of it is the former contract, ❌ do not emit:

- ❌ an app shim (`RendererFormWizard`, `wizard.tsx`, `$component(Wizard)`) — the wizard is the library component;
- ❌ steps in `componentProps.steps` — steps are `children`;
- ❌ the `(model, form?)` schema builder called twice, and `...(form ? { form } : {})` in `componentProps`;
- ❌ injecting `form` and the validation config via `onInit(schema.node('wizard'), () => schema.node('wizard').patchProps({ form, config }))`, and navigation through the wizard ref (`getRef<FormWizardHandle>()`) — the behavior uses `flow.goTo(id)`;
- ❌ `renderStepBody`, and a `useEffect` cascade of `schema.node('stepN').setHidden(n !== currentStep)`.

**A2 / A3 / A4 with a renderer.** A component that manages its children itself declares the static `__selfManagedChildren = true`; the renderer then hands it the child NODES — compiled schema nodes (`CompiledNode`: `selector`, `props` (the author's `componentProps`), `children`) — plus a `renderNode` function instead of rendered elements, and the component reads the form and the flow of steps from `useFormBundleContext()` (`@reformer/core/react`). A custom wizard has to implement this protocol to stand in a schema — see `reformer://docs/renderer-react` («Компонент, который сам управляет детьми»). If that is not worth it, keep the wizard in JSX (B1) and draw each step with its own `FormRenderer`.

**Conditional sub-sections inside steps** (mortgage, residence, …) get their own `selector` and a rule in the behavior: `hideWhen(schema.node('mortgage'), () => model.loanType !== 'mortgage')`. The condition reads the MODEL (`model.loanType`), not `form.loanType.value.value`.

**A conditional STEP** (a step that exists only under a condition) is NOT a node rule: the library wizard builds its steps from all child nodes, so `hideWhen` on a step node hides the step's content but leaves the step in the indicator and in navigation. A form with a dynamic step count keeps the wizard in JSX (B1) and renders the step conditionally — see `reformer://docs/cdk/conditional-dynamic-step-count-in-formwizard`.

**Scopes are isolated.** `schema.node(selector)` in the root behavior sees the root tree only — not the nodes inside an array `item` or a sub-form `part`. Reach those from the sub-behavior passed to `applyEach(model.$.items, itemBehavior)` / `apply(model.$.group, groupBehavior)`: it receives its own `schema`.

---

## Visual baseline (do NOT skip — A1/A2 give it for free; A3/A4 must wire it manually)

- **Step indicator strip** with icons + en-dashes between chips. Chips MUST be `<button>` with `onClick` (clickable to completed steps), not `<div>`.
- **Step section card**: `<Card><CardHeader><CardTitle>…</CardTitle></CardHeader><CardContent className="space-y-4">…</CardContent></Card>` — карточка компонентом, НЕ строкой `bg-white border rounded-xl shadow-sm p-6`.
- **Page container**: `max-w-2xl mx-auto p-6 space-y-6`.
- **Классы — только раскладка и отступы** (`space-y-*`, `grid`, `gap-*`, `flex`, `max-w-*`). Цвет, фон, рамку, тень и радиус даёт компонент кита. Правила: `find_recipe({ topic: "form-layout", package: "ui-kit" })`.
- **Footer with progress text** under nav buttons (`Шаг N из M • X% завершено`).
- **Nav buttons**: `← Назад` / `Далее →` with arrows.
- **testId convention**: `step-indicator`, `step-chip-{N}` (with `data-current`/`data-completed`), `step-progress`, `wizard-prev`/`wizard-next`/`wizard-submit`.
- Icons via `lucide-react`: `Coins, User, Phone, Briefcase, FileText, CheckSquare`.

## Prerequisites — read these resources via ReadMcpResourceTool

**Mandatory based on chosen A and B:**

- always: `find_recipe unified-contract`, `find_recipe wizard`.
- **A1 / A2**: the wrapper's docs (ui-kit `reformer://docs/ui-kit/...` if A1, project README if A2).
- **A3**: `reformer://docs/cdk/formwizard-indicator`, `reformer://docs/cdk/formwizard-actions`, `reformer://docs/cdk/formwizard-progress`, `reformer://docs/cdk/conditional-dynamic-step-count-in-formwizard`, `reformer://docs/cdk/multi-step-submit`.
- **A4**: `reformer://docs/core/multi-step-form-validation` for `validateModel(model, schema)` semantics.
- **B2**: `reformer://docs/renderer-react` (the bundle and node rules); for `renderer-json` also `reformer://docs/renderer-json/quick-start`.

## Task

1. **Pick A** by walking the hierarchy A1 → A2 → A3 → A4 (the highest applicable wins).
2. **Pick B** by who draws the markup.
3. State both choices in your output ("A=A1 (ui-kit FormWizard), B=B2 (schema node)").
4. Split existing fields into steps per requirements; give every step a `selector`.
5. Build per-step `defineValidation` functions and declare them as data: `export const formFlow: FormFlowConfig<MyForm> = { steps: [{ id: 'loan', rules: loanRules }, { id: 'contacts', rules: contactsRules }] }` → the `flow` field of `createForm`; rules outside steps — `export const formValidation: FormValidation<MyForm> = { extras: crossStepRules }` → the `validation` field.
6. Implement following A's API + B's integration.
7. Add the full visual baseline (or rely on A1/A2 if they ship it).

## Output checklist

- [ ] Stated chosen (A, B) pair AND why each was picked
- [ ] Read the Prerequisites for both A and B
- [ ] Per-step `defineValidation` functions cover all step fields; declared as `flow: { steps: [{ id, rules }] }`, ids = step selectors
- [ ] Cross-step rules live in `extras`; no duplicate validation between a step and `extras`
- [ ] Navigation goes through `bundle.flow` (`next()` checks the step, the transition is an object with `status`); submit through `bundle.submit(handler)`; warnings stay non-blocking (no hand-rolled `.issues` gate)
- [ ] (B2) the wizard is a schema node `{ selector: 'wizard', component: FormWizard, children: [steps] }`; no shim, no `componentProps.steps`, no `patchProps({ form, config })`
- [ ] (B2) submit is `onComponentEvent(schema.node('wizard'), 'onSubmit', …)` in `form.behavior.ts`
- [ ] Visual baseline present (step indicator strip with icons + en-dashes, `Card`-wrapped step, progress text, nav arrows) — either from A1/A2 or wired manually for A3/A4
- [ ] No hand-written appearance classes (`bg-*`, `text-<color>-<shade>`, `border-<color>`, `shadow-*`, `rounded-*`) — layout and spacing only
- [ ] testIds present per convention
