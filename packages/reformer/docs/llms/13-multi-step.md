## 12. MULTI-STEP FORM VALIDATION

Каждый шаг — своя `ValidationSchema<Form>` (обычная функция `({ model }) => void`, обёрнутая
`defineValidationSchema`). Переход к следующему шагу проверяется `validateModel(model, stepSchema)`;
полный submit — по общей схеме (композиция шагов через `apply(...)`). `validateModel` сам разносит
ошибки по нодам формы (`getNodeForSignal(sig).setErrors(...)`), поэтому UI подсветит проблемные поля
текущего шага автоматически. Валидация живёт ОТДЕЛЬНО от layout: сам `RenderNode`/JSON-узел валидаторов
не несёт — схема инъектируется в рантайме и роутит ошибки по тем же нодам.

```typescript
import { type FormModel } from '@reformer/core';
import {
  validate,
  apply,
  defineValidationSchema,
  validateModel,
  type ValidationSchema,
} from '@reformer/core/validation';
import { required, min } from '@reformer/core/validators';

// Под-схема шага — обычная функция ({ model }) => void. Значения проверяет оператор validate(sig, [rules]).
const step1Schema = defineValidationSchema<Form>(({ model }) => {
  validate(model.$.loanType, [required()]);
  validate(model.$.loanAmount, [required(), min(50000)]);
});

const step2Schema = defineValidationSchema<Form>(({ model }) => {
  validate(model.$.personalData.firstName, [required()]);
  validate(model.$.personalData.lastName, [required()]);
});

// Карта шагов + полная схема (композиция под-схем через apply — заменяет пошаговую группировку деревом)
const STEP_SCHEMAS: readonly ValidationSchema<Form>[] = [step1Schema, step2Schema];
const fullSchema = defineValidationSchema<Form>(() => apply(...STEP_SCHEMAS));
```

```typescript
// Переход к следующему шагу. validateModel возвращает Promise<boolean> (true = нет блокирующих ошибок;
// severity:'warning' не блокирует). Устаревшие прогоны той же (model, schema) отменяются автоматически.
const goToNextStep = async () => {
  const ok = await validateModel(model, STEP_SCHEMAS[currentStep - 1]);
  if (!ok) return; // ошибки уже проставлены в ноды текущего шага
  setCurrentStep(currentStep + 1);
};

// Полный submit — по общей схеме
const handleSubmit = async () => {
  const ok = await validateModel(model, fullSchema);
  if (ok) {
    await onSubmit(model.get());
  }
};
```

Слой-потребитель (`FormWizard`) обычно оборачивает это в конфиг с per-step и полной валидацией:

```typescript
function makeValidationConfig(model: FormModel<Form>) {
  return {
    validateStep: (n: number): Promise<boolean> => validateModel(model, STEP_SCHEMAS[n - 1]),
    validateAll: (): Promise<boolean> => validateModel(model, fullSchema),
  };
}
```

### Multi-Step Component Example

```tsx
function MultiStepForm() {
  const [step, setStep] = useState(1);

  const nextStep = async () => {
    const ok = await validateModel(model, STEP_SCHEMAS[step - 1]);
    if (ok) setStep(step + 1);
  };

  return (
    <div>
      {step === 1 && <Step1Fields form={form} />}
      {step === 2 && <Step2Fields form={form} />}

      <button onClick={() => setStep(step - 1)} disabled={step === 1}>
        Back
      </button>
      <button onClick={step === 2 ? handleSubmit : nextStep}>
        {step === 2 ? 'Submit' : 'Next'}
      </button>
    </div>
  );
}
```
