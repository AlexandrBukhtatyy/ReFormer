---
sidebar_position: 1
---

# Структура проекта

Одна форма — один модуль-папка. Раскладок две: **плоская** — по умолчанию, файл на каждую
обязанность в корне модуля; **по папкам** — для больших форм, по папке на слой. Эталон второй
раскладки — многошаговая кредитная заявка из `react-playground`.

## Плоская раскладка

```
forms/
└── credit-application/          # Модуль формы — один файл на обязанность
    ├── index.tsx                # сборка createForm + разметка (все шаги инлайн)
    ├── types.ts                 # тип формы + enum'ы + тип опции { value, label }
    ├── model.ts                 # createModel + начальные значения + шаблоны строк массивов
    ├── form.schema.ts           # дерево схемы: { model: model.$.x, component, componentProps }
    ├── form.behavior.ts         # defineFormBehavior: compute / enableWhen / onChange / правила узлов
    ├── form.validation.ts       # ВСЕ правила валидации формы
    ├── data-sources.ts          # опции + асинхронные загрузчики
    └── api.ts                   # загрузка и отправка
```

| Файл                 | За что отвечает                                                                     |
| -------------------- | ----------------------------------------------------------------------------------- |
| `types.ts`           | тип формы, enum'ы полей, тип `{ value, label }` для опций                           |
| `model.ts`           | `createModel<T>(initial)` — источник истины для значений; шаблоны строк — `arrayOf` |
| `form.schema.ts`     | дерево разметки: привязка полей к модели, `component`, `componentProps`, `selector` |
| `form.behavior.ts`   | реакции: вычисляемые поля, доступность, правила узлов схемы (`hideWhen`, события)   |
| `form.validation.ts` | `defineValidation` — правила формы; у визарда — правила шагов для потока `flow`     |
| `data-sources.ts`    | словари опций и загрузчики (держим их вне схемы)                                    |
| `api.ts`             | загрузка и отправка — обработчик для `bundle.submit`                                |
| `index.tsx`          | фабрика `createXxxForm()` (один `createForm`) + разметка                            |

:::note Одно правило имён — `form.<роль>`
Всё, что описывает саму форму, называется `form.<роль>`: `form.schema.ts` (разметка),
`form.behavior.ts` (поведение), `form.validation.ts` (правила). Общие файлы модуля — без префикса:
`types.ts`, `model.ts`, `data-sources.ts`, `api.ts`. Прежние имена `renderer.schema.*`,
`renderer.behavior.ts`, `validation.ts`, а также `form.render.ts` и `wizard.tsx` прежнего
контракта работают, но `validate_form kind="layout"` в MCP предупреждает о них: правила узлов
схемы теперь живут в `form.behavior.ts`, визард — библиотечный.
:::

## Сборка формы

Файлы соединяются одним вызовом `createForm`: модель, дерево схемы, поведение и правила — одна
сборка. Её же отдают рендереру, если форма рисуется по схеме.

```typescript title="forms/credit-application/model.ts"
import { createModel, type FormModel } from '@reformer/core';
import type { CreditApplicationForm } from './types';

export const createCreditApplicationModel = (): FormModel<CreditApplicationForm> =>
  createModel<CreditApplicationForm>({
    loanType: 'consumer',
    loanAmount: null,
    propertyValue: null,
    monthlyPayment: null,
    // …начальные значения всех полей
  });
```

```typescript title="forms/credit-application/form.schema.ts"
import type { FormModel, FormSchemaNode } from '@reformer/core';
import { InputNumber, SelectAsync } from '@reformer/ui-kit';
import { LOAN_TYPES } from './data-sources';
import type { CreditApplicationForm } from './types';

// Дерево разметки: привязка полей и компоненты — без валидаторов. Дети — только в `children`.
export const creditApplicationSchema = (
  model: FormModel<CreditApplicationForm>
): FormSchemaNode => ({
  children: [
    {
      model: model.$.loanType,
      component: SelectAsync,
      componentProps: { label: 'Тип кредита', options: LOAN_TYPES },
    },
    { model: model.$.loanAmount, component: InputNumber, componentProps: { label: 'Сумма' } },
    {
      model: model.$.propertyValue,
      component: InputNumber,
      componentProps: { label: 'Стоимость недвижимости' },
    },
    { model: model.$.monthlyPayment, component: InputNumber, disabled: true },
  ],
});
```

```typescript title="forms/credit-application/form.validation.ts"
import { defineValidation, validate } from '@reformer/core/validation';
import { required, min } from '@reformer/core/validators';
import type { CreditApplicationForm } from './types';

// Правила несут код замечания; текст по коду — в словаре формы (defineIssueMessages).
export const creditApplicationRules = defineValidation<CreditApplicationForm>(({ model }) => {
  validate(model.$.loanType, [required({ code: 'loanType.required' })]);
  validate(model.$.loanAmount, [required(), min(50000)]);
});
```

```typescript title="forms/credit-application/form.behavior.ts"
import { defineFormBehavior, compute, enableWhen } from '@reformer/core/behaviors';
import type { CreditApplicationForm } from './types';

export const creditApplicationBehavior = defineFormBehavior<CreditApplicationForm>(({ model }) => {
  enableWhen(model.$.propertyValue, () => model.loanType === 'mortgage', {
    resetOnDisable: true,
  });
  // упрощённый расчёт; реальную формулу вынесите в чистую функцию
  compute(model.$.monthlyPayment, () => (model.loanAmount ?? 0) / 12);
});
```

```tsx title="forms/credit-application/index.tsx"
import { createForm } from '@reformer/core';
import { useFormBundle } from '@reformer/core/react';
import { FormField } from '@reformer/ui-kit';
import { createCreditApplicationModel } from './model';
import { creditApplicationSchema } from './form.schema';
import { creditApplicationBehavior } from './form.behavior';
import { creditApplicationRules } from './form.validation';
import type { CreditApplicationForm } from './types';

// Одна фабрика — один createForm: модель, схема, поведение, правила.
export const createCreditApplicationForm = () =>
  createForm<CreditApplicationForm>({
    model: createCreditApplicationModel(),
    schema: creditApplicationSchema, // билдер (model) => дерево
    behavior: creditApplicationBehavior,
    validation: creditApplicationRules,
  });

export function CreditApplicationPage() {
  // Фабрика вызывается ровно один раз — сборка стабильна между рендерами.
  const bundle = useFormBundle(createCreditApplicationForm);
  const { form } = bundle;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    void bundle.submit(submitApplication); // обработчик из api.ts; при замечаниях не вызывается
  };

  return (
    <form onSubmit={handleSubmit}>
      <FormField control={form.loanType} />
      <FormField control={form.loanAmount} />
      <FormField control={form.propertyValue} />
      <FormField control={form.monthlyPayment} />
    </form>
  );
}
```

У многошаговой формы правила раскладываются по шагам потока:
`createForm({ validation: { extras: crossStepRules }, flow: { steps: [{ id: 'loan', rules: loanRules }, …] } })`
— см. [FormWizard](../cdk/form-wizard).

## Тип формы: ввод и расчёт

Тип формы объявляйте `interface` или `type` — сборке подходит любой объектный тип. Если в форме
есть вычисляемые поля (цели `compute`), удобно развести типы: **ввод** — то, что заполняет
пользователь и что уходит на сервер, и **расчёт** — то, что пишет поведение. Форма — их
пересечение.

```typescript title="types/credit-application.ts"
/** Ввод заявки — то, что заполняет пользователь и что уходит на сервер. */
export interface CreditApplication {
  loanType: LoanType;
  loanAmount: number | null; // пустое числовое поле — null
  loanTerm: number;
  // …
}

/** Вычисляемые поля — их пишет поведение формы, сервер считает их сам. */
export interface CreditApplicationDerived {
  interestRate: number;
  monthlyPayment: number;
}

export type CreditApplicationForm = CreditApplication & CreditApplicationDerived;
```

Перед отправкой вычисляемые поля отрезаются: обработчик `bundle.submit` получает значения формы
и отдаёт на сервер только ввод (`toApplicationPayload(values)`). Список ключей сверяется с типом
`CreditApplicationDerived`, поэтому новое вычисляемое поле не уедет на сервер незамеченным.

:::tip Опциональные числа — `number | null`
Числа, которые пользователь может очистить, объявляйте как `number | null` (конвенция «поле
пустое»). Встроенные валидаторы (`min`, `max`, `minLength`, …) пропускают пустые значения.
:::

## Стабильность сборки — `useFormBundle`

В React сборку создают **один раз** хуком `useFormBundle(factory)` из `@reformer/core/react`. Он
зовёт фабрику ленивым инициализатором `useState` и армирует живую проверку
(`validation.strategy`). `useMemo` для этого не годится: React вправе сбросить его кэш и пересобрать
форму, потеряв введённое.

```tsx
import { useFormBundle } from '@reformer/core/react';
import { createCreditApplicationForm } from './index';

export function CreditApplicationView() {
  const bundle = useFormBundle(createCreditApplicationForm); // ровно одна сборка
  // …разметка
}
```

:::warning Не собирайте форму в теле компонента
`createModel` / `createForm` прямо в рендере — источник «мигающих» форм и потерянного ввода.
Всегда оборачивайте сборку в `useFormBundle(() => …)`.
:::

## Передача формы в дочерние компоненты — через props

Форму (и отдельные ноды) передавайте вниз **явными props** типа `FormGroup<T>` / `FormControl<T>` /
`FormArray<T>`. Явная передача делает компоненты предсказуемыми и тестируемыми: каждый видит ровно ту
ноду, с которой работает.

```tsx
import type { FormGroup } from '@reformer/core';

function LoanStep({ control }: { control: FormGroup<CreditApplicationForm> }) {
  return (
    <section>
      <FormField control={control.loanType} />
      <FormField control={control.loanAmount} />
    </section>
  );
}
```

Строки массива меняются через саму ноду массива (`form.properties.push()`,
`form.properties.removeAt(i)`) или через модель (`model.properties.push(…)`) — компоненту строки
достаточно пропа с нодой.

:::info Почему не свой context
Форма реактивна на уровне нод: подписки идут через хуки (`useFormControl` и т.п.), а не через
контекст. Проброс пропсом ничего не перерисовывает лишнего и оставляет граф зависимостей явным.
Контекст сборки (`FormBundleContext`) ставит рендерер — из него форму и поток берёт визард в схеме;
в разметке руками он не обязателен.
:::

## Масштабирование: папки

Когда плоский модуль становится неудобным — визард из многих шагов, подформы на нескольких шагах,
правила, которые не помещаются в один файл, — модуль делят по **слоям**, по папке на слой. Так
устроена эталонная кредитная заявка (`projects/react-playground/src/pages/demo/complex-multy-step-form`).

| Папка          | На какой вопрос отвечает                               |
| -------------- | ------------------------------------------------------ |
| `model/`       | какие данные держит форма и с чего она начинается      |
| `schema/`      | как форма разложена на экране                          |
| `validation/`  | что считается верным значением и как о нём сказать     |
| `behavior/`    | как значения и состояние полей реагируют друг на друга |
| `flow/`        | какие шаги проходит пользователь и в каком порядке     |
| `application/` | как форма собирается, загружается и отправляется       |
| `api/`         | HTTP-запросы                                           |
| `components/`  | React-разметка: шаги, подформы, общие куски UI         |

```
credit-application/
├── CreditApplicationForm.tsx      # точка входа «React руками»: сборка + FormWizard
├── model/
│   ├── model.ts                   # createCreditApplicationModel — реактивная модель
│   ├── initial-value.ts           # начальные значения; шаблоны строк — arrayOf(blank)
│   ├── predicates.ts              # условия, общие для поведения, правил и JSX
│   └── factories/                 # пустые значения подформ и строк массивов
├── schema/
│   ├── form.ts                    # дерево: загрузка → визард → шаги из потока
│   ├── steps/                     # содержимое каждого шага (массив узлов)
│   └── sections/                  # секции, подформы (part) и строки массивов (item)
├── validation/
│   ├── form.ts                    # FormValidation сборки: { extras: crossStepRules }
│   ├── messages.ts                # словарь текстов замечаний — defineIssueMessages
│   ├── common/                    # общие наборы правил, правила подформ и строк
│   ├── loan.ts                    # правила одного шага — файл на шаг
│   ├── contacts.ts
│   └── cross-step.ts              # правила формы целиком (проверяются при отправке)
├── behavior/
│   ├── index.ts                   # поведение формы, собранное из частей ниже
│   ├── derived.ts                 # вычисляемые поля
│   ├── conditions.ts              # доступность полей и видимость секций
│   ├── synchronization.ts         # копирование, очистка списков
│   ├── dynamic-options.ts         # опции и ограничения, зависящие от значений
│   └── operators.ts               # свои операторы поверх встроенных
├── flow/
│   └── credit-application-flow.ts # шаги: selector, заголовок, значок, разметка, правила
├── application/
│   ├── create.ts                  # ОДИН createForm на все способы рендера
│   ├── load.ts                    # сеть: заявка и справочники
│   ├── mapping.ts                 # ответ сервера → модель (model.patch + captureInitial)
│   ├── payload.ts                 # toApplicationPayload — тело запроса без вычисляемых полей
│   ├── submit.ts                  # обработчик bundle.submit и сообщение о результате
│   └── renderer.ts                # правила узлов для рендерера: загрузка, отправка, навигация
├── api/                           # HTTP-запросы
├── components/                    # steps/, nested-forms/, ui/
└── types/  constants/  utils/     # тип формы, словари опций, чистые расчёты
```

Шаг объявлен **один раз** — в потоке: идентификатор (он же `selector` узла шага), заголовок, значок,
разметка и правила. Из этого списка строятся узлы шагов схемы и шаги потока сборки, поэтому связать
разметку одного шага с правилами другого негде:

```typescript title="flow/credit-application-flow.ts"
import type { FormFlowConfig } from '@reformer/core';

export const creditApplicationFlow = [
  { selector: 'loan', title: 'Кредит', icon: '💰', content: loanStep, rules: loanRules },
  {
    selector: 'contacts',
    title: 'Контакты',
    icon: '📞',
    content: contactsStep,
    rules: contactsRules,
  },
  {
    selector: 'confirmation',
    title: 'Подтверждение',
    icon: '✓',
    content: confirmationStep,
    rules: null,
  },
] as const;

// Поле `flow` сборки: id шага — его selector, правила — правила шага.
export const creditApplicationFlowSteps: FormFlowConfig<CreditApplicationForm> = {
  steps: creditApplicationFlow.map((step) => ({ id: step.selector, rules: step.rules })),
};
```

```typescript title="application/create.ts"
import { createForm, type CreateFormConfig } from '@reformer/core';

type Overrides = Pick<CreateFormConfig<CreditApplicationForm>, 'schema' | 'registry' | 'setup'>;

// Одна сборка на все способы реализации: JSON-вариант передаёт документ схемы и реестр,
// renderer-варианты — `setup` со связкой узлов.
export const createCreditApplication = (overrides: Overrides = {}) =>
  createForm<CreditApplicationForm>({
    model: createCreditApplicationModel(),
    schema: creditApplicationSchema,
    behavior: creditApplicationBehavior,
    validation: creditApplicationValidation, // { extras: crossStepRules }
    flow: creditApplicationFlowSteps,
    ...overrides,
  });
```

Зависимости направлены в одну сторону: `application → flow → schema/steps, validation/<шаг>`;
`application → behavior → model`. Ниже `application/` никто не знает ни идентификатора заявки, ни
сети, ни рендерера. `model` / `behavior` / `validation` при этом **общие** для всех способов
реализации — React руками, рендерер по TS-схеме, рендерер по JSON; меняется только то, что
передаётся в `create.ts` сверху.

## Визард: папка на шаг

Промежуточный вариант между плоской раскладкой и папками по слоям: код шага держится рядом с шагом.
Папка названа по заголовку шага (`Контакты` → `kontakty`), без номера: порядок задаёт агрегатор
`steps/index.ts`, поэтому перестановка шагов папки не трогает. Имена внутри папки — те же, что в
корне.

```
forms/credit-application/
├── form.validation.ts          # правила вне шагов (extras)
├── form.behavior.ts            # поведение формы, межшаговое
└── steps/
    ├── index.ts                # шаги по порядку: id, правила, схемы
    ├── kredit/
    │   ├── form.validation.ts  # правила полей шага → rules шага потока
    │   ├── form.behavior.ts    # поведение в пределах шага
    │   └── form.schema.json    # разметка шага (renderer-json, опционально)
    └── kontakty/…
```

Межшаговые правила и поведение остаются в корневых файлах. «Далее» проверяет только правила
текущего шага потока.

У renderer-json документ схемы тоже можно разрезать по шагам: в `children` визарда корневого
`form.schema.json` стоят ссылки `{ "$ref": "./steps/<шаг>/form.schema.json" }`, файл шага —
`{ "$schema", "node": … }`, а `index.tsx` собирает документ
`composeJsonFormSchema(document, stepSchemas)` до `createForm`. Билдер открывает такую форму как
одну и сам раскладывает правки по файлам шагов; команды «Разбить визард по файлам шагов» и «Собрать
форму в один файл» переключают раскладку.

## Правила

| Правило                          | Зачем                                                       |
| -------------------------------- | ----------------------------------------------------------- |
| Начинать с плоской раскладки     | один файл на обязанность; без преждевременных папок         |
| Один `createForm` на форму       | модель, схема, поведение, правила и поток — одна сборка     |
| Собирать форму в `useFormBundle` | стабильная сборка, форма не теряет состояние                |
| Пробрасывать форму пропсами      | предсказуемость и тестируемость вместо неявного контекста   |
| Правила — в `form.validation.ts` | одно место, куда смотреть; тексты — в словаре `messages.ts` |
| Шаг объявлен один раз — в потоке | разметка и правила шага не расходятся                       |
| Data sources — отдельный файл    | схема читаемее, renderer-json ссылается по имени            |

## Дальше

- [Композиция схем](../core-concepts/schemas/composition) — переиспользуемые части схемы и правила.
- [FormWizard](../cdk/form-wizard) — поток шагов и отправка визарда.
- [React-хуки](../react/hooks) — чтение состояния нод в компонентах.
- [Behaviors](../behaviors/overview) — вычисляемые поля и условная логика.
