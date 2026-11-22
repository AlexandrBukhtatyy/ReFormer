---
sidebar_position: 1
---

# Структура проекта

Одна форма — одна папка. В ней по файлу на каждую часть формы: тип, модель, схема, правила,
поведение, загрузка и отправка. Так любой файл формы находится по имени, а не поиском.

## Когда нужно

- Вы начинаете новую форму и решаете, как разложить код.
- Файл формы разросся, и в нём трудно найти правило или расчёт.

## Минимальный пример

Рекомендованная раскладка — плоская: все файлы в корне папки формы.

```
forms/credit-application/
├── index.tsx            # createForm и разметка формы
├── types.ts             # тип формы, перечисления, тип опции { value, label }
├── model.ts             # createModel, начальные значения, шаблоны строк arrayOf
├── form.schema.ts       # схема формы: поля и компоненты
├── form.validation.ts   # правила
├── form.behavior.ts     # поведение: расчёты, доступность, правила узлов схемы
├── form.flow.ts         # шаги мастера — если форма многошаговая
├── form.messages.ts     # тексты замечаний по кодам — если нужны свои
├── data-sources.ts      # списки опций и их загрузка
└── api.ts               # загрузка и отправка
```

Правило имён: всё, что описывает саму форму, называется `form.<роль>` — `form.schema.ts`,
`form.validation.ts`, `form.behavior.ts`, `form.flow.ts`, `form.messages.ts`. Остальные файлы — без
префикса.

## Как файлы соединяются

Все части собирает один вызов `createForm` в `index.tsx`. Страница создаёт сборку хуком
`useFormBundle` — один раз за жизнь компонента.

```tsx title="forms/credit-application/index.tsx"
import { createForm } from '@reformer/core';
import { useFormBundle } from '@reformer/core/react';
import { FormField } from '@reformer/ui-kit';
import { submitApplication } from './api';
import { creditApplicationBehavior } from './form.behavior';
import { creditApplicationSchema } from './form.schema';
import { creditApplicationRules } from './form.validation';
import { createCreditApplicationModel } from './model';
import type { CreditApplicationForm } from './types';

// Одна фабрика — один createForm: модель, схема, правила, поведение.
export const createCreditApplicationForm = () =>
  createForm<CreditApplicationForm>({
    model: createCreditApplicationModel(),
    schema: creditApplicationSchema,
    validation: creditApplicationRules,
    behavior: creditApplicationBehavior,
  });

export function CreditApplicationPage() {
  const bundle = useFormBundle(createCreditApplicationForm);
  const { form } = bundle;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void bundle.submission.submit(submitApplication);
      }}
    >
      <FormField control={form.loanType} />
      <FormField control={form.loanAmount} />
    </form>
  );
}
```

У многошаговой формы `form.flow.ts` отдаёт поток шагов, а `createForm` получает его полем `flow` —
см. [FormWizard](/docs/cdk/form-wizard).

## Тип формы: ввод и расчёт

Если в форме есть вычисляемые поля, удобно развести два типа: **ввод** — что заполняет пользователь
и что уходит на сервер, и **расчёт** — что пишет поведение. Тип формы — их пересечение.

```typescript title="forms/credit-application/types.ts"
/** Ввод: заполняет пользователь, уходит на сервер. */
export interface CreditApplication {
  loanType: LoanType;
  loanAmount: number | null; // пустое числовое поле — null
}

/** Расчёт: пишет поведение формы, сервер считает сам. */
export interface CreditApplicationDerived {
  monthlyPayment: number;
}

export type CreditApplicationForm = CreditApplication & CreditApplicationDerived;
```

Перед отправкой обработчик отрезает вычисляемые поля и отдаёт серверу только ввод. Список
отрезаемых ключей сверяют с типом `CreditApplicationDerived`, поэтому новое вычисляемое поле не
уйдёт на сервер незамеченным.

## Масштабирование: папки

Когда плоская папка становится неудобной — мастер из многих шагов, подформы на нескольких шагах,
правила не помещаются в один файл, — форму делят по слоям, по папке на слой:

| Папка          | На какой вопрос отвечает                               |
| -------------- | ------------------------------------------------------ |
| `model/`       | какие данные держит форма и с чего она начинается      |
| `schema/`      | как форма разложена на экране                          |
| `validation/`  | что считается верным значением и как о нём сказать     |
| `behavior/`    | как значения и состояние полей реагируют друг на друга |
| `flow/`        | какие шаги проходит пользователь и в каком порядке     |
| `application/` | как форма собирается, загружается и отправляется       |

Полная раскладка, порядок зависимостей между слоями и вариант «папка на шаг» — в
[Структуре большой формы](./project-structure-large.md).

## Подводные камни

- **Не собирайте форму в теле компонента.** `createForm` прямо в рендере пересоздаёт форму при
  каждой перерисовке, и введённое теряется. Нужен `useFormBundle(фабрика)`; `useMemo` не годится —
  React вправе сбросить его кэш.
- **Один `createForm` на форму.** Модель, схема, правила, поведение и шаги — одна сборка. Её же
  получает рендерер, если форма рисуется по схеме.
- **Передавайте ноды пропсами.** Компонент шага получает свою ноду (`FormGroup<T>`, `FormControl<T>`)
  явным пропсом — так видно, с какой частью формы он работает.
- **Не начинайте с папок.** Плоская раскладка подходит почти любой форме. Папки — когда файл
  перестаёт помещаться на экран.

## См. также

- [Структура большой формы](./project-structure-large.md) — раскладка по слоям.
- [Модуль группы](../core-concepts/schemas/modules.md) — общие группы полей для многих форм.
- [Отправка и сброс](/docs/patterns/submit-and-reset) — обработчик `submission.submit` из `api.ts`.
- [React-хуки](/docs/react/hooks) — `useFormBundle` и чтение состояния нод.
