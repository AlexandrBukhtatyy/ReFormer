## 12. MULTI-STEP FORM VALIDATION

Каждый шаг — своя `ValidationSchema<Form>` (обычная функция `({ model, cross }) => void`, обёрнутая
`defineValidationSchema`). Правила шагов передаются сборке формы данными — `validation: { steps, extras }`;
сборка отдаёт прогон шага и полный прогон. Раннер сам разносит ошибки по нодам формы, поэтому UI
подсветит проблемные поля текущего шага автоматически. Валидация живёт ОТДЕЛЬНО от схемы формы: узел
схемы (TS или JSON) правил не несёт.

### Через сборку формы — `validation: { steps, extras }`

Ключ `steps` — `selector` узла шага в схеме; порядок ключей — порядок шагов. `extras` — правила всей
формы, которые проверяются только целиком.

```typescript
import { createForm } from '@reformer/core';

const { form, validation } = createForm<Form>({
  initial,
  schema: formSchema, // узлы шагов несут selector: 'loan', 'applicant'
  validation: {
    steps: { loan: step1Schema, applicant: step2Schema }, // null — шаг без правил
    extras: crossStepRules,
  },
});

await validation.validateStep(1);        // правила шага: по номеру (с 1) либо по селектору — 'loan'
await validation.validateAll();          // все шаги + extras
const result = await validation.runStep('loan'); // то же с полным результатом
// result.status: 'valid' | 'invalid' | 'error' (правило не удалось проверить) | 'cancelled'
validation.validating.value;             // идёт ли прогон — полный либо шага
```

`validation` структурно совместима с конфигом визарда: `<FormWizard form={form} config={validation} … />`.
В dev сборка предупреждает о ключе `steps`, для которого в схеме нет шага с таким `selector`.

В большой форме шаг объявляют один раз — в списке шагов (`flow/`): из него строятся и узлы шагов
схемы, и `validation.steps`. См. `15-project-structure.md`.

### Вручную — `validateModel` по схеме шага

Тот же результат без сборки: переход к следующему шагу проверяется `validateModel(model, stepSchema)`,
полный submit — по общей схеме (композиция шагов через `apply(...)`).

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
