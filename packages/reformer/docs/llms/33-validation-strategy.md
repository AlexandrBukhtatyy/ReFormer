# useFormValidation — Единый выбор стратегии валидации

## Purpose

Одна декларативная точка выбора «когда прогонять схему валидации» вместо ручной разводки
`markAsTouched` + `validateModel` + `revalidateWhen` + `useState(pending)`. Аддитивный слой над
функциональной схемой (`@reformer/core/validation`): переиспользует раннер схемы как
ЕДИНСТВЕННЫЙ движок (разнос ошибок по нодам, отмена устаревших прогонов, дедуп по `(model, schema)`),
второго движка не заводит. Других триггеров валидации нет: у ноды поля собственных валидаторов,
`updateOn` и `debounce` не бывает — когда запускать проверку, решает только стратегия.

Стратегия определяет только момент запуска и раскрытие ошибок — сами правила остаются в отдельной
`defineValidation<T>(({ model }) => …)`.

## API

Три точки входа к одному контроллеру:

- **сборка `createForm`** — `validation: { rules?, extras?, strategy, debounce, liveAfterSubmit }`.
  Контроллер собирает уровень формы, армирует `useFormBundle` (в эффекте, не при SSR);
  `bundle.validate()` и `bundle.submit(handler)` — полный прогон с раскрытием замечаний. Это путь
  по умолчанию для формы со сборкой;
- **React-хук `useFormValidation`** из `@reformer/core/react` — для формы без сборки
  (`createFormFromModel` + своя схема);
- **headless-фабрика `createFormValidation`** из `@reformer/core/validation` — для SSR / тестов /
  не-React потребителей.

```typescript
// Сборка (@reformer/core)
createForm<T>({
  …,
  validation: {
    rules?: ValidationDefinition<T>;       // полный набор; без него — правила шагов flow + extras
    extras?: ValidationDefinition<T>;
    strategy?: ValidationStrategyKind;     // default 'submit'
    debounce?: number;
    liveAfterSubmit?: 'change' | 'blur';
  },
});

// React (@reformer/core/react)
function useFormValidation<T>(args: {
  model: FormModel<T>;
  schema: ValidationDefinition<T>;         // СТАБИЛЬНАЯ ссылка (module-level const / useMemo)
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
  run(): Promise<ValidationResult>;    // тот же прогон с полным результатом: valid | invalid | error | cancelled
  start(): () => void;                 // армит реактивные подписки (ТОЛЬКО на клиенте) → dispose
  dispose(): void;
  readonly isValidating: boolean;
  readonly validating: ReadonlySignal<boolean>;
}
function createFormValidation<T>(
  model: FormModel<T>,
  schema: ValidationDefinition<T>,
  options?: ValidationStrategyOptions,
): FormValidationController;
```

- `useFormValidation` мемоизирует контроллер по `[model, schema, strategy, debounce, liveAfterSubmit]`,
  армит стратегию в `useEffect` (SSR-safe), а `submit()` = `controller.validate()`.
- `createFormValidation` ЧИСТА до `start()` (никаких подписок) → SSR-safe; `start()` возвращает
  `dispose` и арминует триггеры только на клиенте.

### Стратегии

| strategy | когда прогон | touch | раскрытие замечаний |
| --- | --- | --- | --- |
| `submit` (default) | только `validate()` / `submit()` (в сборке — `bundle.validate()` / `bundle.submit()`) | `true` | всё на submit |
| `blur` | смена `touched` поля (потеря фокуса) | `false` | только сблюренные (по `touched`) |
| `change` | на каждый ввод (+ `debounce`) | `false` | только редактированные (по `dirty`) |
| `afterFirstSubmit` | тихо до 1-го submit, затем live (`liveAfterSubmit: 'change'` \| `'blur'`, default `'change'`) | `true` один раз на 1-м submit, дальше `false` | тихо → раскрыть всё на submit → далее live |

## Examples

### Сборка — стратегия полем `validation`

```tsx
import { createForm } from '@reformer/core';
import { useFormBundle } from '@reformer/core/react';

const createRegistration = () =>
  createForm<RegistrationData>({
    initial: { username: '', email: '', password: '' },
    schema: registrationSchema,
    validation: { rules: registrationValidation, strategy: 'afterFirstSubmit', debounce: 400 },
  });

function RegistrationForm() {
  const registration = useFormBundle(createRegistration); // армирует живую стратегию в эффекте
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // первый submit раскрывает все замечания и переводит форму в живую фазу
    await registration.submit(api.save);
  };
  /* … */
}
```

### Без сборки — useFormValidation, afterFirstSubmit + debounce

Тихо до первой отправки, `submit()` раскрывает все замечания и переводит форму в живую фазу
(дальше проверка на ввод с задержкой 400 мс). `submit()` сам метит `touched` — ручной
`markAsTouched` не нужен.

```tsx
import { useMemo } from 'react';
import { createModel, createFormFromModel } from '@reformer/core';
import { useFormValidation } from '@reformer/core/react';
import { defineValidation, validate } from '@reformer/core/validation';
import { required, email, minLength } from '@reformer/core/validators';

type RegistrationData = { username: string; email: string; password: string };

// Схема — стабильный module-level const (иначе ломается дедуп раннера).
const registrationValidation = defineValidation<RegistrationData>(({ model }) => {
  validate(model.$.username, [required(), minLength(3)]);
  validate(model.$.email, [required(), email()]);
  validate(model.$.password, [required(), minLength(8)]);
});

function RegistrationForm() {
  const model = useMemo(() => createModel<RegistrationData>({ username: '', email: '', password: '' }), []);
  const form = useMemo(() => createFormFromModel({ model }), [model]);

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

### Визард — стратегия формы и проверка шага потоком

Живая стратегия — свойство формы, а не шага: она задаётся полем `validation` сборки и армируется
`useFormBundle`. Проверку шага делает поток: «Далее» визарда — `flow.next()`, он прогоняет правила
текущего шага и не пускает дальше при замечаниях. Отправка — `bundle.submit` (все шаги + `extras`).

```tsx
const createCredit = () =>
  createForm<CreditForm>({
    model: createCreditModel(),
    schema: creditSchema,
    validation: { extras: crossFieldRules, strategy: 'blur' }, // живая проверка при потере фокуса
    flow: {
      steps: [
        { id: 'loan', rules: loanStep },
        { id: 'applicant', rules: applicantStep },
        { id: 'confirm' }, // без правил
      ],
    },
  });

function CreditWizard() {
  const credit = useFormBundle(createCredit);
  return (
    <FormWizard
      form={credit.form}
      flow={credit.flow}
      steps={STEPS}
      onSubmit={() => void credit.submit(api.save)}
    />
  );
}
```

Живая фаза прогоняет **полный** набор правил (все шаги + `extras`), а показ замечаний гейтится
`touched` / `dirty` полей: поля следующих шагов пользователь ещё не трогал — их замечания не видны.
Прежний per-step механизм (`defineSteps(…, { strategy })` + `useWizardStepValidation`) удалён.

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
  const schema = defineValidation<Form>(({ model }) => { … }); // новая ссылка на каждый рендер
  useFormValidation({ model, schema, strategy: 'change' });
}

// ✅ Стабильная ссылка: module-level const (или useMemo с пустыми deps)
const formValidation = defineValidation<Form>(({ model }) => { … });
function MyForm() {
  useFormValidation({ model, schema: formValidation, strategy: 'change' });
}
```

```typescript
// ❌ updateOn / debounce / validators в узле схемы — таких ключей у узла нет, сборка их не читает
// { model: model.$.email, component: Input, updateOn: 'blur', validators: [required()] }

// ✅ Момент запуска — стратегия формы; правила — схема валидации
// createForm({ …, validation: { rules: formValidation, strategy: 'blur', debounce: 300 } })
```

```typescript
// ❌ Своя стратегия поверх сборки: второй контроллер на ту же модель и правила
const bundle = useFormBundle(() => createForm({ …, validation: rules }));
useFormValidation({ model: bundle.model, schema: rules, strategy: 'change' });

// ✅ Стратегия — полем validation сборки; армирует useFormBundle
const bundle = useFormBundle(() => createForm({ …, validation: { rules, strategy: 'change' } }));
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
- [13-multi-step.md](./13-multi-step.md) — многошаговая форма: поток `flow`, `bundle.validateStep(id)`
- [38-form-flow.md](./38-form-flow.md) — уровень формы: `validate`, `submit`, поток шагов
