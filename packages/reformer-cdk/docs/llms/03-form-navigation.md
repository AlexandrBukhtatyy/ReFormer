# FormWizard

Headless compound component for multi-step form wizards.

The wizard is an adapter over the core step flow `FormFlow` (`@reformer/core`). The flow owns the
current step, the completed steps, the step rules and the "may I go to this step" rule; the wizard
renders that state and calls the flow's transitions from its buttons.

## Where the flow comes from

| Source                | When                                                                                                                                            | Step rules                                         |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `flow` prop           | markup written by hand: `<FormWizard form={bundle.form} flow={bundle.flow}>`                                                                    | `createForm({ flow: { steps: [{ id, rules }] } })` |
| bundle in the context | inside `FormRenderer` (it puts the bundle into `FormBundleContext`) or your own `<FormBundleContext.Provider value={bundle}>` — no props needed | the same                                           |
| neither               | positional flow `'1'`, `'2'`, … built from the number of `FormWizard.Step` children                                                             | **none** — every step passes without a check       |

The prop wins over the context. `form` is optional inside the bundle context; with neither a `form`
prop nor a bundle in the context the wizard throws `[@reformer/cdk] FormWizard: no form…`.

## Basic Usage

```tsx
import { createForm } from '@reformer/core';
import { useFormBundle } from '@reformer/core/react';
import { defineValidation, validate } from '@reformer/core/validation';
import { required, min, email } from '@reformer/core/validators';
import { FormWizard } from '@reformer/cdk/form-wizard';

type Root = { loanAmount: number; email: string };

// Step rules — stable module-level references.
const loanRules = defineValidation<Root>(({ model }) => {
  validate(model.$.loanAmount, [required(), min(50000)]);
});
const contactsRules = defineValidation<Root>(({ model }) => {
  validate(model.$.email, [required(), email()]);
});

function CreditWizard() {
  const bundle = useFormBundle(() =>
    createForm<Root>({
      initial: { loanAmount: 0, email: '' },
      flow: {
        steps: [
          { id: 'loan', rules: loanRules },
          { id: 'contacts', rules: contactsRules },
          { id: 'confirm' }, // no rules — the step passes without a check
        ],
      },
    })
  );

  // Outside the bundle context the wizard calls onSubmit on click — the check is bundle.submit.
  const send = async () => {
    const outcome = await bundle.submit(api.send);
    if (outcome.status === 'invalid') toast('Check the form');
  };

  return (
    <FormWizard form={bundle.form} flow={bundle.flow}>
      <FormWizard.Step component={LoanStep} control={bundle.form} />
      <FormWizard.Step component={ContactsStep} control={bundle.form} />
      <FormWizard.Step component={ConfirmStep} control={bundle.form} />

      <FormWizard.Actions onSubmit={send}>
        {({ prev, next, submit, isFirstStep, isLastStep }) => (
          <div>
            {!isFirstStep && (
              <button onClick={prev.onClick} disabled={prev.disabled}>
                Back
              </button>
            )}
            {!isLastStep ? (
              <button onClick={next.onClick} disabled={next.disabled}>
                Next
              </button>
            ) : (
              <button onClick={submit.onClick} disabled={submit.disabled}>
                Submit
              </button>
            )}
          </div>
        )}
      </FormWizard.Actions>
    </FormWizard>
  );
}
```

Steps are matched **by position**: the N-th `FormWizard.Step` renders while the flow is on its N-th
step (`flow.steps[N - 1]`). Keep the `FormWizard.Step` children in the order of `flow.steps` and as
many of them; `totalSteps` is `flow.steps.length`. `FormWizard.Step` takes either
`component` + `control` (the component receives `control` and any extra props) or `children`.

> Note: `prev`/`next`/`submit` are `{ onClick, disabled }` objects (submit also has
> `isSubmitting`). They are not DOM-attribute bags — do not `{...prev}`-spread them
> onto `<button>` (`isSubmitting` would leak into the DOM). Read the
> members explicitly as shown, or use the compound `FormWizard.Prev/Next/Submit`.

Other props: `onStepChange(step)` — called after the wizard's own transitions with the 1-based step
number; `scrollToTop` (default `true`) — scroll to the top after them. A polite live region
announces "Step N of M" to screen readers; focus management stays with the consumer
(`onStepChange`).

## Validation and Submit

- **Next** (`next.onClick`, `FormWizard.Next`, `goToNextStep()`) calls `flow.next()`: it runs the
  current step's `rules` and marks the fields it checked as touched — only those: fields of the
  next steps stay untouched. On blocking issues (or when a rule failed / the run was cancelled) the
  wizard stays on the step. It also stays (`reason: 'cancelled'`) when the model changed while the
  step was being checked — a field edited during an async rule was not seen by the rules; the
  next click checks the new value. A step without `rules` (or with `rules: null`) passes without a check.
- **Submit** (`submit.onClick`, `FormWizard.Submit`, `submit(handler)` from `useFormWizard()`):
  - inside the bundle context it goes through `bundle.submit`: one run of the **full** rule set; on
    success the handler (`Actions` `onSubmit`) is called, on issues every field is marked touched
    and the handler is not called;
  - with `form`/`flow` props outside the context the wizard calls the handler on click **without**
    a check — run it in the handler: `bundle.submit(handler)`.
- The full rule set is `validation.rules` if given, otherwise every step's `rules` plus
  `validation.extras` (rules checked only as a whole, on submit):

```typescript
createForm<Root>({
  initial,
  validation: { extras: crossStepRules }, // or a bare rule set: validation: allRules
  flow: { steps: [{ id: 'loan', rules: loanRules }, { id: 'confirm' }] },
});
```

`bundle.submit(handler)` resolves to a `SubmitResult`:
`{ status: 'submitted', result }` | `{ status: 'invalid' | 'error' | 'cancelled', validation }` |
`{ status: 'failed', error }` (the handler threw). `bundle.validateStep('loan')` checks one step
(an unknown id throws), `bundle.validate()` — the full set.

When the steps are described in the schema, the step id is the `selector` of the step node; in dev
`createForm` warns about `flow.steps` ids that have no node with that `selector`. A wizard described
in the schema is the `FormWizard` of `@reformer/ui-kit` (it renders inside `FormRenderer` and takes
form and flow from the context).

## Sub-components

| Component              | Purpose                                                |
| ---------------------- | ------------------------------------------------------ |
| `FormWizard`           | Root provider                                          |
| `FormWizard.Step`      | Renders component/children when step is current        |
| `FormWizard.Indicator` | Headless step indicator (render props)                 |
| `FormWizard.Actions`   | Navigation container: render props OR compound buttons |
| `FormWizard.Prev`      | Compound "Back" button (inside `Actions`)              |
| `FormWizard.Next`      | Compound "Next" button (inside `Actions`)              |
| `FormWizard.Submit`    | Compound "Submit" button (inside `Actions`)            |
| `FormWizard.Progress`  | Headless progress display (render props)               |

`FormWizard.Prev` / `Next` / `Submit` are compound children of `FormWizard.Actions`
(they read the Actions context) — they cannot be used standalone. They are not
top-level exports; access them as members: `FormWizard.Prev`, etc.

### Actions: compound mode

```tsx
<FormWizard.Actions onSubmit={handleSubmit} className="flex justify-between">
  <FormWizard.Prev>Back</FormWizard.Prev>
  <FormWizard.Next>Next</FormWizard.Next>
  <FormWizard.Submit loadingText="Submitting…">Submit</FormWizard.Submit>
</FormWizard.Actions>
```

## FormWizard.Indicator

```tsx
<FormWizard.Indicator steps={STEPS}>
  {({ steps, goToStep, currentStep }) => (
    <nav>
      {steps.map((step) => (
        <button
          key={step.number}
          onClick={() => goToStep(step.number)}
          disabled={!step.canNavigate}
          aria-current={step.isCurrent ? 'step' : undefined}
        >
          {step.isCompleted ? '✓' : step.number} {step.title}
        </button>
      ))}
    </nav>
  )}
</FormWizard.Indicator>
```

`canNavigate` follows the flow rule (`flow.canGoTo`): the first step always, any other step once
the previous one is completed.

### Step Definition

```typescript
interface FormWizardIndicatorStep {
  number: number; // 1-based step number
  title: string;
  icon?: string;
}
```

### Render Props

```typescript
interface FormWizardIndicatorRenderProps {
  steps: FormWizardIndicatorStepWithState[];
  goToStep: (step: number) => boolean;
  currentStep: number;
  totalSteps: number;
  completedSteps: number[];
}

interface FormWizardIndicatorStepWithState {
  number: number;
  title: string;
  icon?: string;
  isCurrent: boolean;
  isCompleted: boolean;
  canNavigate: boolean;
}
```

## FormWizard.Actions

```tsx
<FormWizard.Actions onSubmit={handleSubmit}>
  {({ prev, next, submit, isFirstStep, isLastStep, isValidating }) => (
    <div>
      {!isFirstStep && (
        <button onClick={prev.onClick} disabled={prev.disabled}>
          Back
        </button>
      )}
      {!isLastStep ? (
        <button onClick={next.onClick} disabled={next.disabled}>
          {isValidating ? 'Validating...' : 'Next'}
        </button>
      ) : (
        <button onClick={submit.onClick} disabled={submit.disabled}>
          {submit.isSubmitting ? 'Submitting...' : 'Submit'}
        </button>
      )}
    </div>
  )}
</FormWizard.Actions>
```

`onSubmit` takes no arguments: inside the bundle context it is called after `bundle.submit` passed,
so read the values from the bundle (`bundle.model.get()`) or submit from your own button with
`useFormWizard().submit(handler)` — that one gets the values and returns the `SubmitResult`.

### Render Props

```typescript
interface FormWizardActionsRenderProps {
  prev: { onClick: () => void; disabled: boolean };
  next: { onClick: () => void; disabled: boolean };
  submit: { onClick: () => void; disabled: boolean; isSubmitting: boolean };
  isFirstStep: boolean;
  isLastStep: boolean;
  isValidating: boolean;
  isSubmitting: boolean;
}
```

## FormWizard.Progress

```tsx
<FormWizard.Progress>
  {({ current, total, percent }) => (
    <div>
      Step {current} of {total} ({percent}%)
      <div style={{ width: `${percent}%` }} />
    </div>
  )}
</FormWizard.Progress>
```

### Render Props

```typescript
interface FormWizardProgressRenderProps {
  current: number;
  total: number;
  percent: number;
  completedCount: number;
  isFirstStep: boolean;
  isLastStep: boolean;
}
```

## useFormWizard()

Context of the wizard for any component inside it (throws outside `<FormWizard>`):

```typescript
interface FormWizardContextValue<T> {
  form: FormGroup<T>;
  flow: FormFlow; // the flow being rendered: prop, bundle or positional
  currentStep: number; // 1-based: flow.index + 1
  totalSteps: number; // flow.steps.length
  completedSteps: number[]; // 1-based numbers of completed steps
  isFirstStep: boolean;
  isLastStep: boolean;
  isValidating: boolean; // a step check is running (flow.validating)
  isSubmitting: boolean; // bundle.submitting inside the bundle context, otherwise always false
  goToNextStep: () => Promise<boolean>; // false — the step did not pass its check
  goToPreviousStep: () => void;
  goToStep: (step: number) => boolean; // 1-based; false — unknown or locked step
  submit: <R>(handler: (values: T) => Promise<R> | R) => Promise<SubmitResult<R>>;
}
```

Outside the bundle context `isSubmitting` stays `false` — show the submit progress from
`bundle.submitting` yourself.

## External Control via the Flow

The wizard has no `ref`. It renders `bundle.flow`, so code outside the wizard tree drives that same
flow:

```tsx
const flow = bundle.flow!; // declared in createForm({ flow })

await flow.next(); // check the current step and move on → FlowTransition
flow.previous();
flow.goTo('contacts'); // only a reachable step: the first, or one whose previous step is completed
flow.canGoTo('confirm'); // boolean
flow.reset(); // back to the first step, completion forgotten

const outcome = await bundle.submit(api.send); // submit with the full check → SubmitResult
```

```typescript
type FlowTransition =
  | { status: 'moved'; from: string; to: string }
  | {
      status: 'stayed';
      step: string;
      reason: 'invalid' | 'error' | 'cancelled' | 'edge' | 'locked';
      validation?: ValidationResult; // when the step was checked
    };
```

- `goTo` of an id that is not in the flow throws; a step that is not reachable yet returns
  `{ status: 'stayed', reason: 'locked' }`.
- Going back (`previous()`, `goTo` an earlier step) forgets the completion of the target step and
  every later one — moving forward checks them again.
- Transitions made outside the wizard do not call `onStepChange` and do not scroll — the wizard does
  that only for its own buttons. Subscribe to the flow instead: `useFormFlow(flow)` from
  `@reformer/core/react` returns `{ current, index, completed, isFirst, isLast, validating }`.
- Behaviors get the same flow: `defineFormBehavior<Root>(({ flow }) => …)` — e.g. `flow?.goTo('loan')`
  from a reaction.

Inside the wizard tree `useFormWizard()` gives the same operations with 1-based numbers
(`goToStep(n)`, `goToNextStep()`) and `submit(handler)`.

## Removed API (previous contract)

| Removed                                                                         | Replacement                                                                                                                                  |
| ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `config` prop, `FormWizardConfig` (`validateStep` / `validateAll` callbacks)    | step rules in `createForm({ flow: { steps: [{ id, rules }] } })`; full check — `bundle.submit(handler)` / `bundle.validate()`                |
| `defineSteps(model, { steps, extras })`                                         | `flow.steps` + `validation.extras` of `createForm`                                                                                           |
| `ref` prop, `FormWizardHandle` (`goToStep`, `submit`, `validateCurrentStep`, …) | `bundle.flow` (`next()`, `previous()`, `goTo(id)`), `bundle.submit(handler)`, `bundle.validateStep(id)`; inside the tree — `useFormWizard()` |
| `useWizardStepValidation(config)` + `strategy` in `defineSteps`                 | `createForm({ validation: { strategy } })`, armed by `useFormBundle`                                                                         |
| ref `submit()` resolving to `R \| null`                                         | `bundle.submit(handler)` resolving to `SubmitResult`                                                                                         |

## Живая валидация: `validation.strategy`

По умолчанию проверка идёт на границах: правила шага — на «Далее», полный набор — на отправке.
Живая проверка задаётся сборке формы, а не визарду:

```tsx
const bundle = useFormBundle(() =>
  createForm<Root>({
    initial,
    validation: { extras: crossStepRules, strategy: 'blur' },
    flow: { steps: [{ id: 'loan', rules: loanRules }, { id: 'confirm' }] },
  })
);
```

- `strategy`: `'submit'` (по умолчанию — живой проверки нет) | `'blur'` | `'change'` (+ `debounce`,
  мс) | `'afterFirstSubmit'` (+ `liveAfterSubmit: 'change' | 'blur'`, по умолчанию `'change'`).
- Стратегию армирует `useFormBundle` (в эффекте; при SSR не армируется) — отдельного хука у
  визарда нет.
- Живой прогон идёт по полному набору правил формы и `touched` не ставит: замечание видно, когда
  поле тронуто или изменено (`shouldShowIssues`).
- Шаг, не прошедший «Далее», помечает тронутыми только проверенные поля шага: замечания полей
  следующих шагов не всплывают раньше, чем пользователь до них дойдёт.
