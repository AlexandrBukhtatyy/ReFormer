---
sidebar_position: 1
---

# Структура проекта

Одна форма — один модуль-папка. **Раскладка по умолчанию — плоская:** каждый concern живёт в
отдельном файле в корне модуля, а вся форма (сборка + все шаги инлайн) — в одном `index.tsx`. Папки
(`lib/` / `schema/` / `components/`) заводят только когда форма разрастётся.

## Плоская раскладка

```
forms/
└── credit-application/          # Модуль формы — один файл на concern
    ├── index.tsx                # сборка формы + разметка (все шаги инлайн)
    ├── types.ts                 # тип формы + enum'ы + тип опции { value, label }
    ├── model.ts                 # createModel + начальные значения + фабрики элементов массива
    ├── form.schema.ts           # схема: { value: model.$.x, component, componentProps }
    ├── form.behavior.ts         # defineFormBehavior: compute / enableWhen / onChange
    ├── validation.ts            # ВСЯ валидация формы
    ├── data-sources.ts          # опции + асинхронные загрузчики
    └── api.ts                   # submit + prefill
```

| Файл               | За что отвечает                                                          |
| ------------------ | ------------------------------------------------------------------------ |
| `types.ts`         | тип формы (`type`-алиас), enum'ы полей, тип `{ value, label }` для опций |
| `model.ts`         | `createModel<T>(initial)` — источник истины для значений                 |
| `form.schema.ts`   | привязка полей к сигналам модели, `component` и `componentProps`         |
| `form.behavior.ts` | реактивные правила: вычисляемые поля, условная доступность, реакции      |
| `validation.ts`    | `defineValidationSchema` (все правила) + запуск `validateModel`          |
| `data-sources.ts`  | словари опций и загрузчики (держим их вне схемы)                         |
| `api.ts`           | отправка и предзаполнение                                                |
| `index.tsx`        | сборка `createXxxForm()` + разметка                                      |

:::note Почему dot-префикс у schema/behavior
Только у `schema` и `behavior` есть два слоя — модельный (`form.schema.ts`, `form.behavior.ts`) и
рендер-слой у renderer-пакетов (`renderer.schema.*`, `renderer.behavior.ts`). Остальные concern'ы
общие на всю форму, поэтому их файлы плоские: `types.ts`, `model.ts`, `validation.ts`, …
:::

## Сборка формы

Файлы соединяются в одну фабрику `createXxxForm()`: модель → схема → behavior → `createForm`.

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
import type { FormModel } from '@reformer/core';
import { Input, Select } from '@reformer/ui-kit';
import { LOAN_TYPES } from './data-sources';
import type { CreditApplicationForm } from './types';

// Layout-схема: только component/componentProps — без валидаторов
export const creditApplicationSchema = (model: FormModel<CreditApplicationForm>) => ({
  loanType: {
    value: model.$.loanType,
    component: Select,
    componentProps: { label: 'Тип кредита', options: LOAN_TYPES },
  },
  loanAmount: {
    value: model.$.loanAmount,
    component: Input,
    componentProps: { label: 'Сумма', type: 'number' },
  },
  monthlyPayment: { value: model.$.monthlyPayment, component: Input, disabled: true },
});
```

```typescript title="forms/credit-application/validation.ts"
import { defineValidationSchema, validate } from '@reformer/core/validation';
import { required, min } from '@reformer/core/validators';
import type { CreditApplicationForm } from './types';

// Отдельная схема валидации; запуск: await validateModel(model, creditApplicationValidation)
export const creditApplicationValidation = defineValidationSchema<CreditApplicationForm>(
  ({ model }) => {
    validate(model.$.loanType, [required()]);
    validate(model.$.loanAmount, [required(), min(50000)]);
  }
);
```

```typescript title="forms/credit-application/form.behavior.ts"
import { defineFormBehavior, compute, enableWhen } from '@reformer/core/behaviors';
import type { CreditApplicationForm } from './types';

export const creditApplicationBehavior = defineFormBehavior<CreditApplicationForm>(({ model }) => {
  enableWhen([model.$.propertyValue], () => model.loanType === 'mortgage', {
    resetOnDisable: true,
  });
  // упрощённый расчёт; реальную формулу вынесите в helper из lib
  compute(model.$.monthlyPayment, () => (model.loanAmount ?? 0) / 12);
});
```

```typescript title="forms/credit-application/index.tsx"
import { useMemo } from 'react';
import { createForm } from '@reformer/core';
import { createCreditApplicationModel } from './model';
import { creditApplicationSchema } from './form.schema';
import { creditApplicationBehavior } from './form.behavior';
import type { CreditApplicationForm } from './types';

// Одна фабрика собирает форму: model → schema → behavior → createForm
export const createCreditApplicationForm = () => {
  const model = createCreditApplicationModel();
  return {
    model,
    form: createForm<CreditApplicationForm>({
      model,
      schema: creditApplicationSchema(model),
      behavior: creditApplicationBehavior,
    }),
  };
};
```

## Тип формы — `type`, а не `interface`

Всё, что попадает в `FormProxy<T>` (корневую форму, вложенные группы, тип элемента массива),
объявляйте через **`type`-алиас**. Интерпретатору схемы нужна индекс-сигнатура
(`Record<string, …>`): у `type` она есть структурно, у `interface` — нет.

```typescript title="forms/credit-application/types.ts"
export type LoanType = 'consumer' | 'mortgage' | 'car';

export type PropertyItem = {
  type: 'apartment' | 'house' | 'car';
  estimatedValue: number;
};

// ✅ type-алиас — структурная индекс-сигнатура
export type CreditApplicationForm = {
  loanType: LoanType;
  loanAmount: number | null;
  propertyValue: number | null;
  monthlyPayment: number | null;
  properties: PropertyItem[];
};
```

```typescript
// ❌ interface — не подойдёт как форма/элемент массива
interface CreditApplicationForm {
  /* … */
}
```

:::tip Опциональные числа — `number | null`
Числа, которые пользователь может очистить, объявляйте как `number | null` (конвенция «поле
пустое»). Встроенные валидаторы (`min`, `max`, `minLength`, …) пропускают пустые значения.
:::

## Стабильность инстанса — `useMemo`

В React модель и форму создают **один раз** через `useMemo(() => …, [])`. Без этого на каждый
рендер пересоздавались бы модель, схема и ноды — форма теряла бы состояние.

```tsx
import { useMemo } from 'react';
import { createCreditApplicationForm } from './index';

export function CreditApplicationView() {
  // Пустой массив зависимостей → форма собирается ровно один раз
  const { form, model } = useMemo(() => createCreditApplicationForm(), []);

  // …разметка со всеми шагами инлайн
}
```

:::warning Не собирайте форму в теле компонента
`createModel` / `createForm` прямо в рендере (без `useMemo`) — источник «мигающих» форм и
потерянного ввода. Всегда оборачивайте сборку в `useMemo(..., [])`.
:::

## Передача формы в дочерние компоненты — через props

Форму (и отдельные ноды) передавайте вниз **явными props** типа `FormProxy<T>` / `FieldNode<T>`, а
не через React Context. Явная передача делает компоненты предсказуемыми и тестируемыми: каждый
видит ровно ту ноду, с которой работает.

```tsx
import type { FormProxy } from '@reformer/core';

function LoanStep({ form }: { form: FormProxy<CreditApplicationForm> }) {
  return (
    <section>
      <FormField control={form.loanType} />
      <FormField control={form.loanAmount} />
    </section>
  );
}

export function CreditApplicationView() {
  const { form } = useMemo(() => createCreditApplicationForm(), []);
  return <LoanStep form={form} />;
}
```

Дочерний компонент, который **мутирует массив**, дополнительно принимает `model` (мутации идут по
модели: `model.items.push` / `removeAt`) — тоже явным пропом `FormModel<T>`.

:::info Почему не context
Форма уже реактивна на уровне нод: подписки идут через хуки (`useFormControl` и т.п.), а не через
контекст. Проброс `form` пропсом ничего не «перерисовывает лишнего» и оставляет граф зависимостей
явным. Context пришлось бы заводить лишь для очень глубоких деревьев — по умолчанию он не нужен.
:::

## Масштабирование

| Сложность                                  | Раскладка                                                                            |
| ------------------------------------------ | ------------------------------------------------------------------------------------ |
| Простая форма                              | один файл `index.tsx` (модель + схема + behavior + компонент)                        |
| **Плоский модуль**                         | **по умолчанию.** Один файл на concern + `index.tsx` со всеми шагами инлайн          |
| Папки (`lib/` + `schema/` + `components/`) | большие формы: concern'ы по папкам, по компоненту на шаг, переиспользуемые под-формы |

Когда плоский модуль становится неудобным (много шагов, отдельные владельцы, переиспользуемые
под-формы) — вынесите в три папки: `lib/` (доменные помощники), `schema/` (описание формы),
`components/` (React-раскладка), оставив в корне только entry-компонент и `index.ts`.
`model` / `form.behavior` / `validation` / `data-sources` при этом **переиспользуются как есть** —
никогда не дублируйте их между таргетами.

## Правила

| Правило                           | Зачем                                                     |
| --------------------------------- | --------------------------------------------------------- |
| Начинать с плоской раскладки      | один файл на concern; без преждевременных папок           |
| Тип формы через `type`            | нужна структурная индекс-сигнатура для `FormProxy<T>`     |
| Собирать форму в `useMemo(…, [])` | стабильный инстанс, форма не теряет состояние             |
| Пробрасывать форму пропсами       | предсказуемость и тестируемость вместо неявного контекста |
| Вся валидация в `validation.ts`   | одно место, куда смотреть                                 |
| Data sources — отдельный файл     | схема читаемее, renderer-json ссылается по имени          |

## Дальше

- [Композиция схем](../core-concepts/schemas/composition) — переиспользуемые схемы и валидаторы.
- [React-хуки](../react/hooks) — чтение состояния нод в компонентах.
- [Behaviors](../behaviors/overview) — вычисляемые поля и условная логика.
