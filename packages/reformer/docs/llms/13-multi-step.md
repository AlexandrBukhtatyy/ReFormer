## 12. MULTI-STEP FORM VALIDATION

Каждый шаг — своя под-схема валидации (дерево узлов `{ children: [...] }`). Переход к
следующему шагу проверяется `validateFormModel(model, stepSchema)`; полный submit — по
общей схеме (объединение шагов). `validateFormModel` роутит ошибки в ноды формы, поэтому
UI подсветит проблемные поля текущего шага автоматически.

```typescript
import { validateFormModel, type FormModel } from '@reformer/core';
import { required, min } from '@reformer/core/validators';

// Под-схема шага: дерево field-узлов { value, validators }
const step1Schema = (m: FormModel<Form>) => ({
  children: [
    { value: m.$.loanType, validators: [required()] },
    { value: m.$.loanAmount, validators: [required(), min(50000)] },
  ],
});

const step2Schema = (m: FormModel<Form>) => ({
  children: [
    { value: m.$.personalData.firstName, validators: [required()] },
    { value: m.$.personalData.lastName, validators: [required()] },
  ],
});

// Карта шагов + полная схема (объединение)
const STEP_SCHEMAS = [step1Schema, step2Schema];
const fullSchema = (m: FormModel<Form>) => ({
  children: STEP_SCHEMAS.map((build) => build(m)),
});
```

```typescript
// Переход к следующему шагу
const goToNextStep = async () => {
  const result = await validateFormModel(model, STEP_SCHEMAS[currentStep - 1](model));
  if (!result.valid) return; // ошибки уже проставлены в ноды текущего шага
  setCurrentStep(currentStep + 1);
};

// Полный submit
const handleSubmit = async () => {
  const result = await validateFormModel(model, fullSchema(model));
  if (result.valid) {
    await onSubmit(model.get());
  }
};
```

### Multi-Step Component Example

```tsx
function MultiStepForm() {
  const [step, setStep] = useState(1);

  const nextStep = async () => {
    const result = await validateFormModel(model, STEP_SCHEMAS[step - 1](model));
    if (result.valid) setStep(step + 1);
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

> В монорепо `FormWizard` из `@reformer/ui-kit` принимает колбэки `{ validateStep, validateAll }`,
> собранные фабрикой `makeCreditValidationConfig(model)` поверх `validateFormModel`. См.
> `complex-multy-step-form/schemas/validation.ts`.
