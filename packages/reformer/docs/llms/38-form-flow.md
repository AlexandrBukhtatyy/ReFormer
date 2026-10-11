# Уровень формы и поток шагов — validate, submit и FormFlow

## Purpose

`createForm` возвращает сборку: модель, форму, часть для рендерера и **уровень формы** — проверку,
проверку шага, отправку и поток шагов. Уровень один для всех способов реализации: React-руками,
рендерер по TS-схеме (`createReactForm`), рендерер по JSON (`createJsonForm`) собирают его одной
функцией `createFormLevel`, поэтому `validate`, `submit` и поток ведут себя одинаково.

- Правила формы передаются сборке данными: `validation` — полный набор (`rules`), правила вне
  шагов (`extras`) и стратегия живой проверки.
- Шаги и их правила — поток: `flow: { steps: [{ id, rules }] }`. Идентификатор шага — `selector`
  узла шага в схеме.
- Результаты — объекты со статусом, а не `boolean`: по ним отличают ошибки в форме (`invalid`) от
  сбоя проверки (`error`), отмены (`cancelled`) и исключения обработчика (`failed`).

## API

```typescript
import {
  createForm,
  createFormFlow,
  type FormBundle,
  type FormFlow,
  type FormFlowConfig,
  type FormValidation,
  type FlowTransition,
  type SubmitResult,
} from '@reformer/core';
import { useFormBundle, useFormFlow } from '@reformer/core/react';

// Конфиг сборки — поля уровня формы
interface CreateFormConfig<T> {
  // … initial | model, schema, registry, behavior, seed, setup
  validation?: FormValidation<T> | ValidationDefinition<T>; // голая схема = { rules }
  flow?: FormFlowConfig<T>;
}
interface FormValidation<T> {
  rules?: ValidationDefinition<T>; // полный набор; без него — правила всех шагов + extras
  extras?: ValidationDefinition<T>; // правила вне шагов: проверяются только целиком
  strategy?: 'submit' | 'blur' | 'change' | 'afterFirstSubmit'; // живая проверка, по умолчанию 'submit'
  debounce?: number;
  liveAfterSubmit?: 'change' | 'blur';
}
interface FormFlowConfig<T> {
  steps: readonly { id: string; rules?: ValidationDefinition<T> | null }[];
}

// Сборка
interface FormBundle<T> {
  model: FormModel<T>;
  form: FormGroup<T>;
  render: FormRender; // { tree: CompiledSchema | undefined, controller, node(selector) }
  flow: FormFlow | undefined; // без flow в конфиге — undefined
  validating: ReadonlySignal<boolean>; // идёт полная проверка или проверка шага
  submitting: ReadonlySignal<boolean>; // работает обработчик submit
  // служебное: полный набор правил и контроллер живой проверки (его армирует useFormBundle);
  // без правил — undefined. Методов проверки на нём нет — проверяют validate/validateStep/submit
  validation: { rules: ValidationDefinition<T>; controller: FormValidationController } | undefined;
  validate(): Promise<ValidationResult>; // вся форма, замечания показываются
  validateStep(stepId: string): Promise<ValidationResult>; // неизвестный шаг — исключение
  submit<R>(handler: (values: T) => R | Promise<R>): Promise<SubmitResult<R>>;
}

type SubmitResult<R> =
  | { status: 'submitted'; result: R } // обработчик отработал
  | { status: 'invalid' | 'error' | 'cancelled'; validation: ValidationResult } // обработчик не вызывался
  | { status: 'failed'; error: unknown }; // обработчик бросил исключение

// Поток шагов
interface FormFlow {
  readonly steps: readonly string[];
  readonly current: ReadonlySignal<string>;
  readonly index: ReadonlySignal<number>; // с нуля
  readonly completed: ReadonlySignal<ReadonlySet<string>>;
  readonly isFirst: ReadonlySignal<boolean>;
  readonly isLast: ReadonlySignal<boolean>;
  readonly validating: ReadonlySignal<boolean>; // идёт проверка шага в next()
  canGoTo(stepId: string): boolean;
  next(): Promise<FlowTransition>; // проверить правила текущего шага и перейти
  previous(): FlowTransition;
  goTo(stepId: string): FlowTransition; // неизвестный шаг — исключение
  reset(): void; // на первый шаг, пройденные забыты
}
type FlowTransition =
  | { status: 'moved'; from: string; to: string }
  | { status: 'stayed'; step: string; reason: FlowStayReason; validation?: ValidationResult };
type FlowStayReason = 'invalid' | 'error' | 'cancelled' | 'edge' | 'locked';

// React: снимок потока для рендера
function useFormFlow(flow: FormFlow): {
  current: string; index: number; completed: ReadonlySet<string>;
  isFirst: boolean; isLast: boolean; validating: boolean;
};

// Поток без сборки
function createFormFlow(options: {
  steps: readonly string[];
  validateStep?: (stepId: string) => Promise<ValidationResult>; // без неё шаги без проверки
}): FormFlow;
```

### Проверка и отправка

| Вызов                  | Какие правила                                  | Что делает с нодами                                   |
| ---------------------- | ---------------------------------------------- | ----------------------------------------------------- |
| `bundle.validate()`    | полный набор (`rules` либо шаги + `extras`)    | разносит замечания, проверенные поля — `touched`      |
| `bundle.validateStep(id)` | правила шага `id`; шаг без правил — `valid` | разносит замечания, поля шага — `touched`             |
| `bundle.submit(handler)` | один прогон полного набора                   | не `valid` — вся форма `touched`, обработчик не зовётся |
| `flow.next()`          | правила текущего шага (`validateStep`)         | как `validateStep`; при успехе — переход              |

- `ValidationResult` — `{ status, issues, failures }`: `status` — `valid | invalid | error |
  cancelled`, `issues` — замечания по ручке поля, `failures` — правила, не вернувшие результат.
- Без правил `validate()` отвечает `valid`; `submit` при этом сразу зовёт обработчик.
- Обработчик получает `model.get()` — значения модели целиком; лишние для сервера (вычисляемые)
  поля отрезает он сам.
- `submitting` истинен, пока работает обработчик; `validating` — пока идёт проверка.
- Обработчик получает то, что видели правила: если модель изменилась, пока шла проверка отправки
  (правка поля, загрузка, запись поведения после таймера или запроса), `submit` отвечает
  `cancelled` и обработчик не зовёт — отправку повторяют.
- Правила читают модель в момент вызова. Исключение — вызов `validate` / `validateStep` /
  `submit` / `flow.next()` в одном тике со сборкой формы или правкой поля: поведение ещё пишет
  отложенно (колбэк `onChange`, сброс `resetOnDisable`), проверка дожидается этих записей и
  читает модель после них; `validating` поднят сразу. Раннеры без сборки (`validateModel`,
  `runValidation`) исполняют правила в момент вызова.
- `validate()` переводит стратегию `afterFirstSubmit` в живую фазу. Живую проверку армирует
  `useFormBundle` в эффекте (на сервере не армируется).
- `rules` и `extras` — стабильные ссылки (`defineValidation` в модуле): отмена устаревших прогонов
  ключится по паре «модель + правила».

### Правила переходов потока

- `next()` на шаге с замечаниями — `stayed` с причиной `invalid` / `error` / `cancelled` и
  результатом проверки в `validation`. На последнем шаге — `stayed`, `reason: 'edge'` (шаг при этом
  отмечается пройденным).
- Пока шла проверка, поток перевели или сбросили — `stayed`, `reason: 'cancelled'`.
- `previous()` на первом шаге — `stayed`, `reason: 'edge'`. Назад: пройденными остаются только шаги
  до цели.
- `goTo(id)`: первый шаг доступен всегда, остальные — после прохождения предыдущего; иначе
  `stayed`, `reason: 'locked'`. Неизвестный `id` — исключение.
- Повтор `id` в `flow.steps` — исключение при сборке. Шаг, для которого в корневой области схемы
  нет узла с таким `selector`, — dev-предупреждение (если хотя бы один шаг узел нашёл).

## Examples

### Сборка с потоком шагов

```typescript
// flow/credit-flow.ts — шаг объявлен один раз: id = selector узла шага
import type { FormFlowConfig, FormValidation } from '@reformer/core';

export const creditFlow: FormFlowConfig<CreditForm> = {
  steps: [
    { id: 'loan', rules: loanRules },
    { id: 'applicant', rules: applicantRules },
    { id: 'confirm' }, // шаг без правил
  ],
};

// правила вне шагов — проверяются только целиком (submit, validate)
export const creditValidation: FormValidation<CreditForm> = { extras: crossStepRules };
```

```tsx
import { createForm } from '@reformer/core';
import { useFormBundle } from '@reformer/core/react';

const createCredit = () =>
  createForm<CreditForm>({
    model: createCreditModel(),
    schema: creditSchema, // узлы шагов несут selector: 'loan', 'applicant', 'confirm'
    behavior: creditBehavior,
    validation: creditValidation,
    flow: creditFlow,
  });

function CreditPage() {
  const credit = useFormBundle(createCredit); // фабрика вызывается один раз
  // …
}
```

### Визард ui-kit — поток сборки

```tsx
import { FormWizard } from '@reformer/ui-kit';
import { ValidationMessagesProvider } from '@reformer/cdk';

function CreditWizard() {
  const credit = useFormBundle(createCredit);

  const send = async () => {
    const outcome = await credit.submit(sendApplication);
    if (outcome.status === 'submitted') showToast(`Заявка ${outcome.result.id} отправлена`);
    else if (outcome.status === 'invalid') showToast('Проверьте форму');
    else if (outcome.status === 'error') showToast('Не удалось проверить форму, повторите');
    else if (outcome.status === 'failed') showToast('Сервер недоступен');
  };

  return (
    <ValidationMessagesProvider messages={creditMessages}>
      <FormWizard form={credit.form} flow={credit.flow} steps={STEPS} onSubmit={send} />
    </ValidationMessagesProvider>
  );
}
```

- `flow={credit.flow}` — визард рисует поток и зовёт его переходы; «Далее» — `flow.next()`, при
  замечаниях шаг остаётся, поля показываются.
- Визард внутри рендерера (`FormRenderer` кладёт сборку в контекст) берёт `form` и `flow` из
  сборки сам; его `onSubmit` зовётся через `bundle.submit` — только после успешной проверки всей
  формы.
- Без `flow` и без сборки в контексте визард строит позиционный поток **без правил**.

### Свои кнопки — `useFormFlow`

```tsx
import type { FormBundle } from '@reformer/core';
import { useFormFlow } from '@reformer/core/react';

function StepActions({ bundle }: { bundle: FormBundle<CreditForm> }) {
  const flow = bundle.flow!;
  const { current, isFirst, isLast, validating } = useFormFlow(flow);

  const next = async () => {
    const transition = await flow.next();
    if (transition.status === 'stayed' && transition.reason === 'error') {
      showToast('Не удалось проверить шаг, повторите');
    }
  };

  return (
    <div data-step={current}>
      {!isFirst && <button onClick={() => flow.previous()}>Назад</button>}
      {isLast ? (
        <button onClick={() => void bundle.submit(sendApplication)}>Отправить</button>
      ) : (
        <button disabled={validating} onClick={() => void next()}>
          Далее
        </button>
      )}
    </div>
  );
}
```

### Поток в поведении

Область поведения получает поток сборки: `defineFormBehavior(({ model, form, schema, flow }) => …)`.
Без `flow` в конфиге он `undefined`; поведения подформ и строк (`apply`, `applyEach`) получают тот
же поток.

```typescript
import { defineFormBehavior, renderEffect } from '@reformer/core/behaviors';

export const navigationBehavior = defineFormBehavior<CreditForm>(({ model, schema, flow }) => {
  // смена типа на ипотеку возвращает к шагу кредита
  renderEffect(schema, () => {
    if (model.loanType === 'mortgage') flow?.goTo('loan');
  });
});
```

### Проверка шага и всей формы без перехода

```typescript
const step = await credit.validateStep('applicant'); // ValidationResult
if (step.status === 'invalid') scrollToFirstIssue();

const all = await credit.validate();
if (all.status === 'error') console.warn(all.failures); // какое async-правило не ответило
```

### Ответ сервера — замечания в поля

```typescript
// статус 'submitted' значит «обработчик отработал»; отказ сервера — дело обработчика
const outcome = await credit.submit(async (values) => {
  const response = await api.send(values);
  if (response.status === 422) {
    for (const [field, code] of Object.entries(response.fieldCodes)) {
      credit.form.$[field as keyof CreditForm]?.setIssues([{ code }]);
    }
  }
  return response;
});
```

### Поток без сборки

```typescript
import { createFormFlow } from '@reformer/core';
import { applyValidationResult, runValidation } from '@reformer/core/validation';

const STEP_RULES = { loan: loanRules, confirm: confirmRules } as const;

const flow = createFormFlow({
  steps: ['loan', 'confirm'],
  validateStep: async (id) => {
    const result = await runValidation(model, STEP_RULES[id as keyof typeof STEP_RULES]);
    if (result.status !== 'cancelled') applyValidationResult(result, { touch: true });
    return result;
  },
});
await flow.next(); // { status: 'moved', from: 'loan', to: 'confirm' } либо 'stayed'
```

Обычно это не нужно: `createForm({ flow })` собирает такой поток сам, а визард без потока
строит позиционный.

## Anti-patterns

```typescript
// ❌ Шаги ключами validation.steps — удалено
createForm({ model, schema, validation: { steps: { loan: loanRules }, extras } });

// ✅ Шаги — поток сборки; правила вне шагов — extras
createForm({ model, schema, validation: { extras }, flow: { steps: [{ id: 'loan', rules: loanRules }] } });
```

```typescript
// ❌ Результат проверки как boolean
if (await credit.validate()) send(); // объект всегда truthy

// ✅ Статус результата
if ((await credit.validate()).status === 'valid') send();
// для отправки — submit: проверка и обработчик одним вызовом
await credit.submit(send);
```

```typescript
// ❌ Переход как boolean
if (await flow.next()) track('step');

// ✅ Статус перехода
const transition = await flow.next();
if (transition.status === 'moved') track(transition.to);
```

```typescript
// ❌ Прыжок вперёд через непройденный шаг — 'locked', поток не двигается
flow.goTo('confirm');

// ✅ Вперёд — next() (он проверяет шаг); goTo — назад и на уже открытые шаги
if (flow.canGoTo('confirm')) flow.goTo('confirm');
```

```typescript
// ❌ Номер шага с единицы — прежний контракт; параметр — строка, номер не скомпилируется
credit.validateStep(1);

// ✅ Идентификатор шага — selector узла шага
credit.validateStep('loan');
```

```typescript
// ❌ Отправка в обход проверки
await sendApplication(credit.model.get());

// ✅ bundle.submit: один прогон всех правил, обработчик — только при valid
await credit.submit(sendApplication);
```

## See also

- [13-multi-step.md](./13-multi-step.md) — многошаговая форма: правила шагов, визард, раскладка
- [28-submit-and-reset.md](./28-submit-and-reset.md) — отправка, сброс, серверные ошибки
- [33-validation-strategy.md](./33-validation-strategy.md) — живая проверка: `strategy`, `debounce`
- [36-issue-messages.md](./36-issue-messages.md) — тексты замечаний
- [37-compiled-schema.md](./37-compiled-schema.md) — `selector`, области и `bundle.render.tree`
