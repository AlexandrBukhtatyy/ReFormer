# Очистка контракта ядра и эталонной формы

## Context

Разбор ревью «Анализ архитектуры библиотеки» по коду `packages/reformer` и эталона
`projects/react-playground/src/pages/demo/complex-multy-step-form` подтвердил: главный долг ядра —
два контракта валидации, живущие одновременно. Последствия видны в коде:

- `form.validate()` стирает ошибки, разнесённые `validateModel`, и возвращает `true`
  (`form/nodes/group-node.ts:324-339`), поэтому `form.submit()` отправляет невалидную форму;
- `field.pending`, `updateOn`, `debounce` узла работают только со старыми валидаторами ноды;
- сборка превращает дерево в конфиг старого формата, и `NodeFactory` угадывает вид узла по ключам —
  поля данных с именами `schema`, `form`, `value` ломают форму;
- `validateModel` возвращает `false` и при ошибках, и при отмене; сбой async-правила молча считается
  успехом (`form/validation/operators.ts:67-69`);
- эталон обходит типы приведением: `number` при начальном `null`, `Rule<unknown>[]`, `(f: Root)`.

Цель — один контракт без следов старого и эталон без приведений типов и дублей.

## Принятые решения

| Тема | Решение |
| --- | --- |
| Старый путь (`createLegacyForm`, валидаторы нод, `NodeFactory`, старый `ArrayNode`) | удаляется |
| Сборка нод | по виду узла модели, без промежуточного конфига |
| Результат прогона | объект со статусом; `validateModel` остаётся обёрткой с `boolean` |
| Сбой async-правила | блокирует: статус `error`, на поле видна ошибка |
| Правила | `Rule<T> = (value: T) => …`; `cross` с типом области из аргумента схемы; `message` необязателен |
| Узел схемы | закрытый union по ключам `item` / `part` / `model`, без поля `kind` |
| Проверки при сборке | дубли `selector`, ключи `validation.steps` без шага |
| Низкоуровневые операторы | уходят из корневого экспорта, остаются в `@reformer/core/model` |
| Раскладка эталона | каталоги `model` / `schema` / `validation` / `behavior` / `flow` / `application` |
| Канон раскладки | меняется под эталон: док ядра — в этом плане, проверка и генераторы MCP — отдельной задачей |
| Поток шагов | список шагов в эталоне (`flow/`), без нового API ядра |
| Эталон | честные типы, загрузка и отправка вне поведения, общие условия |
| Зависимый код | чинится до зелёного typecheck и тестов; его документация не переписывается |

`form.validate()` и `form.submit()` остаются, но `validate()` больше не стирает ошибки — отражает
текущее состояние нод.

Не входит: единый `submit` сборки, хелпер `field()`, вычисляемые поля отдельно от вводимых, поток
шагов в ядре, режим «React руками», переименование `ValidationError`, сабпат `/react`, политика
зарезервированных имён, семантика `set` / `patch`, оператор `each`.

## Этап 0. Подготовка

- `bd`: эпик и задачи по этапам; связать с `ReFormer-qs2y` (Ф11) — пересечение по ключам `value` / `array`.
  Отдельная задача вне плана: проверка раскладки MCP (`validate_form`, `kind=layout`, диагностики
  RF011–RF013), генераторы и рецепт `directory-layout` под новую раскладку.
- Ветка `feature/core-contract-cleanup` от `develop`. Коммиты и push — только по явной просьбе, по
  одному пакету на коммит.
- Базовая линия до правок: тесты ядра и зависимых пакетов, корневой `npm run typecheck`,
  `npm run size`, список падений e2e эталона — в `.tmp/core-contract-cleanup/baseline/`.
- Пересчитать `grep`-ом радиус в тестах ядра: вызовы `createLegacyForm`, `new FieldNode(`,
  `new ArrayNode(`, ключи `validators:` (оценка: 12 + 12 файлов, около 8 файлов целиком про старый путь).

## Этап 1. Ядро: удаление старого пути, ноды по виду модели

Удалить:

- `createLegacyForm` (`form/create-form.ts`), `NodeFactory` (`form/factories/`), старый `ArrayNode`
  (`form/nodes/array-node.ts`), `FormErrorHandler` / `ErrorStrategy` (`form/validation/error-handler.ts`);
- типы `FormSchema`, `GroupNodeConfig`, `ValidatorFn`, `AsyncValidatorFn`, `AsyncValidatorOptions`;
  в `FieldConfig` — `value`, `validators`, `asyncValidators`, `updateOn`, `debounce`;
- в `FieldNode` — собственные валидаторы и всё, что их обслуживает: `validateImmediate`, отмена и
  debounce, `setUpdateOn` / `getUpdateOn`, запуск проверки в `onMarkAsTouched` / `onEnable`,
  `SetValueOptions.emitEvent`.

Изменить:

- `createFormFromModel` строит ноды напрямую при обходе `model.$`: лист и массив-значение —
  `FieldNode` над сигналом модели, группа — `GroupNode` из готовых детей, массив под-форм —
  `ModelArrayNode`. У `GroupNode` один конструктор — от карты «имя → нода».
- `GroupNode.validate()` и `FieldNode.validate()` возвращают текущую валидность без `clearErrors()`.
- `FormArrayProxy`, `isArrayNode`, перегрузки `useFormControl` / `useArrayLength` — на `ModelArrayNode`.
- `isFieldNode` (`form/type-guards.ts`) — без проверки ключа `validators`.
- Текст ошибки-гарда в `form/form-bundle.ts:193-198` — без отсылки к `createLegacyForm`.

Тесты ядра: общий помощник сборки формы из начальных значений в `tests/test-utils`; тесты, которые
строили форму старым способом ради удобства, переводятся на него; тесты старого поведения
(валидаторы нод, `updateOn`, `NodeFactory`, старый `ArrayNode`) удаляются. Новые тесты: поля данных с
именами `schema`, `form`, `value`, `valueSignal`, `component`; `form.validate()` не стирает ошибки
от `validateModel`.

## Этап 2. Ядро: результат прогона и политика сбоя

В `form/validation/run.ts`:

```ts
export type ValidationStatus = 'valid' | 'invalid' | 'cancelled' | 'error';

export interface ValidationResult {
  readonly status: ValidationStatus;
  /** Ошибки по ручке поля `model.$.…`; путь — метаданные ручки. */
  readonly errors: ReadonlyMap<PathAwareSignal<unknown>, readonly ValidationError[]>;
  /** Правила, которые не вернули результат (сеть, исключение). */
  readonly failures: readonly { handle: PathAwareSignal<unknown>; error: unknown }[];
}

runValidation(model, schema): Promise<ValidationResult>; // только сбор, ноды не трогает
applyValidationResult(result, options?: { touch?: boolean }): void; // разнос по нодам
validateModel(model, schema, options?): Promise<boolean>; // сбор + разнос, true только для 'valid'
```

- Приоритет статуса: `cancelled` → `error` → `invalid` → `valid`. Отменённый результат не разносится.
- `validateAsync`: отклонённое правило при неотменённом прогоне пишет сбой в `failures` и блокирующую
  ошибку `{ code: 'ruleFailed' }` на поле. Список сбоев — общая ссылка в `VContext`: `runScoped`
  копирует контекст поверхностно.
- Тексты `validation.ruleFailed` — в `i18n/en.json`, `i18n/ru.json`.
- `field.pending`: на время async-правил поля раннер включает `pending` ноды (единственный
  прежний источник удалён на этапе 1).
- `FormValidationBundle` (`form/validation/config.ts`): `validate` / `validateAll` / `validateStep`
  остаются `Promise<boolean>`; добавляются `runAll()` и `runStep(step)` с `ValidationResult`.
  Сигнал `validating` учитывает и прогоны шага.
- `strategy.ts`: живой прогон не оставляет необработанное отклонение, если схема бросила исключение.

Тесты: все четыре статуса; сбор без формы; сбой и отмена различаются; существующий тест
«сбой правила не блокирует» (`tests/core/validation/validate-model-schema.test.ts:111-120`) меняет ожидание.

## Этап 3. Ядро: правила

- `Rule<T> = (value: T) => ValidationError | null` (`form/validation/types.ts`); `validate` вызывает
  правило одним аргументом; `CallableRule` и тип `Validator` удаляются.
- Фабрики `form/validators/*` возвращают `Rule<TField>`, параметр `TForm` уходит.
- Схема получает область с типизированным оператором:

  ```ts
  export interface ValidationScope<T> {
    model: FormModel<T>;
    cross(handle: PathAwareSignal<unknown>, check: (snapshot: T) => ValidationError | null): void;
  }
  export type ValidationSchema<T> = (scope: ValidationScope<T>) => void;
  ```

  Область строится в трёх местах вызова схемы: `run.ts`, `runScoped` и `apply(...schemas)` в
  `operators.ts`. Свободный `cross` остаётся с пометкой `@deprecated`.
- `ValidationError.message?: string`; `validationError()` не пишет пустую строку; фильтр по
  `message` в `FormNode.getErrors` терпит отсутствие поля. Резолвер `i18n/validation-message.ts`
  менять не нужно.
- Type-тесты (`form/validation/operators.type-test.ts`): `Rule<LoanType>[] = [required()]`;
  `Rule<number | null>[] = [required(), min(1)]`; правило для строки на числовом поле — ошибка;
  `cross` области выводит тип снимка.

## Этап 4. Ядро: узел схемы и проверки при сборке

- `FormSchemaNode` (`form/types/schema-node.ts`) — union четырёх видов: поле (`model` — лист или
  массив), массив под-форм (`model` + `item`), подформа (`model` + `part`), контейнер (`children`).
  Уходят индексная сигнатура и ключи `value`, `array`, `updateOn`, `debounce`, `testId`.
- Обходы спускаются только в `children` и в поддерево `part`: `harvestFieldConfig`
  (`form/create-form.ts`) и `collectSelectors` (`form/schema-controller.ts`). В dev — предупреждение
  о неизвестном ключе узла.
- В dev-блоке `createForm` (`form/form-bundle.ts:213-222`): дубли `selector` в корневой области;
  ключи `validation.steps`, которых нет среди селекторов дерева.
- Type-тест union: опечатка в ключе, группа без `part`, `item` не на массиве — ошибки компиляции.

Риск этапа: узлы внутри `componentProps` в деревьях, которые строят другие пакеты (JSON-реестр).
Проверяется тестами зависимых пакетов; если такие деревья есть — их строитель переводится на `children`.

## Этап 5. Ядро: операторы и зонтичный импорт

- Из корневого экспорта уходят `computeFrom`, `copyFrom`, `watchField`, `transformValue`,
  `resetWhen`, `syncFields`, `revalidateWhen`, `enableWhen`, `disableWhen` (`src/index.ts`,
  `form/index.ts:65`). В `@reformer/core/model` и `@reformer/core/behaviors` состав прежний.
- Десять файлов `form/validation/*` и `form/behaviors/*` импортируют конкретные модули вместо `'../../index'`.
- Обновить тест состава корневых экспортов, если он есть.

## Этап 6. Эталон

Итоговая раскладка и код — в приложении в конце документа.

1. **Раскладка.** Корневые `model.ts`, `form.schema.ts`, `form.validation.ts`, `form.behavior.ts`,
   `operators.ts` и папки `steps/<шаг>/` расходятся по каталогам `model/`, `schema/`,
   `validation/`, `behavior/`, `flow/`, `application/`. Каталоги `types/`, `constants/`,
   `utils/compute/`, `components/`, `api/` и `hooks/useAddressCopy.ts` остаются на месте.
   К названной структуре добавлены три файла: `model/predicates.ts` (условия, общие для трёх слоёв),
   `behavior/operators.ts` (пользовательские операторы), `application/renderer.ts` (связка с узлами
   схемы для renderer-вариантов).
2. **Поток шагов.** `flow/credit-application-flow.ts` — список шагов: идентификатор, заголовок,
   значок, разметка, правила. Из него строятся узлы шагов (`schema/form.ts`), `validation.steps`
   (`validation/form.ts`) и шаги визарда в JSX. Файл шага в `schema/steps/` отдаёт только содержимое
   шага; заголовки шагов остаются в одном месте.
3. **Типы.** В `types/credit-application.ts` числовые поля с начальным `null` — `number | null`;
   `sameEmail` переезжает к полям шага 3; `Address.apartment` становится обязательной строкой (в
   модели поле есть всегда). Уходят `as unknown as` в модели, `unknown` и приведения в
   `utils/compute/*` и их вызовах, приведения у `useFormControlValue` в JSX шагов.
4. **Правила.** По файлу на шаг в `validation/`, правила подформ и общие наборы — в
   `validation/common/`, правила всей формы — `validation/cross-step.ts`. Правила — `Rule<LoanType>`
   вместо `Rule<unknown>`, `cross` из области.
5. **Поведение.** `behavior/index.ts` собирает четыре части: `derived`, `synchronization`,
   `conditions`, `dynamic-options`. Загрузки, отправки и визарда в поведении нет.
6. **Загрузка и отправка.** `application/`: `create.ts` — одна сборка заявки на все варианты;
   `load.ts` — сеть; `mapping.ts` — ответ сервера в модель (`model.patch` и `model.captureInitial`);
   `submit.ts` — отправка и сообщение о результате; `renderer.ts` — разделы 6–9 прежнего поведения.
   `hooks/useLoadCreditApplication.ts` удаляется. `loadOptionsOn` учитывает `AbortSignal`;
   `fetchCarModels` и `fetchCities` принимают его вторым аргументом.
7. **Дубли.** Условия — `model/predicates.ts`: ими пользуются поведение, правила и JSX шагов.
   Секция «Информация о бизнесе» — один построитель на два шага.

Одно изменение поведения: при неожиданном статусе ответа сервера вариант «React руками» показывал
«сервер недоступен», теперь — «сервер вернул неожиданный ответ», как остальные варианты.

Соседние варианты (`-renderer`, `-renderer-json`, `-registry`): новые пути импорта (`model/model`,
`schema/form`, `validation/form`, `behavior`), сборка через `createCreditApplication` с `setup` и
то, чего потребует typecheck. Моки импортируют только `types/` — их пути не меняются.

## Этап 7. Документы ядра и зависимый код

- `packages/reformer/docs/llms/15-project-structure.md`: раздел «Scaling up: folders» описывает
  раскладку эталона (`model` / `schema` / `validation` / `behavior` / `flow` / `application`) и её
  имена файлов; плоская раскладка для малых форм остаётся.
- Остальные доки ядра и README: убрать описания удалённого, обновить результат прогона, политику
  сбоя, тип правила; удалённое — в таблицу `17-nonexistent-api.md`.
  `npm run generate:llms -w @reformer/core` — повторный запуск без diff.
- Зависимые пакеты правятся по ходу каждого этапа: только то, без чего не проходят typecheck и тесты.

До отдельной задачи по MCP проверка `validate_form` с `kind=layout` на эталоне даёт ошибки
(замер на новой раскладке — 19).

## Проверка

После каждого этапа:

- в `packages/reformer`: `npx tsc -b` и `npm test` (из корня `tsc -b` не запускается);
- `npm run build -w @reformer/core`, затем из корня `npm run typecheck`, `npm run lint`,
  `npm run knip`, `npm run size`; тесты затронутых зависимых пакетов;
- после этапа 2 и далее — `npm run coverage` ядра против порогов.

После этапа 6 и в конце:

- e2e эталона: `cd projects/react-playground-e2e && npx playwright test tests/pages/complex-multy-step-form` —
  нет новых падений относительно базовой линии этапа 0;
- дымовой проход Playwright по шести шагам каждого из четырёх вариантов заявки: загрузка, условные
  секции, массивы, ошибка шага, отправка; скриншоты —
  `projects/react-playground-e2e/screenshots/core-contract-cleanup/<вариант>/<шаг>.png`;
- отдельная проверка отправки: при ошибке поля `form.submit()` не вызывает обработчик.

## Приложение. Эталон после правок

Целевой код каталога `projects/react-playground/src/pages/demo/complex-multy-step-form`. Он опирается
на API этапов 1, 3 и 4 (типы нод массива, `Rule` и `cross` области, закрытый тип узла), которого ещё
нет, поэтому не компилировался. Тексты сообщений и пороги правил перенесены из текущих файлов без
изменений.

### Раскладка

```text
complex-multy-step-form/
│
├── model/
│   ├── model.ts                    createCreditApplicationModel
│   ├── initial-value.ts            начальные значения
│   ├── predicates.ts               условия заявки (добавлен к структуре)
│   └── factories/
│       ├── address.ts
│       ├── property.ts
│       ├── existing-loan.ts
│       └── co-borrower.ts
│
├── schema/
│   ├── form.ts                     загрузка → визард → шаги из потока
│   ├── steps/                      содержимое шага
│   │   ├── loan.ts
│   │   ├── applicant.ts
│   │   ├── contacts.ts
│   │   ├── employment.ts
│   │   ├── additional.ts
│   │   └── confirmation.ts
│   └── sections/                   секции, подформы, строки массивов
│       ├── mortgage.ts
│       ├── car.ts
│       ├── business.ts
│       ├── personal-data.ts
│       ├── passport-data.ts
│       ├── address.ts
│       ├── employer.ts
│       ├── income.ts
│       ├── property.ts
│       ├── existing-loan.ts
│       └── co-borrower.ts
│
├── validation/
│   ├── form.ts                     creditApplicationValidation
│   ├── common/
│   │   ├── rules.ts                общие наборы правил
│   │   ├── address.ts
│   │   ├── property.ts
│   │   ├── existing-loan.ts
│   │   └── co-borrower.ts
│   ├── loan.ts
│   ├── applicant.ts
│   ├── contacts.ts
│   ├── employment.ts
│   ├── additional.ts
│   ├── confirmation.ts
│   └── cross-step.ts
│
├── behavior/
│   ├── index.ts                    creditApplicationBehavior
│   ├── derived.ts
│   ├── conditions.ts
│   ├── synchronization.ts
│   ├── dynamic-options.ts
│   └── operators.ts                пользовательские операторы (добавлен к структуре)
│
├── flow/
│   └── credit-application-flow.ts  список шагов
│
├── application/
│   ├── create.ts
│   ├── load.ts
│   ├── submit.ts
│   ├── mapping.ts
│   └── renderer.ts                 связка с узлами схемы (добавлен к структуре)
│
├── components/                     steps/, nested-forms/, ui/
├── api/
├── types/  constants/  utils/compute/  hooks/    остаются на месте
│
└── CreditApplicationForm.tsx
```

Зависимости между каталогами идут в одну сторону:

```text
application ─► flow ─► schema/steps, validation/<шаг>
     │           ▲
     │           └── schema/form, validation/form
     ├─► behavior ─► model, utils/compute
     └─► model
```

### `flow/credit-application-flow.ts`

```ts
/**
 * Поток кредитной заявки — упорядоченный список шагов.
 *
 * Шаг объявлен один раз: идентификатор, заголовок, значок, разметка и правила. Из списка строятся
 * узлы шагов дерева схемы (`schema/form.ts`), правила по шагам (`validation/form.ts`) и шаги
 * визарда в варианте «React руками». Связать разметку одного шага с правилами другого негде.
 */

import type { FormModel, FormSchemaNode } from '@reformer/core';
import type { ValidationSchema } from '@reformer/core/validation';
import type { CreditApplicationForm } from '../types/credit-application';
import { loanStep } from '../schema/steps/loan';
import { applicantStep } from '../schema/steps/applicant';
import { contactsStep } from '../schema/steps/contacts';
import { employmentStep } from '../schema/steps/employment';
import { additionalStep } from '../schema/steps/additional';
import { confirmationStep } from '../schema/steps/confirmation';
import { loanRules } from '../validation/loan';
import { applicantRules } from '../validation/applicant';
import { contactsRules } from '../validation/contacts';
import { employmentRules } from '../validation/employment';
import { additionalRules } from '../validation/additional';
import { confirmationRules } from '../validation/confirmation';

interface FlowStep {
  /** Идентификатор шага: `selector` узла шага в схеме и ключ его правил. */
  selector: string;
  title: string;
  icon: string;
  /** Разметка шага — содержимое узла шага. */
  content: (model: FormModel<CreditApplicationForm>) => FormSchemaNode[];
  /** Правила шага; `null` — шаг без правил. */
  rules: ValidationSchema<CreditApplicationForm> | null;
}

export const creditApplicationFlow = [
  { selector: 'loan', title: 'Кредит', icon: '💰', content: loanStep, rules: loanRules },
  {
    selector: 'applicant',
    title: 'Данные',
    icon: '👤',
    content: applicantStep,
    rules: applicantRules,
  },
  {
    selector: 'contacts',
    title: 'Контакты',
    icon: '📞',
    content: contactsStep,
    rules: contactsRules,
  },
  {
    selector: 'employment',
    title: 'Работа',
    icon: '💼',
    content: employmentStep,
    rules: employmentRules,
  },
  {
    selector: 'additional',
    title: 'Доп. инфо',
    icon: '📋',
    content: additionalStep,
    rules: additionalRules,
  },
  {
    selector: 'confirmation',
    title: 'Подтверждение',
    icon: '✓',
    content: confirmationStep,
    rules: confirmationRules,
  },
] as const satisfies readonly FlowStep[];

/** Идентификатор шага заявки. */
export type StepSelector = (typeof creditApplicationFlow)[number]['selector'];
```

### `model/`

```ts
// model/factories/address.ts
import type { Address } from '../../components/nested-forms/Address/types';

export const blankAddress = (): Address => ({
  region: '',
  city: '',
  street: '',
  house: '',
  apartment: '',
  postalCode: '',
});

// model/factories/property.ts
import type { Property } from '../../components/nested-forms/Property/types';

export const blankProperty = (): Property => ({
  type: 'apartment',
  description: '',
  estimatedValue: 0,
  hasEncumbrance: false,
});

// model/factories/existing-loan.ts
import type { ExistingLoan } from '../../components/nested-forms/ExistingLoan/types';

export const blankExistingLoan = (): ExistingLoan => ({
  bank: '',
  type: 'consumer',
  amount: 0,
  remainingAmount: 0,
  monthlyPayment: 0,
  maturityDate: '',
});

// model/factories/co-borrower.ts
import type { CoBorrower } from '../../components/nested-forms/CoBorrower/types';

export const blankCoBorrower = (): CoBorrower => ({
  personalData: {
    lastName: '',
    firstName: '',
    middleName: '',
    birthDate: '',
  },
  phone: '',
  email: '',
  relationship: 'spouse',
  monthlyIncome: 0,
});
```

```ts
// model/initial-value.ts
/**
 * Начальные значения заявки: определяют форму данных и initial-снимок модели.
 *
 * Пустое числовое поле — `null`. Массив объявляется через `arrayOf(blank)`: пустой список и шаблон
 * элемента для кнопки «Добавить».
 */

import { arrayOf } from '@reformer/core';
import type { CreditApplicationForm } from '../types/credit-application';
import { blankAddress } from './factories/address';
import { blankProperty } from './factories/property';
import { blankExistingLoan } from './factories/existing-loan';
import { blankCoBorrower } from './factories/co-borrower';

export const createInitialCreditApplication = (): CreditApplicationForm => ({
  // Шаг 1: Основная информация
  loanType: 'consumer',
  loanAmount: null,
  loanTerm: 12,
  loanPurpose: '',
  propertyValue: null,
  initialPayment: null,
  carBrand: '',
  carModel: '',
  carYear: null,
  carPrice: null,

  // Шаг 2: Персональные данные
  personalData: {
    lastName: '',
    firstName: '',
    middleName: '',
    birthDate: '',
    birthPlace: '',
    gender: 'male',
  },
  passportData: {
    series: '',
    number: '',
    issueDate: '',
    issuedBy: '',
    departmentCode: '',
  },
  inn: '',
  snils: '',

  // Шаг 3: Контактная информация
  phoneMain: '',
  phoneAdditional: '',
  email: '',
  emailAdditional: '',
  sameEmail: false,
  registrationAddress: blankAddress(),
  sameAsRegistration: true,
  residenceAddress: blankAddress(),

  // Шаг 4: Информация о занятости
  employmentStatus: 'employed',
  companyName: '',
  companyInn: '',
  companyPhone: '',
  companyAddress: '',
  position: '',
  workExperienceTotal: null,
  workExperienceCurrent: null,
  monthlyIncome: null,
  additionalIncome: null,
  additionalIncomeSource: '',
  businessType: '',
  businessInn: '',
  businessActivity: '',

  // Шаг 5: Дополнительная информация
  maritalStatus: 'single',
  dependents: 0,
  education: 'higher',
  documents: null,
  hasProperty: false,
  properties: arrayOf(blankProperty),
  hasExistingLoans: false,
  existingLoans: arrayOf(blankExistingLoan),
  hasCoBorrower: false,
  coBorrowers: arrayOf(blankCoBorrower),

  // Шаг 6: Согласия
  agreePersonalData: false,
  agreeCreditHistory: false,
  agreeMarketing: false,
  agreeTerms: false,
  confirmAccuracy: false,
  electronicSignature: '',

  // Вычисляемые поля
  interestRate: 0,
  monthlyPayment: 0,
  fullName: '',
  age: null,
  totalIncome: 0,
  paymentToIncomeRatio: 0,
  coBorrowersIncome: 0,
});
```

```ts
// model/model.ts
import { createModel, type FormModel } from '@reformer/core';
import type { CreditApplicationForm } from '../types/credit-application';
import { createInitialCreditApplication } from './initial-value';

/** Реактивная модель кредитной заявки — источник истины значений. */
export const createCreditApplicationModel = (): FormModel<CreditApplicationForm> =>
  createModel<CreditApplicationForm>(createInitialCreditApplication());
```

```ts
// model/predicates.ts
/**
 * Условия кредитной заявки — по одному определению на форму.
 *
 * Чистые функции над значениями: ими пользуются поведение (`enableWhen`, `hideWhen`), правила
 * (`validateWhen`) и JSX шагов.
 */

import type { EmploymentStatus, LoanType } from '../types/credit-application';

export const isMortgage = (loanType: LoanType): boolean => loanType === 'mortgage';
export const isCarLoan = (loanType: LoanType): boolean => loanType === 'car';
export const isBusinessLoan = (loanType: LoanType): boolean => loanType === 'business';

export const isEmployed = (employmentStatus: EmploymentStatus): boolean =>
  employmentStatus === 'employed';
export const isSelfEmployed = (employmentStatus: EmploymentStatus): boolean =>
  employmentStatus === 'selfEmployed';
export const isUnemployed = (employmentStatus: EmploymentStatus): boolean =>
  employmentStatus === 'unemployed';

/** Адрес проживания отличается от адреса регистрации. */
export const livesElsewhere = (sameAsRegistration: boolean): boolean =>
  sameAsRegistration === false;
```

### `types/credit-application.ts`

```ts
import type { Address } from '../components/nested-forms/Address/types';
import type { CoBorrower } from '../components/nested-forms/CoBorrower/types';
import type { ExistingLoan } from '../components/nested-forms/ExistingLoan/types';
import type { PassportData } from '../components/nested-forms/PassportData/types';
import type { PersonalData } from '../components/nested-forms/PersonalData/types';
import type { Property } from '../components/nested-forms/Property/types';

export type LoanType = 'consumer' | 'mortgage' | 'car' | 'business' | 'refinancing';
export type EmploymentStatus = 'employed' | 'selfEmployed' | 'unemployed' | 'retired' | 'student';
export type MaritalStatus = 'single' | 'married' | 'divorced' | 'widowed';
export type EducationLevel = 'secondary' | 'specialized' | 'higher' | 'postgraduate';

/** Числовое поле ввода бывает пустым — тогда его значение `null`. */
export interface CreditApplicationForm {
  // Шаг 1: Основная информация
  loanType: LoanType;
  loanAmount: number | null;
  loanTerm: number;
  loanPurpose: string;

  // Ипотека
  propertyValue: number | null;
  /** Вводится пользователем; для ипотеки подставляется расчётом — 20 % стоимости. */
  initialPayment: number | null;

  // Автокредит
  carBrand: string;
  carModel: string;
  carYear: number | null;
  carPrice: number | null;

  // Шаг 2: Персональные данные
  personalData: PersonalData;
  passportData: PassportData;
  inn: string;
  snils: string;

  // Шаг 3: Контактная информация
  phoneMain: string;
  phoneAdditional: string;
  email: string;
  emailAdditional: string;
  /** Дополнительный email совпадает с основным. */
  sameEmail: boolean;
  registrationAddress: Address;
  sameAsRegistration: boolean;
  residenceAddress: Address;

  // Шаг 4: Информация о занятости
  employmentStatus: EmploymentStatus;
  companyName: string;
  companyInn: string;
  companyPhone: string;
  companyAddress: string;
  position: string;
  workExperienceTotal: number | null;
  workExperienceCurrent: number | null;
  monthlyIncome: number | null;
  additionalIncome: number | null;
  additionalIncomeSource: string;
  businessType: string;
  businessInn: string;
  businessActivity: string;

  // Шаг 5: Дополнительная информация
  maritalStatus: MaritalStatus;
  dependents: number;
  education: EducationLevel;
  /** Сканы документов: `File[]` уходит при отправке через FormData. */
  documents: File[] | null;
  hasProperty: boolean;
  properties: Property[];
  hasExistingLoans: boolean;
  existingLoans: ExistingLoan[];
  hasCoBorrower: boolean;
  coBorrowers: CoBorrower[];

  // Шаг 6: Согласия
  agreePersonalData: boolean;
  agreeCreditHistory: boolean;
  agreeMarketing: boolean;
  agreeTerms: boolean;
  confirmAccuracy: boolean;
  electronicSignature: string;

  // Вычисляемые поля: значения пишет поведение (`compute`)
  interestRate: number;
  monthlyPayment: number;
  fullName: string;
  age: number | null;
  totalIncome: number;
  paymentToIncomeRatio: number;
  coBorrowersIncome: number;
}
```

`components/nested-forms/Address/types.ts` — `apartment: string` вместо `apartment?: string`.

### `schema/`

```ts
// schema/form.ts
/**
 * Схема кредитной заявки — одна на все способы реализации.
 *
 * Каркас: загрузка → визард → шаги. Шаги берутся из потока (`flow/credit-application-flow.ts`):
 * он назначает шагу `selector`, заголовок и значок; содержимое шага — `schema/steps/<шаг>.ts`.
 */

import type { FormModel, FormSchemaNode } from '@reformer/core';
import { Step } from '@reformer/cdk/form-wizard';
import { AsyncBoundary, FormWizard } from '@reformer/ui-kit';
import { creditApplicationFlow } from '../flow/credit-application-flow';
import type { CreditApplicationForm } from '../types/credit-application';

export const creditApplicationSchema = (
  model: FormModel<CreditApplicationForm>
): FormSchemaNode => ({
  selector: 'data-boundary',
  component: AsyncBoundary,
  // Статус (loading | error | ready) и текст ошибки подставляет приложение.
  componentProps: { status: 'loading' },
  children: [
    {
      selector: 'wizard',
      component: FormWizard,
      componentProps: {
        className: 'bg-white p-8 rounded-lg shadow-md',
        submitLabel: 'Отправить заявку',
      },
      children: creditApplicationFlow.map((step) => ({
        selector: step.selector,
        component: Step,
        componentProps: { title: step.title, icon: step.icon },
        children: step.content(model),
      })),
    },
  ],
});
```

```ts
// schema/steps/loan.ts
/**
 * Содержимое шага «Кредит». Заголовок, значок и `selector` шага — в потоке заявки.
 */

import type { FormModel, FormSchemaNode } from '@reformer/core';
import { Box, InputNumber, Section, SelectAsync, Textarea } from '@reformer/ui-kit';
import { LOAN_TYPES } from '../../constants/credit-application';
import type { CreditApplicationForm } from '../../types/credit-application';
import { mortgageSection } from '../sections/mortgage';
import { carSection } from '../sections/car';
import { businessSection } from '../sections/business';

export const loanStep = (model: FormModel<CreditApplicationForm>): FormSchemaNode[] => [
  {
    component: Box,
    componentProps: { className: 'space-y-6' },
    children: [
      {
        component: Section,
        componentProps: {
          title: 'Основная информация о кредите',
          titleAs: 'h2',
          titleClassName: 'text-xl font-bold',
          className: 'space-y-6',
        },
        children: [
          {
            model: model.$.loanType,
            component: SelectAsync,
            componentProps: {
              label: 'Тип кредита',
              placeholder: 'Выберите тип кредита',
              options: LOAN_TYPES,
            },
          },
          {
            model: model.$.loanAmount,
            component: InputNumber,
            componentProps: {
              label: 'Сумма кредита (₽)',
              placeholder: 'Введите сумму',
              min: 50000,
              max: 10000000,
              step: 10000,
            },
          },
          {
            model: model.$.loanTerm,
            component: InputNumber,
            componentProps: {
              label: 'Срок кредита (месяцев)',
              placeholder: 'Введите срок',
              min: 6,
              max: 240,
            },
          },
          {
            model: model.$.loanPurpose,
            component: Textarea,
            componentProps: {
              label: 'Цель кредита',
              placeholder: 'Опишите, на что планируете потратить средства',
              rows: 4,
              maxLength: 500,
            },
          },
        ],
      },
      mortgageSection(model),
      carSection(model),
      businessSection(model, {
        selector: 'loan-business-section',
        titleClassName: 'text-lg font-semibold mt-4',
      }),
    ],
  },
];
```

```ts
// schema/sections/mortgage.ts
import type { FormModel, FormSchemaNode } from '@reformer/core';
import { InputNumber, Section } from '@reformer/ui-kit';
import type { CreditApplicationForm } from '../../types/credit-application';

/** Секция ипотеки. Видимость — `behavior/conditions.ts`, по `selector`. */
export const mortgageSection = (model: FormModel<CreditApplicationForm>): FormSchemaNode => ({
  selector: 'mortgage-section',
  component: Section,
  componentProps: {
    title: 'Информация о недвижимости',
    titleClassName: 'text-lg font-semibold mt-4',
    className: 'space-y-4',
  },
  children: [
    {
      model: model.$.propertyValue,
      component: InputNumber,
      componentProps: {
        label: 'Стоимость недвижимости (₽)',
        placeholder: 'Введите стоимость',
        min: 1000000,
        step: 100000,
      },
    },
    {
      model: model.$.initialPayment,
      component: InputNumber,
      componentProps: {
        label: 'Первоначальный взнос (₽)',
        placeholder: 'Введите сумму',
        min: 0,
        step: 10000,
      },
    },
  ],
});
```

```ts
// schema/sections/business.ts
import type { FormModel, FormSchemaNode } from '@reformer/core';
import { Input, InputMask, Section, Textarea } from '@reformer/ui-kit';
import type { CreditApplicationForm } from '../../types/credit-application';

/**
 * Секция «Информация о бизнесе». Стоит в схеме дважды — на шаге «Кредит» (бизнес-кредит) и на
 * шаге «Работа» (самозанятый): поля одни и те же, различаются `selector` и отступ заголовка.
 */
export const businessSection = (
  model: FormModel<CreditApplicationForm>,
  { selector, titleClassName }: { selector: string; titleClassName: string }
): FormSchemaNode => ({
  selector,
  component: Section,
  componentProps: {
    title: 'Информация о бизнесе',
    titleClassName,
    className: 'space-y-4',
  },
  children: [
    {
      model: model.$.businessType,
      component: Input,
      componentProps: { label: 'Тип бизнеса', placeholder: 'ИП, ООО и т.д.' },
    },
    {
      model: model.$.businessInn,
      component: InputMask,
      componentProps: {
        label: 'ИНН ИП',
        placeholder: '123456789012',
        mask: '999999999999',
      },
    },
    {
      model: model.$.businessActivity,
      component: Textarea,
      componentProps: {
        label: 'Вид деятельности',
        placeholder: 'Опишите вид деятельности',
        rows: 3,
      },
    },
  ],
});
```

Остальная разметка переезжает без изменения содержимого; файл шага отдаёт массив узлов —
прежних детей узла шага:

| Новый файл | Что в нём | Откуда |
| --- | --- | --- |
| `schema/sections/car.ts` | секция `car-section` | `steps/loan/form.schema.ts` |
| `schema/sections/personal-data.ts` | секция «Личные данные» | `steps/applicant/form.schema.ts` |
| `schema/sections/passport-data.ts` | секция «Паспортные данные» | `steps/applicant/form.schema.ts` |
| `schema/sections/address.ts` | подформа адреса (`part`) | `steps/contacts/form.schema.ts` |
| `schema/sections/employer.ts` | секция `employer-section` с «Должность и стаж» | `steps/employment/form.schema.ts` |
| `schema/sections/income.ts` | секция `income-section` | `steps/employment/form.schema.ts` |
| `schema/sections/property.ts` | строка массива имущества (`item`) | `steps/additional/form.schema.ts` |
| `schema/sections/existing-loan.ts` | строка массива кредитов (`item`) | `steps/additional/form.schema.ts` |
| `schema/sections/co-borrower.ts` | строка массива созаёмщиков (`item`) | `steps/additional/form.schema.ts` |
| `schema/steps/applicant.ts` | две секции и «Дополнительные документы» | `steps/applicant/form.schema.ts` |
| `schema/steps/contacts.ts` | «Контакты», оба адреса | `steps/contacts/form.schema.ts` |
| `schema/steps/employment.ts` | статус, три секции, предупреждение | `steps/employment/form.schema.ts` |
| `schema/steps/additional.ts` | «Общая информация», три массива | `steps/additional/form.schema.ts` |
| `schema/steps/confirmation.ts` | весь шаг | `steps/confirmation/form.schema.ts` |

В `schema/steps/employment.ts` секция бизнеса подключается тем же построителем:

```ts
businessSection(model, {
  selector: 'business-section',
  titleClassName: 'text-lg font-semibold mt-6',
}),
```

### `validation/common/`

```ts
// validation/common/rules.ts
/**
 * Наборы правил, общие для нескольких шагов и подформ.
 */

import type { Rule } from '@reformer/core/validation';
import {
  email,
  max,
  maxLength,
  min,
  minLength,
  pattern,
  required,
} from '@reformer/core/validators';

const RU_NAME = /^[А-ЯЁа-яё\s-]+$/;
const PHONE = /^\+7\s\(\d{3}\)\s\d{3}-\d{2}-\d{2}$/;

/** Правила ФИО (русское имя): шаг «Данные» и созаёмщик. */
export const ruName = (label: string): Rule<string>[] => [
  required({ message: `${label} обязательно` }),
  minLength(2, { message: 'Минимум 2 символа' }),
  maxLength(50, { message: 'Максимум 50 символов' }),
  pattern(RU_NAME, { message: 'Только русские буквы, пробелы и дефис' }),
];

/** Формат телефона: дополнительный телефон и хвост обязательных наборов. */
export const PHONE_FORMAT_RULES: Rule<string>[] = [
  pattern(PHONE, { message: 'Формат: +7 (___) ___-__-__' }),
];

/** Формат email: дополнительный email и хвост {@link EMAIL_REQUIRED_RULES}. */
export const EMAIL_FORMAT_RULES: Rule<string>[] = [email({ message: 'Введите корректный email' })];

/** Обязательный email — заёмщик и созаёмщик. */
export const EMAIL_REQUIRED_RULES: Rule<string>[] = [
  required({ message: 'Email обязателен' }),
  ...EMAIL_FORMAT_RULES,
];

// Числовые наборы принимают и пустое значение: так их берут и поля `number | null`, и `number`.

/** Числовое поле не может быть отрицательным. */
export const NON_NEGATIVE_RULES: Rule<number | null>[] = [
  min(0, { message: 'Не может быть отрицательным' }),
];

/** Общий верхний предел сумм — 10 000 000 ₽. */
export const MAX_10M_RUB_RULES: Rule<number | null>[] = [
  max(10000000, { message: 'Максимум 10 000 000 ₽' }),
];
```

```ts
// validation/common/address.ts
import { defineValidationSchema, validate, type Rule } from '@reformer/core/validation';
import { maxLength, minLength, pattern, required } from '@reformer/core/validators';
import type { Address } from '../../components/nested-forms/Address/types';

const REGION_RULES: Rule<string>[] = [
  required({ message: 'Укажите регион' }),
  minLength(2, { message: 'Минимум 2 символа' }),
  maxLength(100, { message: 'Максимум 100 символов' }),
];

const CITY_RULES: Rule<string>[] = [
  required({ message: 'Укажите город' }),
  minLength(2, { message: 'Минимум 2 символа' }),
  maxLength(100, { message: 'Максимум 100 символов' }),
];

const STREET_RULES: Rule<string>[] = [
  required({ message: 'Укажите улицу' }),
  minLength(3, { message: 'Минимум 3 символа' }),
  maxLength(200, { message: 'Максимум 200 символов' }),
];

const HOUSE_RULES: Rule<string>[] = [
  required({ message: 'Укажите номер дома' }),
  maxLength(10, { message: 'Максимум 10 символов' }),
];

const APARTMENT_RULES: Rule<string>[] = [maxLength(10, { message: 'Максимум 10 символов' })];

const POSTAL_CODE_RULES: Rule<string>[] = [
  required({ message: 'Укажите почтовый индекс' }),
  pattern(/^\d{6}$/, { message: 'Индекс должен содержать 6 цифр' }),
];

/** Правила адреса: объявлены один раз, подключаются к адресу регистрации и проживания. */
export const addressRules = defineValidationSchema<Address>(({ model }) => {
  validate(model.$.region, REGION_RULES);
  validate(model.$.city, CITY_RULES);
  validate(model.$.street, STREET_RULES);
  validate(model.$.house, HOUSE_RULES);
  validate(model.$.apartment, APARTMENT_RULES);
  validate(model.$.postalCode, POSTAL_CODE_RULES);
});
```

```ts
// validation/common/property.ts
import { defineValidationSchema, validate, type Rule } from '@reformer/core/validation';
import { maxLength, min, minLength, required } from '@reformer/core/validators';
import type { Property, PropertyType } from '../../components/nested-forms/Property/types';

const TYPE_RULES: Rule<PropertyType>[] = [required({ message: 'Укажите тип имущества' })];

const DESCRIPTION_RULES: Rule<string>[] = [
  required({ message: 'Добавьте описание имущества' }),
  minLength(10, { message: 'Минимум 10 символов' }),
  maxLength(500, { message: 'Максимум 500 символов' }),
];

const ESTIMATED_VALUE_RULES: Rule<number>[] = [
  required({ message: 'Укажите оценочную стоимость' }),
  min(10000, { message: 'Минимальная стоимость: 10 000 ₽' }),
];

export const propertyRules = defineValidationSchema<Property>(({ model }) => {
  validate(model.$.type, TYPE_RULES);
  validate(model.$.description, DESCRIPTION_RULES);
  validate(model.$.estimatedValue, ESTIMATED_VALUE_RULES);
});
```

```ts
// validation/common/existing-loan.ts
import type { ValidationError } from '@reformer/core';
import { defineValidationSchema, validate, type Rule } from '@reformer/core/validation';
import { max, maxLength, min, minLength, required } from '@reformer/core/validators';
import type { ExistingLoan } from '../../components/nested-forms/ExistingLoan/types';
import { NON_NEGATIVE_RULES } from './rules';

const BANK_RULES: Rule<string>[] = [
  required({ message: 'Укажите название банка' }),
  minLength(3, { message: 'Минимум 3 символа' }),
  maxLength(100, { message: 'Максимум 100 символов' }),
];

const TYPE_RULES: Rule<string>[] = [required({ message: 'Укажите тип кредита' })];

const AMOUNT_RULES: Rule<number>[] = [
  required({ message: 'Укажите сумму кредита' }),
  min(1000, { message: 'Минимум 1 000 ₽' }),
  max(100000000, { message: 'Максимум 100 000 000 ₽' }),
];

const REMAINING_AMOUNT_RULES: Rule<number>[] = [
  required({ message: 'Укажите остаток долга' }),
  ...NON_NEGATIVE_RULES,
];

const MONTHLY_PAYMENT_RULES: Rule<number>[] = [
  required({ message: 'Укажите ежемесячный платеж' }),
  min(100, { message: 'Минимум 100 ₽' }),
];

const MATURITY_DATE_RULES: Rule<string>[] = [required({ message: 'Укажите дату погашения' })];

// Правила над несколькими полями строки: получают снимок строки
const remainingWithinAmount = (existingLoan: ExistingLoan): ValidationError | null =>
  existingLoan.remainingAmount > existingLoan.amount
    ? { code: 'remainingExceedsAmount', message: 'Остаток долга не может превышать сумму кредита' }
    : null;

const maturityInFuture = (existingLoan: ExistingLoan): ValidationError | null => {
  if (!existingLoan.maturityDate) return null;
  const maturityDate = new Date(existingLoan.maturityDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return maturityDate < today
    ? { code: 'maturityDateInPast', message: 'Дата погашения должна быть в будущем' }
    : null;
};

export const existingLoanRules = defineValidationSchema<ExistingLoan>(({ model, cross }) => {
  validate(model.$.bank, BANK_RULES);
  validate(model.$.type, TYPE_RULES);
  validate(model.$.amount, AMOUNT_RULES);
  validate(model.$.remainingAmount, REMAINING_AMOUNT_RULES);
  cross(model.$.remainingAmount, remainingWithinAmount);
  validate(model.$.monthlyPayment, MONTHLY_PAYMENT_RULES);
  validate(model.$.maturityDate, MATURITY_DATE_RULES);
  cross(model.$.maturityDate, maturityInFuture);
});
```

```ts
// validation/common/co-borrower.ts
import { defineValidationSchema, validate, type Rule } from '@reformer/core/validation';
import { maxAge, min, minAge, required } from '@reformer/core/validators';
import type { CoBorrower } from '../../components/nested-forms/CoBorrower/types';
import { EMAIL_REQUIRED_RULES, ruName } from './rules';

const BIRTH_DATE_RULES: Rule<string>[] = [
  required({ message: 'Дата рождения обязательна' }),
  minAge(18, { message: 'Созаемщику должно быть не менее 18 лет' }),
  maxAge(80, { message: 'Созаемщику должно быть не более 80 лет' }),
];

const PHONE_RULES: Rule<string>[] = [required({ message: 'Телефон обязателен' })];

const RELATIONSHIP_RULES: Rule<string>[] = [
  required({ message: 'Укажите отношение к заемщику' }),
];

const MONTHLY_INCOME_RULES: Rule<number>[] = [
  required({ message: 'Укажите доход созаемщика' }),
  min(10000, { message: 'Минимум 10 000 ₽' }),
];

export const coBorrowerRules = defineValidationSchema<CoBorrower>(({ model }) => {
  validate(model.$.personalData.lastName, ruName('Фамилия'));
  validate(model.$.personalData.firstName, ruName('Имя'));
  validate(model.$.personalData.middleName, ruName('Отчество'));
  validate(model.$.personalData.birthDate, BIRTH_DATE_RULES);
  validate(model.$.phone, PHONE_RULES);
  validate(model.$.email, EMAIL_REQUIRED_RULES);
  validate(model.$.relationship, RELATIONSHIP_RULES);
  validate(model.$.monthlyIncome, MONTHLY_INCOME_RULES);
});
```

### `validation/` — правила шагов

```ts
// validation/loan.ts
import type { ValidationError } from '@reformer/core';
import {
  defineValidationSchema,
  validate,
  validateWhen,
  type Rule,
} from '@reformer/core/validation';
import { max, maxLength, min, minLength, required } from '@reformer/core/validators';
import { isCarLoan, isMortgage } from '../model/predicates';
import type { CreditApplicationForm, LoanType } from '../types/credit-application';
import { MAX_10M_RUB_RULES, NON_NEGATIVE_RULES } from './common/rules';

const CURRENT_YEAR = new Date().getFullYear();

const LOAN_TYPE_RULES: Rule<LoanType>[] = [required({ message: 'Выберите тип кредита' })];

const LOAN_AMOUNT_RULES: Rule<number | null>[] = [
  required({ message: 'Укажите сумму кредита' }),
  min(50000, { message: 'Минимум 50 000 ₽' }),
  ...MAX_10M_RUB_RULES,
];

const LOAN_TERM_RULES: Rule<number>[] = [
  required({ message: 'Укажите срок кредита' }),
  min(6, { message: 'Минимум 6 месяцев' }),
  max(240, { message: 'Максимум 240 месяцев' }),
];

const LOAN_PURPOSE_RULES: Rule<string>[] = [
  required({ message: 'Укажите цель кредита' }),
  minLength(10, { message: 'Минимум 10 символов' }),
  maxLength(500, { message: 'Не более 500 символов' }),
];

const PROPERTY_VALUE_RULES: Rule<number | null>[] = [
  required({ message: 'Укажите стоимость недвижимости' }),
  min(1000000, { message: 'Минимум 1 000 000 ₽' }),
];

const INITIAL_PAYMENT_RULES: Rule<number | null>[] = [
  required({ message: 'Укажите первоначальный взнос' }),
  ...NON_NEGATIVE_RULES,
];

const CAR_BRAND_RULES: Rule<string>[] = [
  required({ message: 'Укажите марку автомобиля' }),
  minLength(2, { message: 'Минимум 2 символа' }),
  maxLength(50, { message: 'Максимум 50 символов' }),
];

const CAR_MODEL_RULES: Rule<string>[] = [
  required({ message: 'Укажите модель автомобиля' }),
  minLength(1, { message: 'Минимум 1 символ' }),
  maxLength(50, { message: 'Максимум 50 символов' }),
];

const CAR_YEAR_RULES: Rule<number | null>[] = [
  required({ message: 'Укажите год выпуска' }),
  min(2000, { message: 'Не ранее 2000' }),
  max(CURRENT_YEAR + 1, { message: `Не позднее ${CURRENT_YEAR + 1}` }),
];

const CAR_PRICE_RULES: Rule<number | null>[] = [
  required({ message: 'Укажите стоимость автомобиля' }),
  min(300000, { message: 'Минимум 300 000 ₽' }),
  ...MAX_10M_RUB_RULES,
];

const initialPaymentWithinPropertyValue = (
  application: CreditApplicationForm
): ValidationError | null => {
  const { initialPayment, propertyValue } = application;
  if (!initialPayment || !propertyValue) return null;
  if (initialPayment > propertyValue)
    return {
      code: 'initialPaymentTooHigh',
      message: 'Первоначальный взнос не может превышать стоимость недвижимости',
    };
  if (initialPayment < propertyValue * 0.2)
    return {
      code: 'initialPaymentTooLow',
      message: 'Первоначальный взнос не может быть меньше 20% от стоимости недвижимости',
    };
  return null;
};

const loanAmountWithinPropertyValue = (
  application: CreditApplicationForm
): ValidationError | null => {
  const { loanAmount, propertyValue, initialPayment } = application;
  if (!loanAmount || !propertyValue || !initialPayment) return null;
  const maximumLoan = propertyValue - initialPayment;
  return loanAmount > maximumLoan
    ? {
        code: 'loanAmountExceedsMax',
        message: `Сумма кредита не может превышать ${maximumLoan.toLocaleString('ru-RU')} ₽ (стоимость минус взнос)`,
      }
    : null;
};

export const loanRules = defineValidationSchema<CreditApplicationForm>(({ model, cross }) => {
  validate(model.$.loanType, LOAN_TYPE_RULES);
  validate(model.$.loanAmount, LOAN_AMOUNT_RULES);
  validate(model.$.loanTerm, LOAN_TERM_RULES);
  validate(model.$.loanPurpose, LOAN_PURPOSE_RULES);

  validateWhen(
    () => isMortgage(model.loanType),
    () => {
      cross(model.$.loanAmount, loanAmountWithinPropertyValue);
      validate(model.$.propertyValue, PROPERTY_VALUE_RULES);
      validate(model.$.initialPayment, INITIAL_PAYMENT_RULES);
      cross(model.$.initialPayment, initialPaymentWithinPropertyValue);
    }
  );

  validateWhen(
    () => isCarLoan(model.loanType),
    () => {
      validate(model.$.carBrand, CAR_BRAND_RULES);
      validate(model.$.carModel, CAR_MODEL_RULES);
      validate(model.$.carYear, CAR_YEAR_RULES);
      validate(model.$.carPrice, CAR_PRICE_RULES);
    }
  );
});
```

```ts
// validation/applicant.ts
import type { ValidationError } from '@reformer/core';
import { defineValidationSchema, validate, type Rule } from '@reformer/core/validation';
import {
  maxAge,
  maxLength,
  minAge,
  minLength,
  pastDate,
  pattern,
  required,
} from '@reformer/core/validators';
import type { PersonalData } from '../components/nested-forms/PersonalData/types';
import type { CreditApplicationForm } from '../types/credit-application';
import { ruName } from './common/rules';

const BIRTH_DATE_RULES: Rule<string>[] = [
  required({ message: 'Дата рождения обязательна' }),
  minAge(18, { message: 'Заемщику должно быть не менее 18 лет' }),
  maxAge(70, { message: 'Максимальный возраст заемщика: 70 лет' }),
];

const GENDER_RULES: Rule<PersonalData['gender']>[] = [required({ message: 'Выберите пол' })];

const BIRTH_PLACE_RULES: Rule<string>[] = [
  required({ message: 'Место рождения обязательно' }),
  minLength(5, { message: 'Минимум 5 символов' }),
  maxLength(100, { message: 'Максимум 100 символов' }),
];

const PASSPORT_SERIES_RULES: Rule<string>[] = [
  required({ message: 'Серия паспорта обязательна' }),
  pattern(/^\d{2}\s\d{2}$/, { message: 'Формат: 00 00' }),
];

const PASSPORT_NUMBER_RULES: Rule<string>[] = [
  required({ message: 'Номер паспорта обязателен' }),
  pattern(/^\d{6}$/, { message: 'Номер должен содержать 6 цифр' }),
];

const PASSPORT_ISSUE_DATE_RULES: Rule<string>[] = [
  required({ message: 'Дата выдачи обязательна' }),
  pastDate({ message: 'Дата выдачи не может быть в будущем' }),
];

const PASSPORT_ISSUED_BY_RULES: Rule<string>[] = [
  required({ message: 'Кем выдан обязательно' }),
  minLength(10, { message: 'Минимум 10 символов' }),
  maxLength(200, { message: 'Максимум 200 символов' }),
];

const PASSPORT_DEPARTMENT_CODE_RULES: Rule<string>[] = [
  required({ message: 'Код подразделения обязателен' }),
  pattern(/^\d{3}-\d{3}$/, { message: 'Формат: 000-000' }),
];

const INN_RULES: Rule<string>[] = [
  required({ message: 'ИНН обязателен' }),
  pattern(/^\d{12}$/, { message: 'ИНН должен содержать 12 цифр' }),
];

const SNILS_RULES: Rule<string>[] = [
  required({ message: 'СНИЛС обязателен' }),
  pattern(/^\d{3}-\d{3}-\d{3}\s\d{2}$/, { message: 'Формат: 000-000-000 00' }),
];

const passportIssuedAfterAge14 = (application: CreditApplicationForm): ValidationError | null => {
  const { birthDate } = application.personalData;
  const { issueDate } = application.passportData;
  if (!birthDate || !issueDate) return null;
  const earliestIssueDate = new Date(birthDate);
  earliestIssueDate.setFullYear(earliestIssueDate.getFullYear() + 14);
  return new Date(issueDate) < earliestIssueDate
    ? {
        code: 'passportIssuedBeforeMinAge',
        message: 'Паспорт не может быть выдан ранее достижения 14 лет',
      }
    : null;
};

export const applicantRules = defineValidationSchema<CreditApplicationForm>(({ model, cross }) => {
  validate(model.$.personalData.lastName, ruName('Фамилия'));
  validate(model.$.personalData.firstName, ruName('Имя'));
  validate(model.$.personalData.middleName, ruName('Отчество'));
  validate(model.$.personalData.birthDate, BIRTH_DATE_RULES);
  validate(model.$.personalData.gender, GENDER_RULES);
  validate(model.$.personalData.birthPlace, BIRTH_PLACE_RULES);
  validate(model.$.passportData.series, PASSPORT_SERIES_RULES);
  validate(model.$.passportData.number, PASSPORT_NUMBER_RULES);
  validate(model.$.passportData.issueDate, PASSPORT_ISSUE_DATE_RULES);
  cross(model.$.passportData.issueDate, passportIssuedAfterAge14);
  validate(model.$.passportData.issuedBy, PASSPORT_ISSUED_BY_RULES);
  validate(model.$.passportData.departmentCode, PASSPORT_DEPARTMENT_CODE_RULES);
  validate(model.$.inn, INN_RULES);
  validate(model.$.snils, SNILS_RULES);
});
```

```ts
// validation/contacts.ts
import type { ValidationError } from '@reformer/core';
import {
  apply,
  defineValidationSchema,
  validate,
  validateWhen,
  type Rule,
} from '@reformer/core/validation';
import { required } from '@reformer/core/validators';
import { livesElsewhere } from '../model/predicates';
import type { CreditApplicationForm } from '../types/credit-application';
import { addressRules } from './common/address';
import { EMAIL_FORMAT_RULES, EMAIL_REQUIRED_RULES, PHONE_FORMAT_RULES } from './common/rules';

const PHONE_MAIN_RULES: Rule<string>[] = [
  required({ message: 'Телефон обязателен' }),
  ...PHONE_FORMAT_RULES,
];

const additionalPhoneDiffers = (application: CreditApplicationForm): ValidationError | null => {
  if (!application.phoneAdditional) return null;
  return application.phoneMain === application.phoneAdditional
    ? { code: 'phoneDuplicate', message: 'Дополнительный телефон должен отличаться от основного' }
    : null;
};

const additionalEmailDiffers = (application: CreditApplicationForm): ValidationError | null => {
  if (!application.emailAdditional) return null;
  return application.email.toLowerCase() === application.emailAdditional.toLowerCase()
    ? { code: 'emailDuplicate', message: 'Дополнительный email должен отличаться от основного' }
    : null;
};

export const contactsRules = defineValidationSchema<CreditApplicationForm>(({ model, cross }) => {
  validate(model.$.phoneMain, PHONE_MAIN_RULES);
  validate(model.$.phoneAdditional, PHONE_FORMAT_RULES);
  cross(model.$.phoneAdditional, additionalPhoneDiffers);
  validate(model.$.email, EMAIL_REQUIRED_RULES);
  validate(model.$.emailAdditional, EMAIL_FORMAT_RULES);
  cross(model.$.emailAdditional, additionalEmailDiffers);
  apply(model.$.registrationAddress, addressRules);
  // Адрес проживания проверяется, только если он не совпадает с адресом регистрации
  validateWhen(
    () => livesElsewhere(model.sameAsRegistration),
    () => apply(model.$.residenceAddress, addressRules)
  );
});
```

```ts
// validation/employment.ts
import type { ValidationError } from '@reformer/core';
import {
  defineValidationSchema,
  validate,
  validateWhen,
  type Rule,
} from '@reformer/core/validation';
import { max, maxLength, min, minLength, pattern, required } from '@reformer/core/validators';
import { isEmployed, isSelfEmployed } from '../model/predicates';
import type { CreditApplicationForm, EmploymentStatus } from '../types/credit-application';
import { MAX_10M_RUB_RULES, NON_NEGATIVE_RULES, PHONE_FORMAT_RULES } from './common/rules';

const EMPLOYMENT_STATUS_RULES: Rule<EmploymentStatus>[] = [
  required({ message: 'Укажите статус занятости' }),
];

const COMPANY_NAME_RULES: Rule<string>[] = [
  required({ message: 'Укажите название компании' }),
  minLength(3, { message: 'Минимум 3 символа' }),
  maxLength(200, { message: 'Максимум 200 символов' }),
];

const COMPANY_INN_RULES: Rule<string>[] = [
  required({ message: 'ИНН компании обязателен' }),
  pattern(/^\d{10}$/, { message: 'ИНН компании — 10 цифр' }),
];

const COMPANY_PHONE_RULES: Rule<string>[] = [
  required({ message: 'Телефон компании обязателен' }),
  ...PHONE_FORMAT_RULES,
];

const COMPANY_ADDRESS_RULES: Rule<string>[] = [
  required({ message: 'Адрес компании обязателен' }),
  minLength(10, { message: 'Минимум 10 символов' }),
  maxLength(300, { message: 'Максимум 300 символов' }),
];

const POSITION_RULES: Rule<string>[] = [
  required({ message: 'Укажите должность' }),
  minLength(3, { message: 'Минимум 3 символа' }),
  maxLength(100, { message: 'Максимум 100 символов' }),
];

/** Границы стажа в годах — общий и на текущем месте. */
const EXPERIENCE_YEARS_RULES: Rule<number | null>[] = [
  ...NON_NEGATIVE_RULES,
  max(60, { message: 'Максимум 60 лет' }),
];

const WORK_EXPERIENCE_TOTAL_RULES: Rule<number | null>[] = [
  required({ message: 'Укажите общий стаж' }),
  ...EXPERIENCE_YEARS_RULES,
];

const WORK_EXPERIENCE_CURRENT_RULES: Rule<number | null>[] = [
  required({ message: 'Укажите стаж на текущем месте' }),
  ...EXPERIENCE_YEARS_RULES,
];

const BUSINESS_TYPE_RULES: Rule<string>[] = [required({ message: 'Укажите тип бизнеса' })];

const BUSINESS_INN_RULES: Rule<string>[] = [
  required({ message: 'ИНН ИП обязателен' }),
  pattern(/^\d{12}$/, { message: 'ИНН ИП — 12 цифр' }),
];

const BUSINESS_ACTIVITY_RULES: Rule<string>[] = [
  required({ message: 'Укажите вид деятельности' }),
  minLength(10, { message: 'Минимум 10 символов' }),
  maxLength(300, { message: 'Максимум 300 символов' }),
];

const MONTHLY_INCOME_RULES: Rule<number | null>[] = [
  required({ message: 'Укажите ежемесячный доход' }),
  min(10000, { message: 'Минимум 10 000 ₽' }),
  ...MAX_10M_RUB_RULES,
];

const ADDITIONAL_INCOME_RULES: Rule<number | null>[] = [
  ...NON_NEGATIVE_RULES,
  ...MAX_10M_RUB_RULES,
];

const currentExperienceWithinTotal = (
  application: CreditApplicationForm
): ValidationError | null => {
  const { workExperienceCurrent, workExperienceTotal } = application;
  return workExperienceCurrent && workExperienceTotal && workExperienceCurrent > workExperienceTotal
    ? {
        code: 'currentExperienceExceedsTotal',
        message: 'Стаж на текущем месте не может превышать общий стаж',
      }
    : null;
};

const additionalIncomeSourceRequired = (
  application: CreditApplicationForm
): ValidationError | null =>
  application.additionalIncome &&
  application.additionalIncome > 0 &&
  !application.additionalIncomeSource
    ? { code: 'additionalIncomeSourceRequired', message: 'Укажите источник дополнительного дохода' }
    : null;

export const employmentRules = defineValidationSchema<CreditApplicationForm>(
  ({ model, cross }) => {
    validate(model.$.employmentStatus, EMPLOYMENT_STATUS_RULES);

    validateWhen(
      () => isEmployed(model.employmentStatus),
      () => {
        validate(model.$.companyName, COMPANY_NAME_RULES);
        validate(model.$.companyInn, COMPANY_INN_RULES);
        validate(model.$.companyPhone, COMPANY_PHONE_RULES);
        validate(model.$.companyAddress, COMPANY_ADDRESS_RULES);
        validate(model.$.position, POSITION_RULES);
        validate(model.$.workExperienceTotal, WORK_EXPERIENCE_TOTAL_RULES);
        validate(model.$.workExperienceCurrent, WORK_EXPERIENCE_CURRENT_RULES);
        cross(model.$.workExperienceCurrent, currentExperienceWithinTotal);
      }
    );

    validateWhen(
      () => isSelfEmployed(model.employmentStatus),
      () => {
        validate(model.$.businessType, BUSINESS_TYPE_RULES);
        validate(model.$.businessInn, BUSINESS_INN_RULES);
        validate(model.$.businessActivity, BUSINESS_ACTIVITY_RULES);
      }
    );

    validate(model.$.monthlyIncome, MONTHLY_INCOME_RULES);
    validate(model.$.additionalIncome, ADDITIONAL_INCOME_RULES);
    cross(model.$.additionalIncomeSource, additionalIncomeSourceRequired);
  }
);
```

```ts
// validation/additional.ts
import type { ValidationError } from '@reformer/core';
import {
  applyEach,
  defineValidationSchema,
  validate,
  type Rule,
} from '@reformer/core/validation';
import { max, required } from '@reformer/core/validators';
import type {
  CreditApplicationForm,
  EducationLevel,
  MaritalStatus,
} from '../types/credit-application';
import { coBorrowerRules } from './common/co-borrower';
import { existingLoanRules } from './common/existing-loan';
import { propertyRules } from './common/property';
import { NON_NEGATIVE_RULES } from './common/rules';

const MARITAL_STATUS_RULES: Rule<MaritalStatus>[] = [
  required({ message: 'Укажите семейное положение' }),
];

const DEPENDENTS_RULES: Rule<number>[] = [
  required({ message: 'Укажите количество иждивенцев' }),
  ...NON_NEGATIVE_RULES,
  max(10, { message: 'Максимум 10' }),
];

const EDUCATION_RULES: Rule<EducationLevel>[] = [
  required({ message: 'Укажите уровень образования' }),
];

/** Флаг включён, а список пуст: ошибка вешается на флаг. */
const requireItems = (
  enabled: boolean,
  items: readonly unknown[],
  message: string
): ValidationError | null =>
  enabled && items.length === 0 ? { code: 'arrayEmpty', message } : null;

export const additionalRules = defineValidationSchema<CreditApplicationForm>(
  ({ model, cross }) => {
    validate(model.$.maritalStatus, MARITAL_STATUS_RULES);
    validate(model.$.dependents, DEPENDENTS_RULES);
    validate(model.$.education, EDUCATION_RULES);

    cross(model.$.hasProperty, (application) =>
      requireItems(
        application.hasProperty,
        application.properties,
        'Добавьте хотя бы один объект имущества'
      )
    );
    cross(model.$.hasExistingLoans, (application) =>
      requireItems(
        application.hasExistingLoans,
        application.existingLoans,
        'Добавьте информацию о кредите'
      )
    );
    cross(model.$.hasCoBorrower, (application) =>
      requireItems(
        application.hasCoBorrower,
        application.coBorrowers,
        'Добавьте информацию о созаемщике'
      )
    );

    applyEach(model.$.properties, propertyRules);
    applyEach(model.$.existingLoans, existingLoanRules);
    applyEach(model.$.coBorrowers, coBorrowerRules);
  }
);
```

```ts
// validation/confirmation.ts
import {
  defineValidationSchema,
  validate,
  validateAsync,
  type AsyncRule,
  type Rule,
} from '@reformer/core/validation';
import { maxLength, minLength, pattern, required } from '@reformer/core/validators';
import type { CreditApplicationForm } from '../types/credit-application';

const AGREE_PERSONAL_DATA_RULES: Rule<boolean>[] = [
  required({ message: 'Согласие на обработку ПД обязательно' }),
];

const AGREE_CREDIT_HISTORY_RULES: Rule<boolean>[] = [
  required({ message: 'Согласие на проверку кредитной истории обязательно' }),
];

const AGREE_TERMS_RULES: Rule<boolean>[] = [
  required({ message: 'Согласие с условиями обязательно' }),
];

const CONFIRM_ACCURACY_RULES: Rule<boolean>[] = [
  required({ message: 'Подтверждение точности обязательно' }),
];

const ELECTRONIC_SIGNATURE_RULES: Rule<string>[] = [
  required({ message: 'Введите код из СМС' }),
  minLength(6, { message: 'Код — 6 символов' }),
  maxLength(6, { message: 'Код — 6 символов' }),
  pattern(/^\d{6}$/, { message: 'Только цифры' }),
];

/** Код из СМС (демо: 123456). */
const smsCode: AsyncRule<string> = async (value) => {
  if (!value || value.length !== 6) return null;
  await new Promise((resolve) => setTimeout(resolve, 200));
  return value !== '123456'
    ? {
        code: 'invalidSmsCode',
        message: 'Неверный код подтверждения. Для демо используйте: 123456',
      }
    : null;
};

export const confirmationRules = defineValidationSchema<CreditApplicationForm>(({ model }) => {
  validate(model.$.agreePersonalData, AGREE_PERSONAL_DATA_RULES);
  validate(model.$.agreeCreditHistory, AGREE_CREDIT_HISTORY_RULES);
  validate(model.$.agreeTerms, AGREE_TERMS_RULES);
  validate(model.$.confirmAccuracy, CONFIRM_ACCURACY_RULES);
  validate(model.$.electronicSignature, ELECTRONIC_SIGNATURE_RULES);
  validateAsync(model.$.electronicSignature, [smsCode]);
});
```

```ts
// validation/cross-step.ts
/**
 * Правила и предупреждения всей формы: проверяются целиком, при отправке.
 */

import type { ValidationError } from '@reformer/core';
import { defineValidationSchema } from '@reformer/core/validation';
import type { CreditApplicationForm } from '../types/credit-application';

const paymentWithinIncome = (application: CreditApplicationForm): ValidationError | null =>
  application.paymentToIncomeRatio > 50
    ? {
        code: 'paymentTooHigh',
        message: `Ежемесячный платеж не должен превышать 50% дохода (сейчас ${application.paymentToIncomeRatio}%)`,
      }
    : null;

const applicantAgeAllowed = (application: CreditApplicationForm): ValidationError | null => {
  const { age } = application;
  if (!age) return null;
  if (age < 18) return { code: 'ageTooYoung', message: 'Заемщик должен быть старше 18 лет' };
  if (age > 70) return { code: 'ageTooOld', message: 'Заемщик должен быть младше 70 лет' };
  return null;
};

const warnHighDebtLoad = (application: CreditApplicationForm): ValidationError | null =>
  application.paymentToIncomeRatio > 40 && application.paymentToIncomeRatio <= 50
    ? {
        code: 'highDebtLoad',
        message: 'Высокая долговая нагрузка. Рекомендуем уменьшить сумму или увеличить срок.',
        severity: 'warning',
      }
    : null;

const warnSeniorAge = (application: CreditApplicationForm): ValidationError | null =>
  application.age !== null && application.age > 60 && application.age <= 70
    ? {
        code: 'seniorAge',
        message: 'Могут потребоваться дополнительные гарантии в связи с возрастом.',
        severity: 'warning',
      }
    : null;

const warnLowExperience = (application: CreditApplicationForm): ValidationError | null =>
  application.workExperienceCurrent !== null && application.workExperienceCurrent < 3
    ? {
        code: 'lowWorkExperience',
        message: 'Малый стаж на текущем месте может повлиять на решение.',
        severity: 'warning',
      }
    : null;

export const crossStepRules = defineValidationSchema<CreditApplicationForm>(({ model, cross }) => {
  cross(model.$.monthlyPayment, paymentWithinIncome);
  cross(model.$.age, applicantAgeAllowed);
  cross(model.$.age, warnSeniorAge);
  cross(model.$.paymentToIncomeRatio, warnHighDebtLoad);
  cross(model.$.workExperienceCurrent, warnLowExperience);
});
```

```ts
// validation/form.ts
/**
 * Правила валидации кредитной заявки как данные — поле `validation` сборки `createForm`.
 *
 * Правила шагов берутся из потока заявки: ключ — `selector` шага, порядок — порядок шагов.
 * Ссылка стабильна на уровне модуля: отмена устаревших прогонов ключуется по паре (модель, схема).
 */

import type { FormValidation } from '@reformer/core';
import { creditApplicationFlow } from '../flow/credit-application-flow';
import type { CreditApplicationForm } from '../types/credit-application';
import { crossStepRules } from './cross-step';

export const creditApplicationValidation: FormValidation<CreditApplicationForm> = {
  steps: Object.fromEntries(creditApplicationFlow.map((step) => [step.selector, step.rules])),
  extras: crossStepRules,
};
```

### `behavior/`

```ts
// behavior/index.ts
/**
 * Поведение кредитной заявки: значения модели, состояние полей и видимость секций.
 *
 * Загрузка заявки, отправка и работа с визардом сюда не входят — это уровень приложения
 * (`application/`): поведение статично и не знает идентификатора заявки.
 */

import { apply, defineFormBehavior } from '@reformer/core/behaviors';
import { addressBehavior } from '../components/nested-forms/Address/address-behavior';
import type { CreditApplicationForm } from '../types/credit-application';
import { derived } from './derived';
import { synchronization } from './synchronization';
import { conditions } from './conditions';
import { dynamicOptions } from './dynamic-options';

export const creditApplicationBehavior = defineFormBehavior<CreditApplicationForm>((scope) => {
  derived(scope);
  synchronization(scope);
  conditions(scope);
  dynamicOptions(scope);

  // Поведение подформы адреса — на оба адреса
  const { model } = scope;
  apply([model.$.registrationAddress, model.$.residenceAddress], addressBehavior);
});
```

```ts
// behavior/derived.ts
import { compute, type BehaviorScope } from '@reformer/core/behaviors';
import { isMortgage } from '../model/predicates';
import type { CreditApplicationForm } from '../types/credit-application';
import {
  computeAge,
  computeCoBorrowersIncome,
  computeFullName,
  computeInitialPayment,
  computeInterestRate,
  computeMonthlyPayment,
  computePaymentRatio,
  computeTotalIncome,
} from '../utils';

/** Вычисляемые поля: `compute` следит за сигналами, которые прочитаны в расчёте. */
export function derived({ model }: BehaviorScope<CreditApplicationForm>): void {
  compute(model.$.interestRate, () =>
    computeInterestRate({
      loanType: model.loanType,
      region: model.registrationAddress.region,
      hasProperty: model.hasProperty,
      propertyCount: model.properties.length,
    })
  );
  compute(model.$.monthlyPayment, () => computeMonthlyPayment(model));
  // Первоначальный взнос (20 % стоимости) — только для ипотеки
  compute(model.$.initialPayment, () => computeInitialPayment(model), {
    when: () => isMortgage(model.loanType),
  });
  compute(model.$.fullName, () => computeFullName(model.personalData));
  compute(model.$.age, () => computeAge(model.personalData.birthDate));
  compute(model.$.coBorrowersIncome, () =>
    computeCoBorrowersIncome(model.coBorrowers.map((coBorrower) => coBorrower.monthlyIncome))
  );
  compute(model.$.totalIncome, () => computeTotalIncome(model));
  compute(model.$.paymentToIncomeRatio, () => computePaymentRatio(model));
}
```

```ts
// behavior/synchronization.ts
import { copyFrom, type BehaviorScope } from '@reformer/core/behaviors';
import type { CreditApplicationForm } from '../types/credit-application';
import { clearWhenOff } from './operators';

/** Согласованность значений: копии полей и очистка списков при снятом флаге. */
export function synchronization({ model, form }: BehaviorScope<CreditApplicationForm>): void {
  copyFrom(model.$.email, model.$.emailAdditional, { when: () => model.sameEmail === true });
  copyFrom(model.$.registrationAddress, model.$.residenceAddress, {
    when: () => model.sameAsRegistration === true,
  });

  clearWhenOff(model.$.hasProperty, form.properties);
  clearWhenOff(model.$.hasExistingLoans, form.existingLoans);
  clearWhenOff(model.$.hasCoBorrower, form.coBorrowers);
}
```

```ts
// behavior/conditions.ts
import { enableWhen, hideWhen, type BehaviorScope } from '@reformer/core/behaviors';
import {
  isBusinessLoan,
  isCarLoan,
  isEmployed,
  isMortgage,
  isSelfEmployed,
  isUnemployed,
  livesElsewhere,
} from '../model/predicates';
import type { CreditApplicationForm } from '../types/credit-application';

/**
 * Условные секции: включение полей и видимость секции — рядом.
 *
 * Видимость (`hideWhen`) исполняет рендерер; в варианте «React руками» те же условия из
 * `model/predicates.ts` читает JSX шагов.
 */
export function conditions({ model, schema }: BehaviorScope<CreditApplicationForm>): void {
  const mortgage = () => isMortgage(model.loanType);
  const carLoan = () => isCarLoan(model.loanType);
  const businessLoan = () => isBusinessLoan(model.loanType);
  const employed = () => isEmployed(model.employmentStatus);
  const selfEmployed = () => isSelfEmployed(model.employmentStatus);
  const unemployed = () => isUnemployed(model.employmentStatus);
  const separateResidence = () => livesElsewhere(model.sameAsRegistration);

  enableWhen([model.$.propertyValue, model.$.initialPayment], mortgage, {
    resetOnDisable: true,
  });
  hideWhen(schema.node('mortgage-section'), () => !mortgage());

  enableWhen([model.$.carBrand, model.$.carModel, model.$.carYear, model.$.carPrice], carLoan, {
    resetOnDisable: true,
  });
  hideWhen(schema.node('car-section'), () => !carLoan());

  enableWhen(
    [
      model.$.companyName,
      model.$.companyInn,
      model.$.companyPhone,
      model.$.companyAddress,
      model.$.position,
    ],
    employed,
    { resetOnDisable: true }
  );
  hideWhen(schema.node('employer-section'), () => !employed());

  // Бизнес-поля стоят в схеме дважды: на шаге «Кредит» (бизнес-кредит) и на шаге «Работа»
  // (самозанятый). Поля одни и те же — включает их статус занятости.
  enableWhen([model.$.businessType, model.$.businessInn, model.$.businessActivity], selfEmployed, {
    resetOnDisable: true,
  });
  hideWhen(schema.node('loan-business-section'), () => !businessLoan());
  hideWhen(schema.node('business-section'), () => !selfEmployed());

  hideWhen(schema.node('income-section'), unemployed);
  hideWhen(schema.node('unemployed-warning'), () => !unemployed());

  // Адрес проживания — группа: без сброса, значение копируется из адреса регистрации.
  enableWhen(model.$.residenceAddress, separateResidence);
  hideWhen(schema.node('residence-address-section'), () => !separateResidence());

  hideWhen(schema.node('properties-array'), () => !model.hasProperty);
  hideWhen(schema.node('existing-loans-array'), () => !model.hasExistingLoans);
  hideWhen(schema.node('co-borrowers-array'), () => !model.hasCoBorrower);
}
```

```ts
// behavior/dynamic-options.ts
import { onChange, type BehaviorScope } from '@reformer/core/behaviors';
import { fetchCarModels } from '../api';
import type { CreditApplicationForm } from '../types/credit-application';
import { loadOptionsOn } from './operators';

/** Пропсы полей, которые зависят от значений: списки опций и пределы ввода. */
export function dynamicOptions({ model, form }: BehaviorScope<CreditApplicationForm>): void {
  loadOptionsOn(model.$.carBrand, form.carModel, fetchCarModels, { resetTarget: true });

  // Максимальная сумма кредита от дохода (≤ 10 годовых, не более 10 млн)
  onChange(model.$.totalIncome, (totalIncome) => {
    if (totalIncome > 0) {
      form.loanAmount.updateComponentProps({ max: Math.min(totalIncome * 12 * 10, 10_000_000) });
    }
  });
  // Максимальный срок с учётом возраста (погашение до 70 лет)
  onChange(model.$.age, (age) => {
    if (age !== null && age >= 18) {
      form.loanTerm.updateComponentProps({ max: Math.min(Math.max(70 - age, 1) * 12, 240) });
    }
  });
}
```

```ts
// behavior/operators.ts
/**
 * Пользовательские операторы поведения кредитной формы: обычные функции поверх встроенных
 * операторов `@reformer/core/behaviors`.
 */

import { onChange, type ReadonlySignal } from '@reformer/core/behaviors';

/** Нода-поле с динамическими опциями (Select и подобные). */
interface OptionsTarget {
  reset(): void;
  updateComponentProps(props: Record<string, unknown>): void;
}

/** Нода-массив, которую можно очистить. */
interface Clearable {
  clear(): void;
}

/**
 * Подгружать опции поля при изменении источника. Ответ на устаревшее значение источника
 * отбрасывается: `signal` отменяется, когда источник меняется снова.
 *
 * @example
 * loadOptionsOn(model.$.carBrand, form.carModel, fetchCarModels, { resetTarget: true });
 */
export function loadOptionsOn<TValue, TOption>(
  source: ReadonlySignal<TValue>,
  target: OptionsTarget,
  fetcher: (value: TValue, signal: AbortSignal) => Promise<{ data: TOption[] }>,
  options: { debounce?: number; resetTarget?: boolean } = {}
): void {
  const { debounce = 300, resetTarget = false } = options;
  onChange(
    source,
    async (value, { signal }) => {
      if (resetTarget) target.reset();
      if (!value) {
        target.updateComponentProps({ options: [] });
        return;
      }
      try {
        const { data } = await fetcher(value, signal);
        if (!signal.aborted) target.updateComponentProps({ options: data });
      } catch {
        if (!signal.aborted) target.updateComponentProps({ options: [] });
      }
    },
    { debounce }
  );
}

/** Очистить массив-ноду при снятии булева флага. */
export function clearWhenOff(flag: ReadonlySignal<boolean>, array: Clearable): void {
  onChange(flag, (enabled) => {
    if (!enabled) array.clear();
  });
}
```

`components/nested-forms/Address/address-behavior.ts` остаётся на месте; меняется путь импорта
`loadOptionsOn` — `'../../../behavior/operators'`.

`api/fetch-car-models.ts`, `api/fetch-cities.ts` — второй аргумент и отмена запроса:

```ts
export async function fetchCarModels(
  brand: string,
  signal?: AbortSignal
): Promise<AxiosResponse<Option[]>> {
  return axios.get(`/api/v1/car-models?brand=${brand}`, { signal });
}
```

### `utils/compute/*.ts`

```ts
// compute-interest-rate.ts
import type { LoanType } from '../../types/credit-application';

const BASE_RATES: Record<LoanType, number> = {
  consumer: 15.5,
  mortgage: 8.5,
  car: 12.0,
  business: 18.0,
  refinancing: 14.0,
};
const DEFAULT_RATE = 15.0;

/** Процентная ставка (%): базовая по типу кредита с надбавками и скидками. */
export function computeInterestRate({
  loanType,
  region,
  hasProperty,
  propertyCount,
}: {
  loanType: LoanType;
  region: string;
  hasProperty: boolean;
  propertyCount: number;
}): number {
  let rate = BASE_RATES[loanType] ?? DEFAULT_RATE;
  // Надбавка за регион: Москва дороже
  if (loanType === 'mortgage' && region === 'moscow') rate += 0.5;
  // TODO: скидка за КАСКО для автокредита — нужен параметр carInsurance
  // Скидка за обеспечение имуществом
  if (hasProperty && propertyCount > 0) rate -= 0.5;
  return Math.max(rate, 0);
}

// compute-monthly-payment.ts
import type { CreditApplicationForm } from '../../types/credit-application';

/** Ежемесячный платёж (₽) по формуле аннуитета. */
export function computeMonthlyPayment({
  loanAmount,
  loanTerm,
  interestRate,
}: Pick<CreditApplicationForm, 'loanAmount' | 'loanTerm' | 'interestRate'>): number {
  if (!loanAmount || !loanTerm) return 0;
  const monthlyRate = interestRate / 12 / 100;
  if (monthlyRate === 0) return loanAmount / loanTerm;
  const growth = Math.pow(1 + monthlyRate, loanTerm);
  return Math.round((loanAmount * (monthlyRate * growth)) / (growth - 1));
}

// compute-initial-payment.ts
/** Первоначальный взнос (₽): 20 % стоимости недвижимости. */
export function computeInitialPayment({
  propertyValue,
}: Pick<CreditApplicationForm, 'propertyValue'>): number {
  return propertyValue ? Math.round(propertyValue * 0.2) : 0;
}

// compute-full-name.ts
import type { PersonalData } from '../../components/nested-forms/PersonalData/types';

/** Полное имя: «Фамилия Имя Отчество» без пустых частей. */
export function computeFullName({
  lastName,
  firstName,
  middleName,
}: Pick<PersonalData, 'lastName' | 'firstName' | 'middleName'>): string {
  return [lastName, firstName, middleName].filter(Boolean).join(' ');
}

// compute-age.ts
/** Возраст (полных лет) по дате рождения; без даты — `null`. */
export function computeAge(birthDate: string): number | null {
  if (!birthDate) return null;
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDifference = today.getMonth() - birth.getMonth();
  if (monthDifference < 0 || (monthDifference === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

// compute-co-borrowers-income.ts
/** Суммарный доход созаёмщиков (₽). */
export function computeCoBorrowersIncome(monthlyIncomes: readonly number[]): number {
  return monthlyIncomes.reduce((total, monthlyIncome) => total + (monthlyIncome || 0), 0);
}

// compute-total-income.ts
/** Общий доход (₽): основной, дополнительный и доход созаёмщиков. */
export function computeTotalIncome({
  monthlyIncome,
  additionalIncome,
  coBorrowersIncome,
}: Pick<CreditApplicationForm, 'monthlyIncome' | 'additionalIncome' | 'coBorrowersIncome'>): number {
  return (monthlyIncome ?? 0) + (additionalIncome ?? 0) + coBorrowersIncome;
}

// compute-payment-ratio.ts
/** Доля платежа в доходе (%). */
export function computePaymentRatio({
  monthlyPayment,
  totalIncome,
}: Pick<CreditApplicationForm, 'monthlyPayment' | 'totalIncome'>): number {
  if (!monthlyPayment || !totalIncome) return 0;
  return Math.round((monthlyPayment / totalIncome) * 100);
}
```

### `application/`

```ts
// application/create.ts
/**
 * Сборка кредитной заявки — одна на все способы реализации.
 *
 * Варианты отличаются только тем, что передают сверху: JSON-вариант — документ схемы и реестр,
 * renderer-варианты — `setup` со связкой узлов (`application/renderer.ts`).
 */

import { createForm, type CreateFormConfig } from '@reformer/core';
import { creditApplicationBehavior } from '../behavior';
import { createCreditApplicationModel } from '../model/model';
import { creditApplicationSchema } from '../schema/form';
import type { CreditApplicationForm } from '../types/credit-application';
import { creditApplicationValidation } from '../validation/form';

type Overrides = Pick<CreateFormConfig<CreditApplicationForm>, 'schema' | 'registry' | 'setup'>;

export const createCreditApplication = (overrides: Overrides = {}) =>
  createForm<CreditApplicationForm>({
    model: createCreditApplicationModel(),
    schema: creditApplicationSchema,
    behavior: creditApplicationBehavior,
    validation: creditApplicationValidation,
    ...overrides,
  });
```

```ts
// application/load.ts
/**
 * Загрузка кредитной заявки и справочников — только сеть.
 */

import { fetchCreditApplication, fetchDictionaries, type DictionariesResponse } from '../api';
import type { CreditApplicationForm } from '../types/credit-application';

/** Всё, что нужно экрану заявки: сама заявка и справочники. */
export interface CreditApplicationData {
  application: Partial<CreditApplicationForm>;
  dictionaries: DictionariesResponse;
}

/**
 * Загрузить заявку и справочники как одну единицу: падение любого запроса одинаково фатально.
 *
 * @param applicationId - идентификатор заявки
 * @param signal - сигнал отмены устаревшего запроса
 */
export async function loadCreditApplication(
  applicationId: string,
  signal?: AbortSignal
): Promise<CreditApplicationData> {
  const [applicationResponse, dictionariesResponse] = await Promise.all([
    fetchCreditApplication(applicationId, signal),
    fetchDictionaries(signal),
  ]);

  // Разные сообщения: пользователь должен понимать, что именно не загрузилось.
  if (applicationResponse?.status !== 200) throw new Error('Ошибка загрузки заявки');
  if (dictionariesResponse?.status !== 200) throw new Error('Ошибка загрузки справочников');

  return {
    application: applicationResponse.data,
    dictionaries: dictionariesResponse.data,
  };
}
```

```ts
// application/mapping.ts
/**
 * Ответ сервера → модель и поля формы.
 */

import type { FormModel, FormProxy } from '@reformer/core';
import type { CreditApplicationForm } from '../types/credit-application';
import type { CreditApplicationData } from './load';

/**
 * Записать загруженную заявку в модель и раздать справочники полям.
 *
 * Загруженные значения становятся точкой отсчёта модели: форма не считается изменённой, а
 * `model.reset()` возвращает к ним.
 */
export function applyCreditApplication(
  target: { model: FormModel<CreditApplicationForm>; form: FormProxy<CreditApplicationForm> },
  { application, dictionaries }: CreditApplicationData
): void {
  const { model, form } = target;
  model.patch(application);
  model.captureInitial();

  // Справочники — следующим тактом: строки массивов к этому моменту уже построены.
  queueMicrotask(() => {
    form.registrationAddress.city.updateComponentProps({ options: dictionaries.cities });
    form.residenceAddress.city.updateComponentProps({ options: dictionaries.cities });
    form.properties.forEach((property) => {
      property.type.updateComponentProps({ options: dictionaries.propertyTypes });
    });
    form.existingLoans.forEach((existingLoan) => {
      existingLoan.bank.updateComponentProps({ options: dictionaries.banks });
    });
  });
}
```

```ts
// application/submit.ts
/**
 * Отправка кредитной заявки и сообщение о результате — одни на все способы реализации.
 */

import { submitCreditApplication } from '../api';
import type { CreditApplicationForm } from '../types/credit-application';

export type SubmitOutcome =
  | { status: 'sent'; applicationId: string }
  | { status: 'rejected' }
  | { status: 'unreachable' };

/** Отправить заявку. Не бросает: сбой сети и неожиданный ответ — варианты результата. */
export async function sendCreditApplication(values: CreditApplicationForm): Promise<SubmitOutcome> {
  try {
    const response = await submitCreditApplication(values);
    return response.status === 200 || response.status === 201
      ? { status: 'sent', applicationId: response.data.id }
      : { status: 'rejected' };
  } catch {
    return { status: 'unreachable' };
  }
}

export function reportSubmitOutcome(outcome: SubmitOutcome): void {
  if (outcome.status === 'sent') {
    alert(`Заявка успешно отправлена! ID: ${outcome.applicationId}`);
  } else if (outcome.status === 'rejected') {
    alert('Ошибка отправки заявки: сервер вернул неожиданный ответ');
  } else {
    alert('Ошибка отправки заявки: сервер недоступен');
  }
}
```

```ts
// application/renderer.ts
/**
 * Связка заявки с узлами схемы — для вариантов, где форму рисует рендерер.
 *
 * Правила узлов записываются через `bundle.render.node(selector)`, исполняет их рендерер.
 */

import type { FormBundle } from '@reformer/core';
import { onComponentEvent, onMount, onUnmount, renderEffect } from '@reformer/core/behaviors';
import type { FormWizardHandle } from '@reformer/cdk/form-wizard';
import { isMortgage } from '../model/predicates';
import type { CreditApplicationForm } from '../types/credit-application';
import { loadCreditApplication } from './load';
import { applyCreditApplication } from './mapping';
import { reportSubmitOutcome, sendCreditApplication } from './submit';

export function wireRenderer(
  bundle: FormBundle<CreditApplicationForm>,
  { applicationId }: { applicationId: string }
): void {
  const { model, render } = bundle;
  const boundary = render.node('data-boundary');
  const wizard = render.node('wizard');

  // Загрузка заявки: статус и текст ошибки показывает AsyncBoundary
  const loadApplication = async () => {
    boundary.patchProps({ status: 'loading', error: null });
    try {
      applyCreditApplication(bundle, await loadCreditApplication(applicationId));
      boundary.patchProps({ status: 'ready' });
    } catch (error) {
      // Текст ошибки уходит в пропсы: пользователь должен видеть, что именно не загрузилось.
      boundary.patchProps({
        status: 'error',
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        onRetry: () => void loadApplication(),
      });
    }
  };
  onMount(boundary, () => {
    void loadApplication();
  });

  // Отправка: визард зовёт обработчик только после успешной валидации
  onComponentEvent(wizard, 'onSubmit', async (values: CreditApplicationForm) => {
    reportSubmitOutcome(await sendCreditApplication(values));
  });

  // Навигация через ref визарда: эффект запускается после монтирования
  const wizardRef = wizard.getRef<FormWizardHandle<CreditApplicationForm>>();
  renderEffect(render.controller.scopeOf(model), () => {
    if (isMortgage(model.loanType)) wizardRef.current?.goToStep(1);
  });

  // Хуки жизненного цикла узла (демонстрация)
  onMount(wizard, () => {
    console.log('[credit-application] wizard mounted');
    return () => console.log('[credit-application] wizard cleanup from onMount');
  });
  onUnmount(wizard, () => {
    console.log('[credit-application] wizard unmounted');
  });
}
```

Сборка в соседних вариантах:

```ts
// -renderer, -registry
createCreditApplication({
  setup: (bundle) => wireRenderer(bundle, { applicationId: '1' }),
});

// -renderer-json
createCreditApplication({
  schema: creditApplicationJson,
  registry,
  setup: (bundle) => wireRenderer(bundle, { applicationId: '1' }),
});
```

### `CreditApplicationForm.tsx`

```tsx
/**
 * CreditApplicationForm — вариант «React руками».
 *
 * Сборка та же, что у renderer-вариантов (`application/create.ts`). Из схемы эта страница берёт
 * поля, из потока — список шагов; разметку шагов рисует JSX. Условия видимости секций — общие с
 * поведением и правилами (`model/predicates.ts`), загрузка и отправка — общие с
 * renderer-вариантами (`application/`).
 */

import { useRef } from 'react';
import { useFormBundle } from '@reformer/core';
import { AsyncBoundary, FormWizard, type FormWizardStep } from '@reformer/ui-kit';
import type { FormWizardHandle } from '@reformer/cdk/form-wizard';
import { ValidationMessagesProvider } from '@reformer/cdk';
import { createCreditApplication } from './application/create';
import { loadCreditApplication, type CreditApplicationData } from './application/load';
import { applyCreditApplication } from './application/mapping';
import { reportSubmitOutcome, sendCreditApplication } from './application/submit';
import { creditApplicationFlow, type StepSelector } from './flow/credit-application-flow';
import { BasicInfoForm } from './components/steps/BasicInfo/BasicInfoForm';
import { PersonalInfoForm } from './components/steps/PersonalInfo/PersonalInfoForm';
import { ContactInfoForm } from './components/steps/ContactInfo/ContactInfoForm';
import { EmploymentForm } from './components/steps/Employment/EmploymentForm';
import { AdditionalInfoForm } from './components/steps/AdditionalInfo/AdditionalInfoForm';
import { ConfirmationForm } from './components/steps/Confirmation/ConfirmationForm';
import { fileUploadMessages } from './constants/file-upload-messages';
import type { CreditApplicationForm as CreditApplicationFormType } from './types/credit-application';

type Step = FormWizardStep<CreditApplicationFormType>;

/** JSX тела шага. Тип требует компонент для каждого шага потока. */
const STEP_BODIES: Record<StepSelector, Step['body']> = {
  loan: BasicInfoForm,
  applicant: PersonalInfoForm,
  contacts: ContactInfoForm,
  employment: EmploymentForm,
  additional: AdditionalInfoForm,
  confirmation: ConfirmationForm,
};

/** Шаги визарда: порядок, заголовки и значки — из потока заявки. */
const STEPS: Step[] = creditApplicationFlow.map((step, index) => ({
  number: index + 1,
  title: step.title,
  icon: step.icon,
  body: STEP_BODIES[step.selector],
}));

function CreditApplicationForm() {
  const wizardRef = useRef<FormWizardHandle<CreditApplicationFormType>>(null);

  // Модель, форма и валидация — одной сборкой. useFormBundle зовёт фабрику ровно один раз и
  // держит бандл стабильным.
  const bundle = useFormBundle(() => createCreditApplication());
  const { form, validation } = bundle;

  // ID заявки: '1' / '2' — редактирование, null — пустая форма (создание).
  const applicationId: string | null = '1';

  const submitApplication = async () => {
    // Визард зовёт обработчик только после успешной валидации; иначе возвращает null.
    const outcome = await wizardRef.current?.submit(sendCreditApplication);
    if (outcome) reportSubmitOutcome(outcome);
    else alert('Пожалуйста, исправьте ошибки в форме');
  };

  // Загрузкой управляет AsyncBoundary: состояние, отмена устаревшего запроса, «Повторить».
  return (
    // Резолвер текстов для кодов отбора FileUpload (поле «Документы», шаг 5).
    <ValidationMessagesProvider resolver={fileUploadMessages}>
      <AsyncBoundary<CreditApplicationData>
        load={(signal) => loadCreditApplication(applicationId!, signal)}
        loadKey={applicationId}
        enabled={applicationId !== null}
        onSuccess={(data) => applyCreditApplication(bundle, data)}
      >
        <FormWizard
          ref={wizardRef}
          form={form}
          config={validation}
          steps={STEPS}
          onSubmit={submitApplication}
          submitLabel="Отправить заявку"
        />
      </AsyncBoundary>
    </ValidationMessagesProvider>
  );
}

export default CreditApplicationForm;
```

### JSX шагов

`components/steps/BasicInfo/BasicInfoForm.tsx` целиком:

```tsx
import type { FormProxy } from '@reformer/core';
import { useFormControlValue } from '@reformer/core';
import { FormField } from '@reformer/ui-kit';
import { isBusinessLoan, isCarLoan, isMortgage } from '../../../model/predicates';
import type { CreditApplicationForm } from '../../../types/credit-application';

interface BasicInfoFormProps {
  control: FormProxy<CreditApplicationForm>;
}

export function BasicInfoForm({ control }: BasicInfoFormProps) {
  const loanType = useFormControlValue(control.loanType);

  return (
    <div className="space-y-6" data-testid="step-basic-info">
      <h2 className="text-xl font-bold" data-testid="step-heading">
        Основная информация о кредите
      </h2>
      <FormField control={control.loanType} testId="loanType" />
      <FormField control={control.loanAmount} testId="loanAmount" />
      <FormField control={control.loanTerm} testId="loanTerm" />
      <FormField control={control.loanPurpose} testId="loanPurpose" />

      {isMortgage(loanType) && (
        <>
          <h3 className="text-lg font-semibold mt-4">Информация о недвижимости</h3>
          <FormField control={control.propertyValue} testId="propertyValue" />
          <FormField control={control.initialPayment} testId="initialPayment" />
        </>
      )}

      {isCarLoan(loanType) && (
        <>
          <h3 className="text-lg font-semibold mt-4">Информация об автомобиле</h3>
          <FormField control={control.carBrand} testId="carBrand" />
          <FormField control={control.carModel} testId="carModel" />
          <div className="grid grid-cols-2 gap-4">
            <FormField control={control.carYear} testId="carYear" />
            <FormField control={control.carPrice} testId="carPrice" />
          </div>
        </>
      )}

      {isBusinessLoan(loanType) && (
        <>
          <h3 className="text-lg font-semibold mt-4">Информация о бизнесе</h3>
          <FormField control={control.businessType} testId="businessType" />
          <FormField control={control.businessInn} testId="businessInn" />
          <FormField control={control.businessActivity} testId="businessActivity" />
        </>
      )}
    </div>
  );
}
```

Остальные шаги — те же замены, разметка не меняется:

```tsx
// components/steps/Employment/EmploymentForm.tsx
const employmentStatus = useFormControlValue(control.employmentStatus);

{isEmployed(employmentStatus) && (/* работодатель, должность и стаж */)}
{isSelfEmployed(employmentStatus) && (/* бизнес */)}
{!isUnemployed(employmentStatus) && (/* доход */)}
{isUnemployed(employmentStatus) && <UnemployedWarning className={'mt-6'} />}

// components/steps/ContactInfo/ContactInfoForm.tsx
const { value: sameAsRegistration } = useFormControl(control.sameAsRegistration);

{livesElsewhere(sameAsRegistration) && (
  <ResidenceAddressSection>
    <AddressForm control={control.residenceAddress} testIdPrefix="residenceAddress" />
  </ResidenceAddressSection>
)}

// components/steps/Confirmation/ConfirmationForm.tsx — значения без приведения типов
const interestRate = useFormControlValue(control.interestRate);
const monthlyPayment = useFormControlValue(control.monthlyPayment);
const fullName = useFormControlValue(control.fullName);
const age = useFormControlValue(control.age);
const totalIncome = useFormControlValue(control.totalIncome);
const paymentToIncomeRatio = useFormControlValue(control.paymentToIncomeRatio);
const coBorrowersIncome = useFormControlValue(control.coBorrowersIncome);

// components/steps/AdditionalInfo/AdditionalInfoForm.tsx — то же для флагов
const hasProperty = useFormControlValue(control.hasProperty);
const hasExistingLoans = useFormControlValue(control.hasExistingLoans);
const hasCoBorrower = useFormControlValue(control.hasCoBorrower);
```

### Что нужно проверить при реализации

- `model.patch` с массивами строк: строки и их ноды формы построены к моменту раздачи справочников;
  если нет — остаётся прежний `form.patchValue`, а `captureInitial` вызывается после него.
- Правила предупреждений читали `paymentToIncomeRatio` и `age` через проверку на истинность; новая
  запись сравнивает числа напрямую — поведение при нуле и `null` сверить тестом.
- `useFormControlValue` без приведения: тип выводится из ноды (`FieldNode<T>` → `T`); если для
  объединений строк вывод не сработает, приведение остаётся в одном месте — в хуке шага.
- Порядок регистрации в поведении: очистка списков (`clearWhenOff`) теперь стоит раньше условных
  секций; реакции независимы, но e2e шага 5 это подтверждает.
- e2e соседних вариантов: переход на шаг 1 при выборе ипотеки, тексты сообщений отправки, пути
  импорта после переезда файлов.
