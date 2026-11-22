---
title: 'Массивы, части и шаги'
sidebar_label: 'Массивы, части и шаги'
---

# Массивы, части и шаги

В JSON нельзя записать функцию `(row) => узел`, поэтому строку массива описывает шаблон — узел, пути
в котором считаются от строки. Повторяющийся блок выносится в именованную часть документа и
подключается по имени. Шаги мастера — обычные дети узла мастера.

## Когда это нужно

- В форме есть список строк: телефоны, созаёмщики, позиции заказа.
- Один и тот же блок полей стоит в документе несколько раз — например, два адреса.
- Форма многошаговая, и шаги удобно хранить в отдельных файлах.

## Массив под-форм

```json
{
  "selector": "phones",
  "model": "$model(phones)",
  "component": "$component(FieldArray)",
  "componentProps": { "title": "Телефоны", "itemLabel": "Телефон", "maxItems": 3 },
  "item": {
    "$template": {
      "component": "$component(Box)",
      "children": [
        {
          "model": "$model(label)",
          "component": "$component(Input)",
          "componentProps": { "label": "Метка" }
        },
        {
          "model": "$model(number)",
          "component": "$component(Input)",
          "componentProps": { "label": "Номер" }
        }
      ]
    }
  }
}
```

- `model` — массив модели, `item` — шаблон строки. Без `item` узел — одно поле со значением-массивом.
- Внутри шаблона пути считаются от строки: `$model(number)`, а не `$model(phones.0.number)`.
- `component` рисует список. `$component(FieldArray)` — с кнопками «Добавить» и «Удалить»; без
  `component` строки рисуются без кнопок, в консоли — предупреждение.
- Пропсы `FieldArray` (`title`, `itemLabel`, `maxItems`, подписи кнопок…) — те же, что в схеме на
  TypeScript: см. [Массивы и подформы](../renderer-react/arrays-and-parts.md#какой-компонент-взять).
  Метку-функцию передают через реестр: `"itemLabel": "$fn(phoneLabel)"`.

Новую строку кнопка «Добавить» берёт из шаблона в модели:

```ts
import { arrayOf, createModel } from '@reformer/core';

const blankPhone = () => ({ label: '', number: '' });
export const createContactsModel = () => createModel<Contacts>({ phones: arrayOf(blankPhone) });
```

Если модель создаётся из данных без кода, шаблон можно задать в узле — `"initialValue"`. Шаблон модели
главнее. `initialValue` обязан содержать все ключи строки: поле, которого в нём нет, не получит
сигнала и не нарисуется.

## Список без кнопок

Тот же узел с `$component(List)` из `@reformer/ui-kit` рисует строки без кнопок. Так показывают
предупреждения, бейджи, итоги — список меняет только поведение формы.

```json
{
  "selector": "notices",
  "model": "$model(notices)",
  "component": "$component(List)",
  "componentProps": { "className": "space-y-2" },
  "item": {
    "$template": {
      "component": "$component(Notice)",
      "componentProps": { "tone": "$model(tone)", "text": "$model(text)" }
    }
  }
}
```

`Notice` здесь — ваш компонент с пропсами `tone` и `text`. `$model(...)` в пропсах строки доходит до
него значением. Строки добавляет и убирает поведение:

```ts
import { defineFormBehavior, onChange } from '@reformer/core/behaviors';

export const loanBehavior = defineFormBehavior<LoanForm>(({ model }) => {
  onChange(model.$.amount, (amount) => {
    model.notices.clear();
    if (amount > 1_000_000) model.notices.push({ tone: 'error', text: 'Превышен лимит' });
  });
});
```

## Именованные части

Повторяющийся блок объявляется один раз в `parts` и подключается оператором `$part(name)`:

- узлом-подформой `{ "model": "$model(group)", "part": "$part(name)" }` — к группе модели;
- шаблоном строки `"item": "$part(name)"` — к каждой строке массива.

```json
{
  "format": 2,
  "parts": {
    "address": {
      "component": "$component(Box)",
      "children": [
        {
          "model": "$model(city)",
          "component": "$component(Input)",
          "componentProps": { "label": "Город" }
        },
        {
          "selector": "street",
          "model": "$model(street)",
          "component": "$component(Input)",
          "componentProps": { "label": "Улица" }
        }
      ]
    },
    "coBorrower": {
      "component": "$component(Box)",
      "children": [
        {
          "model": "$model(name)",
          "component": "$component(Input)",
          "componentProps": { "label": "ФИО" }
        },
        {
          "model": "$model(phones)",
          "component": "$component(FieldArray)",
          "componentProps": { "itemLabel": "Телефон" },
          "item": {
            "$template": {
              "model": "$model(number)",
              "component": "$component(Input)",
              "componentProps": { "label": "Номер" }
            }
          }
        }
      ]
    }
  },
  "root": {
    "component": "$component(Box)",
    "children": [
      { "model": "$model(registrationAddress)", "part": "$part(address)" },
      { "model": "$model(residenceAddress)", "part": "$part(address)" },
      {
        "selector": "co-borrowers",
        "model": "$model(coBorrowers)",
        "component": "$component(FieldArray)",
        "componentProps": { "title": "Созаёмщики", "itemLabel": "Созаёмщик" },
        "item": "$part(coBorrower)"
      }
    ]
  }
}
```

- Пути внутри части считаются от места подключения: `$model(city)` в части `address` — это
  `registrationAddress.city` в одном месте и `residenceAddress.city` в другом.
- Часть может подключать другие части и массивы — строка со вложенным списком, как `coBorrower`.
- Подформа подключается только к группе модели. На поле сборка бросит
  `"$model(x)" is not a group of the model`.

## Области схемы

Строка массива и подключённая часть — отдельные области схемы. `selector` внутри них уникален в своей
области: у каждой строки и у каждого адреса свой `street`.

Корневое поведение формы узлы строк и частей не видит. Их правила пишутся в поведении строки или
группы и подключаются `applyEach` и `apply`:

```ts
import { apply, applyEach, defineFormBehavior, hideWhen } from '@reformer/core/behaviors';

const addressBehavior = defineFormBehavior<Address>(({ model, schema }) => {
  hideWhen(schema.node('street'), () => model.city === '');
});

export const loanBehavior = defineFormBehavior<LoanForm>(({ model }) => {
  apply([model.$.registrationAddress, model.$.residenceAddress], addressBehavior);
  applyEach(model.$.coBorrowers, coBorrowerBehavior);
});
```

## Шаги мастера

Мастер — узел-контейнер с `selector`, шаги — его дети. `selector` шага равен `id` шага в потоке
сборки:

```json
{
  "format": 2,
  "root": {
    "selector": "wizard",
    "component": "$component(FormWizard)",
    "componentProps": { "submitLabel": "Отправить заявку" },
    "children": [
      {
        "selector": "loan",
        "component": "$component(Step)",
        "componentProps": { "title": "Кредит" },
        "children": [
          {
            "model": "$model(loanAmount)",
            "component": "$component(InputNumber)",
            "componentProps": { "label": "Сумма, ₽" }
          }
        ]
      },
      {
        "selector": "applicant",
        "component": "$component(Step)",
        "componentProps": { "title": "Заявитель" },
        "children": [
          {
            "model": "$model(fullName)",
            "component": "$component(Input)",
            "componentProps": { "label": "ФИО" }
          }
        ]
      }
    ]
  }
}
```

```ts
import { Step } from '@reformer/cdk/form-wizard';
import { FormWizard } from '@reformer/ui-kit';

// Реестр: мастер и шаг — как есть, без обёрток.
reg.component('FormWizard', FormWizard);
reg.component('Step', Step);

// Сборка: порядок и правила шагов — поток; id шага = selector узла шага.
createForm<LoanForm>({
  model: createLoanModel(),
  schema: loanDocument,
  registry,
  behavior: loanBehavior,
  flow: {
    steps: [
      { id: 'loan', rules: loanRules },
      { id: 'applicant', rules: applicantRules },
    ],
  },
});
```

Мастер берёт форму, поток шагов и отправку из сборки сам — передавать их в документ не нужно.
Обработчик кнопки «Отправить» вешается в поведении:
`onComponentEvent(schema.node('wizard'), 'onSubmit', handler)`. Подробно о мастере —
[FormWizard (CDK)](/docs/cdk/form-wizard).

### Шаги в отдельных файлах

Большой мастер можно разрезать: в `children` мастера — ссылки, каждый шаг — свой файл с ключом
`node`.

```json title="form.schema.json"
{
  "format": 2,
  "root": {
    "selector": "wizard",
    "component": "$component(FormWizard)",
    "children": [
      { "$ref": "./steps/loan/form.schema.json" },
      { "$ref": "./steps/applicant/form.schema.json" }
    ]
  }
}
```

```json title="steps/loan/form.schema.json"
{
  "node": {
    "selector": "loan",
    "component": "$component(Step)",
    "componentProps": { "title": "Кредит" },
    "children": []
  }
}
```

Сборка ссылок не понимает. Соберите документ до `createForm` функцией `composeJsonFormSchema`:

```ts
import {
  composeJsonFormSchema,
  type JsonFormSchema,
  type JsonFormStep,
} from '@reformer/renderer-json';
import skeleton from './form.schema.json';
import loanStep from './steps/loan/form.schema.json';
import applicantStep from './steps/applicant/form.schema.json';

// Ключ — та же ссылка, что в документе; «./» в начале можно опустить.
export const loanDocument = composeJsonFormSchema(skeleton as unknown as JsonFormSchema, {
  './steps/loan/form.schema.json': loanStep as unknown as JsonFormStep,
  './steps/applicant/form.schema.json': applicantStep as unknown as JsonFormStep,
});
```

Нет файла для ссылки — функция бросит ошибку с путём ссылки. Проверять документ
(`validateFormSchema`) нужно уже собранным: несобранная ссылка — ошибка `step reference … is not
resolved`.

## Подводные камни

- **Строки не рисуются** — у узла нет `item`, и он стал обычным полем.
- **`"$model(x)" is not an array of the model`** — узел с `item` привязан не к массиву, или начальное
  значение массива — `null`. Начинайте с пустого массива или `arrayOf(blank)`.
- **«Добавить» бросает ошибку про шаблон** — нет ни `arrayOf(blank)` в модели, ни `initialValue`.
- **`Part "x" not found in the document "parts"`** — опечатка в `$part(...)` или часть не объявлена.
- **Правило на узел строки не срабатывает** — его адресовали из корневого поведения; нужен
  `applyEach` или `apply`.
- **«Шаги схемы и шаги потока расходятся»** — `selector` узла шага не совпадает с `id` в
  `flow.steps`.

## См. также

- [Массивы и подформы](../renderer-react/arrays-and-parts.md) — то же в схеме на TypeScript, свой компонент списка.
- [Массивы](/docs/patterns/arrays) — модель массива и операции над ним.
- [FormWizard (CDK)](/docs/cdk/form-wizard) — поток шагов и отправка мастера.
- [Формат документа](./document-format.md) — узлы и операторы.
