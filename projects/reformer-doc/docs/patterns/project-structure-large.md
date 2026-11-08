---
sidebar_position: 2
---

# Структура большой формы

Большую форму делят по слоям: модель, схема, правила, поведение, шаги и сборка лежат в отдельных
папках. Каждый слой отвечает на один вопрос о форме, а зависимости между слоями идут в одну сторону.

## Когда нужно

- Мастер из многих шагов, и у каждого шага своя разметка и свои правила.
- Подформы и строки массивов повторяются на нескольких шагах.
- Правила или поведение перестали помещаться в один файл.

Для остальных форм хватает плоской раскладки из [Структуры проекта](./project-structure.md).

## Минимальный пример

Так устроена эталонная кредитная заявка из `projects/react-playground`:

```
credit-application/
├── CreditApplicationForm.tsx      # точка входа: сборка формы и мастер
├── model/
│   ├── model.ts                   # createModel
│   ├── initial-value.ts           # начальные значения; шаблоны строк — arrayOf
│   ├── predicates.ts              # условия, общие для поведения, правил и разметки
│   └── factories/                 # пустые значения подформ и строк
├── schema/
│   ├── form.ts                    # дерево формы: шаги берутся из потока
│   ├── steps/                     # содержимое каждого шага
│   └── sections/                  # секции, подформы (part) и строки массивов (item)
├── validation/
│   ├── form.ts                    # правила вне шагов: { extras }
│   ├── messages.ts                # тексты замечаний по кодам
│   ├── common/                    # общие наборы правил, правила подформ и строк
│   ├── loan.ts                    # правила одного шага — файл на шаг
│   └── cross-step.ts              # правила формы целиком, проверяются при отправке
├── behavior/
│   ├── index.ts                   # поведение формы из частей ниже
│   ├── derived.ts                 # вычисляемые поля
│   ├── conditions.ts              # доступность полей и видимость секций
│   └── dynamic-options.ts         # опции, зависящие от значений
├── flow/
│   └── credit-application-flow.ts # шаги: selector, заголовок, разметка, правила
├── application/
│   ├── create.ts                  # единственный createForm
│   ├── load.ts                    # загрузка заявки и справочников
│   ├── mapping.ts                 # ответ сервера → модель
│   ├── payload.ts                 # значения формы → тело запроса без вычисляемых полей
│   └── submit.ts                  # обработчик submission.submit
├── api/                           # HTTP-запросы
└── components/                    # разметка шагов и подформ
```

## Слои

| Папка          | На какой вопрос отвечает                               |
| -------------- | ------------------------------------------------------ |
| `model/`       | какие данные держит форма и с чего она начинается      |
| `schema/`      | как форма разложена на экране                          |
| `validation/`  | что считается верным значением и как о нём сказать     |
| `behavior/`    | как значения и состояние полей реагируют друг на друга |
| `flow/`        | какие шаги проходит пользователь и в каком порядке     |
| `application/` | как форма собирается, загружается и отправляется       |

Зависимости направлены в одну сторону: `application → flow → schema/steps, validation/<шаг>` и
`application → behavior → model`. Ниже `application/` никто не знает ни идентификатора заявки, ни
сети, ни способа рендера.

## Шаг объявляется один раз — в потоке

Один элемент списка несёт всё о шаге: `selector`, заголовок, разметку и правила. Из этого списка
строятся и узлы шагов в схеме, и поток шагов сборки. Связать разметку одного шага с правилами
другого негде.

```typescript title="flow/credit-application-flow.ts"
import type { FormFlowConfig } from '@reformer/core';

export const creditApplicationFlow = [
  { selector: 'loan', title: 'Кредит', content: loanStep, rules: loanRules },
  { selector: 'contacts', title: 'Контакты', content: contactsStep, rules: contactsRules },
  { selector: 'confirmation', title: 'Подтверждение', content: confirmationStep, rules: null },
] as const;

// Поток для createForm: id шага — его selector, правила — правила шага.
export const creditApplicationFlowSteps: FormFlowConfig<CreditApplicationForm> = {
  steps: creditApplicationFlow.map((step) => ({ id: step.selector, rules: step.rules })),
};
```

```typescript title="schema/form.ts"
// Узлы шагов — из того же списка.
children: creditApplicationFlow.map((step) => ({
  selector: step.selector,
  component: Step,
  componentProps: { title: step.title },
  children: step.content(model),
})),
```

## Одна сборка на все способы рендера

`application/create.ts` — единственное место, где вызывается `createForm`. Модель, правила и
поведение общие для формы в JSX, рендерера по схеме и рендерера по JSON; меняется только то, что
передают сверху.

```typescript title="application/create.ts"
import { createForm, type CreateFormConfig } from '@reformer/core';

type Overrides = Pick<CreateFormConfig<CreditApplicationForm>, 'schema' | 'registry' | 'setup'>;

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

## Промежуточный вариант: папка на шаг

Если папки по слоям — это много, а плоская раскладка тесна, код шага можно держать рядом с шагом.
Имена файлов внутри папки шага те же, что в корне. Папка названа по заголовку шага, без номера:
порядок задаёт `steps/index.ts`, поэтому перестановка шагов папки не трогает.

```
forms/credit-application/
├── form.validation.ts          # правила вне шагов (extras)
├── form.behavior.ts            # поведение, общее для шагов
└── steps/
    ├── index.ts                # шаги по порядку: id, правила, разметка
    ├── kredit/
    │   ├── form.validation.ts  # правила шага
    │   ├── form.behavior.ts    # поведение в пределах шага
    │   └── form.schema.json    # разметка шага для renderer-json, если нужна
    └── kontakty/…
```

У формы на renderer-json документ схемы тоже можно разрезать по шагам. В `children` мастера в
корневом `form.schema.json` стоят ссылки `{ "$ref": "./steps/<шаг>/form.schema.json" }`, а
`index.tsx` собирает документ вызовом `composeJsonFormSchema(document, stepSchemas)` до
`createForm`.

## Подводные камни

- **Условия — в одном месте.** Условие «ипотека ли это» нужно и поведению, и правилам, и разметке
  шага. Держите его чистой функцией в `model/predicates.ts`, а не копией в трёх файлах.
- **Загрузка и отправка — не поведение.** Они живут в `application/`: загрузка пишет ответ в модель
  (`model.patch`, затем `model.captureInitial()`), отправка идёт через `bundle.submission.submit`.
- **Вычисляемые поля не уходят на сервер.** Обработчик получает модель целиком; `payload.ts`
  отрезает поля, которых сервер не ждёт.
- **Межшаговые правила — в `extras`.** «Далее» проверяет только правила текущего шага. Правила,
  которые смотрят на несколько шагов, проверяются при отправке.

## См. также

- [Структура проекта](./project-structure.md) — плоская раскладка для большинства форм.
- [FormWizard](/docs/cdk/form-wizard) — мастер и поток шагов.
- [Модуль группы](../core-concepts/schemas/modules.md) — общие группы полей для многих форм.
- [Отправка и сброс](/docs/patterns/submit-and-reset) — загрузка, точка отсчёта и отправка.
