# useFormValidation — Единый выбор стратегии валидации

## Purpose

Одна декларативная точка выбора «когда прогонять схему валидации» вместо ручной разводки
`markAsTouched` + `validateModel` + `revalidateWhen` + `useState(pending)`. Аддитивный слой над
функциональной схемой (`@reformer/core/validation`): переиспользует `validateModel` как
ЕДИНСТВЕННЫЙ движок (роутинг ошибок в ноды, отмена устаревших прогонов, дедуп по `(model, schema)`),
второго движка не заводит. Node-level `updateOn` / `debounce` на самой ноде поля (legacy-триггеры)
этот API НЕ трогает.

Стратегия определяет только момент запуска и раскрытие ошибок — сами правила остаются в отдельной
`defineValidationSchema<T>(({ model }) => …)`.

## API

Основной способ — React-хук `useFormValidation` из `@reformer/core` (рядом с `useFormControl`).
Под ним — headless-фабрика `createFormValidation` из `@reformer/core/validation` (для SSR / тестов /
не-React потребителей).

```typescript
// React (@reformer/core)
function useFormValidation<T>(args: {
  model: FormModel<T>;
  schema: ValidationSchema<T>;         // СТАБИЛЬНАЯ ссылка (module-level const / useMemo)
  strategy?: ValidationStrategyKind;   // default 'submit'
  debounce?: number;                   // мс, для live-фаз (change / live-часть afterFirstSubmit)
  liveAfterSubmit?: 'change' | 'blur'; // default 'change'
}): { submit: () => Promise<boolean>; validate: () => Promise<boolean>; isValidating: boolean };

// headless (@reformer/core/validation)
type ValidationStrategyKind = 'submit' | 'blur' | 'change' | 'afterFirstSubmit';
interface ValidationStrategyOptions {
  strategy?: ValidationStrategyKind;
  debounce?: number;
  liveAfterSubmit?: 'change' | 'blur';
}
interface FormValidationController {
  validate(): Promise<boolean>;        // полный прогон, touch:true (раскрыть ВСЕ ошибки); переводит afterFirstSubmit в live-фазу
  start(): () => void;                 // армит реактивные подписки (ТОЛЬКО на клиенте) → dispose
  dispose(): void;
  readonly isValidating: boolean;
  readonly validating: ReadonlySignal<boolean>;
}
function createFormValidation<T>(
  model: FormModel<T>,
  schema: ValidationSchema<T>,
  options?: ValidationStrategyOptions,
): FormValidationController;
```

- `useFormValidation` мемоизирует контроллер по `[model, schema, strategy, debounce, liveAfterSubmit]`,
  армит стратегию в `useEffect` (SSR-safe), а `submit()` = `controller.validate()`.
- `createFormValidation` ЧИСТА до `start()` (никаких подписок) → SSR-safe; `start()` возвращает
  `dispose` и арминует триггеры только на клиенте.

### Стратегии

| strategy | когда прогон | touch | раскрытие ошибок |
| --- | --- | --- | --- |
| `submit` (default) | только `validate()` / `submit()` | `true` | всё на submit |
| `blur` | смена `touched` поля (потеря фокуса) | `false` | только сблюренные (по `touched`) |
| `change` | на каждый ввод (+ `debounce`) | `false` | только редактированные (по `dirty`) |
| `afterFirstSubmit` | тихо до 1-го submit, затем live (`liveAfterSubmit: 'change'` \| `'blur'`, default `'change'`) | `true` один раз на 1-м submit, дальше `false` | тихо → раскрыть всё на submit → далее live |

## Examples

### Простая форма — afterFirstSubmit + debounce

Тихо до первой отправки, `submit()` раскрывает все ошибки и переводит форму в живую фазу
(дальше проверка на ввод с задержкой 400 мс). `submit()` сам метит `touched` — ручной
`markAsTouched` не нужен.

```tsx
import { createModel, createForm, useFormValidation } from '@reformer/core';
import { defineValidationSchema, validate } from '@reformer/core/validation';
import { required, email, minLength } from '@reformer/core/validators';

type RegistrationData = { username: string; email: string; password: string };

// Схема — стабильный module-level const (иначе ломается дедуп раннера).
const registrationValidation = defineValidationSchema<RegistrationData>(({ model }) => {
  validate(model.$.username, [required(), minLength(3)]);
  validate(model.$.email, [required(), email()]);
  validate(model.$.password, [required(), minLength(8)]);
});

function RegistrationForm() {
  const model = useMemo(() => createModel<RegistrationData>({ username: '', email: '', password: '' }), []);
  const form = useMemo(() => createForm({ model }), [model]);

  const { submit, isValidating } = useFormValidation({
    model,
    schema: registrationValidation,
    strategy: 'afterFirstSubmit',
    debounce: 400,
  });

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (await submit()) await api.save(model.get()); // true = нет блокирующих ошибок
  };

  return (
    <form onSubmit={onSubmit}>
      <FormField control={form.username} />
      <FormField control={form.email} />
      <FormField control={form.password} />
      <button type="submit" disabled={isValidating}>Отправить</button>
    </form>
  );
}
```

### Wizard — live-стратегия внутри активного шага

`defineSteps(..., { strategy })` задаёт ЖИВУЮ стратегию ВНУТРИ шага; `useWizardStepValidation`
арминует её под текущий шаг (`currentStep` из `FormWizardContext`) и снимает при смене шага / unmount.
Per-step gate (`validateStep` на «Далее») и `validateAll` (submit) при этом НЕ меняются — стратегия
добавляет живой слой ПОВЕРХ них. No-op, если `strategy` не задана / `'submit'` / у шага нет правил.

```tsx
import { defineSteps, useWizardStepValidation, FormWizard } from '@reformer/cdk/form-wizard';

const config = defineSteps<'loan' | 'applicant' | 'confirm', CreditForm>(model, {
  steps: { loan: loanStep, applicant: applicantStep, confirm: null }, // confirm — без правил, ЯВНО
  extras: crossFieldRules,   // применяются только в validateAll (submit)
  strategy: 'blur',          // живая валидация полей текущего шага при потере фокуса
});

function LoanStepBody() {
  useWizardStepValidation(config); // армит 'blur' под активный шаг, снимает при переходе
  return <>{/* поля шага */}</>;
}

<FormWizard form={form} config={config}>
  <LoanStepBody />
</FormWizard>;
```

### Headless / SSR / тесты — createFormValidation

```typescript
import { createFormValidation } from '@reformer/core/validation';

const ctrl = createFormValidation(model, registrationValidation, {
  strategy: 'afterFirstSubmit',
  debounce: 300,
});
const dispose = ctrl.start();        // ТОЛЬКО на клиенте (в React — из useEffect)
const ok = await ctrl.validate();    // submit → раскрыть все ошибки
dispose();
```

## Anti-patterns

```typescript
// ❌ schema пересоздаётся каждый рендер → контроллер и дедуп раннера ломаются
function MyForm() {
  const schema = defineValidationSchema<Form>(({ model }) => { … }); // новая ссылка на каждый рендер
  useFormValidation({ model, schema, strategy: 'change' });
}

// ✅ Стабильная ссылка: module-level const (или useMemo с пустыми deps)
const formValidation = defineValidationSchema<Form>(({ model }) => { … });
function MyForm() {
  useFormValidation({ model, schema: formValidation, strategy: 'change' });
}
```

```typescript
// ❌ Node-level updateOn (Слой B) И активная schema-стратегия на ОДНОМ поле → оба пишут ошибки в ноду → мерцание
// узел поля: { updateOn: 'blur', … } + useFormValidation({ strategy: 'blur', schema: включает это же поле })

// ✅ Одно поле обслуживает ОДИН слой: либо node-level updateOn, либо schema-стратегия — не оба сразу
```

```typescript
// ❌ start() на сервере — арминует реактивные подписки при SSR
const ctrl = createFormValidation(model, schema, { strategy: 'change' });
ctrl.start(); // на сервере подписок быть не должно

// ✅ Фабрика чиста до start(); армить только на клиенте (useFormValidation делает это в useEffect)
const ctrl = createFormValidation(model, schema, { strategy: 'change' });
if (typeof window !== 'undefined') ctrl.start();
```

## See also

- [28-submit-and-reset.md](./28-submit-and-reset.md) — submit-флоу и `validateModel` (движок под стратегией)
- [27-revalidate-when.md](./27-revalidate-when.md) — ручные триггеры перевалидации (низкоуровневый примитив)
- [31-async-validator-debounce.md](./31-async-validator-debounce.md) — async-правила и отмена устаревших прогонов
- [13-multi-step.md](./13-multi-step.md) — per-step / полная валидация wizard (`validateStep` / `validateAll`)
