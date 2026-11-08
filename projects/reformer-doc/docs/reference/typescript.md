---
sidebar_position: 4
---

# TypeScript-рецепты

ReFormer выводит типы полей, нод и правил из одного типа данных формы. Здесь собраны приёмы, при
которых код формы обходится без `any` и приведений `as`.

Страница нужна, когда вы описываете тип своей формы, пишете обобщённые функции над формами или
компилятор ругается на схему, правило или результат проверки. Термины — в
[глоссарии](./glossary.md).

## Тип формы

Тип описывает **данные** формы — то, что лежит в [модели](./glossary.md#форма-и-данные). Сигналов,
нод и компонентов в нём нет. Подходят и `interface`, и `type`: сборка различает их одинаково.

```typescript
interface Address {
  city: string;
  street: string;
}

interface Phone {
  kind: 'mobile' | 'home';
  number: string;
}

export interface Application {
  fullName: string;
  loanAmount: number | null; // поле можно очистить — тогда в нём null
  birthDate: string | null; // дата строкой 'YYYY-MM-DD'
  address: Address;
  phones: Phone[];
  tags: string[];
}
```

Какая [нода](./glossary.md#форма-и-данные) достанется полю, решает вид значения:

| Значение поля                               | Нода в форме     | Пример                       |
| ------------------------------------------- | ---------------- | ---------------------------- |
| обычный объект                              | `FormGroup<T>`   | `form.address.city`          |
| массив объектов                             | `FormArray<T>`   | `form.phones.at(0)`          |
| примитив, массив примитивов, `Date`, `File` | `FormControl<T>` | `form.tags`, `form.fullName` |

### Пустое значение — `null`

Для поля, которое пользователь может очистить, берите `T | null`: `number | null`,
`string | null`. Встроенные правила `min`, `max`, `minLength`, `maxLength`, `minDate`, `maxDate`,
`minAge`, `maxAge` пустое значение пропускают сами — проверка `if (value != null)` не нужна. Пустое
ловит `required()`.

### Ввод и вычисляемые поля — разные типы

Вычисляемые поля (цели `compute`) удобно держать отдельным типом, а форму объявить пересечением.
Тогда видно, что уходит на сервер, а что считает форма:

```typescript
interface ApplicationDerived {
  monthlyPayment: number;
}

export type ApplicationForm = Application & ApplicationDerived;

// Обработчик отправки получает значения формы целиком; на сервер — только ввод.
function toPayload(values: ApplicationForm): Application {
  const { monthlyPayment: _derived, ...input } = values;
  return input;
}
```

## Свои обобщённые функции — `T extends object`

`interface` не приводится к `Record<string, unknown>`: у него нет неявной сигнатуры индекса.
Ограничение в своих функциях пишите через `object`:

```typescript
import type { FormGroup } from '@reformer/core';

// ❌ форму, объявленную через interface, эта функция не примет
function snapshotStrict<T extends Record<string, unknown>>(form: FormGroup<T>): T {
  return form.getValue();
}

// ✅
function snapshot<T extends object>(form: FormGroup<T>): T {
  return form.getValue();
}
```

## Схема — функция над моделью

Схема получает типизированную модель и привязывает узлы к сигналам её полей (`model.$.<поле>`).
Тип узла `FormSchemaNode` закрыт: опечатка в ключе, подформа без `part`, `item` не на массиве и
привязка значением (`model.email` вместо `model.$.email`) не компилируются.

```typescript
import type { FormModel, FormSchemaNode } from '@reformer/core';
import { FieldArray, Input, InputNumber } from '@reformer/ui-kit';

const addressPart = (address: FormModel<Address>): FormSchemaNode => ({
  children: [
    { model: address.$.city, component: Input, componentProps: { label: 'Город' } },
    { model: address.$.street, component: Input, componentProps: { label: 'Улица' } },
  ],
});

const phoneRow = (phone: FormModel<Phone>): FormSchemaNode => ({
  children: [{ model: phone.$.number, component: Input, componentProps: { label: 'Телефон' } }],
});

const applicationSchema = (model: FormModel<ApplicationForm>): FormSchemaNode => ({
  children: [
    { model: model.$.fullName, component: Input, componentProps: { label: 'ФИО' } },
    { model: model.$.loanAmount, component: InputNumber, componentProps: { label: 'Сумма' } },
    { model: model.$.address, part: addressPart }, // подформа получает FormModel<Address>
    { model: model.$.phones, component: FieldArray, item: phoneRow }, // строка — FormModel<Phone>
  ],
});
```

## Правила знают тип поля

Правило — функция значения поля: `Rule<T>` из `@reformer/core/validation`. Список правил для
`model.$.loanAmount` проверяется по типу `number | null`. Своё правило удобно вынести в именованную
константу:

```typescript
import { defineValidation, validate, type Rule } from '@reformer/core/validation';
import { min, required } from '@reformer/core/validators';

const adult: Rule<string | null> = (value) => {
  if (!value) return null;
  const age = new Date().getFullYear() - new Date(value).getFullYear();
  return age < 18 ? { code: 'birthDate.adult', params: { minAge: 18 } } : null;
};

const applicationRules = defineValidation<ApplicationForm>(({ model }) => {
  validate(model.$.loanAmount, [required(), min(50_000)]);
  validate(model.$.birthDate, [required(), adult]);
});
```

Правило между полями — обычная функция над снимком значений формы. Оператор `cross` берётся из
аргумента схемы правил, поэтому тип снимка выведен, и соседние поля читаются без приведений:

```typescript
import type { ValidationIssue } from '@reformer/core';

interface Loan {
  propertyValue: number | null;
  initialPayment: number | null;
}

const paymentWithinValue = (loan: Loan): ValidationIssue | null =>
  loan.initialPayment !== null &&
  loan.propertyValue !== null &&
  loan.initialPayment > loan.propertyValue
    ? { code: 'initialPayment.tooHigh', params: { max: loan.propertyValue } }
    : null;

const loanRules = defineValidation<Loan>(({ model, cross }) => {
  cross(model.$.initialPayment, paymentWithinValue); // замечание ляжет на initialPayment
});
```

Текст замечания по коду `initialPayment.tooHigh` задаёт словарь формы — см.
[Локализацию](/docs/guides/localization).

## Поведение читает модель напрямую

Внутри `compute` модель читается как обычный объект: типы полей выводятся из типа модели, приводить
их не нужно.

```typescript
import { compute, defineFormBehavior } from '@reformer/core/behaviors';

const applicationBehavior = defineFormBehavior<ApplicationForm>(({ model }) => {
  compute(model.$.monthlyPayment, () => Math.round((model.loanAmount ?? 0) / 12));
});
```

## Свой компонент поля

Компонент поля принимает ноду `FormControl<T>`; хук `useFormControl` отдаёт состояние того же
типа:

```tsx
import type { FormControl } from '@reformer/core';
import { useFormControl } from '@reformer/core/react';

function AmountBadge({ control }: { control: FormControl<number | null> }) {
  const { value, disabled } = useFormControl(control);
  return <span aria-disabled={disabled}>{value ?? '—'}</span>;
}
```

Для массива под-форм берите `FormArray<Item>`, для группы — `FormGroup<Group>`. Ноды —
интерфейсы, а не классы, поэтому `instanceof` не работает. Вид неизвестной ноды сужают гарды:

```typescript
import { isFormArray, isFormControl, type FormNode } from '@reformer/core';

function describeNode(node: FormNode<unknown>): string {
  if (isFormArray(node)) return `массив, строк: ${node.length}`;
  if (isFormControl(node)) return `поле, компонент: ${String(node.component)}`;
  return 'группа';
}
```

## Результаты — сужение по `status`

Проверка, отправка и переход по шагам возвращают объединения с полем `status`. Поле результата
становится доступно после проверки `status`, без `as`:

```typescript
import type { FormBundle } from '@reformer/core';

async function send(bundle: FormBundle<ApplicationForm>) {
  const outcome = await bundle.submission.submit((values) => api.send(toPayload(values)));
  if (outcome.status === 'submitted') return outcome.result; // тип ответа api.send
  if (outcome.status === 'failed') throw outcome.error;
  return outcome.validation.status; // 'invalid' | 'error' | 'cancelled'
}

async function goNext(bundle: FormBundle<ApplicationForm>) {
  const transition = await bundle.flow?.next();
  if (transition?.status === 'stayed') console.log(transition.reason); // почему остались на шаге
}
```

## Подводные камни

- **`T extends Record<string, unknown>` в своих функциях** — форма через `interface` не подойдёт.
  Пишите `T extends object`.
- **`as` внутри `compute`** — не нужен: читайте `model.поле`, тип уже выведен.
- **`node instanceof FormControl`** — не скомпилируется: `FormControl` — тип. Используйте
  `isFormControl` / `isFormGroup` / `isFormArray`.
- **Проверка результата как `boolean`** — `if (await bundle.validate())` всегда истинно: результат —
  объект. Сравнивайте `status`.
- **Хуки из `@reformer/core`** — корень ядра без React; хуки и `I18nProvider` импортируются из
  `@reformer/core/react`.

## См. также

- [Модель данных](/docs/core-concepts/model)
- [Ноды формы](/docs/core-concepts/nodes)
- [Свои валидаторы](/docs/validation/custom)
- [Частые проблемы](./faq.md)
