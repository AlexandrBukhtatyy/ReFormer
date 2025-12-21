## 12. MULTI-STEP FORM VALIDATION

```typescript
// Step-specific validation schemas
const step1Validation: ValidationSchemaFn<Form> = (path) => {
  required(path.loanType);
  required(path.loanAmount);
};

const step2Validation: ValidationSchemaFn<Form> = (path) => {
  required(path.personalData.firstName);
  required(path.personalData.lastName);
};

// STEP_VALIDATIONS map for useStepForm hook
export const STEP_VALIDATIONS = {
  1: step1Validation,
  2: step2Validation,
};

// Full validation (combines all steps)
export const fullValidation: ValidationSchemaFn<Form> = (path) => {
  step1Validation(path);
  step2Validation(path);
};

// Using validateForm() for step validation
import { validateForm } from '@reformer/core';

const goToNextStep = async () => {
  const currentValidation = STEP_VALIDATIONS[currentStep];
  const isValid = await validateForm(form, currentValidation);

  if (!isValid) {
    form.markAsTouched();  // Show errors on current step fields
    return;
  }

  setCurrentStep(currentStep + 1);
};

// Full form submit with all validations
const handleSubmit = async () => {
  const isValid = await validateForm(form, fullValidation);

  if (isValid) {
    await form.submit(onSubmit);
  }
};
```

### Multi-Step Component Example

```tsx
function MultiStepForm() {
  const [step, setStep] = useState(1);

  const nextStep = async () => {
    const validation = STEP_VALIDATIONS[step];
    if (await validateForm(form, validation)) {
      setStep(step + 1);
    } else {
      form.markAsTouched();
    }
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
