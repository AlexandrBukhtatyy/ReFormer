# Validation

Как валидировать **значения** формы, собранной из JSON-схемы (`@reformer/renderer-json`). Всё сверено с рабочим кодом: типы узла — [json-schema.ts](../../src/types/json-schema.ts), структурная проверка документа — [validate.ts](../../src/validate.ts), уровень формы — `createForm` из `@reformer/core` (`validate`, `validateStep`, `submission`, поток шагов). Эталон — `complex-multy-step-form-renderer-json` (документ + реестр) поверх общей сборки `complex-multy-step-form/application/create.ts`.

## Mental model — почему валидаторов нет в JSON { #mental-model }

Одна ключевая мысль: **JSON-DSL несёт только layout, а не правила валидации.**

- `JsonFieldNode` — это `{ selector?, model, component?, componentProps?, wrapper? }` и **ничего больше**. Поля `validators` в нём нет (см. [json-schema.ts](../../src/types/json-schema.ts) — интерфейс `JsonFieldNode`).
- Операторы DSL — `$model(...)`, `$component(...)`, `$html(...)`, `$dataSource(...)`, `$fn(...)`, `$locale(...)`, `$part(...)` (см. [operators.ts](../../src/operators.ts)). Оператора `$validator(...)` **не существует**.
- `validateFormSchema` (точка входа `@reformer/renderer-json/validate`) проверяет **структуру** документа через ajv: корректность узлов + синтаксис операторов + известность имён `$component`/`$dataSource`/`$fn` + допустимость тегов `$html(...)` + имена частей `$part(...)`. Это НЕ валидация введённых пользователем значений.
- Теги `$html(...)` проверяются **всегда**, даже без реестра: whitelist статичен, поэтому `$html(script)` отклоняется независимо от того, переданы ли имена компонентов. Тот же whitelist применяет конвертер — битый тег не «просочится» в рантайм при отключённой проверке.
- Значит, валидацию значений выражают **отдельной TS-схемой над МОДЕЛЬЮ** (`FormModel`), а не в JSON. Схема — `ValidationDefinition<T>` (обёрнута `defineValidation`); правила уходят в сборку `createForm` полями `validation` и `flow.steps[].rules` — тем же контрактом `@reformer/core/validation`, что и в TS-варианте формы. Одна валидация на все варианты рендера.
- Правило несёт **код** замечания, а не текст. Строку по коду даёт словарь формы (`defineIssueMessages`) через `ValidationMessagesProvider messages`.

Ключевой тезис для рендереров: **layout (JSON) и валидация — два раздельных артефакта**. JSON можно менять/получать с сервера, не трогая правила, и наоборот. Связь между ними — `selector` шага в документе и `id` шага в потоке сборки.

Дальше — три шага: (1) правила над моделью, (2) подключить их к сборке, (3) тексты замечаний.

## Шаг 1 — правила над моделью { #build-schema }

Схема валидации — обычная функция `({ model, cross }) => void`, обёрнутая `defineValidation<T>(...)`. Внутри вызываются операторы из `@reformer/core/validation`: `validate(handle, [rules])` для синхронных правил (массив правил на поле). `handle` — ручка модели (`model.$.path`), НЕ строка-оператор `$model(...)` (операторы — только для layout-JSON; схема валидации это обычный TS-код). Фабрики правил импортируются из `@reformer/core/validators`; опции правила — `{ code?, params? }`.

```typescript
import { defineValidation, validate } from '@reformer/core/validation';
import { required, min, max, minLength, email } from '@reformer/core/validators';

// Правила шага — стабильные константы модуля; поля адресуются ручками model.$.*.
export const loanRules = defineValidation<CreditForm>(({ model }) => {
  validate(model.$.loanType, [required({ code: 'loanType.required' })]);
  validate(model.$.loanAmount, [
    required({ code: 'loanAmount.required' }),
    min(50000, { code: 'loanAmount.min' }),
    max(10000000),
  ]);
});

export const applicantRules = defineValidation<CreditForm>(({ model }) => {
  validate(model.$.personalData.firstName, [required(), minLength(2)]);
  validate(model.$.email, [required(), email()]);
});
```

Остальные операторы (тот же контракт, что в TS-форме): `validateAsync(handle, [asyncRules])` — асинхронные правила `(value, { signal }) => Promise<...>`; `validateWhen(() => cond, () => {...})` — условная валидация; `cross(handle, (snapshot) => issue | null)` из аргумента схемы — правило над несколькими полями по снимку модели; `applyEach(model.$.items, rowRules)` — правила строк массива; `apply(...schemas)` — композиция. Полное описание — `@reformer/core` [13-multi-step.md](../../../reformer/docs/llms/13-multi-step.md) (не дублируем здесь).

## Шаг 2 — подключить к сборке { #execute }

Документ формата 2 собирает та же сборка, что и TS-схему: `createForm({ model, schema, registry })`. Правила шагов уходят в поток, правила вне шагов — в `validation`:

```tsx
import { createForm } from '@reformer/core';
import { useFormBundle } from '@reformer/core/react';
import { FormRenderer } from '@reformer/renderer-react';

const bundle = useFormBundle(() =>
  createForm<CreditForm>({
    model: createCreditModel(),
    schema: creditJsonSchema, // документ формата 2
    registry,
    behavior: creditBehavior,
    validation: { extras: crossStepRules }, // только при отправке
    // id шага = selector узла `$component(Step)` в документе
    flow: { steps: [{ id: 'loan', rules: loanRules }, { id: 'applicant', rules: applicantRules }] },
  })
);
return <FormRenderer form={bundle} />;
```

Дальше всё делает уровень формы — инъектировать ничего в узлы не нужно:

| Вызов | Что делает |
|---|---|
| `bundle.flow?.next()` (кнопка «Далее» визарда) | правила текущего шага; при замечаниях поток остаётся, поля помечаются `touched` |
| `bundle.submission.submit(handler)` (кнопка «Отправить» визарда) | один прогон всех правил; при успехе — `handler(значения)`; при `invalid` / `error` тронутой помечается вся форма |
| `bundle.validate()` | прогон всех правил → `ValidationResult` (`status`, `issues`, `failures`) |
| `bundle.validateStep('loan')` | правила шага, проверенные поля помечаются `touched`; неизвестный шаг — исключение |

Замечание поля — ошибка или предупреждение — рисуется, только когда оно есть и поле `touched` или `dirty` (`shouldShowIssues`). Пометку `touched` проверенных полей делают `validateStep`, `flow.next()` и `submission.submit` сами (отказ отправки помечает всю форму) — ручной `form.markAsTouched()` на всё поддерево шага не нужен, а следующий шаг не показывается «тронутым», пока пользователь до него не дойдёт.

> **Мост «поведение инициирует валидацию».** Если правка одного поля должна перепрогнать правила другого (без отправки), это делает поведение — `revalidateWhen([model.$.dep], () => void validateModel(model, rules))` в `defineFormBehavior` (контракт `@reformer/core/behaviors`). Валидация остаётся отдельным слоем; поведение лишь дёргает раннер.

## Шаг 3 — тексты замечаний { #messages }

```typescript
import { defineIssueMessages } from '@reformer/core/i18n';

export const creditMessages = defineIssueMessages({
  'loanType.required': 'Выберите тип кредита',
  'loanAmount.min': 'Минимум {min} ₽',
});
```

```tsx
import { ValidationMessagesProvider } from '@reformer/cdk';

<ValidationMessagesProvider messages={creditMessages}>
  <FormRenderer form={bundle} />
</ValidationMessagesProvider>;
```

Порядок поиска текста: словарь формы → словарь локали → встроенный английский → сам `code`. Словарь — код, а не данные: в JSON-документ он не попадает и остаётся в бандле вместе с правилами.

## Полный рабочий пример { #full-example }

Зеркалит эталон `complex-multy-step-form-renderer-json`: правила — TS-схемы над моделью (`@reformer/core/validation`), общие для всех вариантов рендера; документ отличается от TS-варианта только тем, что он JSON.

```json
{
  "format": 2,
  "root": {
    "selector": "wizard",
    "component": "$component(FormWizard)",
    "children": [
      {
        "selector": "loan",
        "component": "$component(Step)",
        "componentProps": { "title": "Кредит", "icon": "💰" },
        "children": [
          { "model": "$model(loanAmount)", "component": "$component(InputNumber)",
            "componentProps": { "label": "Сумма кредита (₽)" } }
        ]
      },
      {
        "selector": "applicant",
        "component": "$component(Step)",
        "componentProps": { "title": "Заявитель", "icon": "👤" },
        "children": [
          { "model": "$model(personalData.firstName)", "component": "$component(Input)",
            "componentProps": { "label": "Имя" } }
        ]
      }
    ]
  }
}
```

```tsx
// index.tsx — сборка: документ + реестр + правила + поток
import { createForm } from '@reformer/core';
import { useFormBundle } from '@reformer/core/react';
import { FormRenderer } from '@reformer/renderer-react';
import { ValidationMessagesProvider } from '@reformer/cdk';
import type { JsonFormSchema } from '@reformer/renderer-json';
import rawSchema from './form.schema.json';
import { registry } from './registry';
import { loanRules, applicantRules, creditMessages } from './form.validation';

const schema = rawSchema as unknown as JsonFormSchema<CreditForm>;

export function CreditFormPage() {
  const bundle = useFormBundle(() =>
    createForm<CreditForm>({
      model: createCreditModel(),
      schema,
      registry,
      behavior: creditBehavior, // отправка и навигация — см. 07-form-wizard.md
      flow: { steps: [{ id: 'loan', rules: loanRules }, { id: 'applicant', rules: applicantRules }] },
    })
  );
  return (
    <ValidationMessagesProvider messages={creditMessages}>
      <FormRenderer form={bundle} />
    </ValidationMessagesProvider>
  );
}
```

## Когда прогонять — декларативная стратегия { #strategy }

По умолчанию правила запускаются только явно: «Далее», отправка, `bundle.validate()`. Живую проверку выбирает поле `strategy` в `validation` сборки — тем же контрактом, что и для TS-схемы (JSON тут ни при чём — он несёт только layout):

```typescript
createForm<CreditForm>({
  model, schema, registry, flow,
  validation: { extras: crossStepRules, strategy: 'afterFirstSubmit', debounce: 300 },
});
```

Значения `strategy`: `submit` (default — прогон только явным вызовом), `blur` (по потере фокуса), `change` (на каждый ввод + `debounce`), `afterFirstSubmit` (тихо до первой попытки отправки → дальше live по `liveAfterSubmit: 'change' | 'blur'`, default `'change'`; живую фазу включает только `bundle.submission.submit` — `bundle.validate()`, `validateStep` и `flow.next()` её не включают). Подписки армирует `useFormBundle` в эффекте (SSR-safe). Для простой формы без сборки — хук `useFormValidation({ model, schema, strategy })` из `@reformer/core/react`.

## Прежний формат документа { #v1 }

Документ без `format: 2` (ключи `value` / `array`, шаги в `componentProps.steps`) собирает `createJsonForm` и рисует `JsonFormRenderer`. Правила и поток передаются теми же полями — `createJsonForm({ schema, registry, model, validation, flow })`, — и `JsonFormRenderer` с этим бандлом (`form={bundle}`) ставит контекст сборки: визард берёт из него форму и поток и отправляет через проверку (`bundle.submission.submit`). Снимается такой бандл, как и сборка `createForm`, вызовом `bundle.dispose()`. Проще перевести документ: `migrateJsonSchema(document)` → формат 2 → `createForm` (см. [10-format-2.md](10-format-2.md)).

## Anti-patterns

- **Ждать, что `validateFormSchema` (или проп `validateSchema` у `JsonFormRenderer`) валидирует значения** — они проверяют только СТРУКТУРУ документа через ajv. Введённые пользователем значения они не трогают.
- **Пытаться добавить `validators` в JSON field-node** — `JsonFieldNode` несёт только layout (`model`/`component`/`componentProps`/`wrapper`). Поля `validators` в нём нет, оператора `$validator(...)` не существует.
- **Текст в правиле** — `required({ message: '…' })` больше нет: опции правила — `{ code?, params? }`. Текст — словарь `defineIssueMessages` + `ValidationMessagesProvider messages`.
- **Инъекция `validateStep`/`validateAll` в узел визарда через `patchProps`, `defineSteps`, `validation.steps`** — прежний контракт, удалён. Правила шагов — `flow: { steps: [{ id, rules }] }` в сборке; визард берёт поток и отправку из сборки сам.
- **Правила шагов по позиции** (`STEP_SCHEMAS[step - 1]`) — перестановка шагов молча рассинхронизирует правила. Шаг потока адресуется `id`, равным `selector` узла шага.
- **Инлайнить схему в `validateModel` или пересобирать её на каждый прогон** — отмена устаревших прогонов ключится по паре «модель + правила». Держите схемы стабильными `const` через `defineValidation`.
- **`selector` шага не совпадает с `id` шага потока** — визард не свяжет шаг с разметкой; в dev предупреждают сборка и визард, реестр форм ловит это preflight-проверкой `unknown-step-selectors`.

## See also

- [07-form-wizard.md](07-form-wizard.md) — визард в JSON: шаги-дети, поток шагов, отправка (`onComponentEvent`), навигация (`flow.goTo`).
- [02-json-schema.md](02-json-schema.md) — справочник по узлам `JsonNode` (field-node несёт только layout).
- [10-format-2.md](10-format-2.md) — документ формата 2 и сборка `createForm`.
- `@reformer/core` [13-multi-step.md](../../../reformer/docs/llms/13-multi-step.md) — операторы схемы валидации и поток шагов.
- `@reformer/core` [34-i18n.md](../../../reformer/docs/llms/34-i18n.md) — словарь замечаний и локали.
- [Типы JsonFormSchema/JsonNode](../../src/types/json-schema.ts) и [validate.ts](../../src/validate.ts) — структурная проверка документа.
