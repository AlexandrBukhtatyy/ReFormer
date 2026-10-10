## 12. MULTI-STEP FORM VALIDATION

Многошаговая форма — **поток шагов** сборки: `createForm({ flow: { steps: [{ id, rules }] } })`.
Каждый шаг — идентификатор и своя `ValidationDefinition<Form>` (обычная функция
`({ model, cross }) => void`, обёрнутая `defineValidation`). Идентификатор шага — `selector` узла
шага в схеме. Правила вне шагов (межшаговые) — `validation: { extras }`: они проверяются только
целиком, при отправке. Валидация живёт ОТДЕЛЬНО от схемы формы: узел схемы (TS или JSON) правил не
несёт.

Сборка отдаёт поток `bundle.flow` (`next` / `previous` / `goTo`), проверку шага
`bundle.validateStep(id)`, полную проверку `bundle.validate()` и отправку `bundle.submit(handler)`.
Замечания разносятся по нодам сами — UI подсветит поля текущего шага. Полный справочник —
[38-form-flow.md](./38-form-flow.md).

### Поток шагов сборки

```typescript
import { createForm } from '@reformer/core';
import { useFormBundle } from '@reformer/core/react';

const createLoanForm = () =>
  createForm<Form>({
    initial,
    schema: formSchema, // узлы шагов несут selector: 'loan', 'applicant', 'confirm'
    validation: { extras: crossStepRules }, // правила всей формы — только целиком
    flow: {
      steps: [
        { id: 'loan', rules: loanRules },
        { id: 'applicant', rules: applicantRules },
        { id: 'confirm' }, // шаг без правил
      ],
    },
  });

// в компоненте: фабрика вызывается один раз, сборка стабильна между рендерами
const loan = useFormBundle(createLoanForm);

// в обработчиках событий
await loan.flow?.next(); // проверить правила текущего шага и перейти → FlowTransition
await loan.validateStep('loan'); // правила одного шага → ValidationResult
await loan.validate(); // все шаги + extras → ValidationResult
await loan.submit(sendLoan); // один прогон всех правил; обработчик — только при valid
loan.validating.value; // идёт ли проверка — полная либо шага
```

- Полный набор правил — правила всех шагов и `extras`; свой полный набор задаёт
  `validation: { rules }` (тогда правила шагов работают только для `validateStep` / `next`).
- `next()` на шаге с замечаниями остаётся на месте: `{ status: 'stayed', reason: 'invalid',
  validation }`; поля шага помечаются тронутыми. Переход — `{ status: 'moved', from, to }`.
- `goTo(id)` открывает первый шаг и шаги после пройденных; прыжок вперёд через непройденный шаг —
  `reason: 'locked'`. Назад — всегда.
- В dev сборка предупреждает о шаге `flow.steps`, для которого в схеме нет узла с таким `selector`.
- Правила (`loanRules`, `extras`) — стабильные ссылки: константы модуля через `defineValidation`.

В большой форме шаг объявляют один раз — в списке шагов (`flow/`): из него строятся и узлы шагов
схемы, и `flow.steps` сборки. См. `15-project-structure.md`.

### Визард — адаптер потока

`FormWizard` из `@reformer/cdk` и `@reformer/ui-kit` рисует поток и зовёт его переходы:

```tsx
import { FormWizard } from '@reformer/ui-kit';

function LoanWizard() {
  const loan = useFormBundle(createLoanForm);
  const send = async () => {
    const outcome = await loan.submit(sendLoan);
    if (outcome.status !== 'submitted') showHint('Проверьте форму');
  };
  return <FormWizard form={loan.form} flow={loan.flow} steps={STEPS} onSubmit={send} />;
}
```

- В JSX — `form`, `flow={bundle.flow}` и `steps` пропсами; отправку проверяет приложение через
  `bundle.submit(handler)`.
- В схеме формы — узел `{ selector: 'wizard', component: FormWizard, children: [шаги] }`, шаг —
  `{ selector: 'loan', component: Step, componentProps: { title }, children: [...] }`. Внутри
  рендерера визард берёт форму и поток из сборки сам, а его `onSubmit` зовётся через
  `bundle.submit` — только после успешной проверки всей формы.
- Без `flow` и без сборки в контексте визард строит позиционный поток **без правил**.
- Навигация снаружи визарда — через сам поток: `bundle.flow?.goTo('loan')`; в поведении — `flow` из
  области (`defineFormBehavior(({ model, flow }) => …)`).

### Шаги без визарда — `useFormFlow`

```tsx
import { useFormFlow } from '@reformer/core/react';

function MultiStepForm() {
  const loan = useFormBundle(createLoanForm);
  const flow = loan.flow!;
  const { current, isFirst, isLast, validating } = useFormFlow(flow);

  return (
    <div>
      {current === 'loan' && <LoanFields form={loan.form} />}
      {current === 'applicant' && <ApplicantFields form={loan.form} />}
      {current === 'confirm' && <Summary form={loan.form} />}

      <button onClick={() => flow.previous()} disabled={isFirst}>
        Back
      </button>
      {isLast ? (
        <button onClick={() => void loan.submit(sendLoan)}>Submit</button>
      ) : (
        <button onClick={() => void flow.next()} disabled={validating}>
          Next
        </button>
      )}
    </div>
  );
}
```

### Без сборки — `validateModel` по схеме шага

Тот же результат без `createForm`: переход проверяется `validateModel(model, stepSchema)`, полный
submit — по общей схеме (композиция шагов через `apply(...)`).

```typescript
import {
  validate,
  apply,
  defineValidation,
  validateModel,
  type ValidationDefinition,
} from '@reformer/core/validation';
import { required, min } from '@reformer/core/validators';

const loanRules = defineValidation<Form>(({ model }) => {
  validate(model.$.loanType, [required()]);
  validate(model.$.loanAmount, [required(), min(50000)]);
});

const applicantRules = defineValidation<Form>(({ model }) => {
  validate(model.$.personalData.firstName, [required()]);
  validate(model.$.personalData.lastName, [required()]);
});

const STEP_RULES: readonly ValidationDefinition<Form>[] = [loanRules, applicantRules];
const fullRules = defineValidation<Form>(() => apply(...STEP_RULES));

// true = нет блокирующих замечаний (severity:'warning' не блокирует); замечания уже в нодах
const stepOk = await validateModel(model, STEP_RULES[index], { touch: true });
const allOk = await validateModel(model, fullRules, { touch: true });
```

Поток без сборки собирает `createFormFlow({ steps, validateStep })` — см. `38-form-flow.md`.

### Удалено

| Прежний контракт                                         | Сейчас                                                    |
| -------------------------------------------------------- | --------------------------------------------------------- |
| `validation: { steps: { loan: rules } }`                 | `flow: { steps: [{ id: 'loan', rules }] }`                |
| `bundle.validation.validateStep(n)` / `.validateAll()` / `.runStep()` / `.runAll()` | `bundle.validateStep(id)` / `bundle.validate()` |
| `<FormWizard config={…} ref={…}>`, `FormWizardConfig`, `FormWizardHandle` | `<FormWizard flow={bundle.flow}>`, навигация — `bundle.flow` |
| `defineSteps`, `useWizardStepValidation`                 | `flow` сборки; живая проверка — `validation.strategy`     |
