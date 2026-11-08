---
sidebar_position: 3
---

# Частые проблемы

Симптомы, которые встречаются чаще всего, — с причиной и решением. Термины — в
[глоссарии](./glossary.md).

## Валидация

### Ошибки не видны, хотя правила не прошли

**Причина.** Замечание показывается, только когда поле трогали или меняли (`touched` или `dirty`).
Кроме того, по умолчанию живой проверки нет: стратегия `submit` проверяет форму только при отправке
и при явном `bundle.validate()`.

**Решение.**

- Отправляйте через `bundle.submission.submit(handler)`: при ошибках он помечает тронутой всю форму.
- `bundle.validate()` помечает тронутыми проверенные поля.
- Нужна проверка во время ввода — задайте стратегию сборке:
  `createForm({ …, validation: { rules, strategy: 'blur' } })` (или `'change'`,
  `'afterFirstSubmit'`). Её включает `useFormBundle`.
- Свой прогон `runValidation` замечания не разносит. Разнесите и пометьте поля:
  `applyValidationResult(result, { touch: true })`.

См. [Стратегии валидации](/docs/validation/validation-strategies).

### После отправки ошибок нет, а данные ушли на сервер

**Причина.** Отправка в обход проверки: `api.send(bundle.model.get())`.

**Решение.** Проверка и отправка — одним вызовом:

```typescript
const outcome = await bundle.submission.submit(api.send);
if (outcome.status === 'submitted') navigate('/done');
```

Обработчик вызывается, только если блокирующих замечаний нет.

### Обработчик отправки вызван, а под полем висит замечание

**Причина.** Это предупреждение — правило с `severity: 'warning'`. Оно показывается, но отправку не
блокирует.

**Решение.** Если предупреждение должно останавливать отправку, проверьте форму до отправки сами:
`(await bundle.validate()).issues`.

### Отправка вернула `cancelled`, ошибок нет

**Причина.** Пока шла проверка (например, ждали ответа async-правила), форму изменили: пользователь
поправил поле, пришла загрузка, поведение записало значение. Правила этих значений не видели —
отправлять их нельзя. Отменой кончается и отправка, которую сменила следующая.

**Решение.** Отправьте ещё раз — новый прогон проверит новые значения. Чтобы правок не было, на время
проверки блокируйте форму по `bundle.validating`.

### На поле текст вида `loanAmount.required`

**Причина.** Правилу дан свой код (`required({ code: 'loanAmount.required' })`), а текста для него
нет ни в одном словаре. Тогда на экран выводится сам код.

**Решение.** Добавьте код в словарь формы и подключите его:

```tsx
const loanMessages = defineIssueMessages({ 'loanAmount.required': 'Укажите сумму кредита' });

<ValidationMessagesProvider messages={loanMessages}>
  <LoanForm />
</ValidationMessagesProvider>;
```

См. [Локализацию](/docs/guides/localization).

### Тексты замечаний на английском

**Причина.** Нет `I18nProvider` — без него библиотека говорит по-английски. Либо провайдер
импортирован не оттуда.

**Решение.** Оберните приложение в провайдер из `@reformer/core/react` с загрузчиком словарей:

```tsx
import { createLocaleLoader } from '@reformer/core/i18n';
import { I18nProvider } from '@reformer/core/react';
import { loadKitLocale } from '@reformer/ui-kit/locale';

const loadLocale = createLocaleLoader([loadKitLocale]); // константа модуля

<I18nProvider lang="ru" load={loadLocale}>
  <App />
</I18nProvider>;
```

### Дата не проверяется

**Причина.** Правила дат (`isDate`, `minDate`, `maxDate`, `pastDate`, `futureDate`, `minAge`,
`maxAge`) принимают `Date` или строку `YYYY-MM-DD`. Другую строку, в том числе дату со временем,
`isDate` считает ошибкой (`date_invalid`), а остальные правила её пропускают.

**Решение.** Храните дату как `Date` или как `YYYY-MM-DD`. Добавьте `isDate()`, чтобы неверный
формат давал замечание.

## Поведение

### `Cycle detected` или «расходящийся цикл пересчёта»

**Причина.** Поведение пишет в поле, от которого само зависит, и значения не сходятся:

- два `compute` вычисляют друг друга: `a` из `b` и `b` из `a`;
- `transformValue` не идемпотентен: `f(f(x))` не равно `f(x)`, например дописывает префикс;
- условие `resetWhen`, `copyFrom` или `enableWhen` читает собственную цель.

**Решение.**

```typescript
// ❌ взаимный пересчёт
compute(model.$.a, () => model.b + 1);
compute(model.$.b, () => model.a + 1);

// ✅ одно направление
compute(model.$.total, () => model.price * model.qty);

// ✅ трансформация, которая не меняет уже преобразованное
transformValue(model.$.code, (value) => (value?.startsWith('RU-') ? value : `RU-${value}`));

// ✅ условие сброса читает другое поле, а не цель
resetWhen(model.$.cardNumber, () => model.paymentType !== 'card', { resetValue: '' });
```

См. [Вычисляемые поля](/docs/behaviors/computed).

### После `model.reset()` под полями «Обязательное поле»

**Причина.** `model.reset()` возвращает только значения, а состояние полей не трогает: поля остаются
тронутыми. При живой стратегии (`change`, `afterFirstSubmit` после первой отправки) форма тут же
проверяется заново, и у опустевших тронутых полей видны ошибки.

**Решение.** Для чистого старта после отправки и для кнопки «Сбросить» берите `form.reset()`: он
возвращает значения и снимает с полей замечания и касание.

```typescript
const outcome = await bundle.submission.submit(api.send);
if (outcome.status === 'submitted') bundle.form.reset();
```

См. [Отправку и сброс](/docs/patterns/submit-and-reset).

### Значение поля не меняется

**Причина.** Значениями владеет модель. Запись идёт не туда — например, в объект, полученный из
`model.get()`, или в состояние компонента.

**Решение.** Пишите в модель или через ноду поля: `model.email = '…'`,
`model.patch({ … })`, `form.email.setValue('…')`.

### `form.enable()` не включает вычисляемое поле

**Причина.** Ключ `disabled: true` в узле схемы — постоянная блокировка: `enable()` группы, массива
или формы её не снимает. Так помечают поля, которые считает форма (`total`, `fullName`).

**Решение.** Включить такое поле можно только его собственным `form.total.enable()` или
`enableWhen` на нём. `componentProps.disabled` на состояние поля не влияет — это проп компонента.

### `enableWhen` перестал работать, вычисляемые поля затираются

**Причина.** В приложение попали две копии `@reformer/core` или `@preact/signals-core` — например,
в микрофронтендах или при неудачной установке зависимостей. Сигналы одной копии не видят эффектов
другой, и реактивность молча пропадает.

**Решение.** Добейтесь одной копии: проверьте `npm ls @reformer/core @preact/signals-core`, в сборщике
включите дедупликацию (`resolve.dedupe` у Vite). Для микрофронтендов в `@reformer/form-registry` есть
проверка `stampRuntime` / `reportRuntime` (вход `@reformer/form-registry/guard`).

## React и рендер

### `useFormControlValue` возвращает `undefined`

**Причина.** Результат хука деструктурировали: `const { value } = useFormControlValue(…)`. Хук
возвращает само значение, а не объект.

**Решение.** `const loanType = useFormControlValue(form.loanType);`. Объект с `value`, `issues` и
остальным состоянием отдаёт `useFormControl`.

### `Module has no exported member`

**Причина.** Имя импортируется не из того входа пакета.

**Решение.**

| Что                                                              | Откуда                      |
| ---------------------------------------------------------------- | --------------------------- |
| `createForm`, `createModel`, типы `FormModel`, `FormSchemaNode`  | `@reformer/core`            |
| хуки (`useFormBundle`, `useFormControl`, …) и `I18nProvider`     | `@reformer/core/react`      |
| `defineValidation`, `validate`, `validateAsync`, `runValidation` | `@reformer/core/validation` |
| правила `required`, `email`, `min`, …                            | `@reformer/core/validators` |
| `defineFormBehavior`, `compute`, `enableWhen`, `onChange`, …     | `@reformer/core/behaviors`  |
| `defineIssueMessages`, `createLocaleLoader`                      | `@reformer/core/i18n`       |

Если имени нет нигде — возможно, оно удалено: см. [Переход с прежних API](./migration.md).

### Поле в `FormRenderer` без подписи и ошибки

**Причина.** Рендереру не передана обёртка поля.

**Решение.** `<FormRenderer form={bundle} settings={{ fieldWrapper: FormField }} />` с `FormField`
из `@reformer/ui-kit`.

### Поле не рисуется, в консоли `[RenderSchema] No form node for signal`

**Причина.** У сигнала поля нет ноды: форма собрана не из этой схемы, узел привязан к сигналу
другой модели или записан значением (`model: model.email`) вместо сигнала (`model: model.$.email`).

**Решение.** Собирайте форму и рисуйте её из одной сборки: `createForm({ initial, schema })` внутри
`useFormBundle` и `<FormRenderer form={bundle} />`. В узле — `model: model.$.<поле>` той модели,
которую получил билдер схемы.

## Многошаговые формы

### «Далее» пропускает шаг без проверки

**Причина.** Мастеру не передан поток, и он нарисован вне сборки — тогда он строит поток по числу
шагов без правил. Либо у шага в `flow.steps` нет `rules`.

**Решение.** Объявите шаги и правила в `createForm({ flow })` и передайте поток мастеру:
`<FormWizard form={bundle.form} flow={bundle.flow} … />`.

### `goTo(id)` не переводит на шаг

**Причина.** Переход вперёд через непройденный шаг закрыт: результат —
`{ status: 'stayed', reason: 'locked' }`.

**Решение.** Вперёд — `await flow.next()`: он проверит шаг и отметит его пройденным. `goTo` — для
возврата назад и на уже открытые шаги.

См. [Многошаговые формы](/docs/guides/multi-step-forms).

## Разработка в репозитории ReFormer

### Правка в `packages/*/src` не видна в playground, на сайте или в тестах другого пакета

**Причина.** Пакеты `@reformer/*` подключаются по полю `exports` — из собранного `dist/`, а не из
исходников. Пока пакет не пересобран, остальные видят прежний код.

**Решение.** Пересоберите изменённый пакет и те, что от него зависят, в порядке зависимостей:

```bash
npm run build -w @reformer/core
npm run build -w @reformer/cdk
npm run build -w @reformer/ui-kit
npm run build -w @reformer/renderer-react
npm run build -w @reformer/renderer-json
```

`ui-kit` зависит от ядра и cdk, `renderer-json` — от ядра и `renderer-react`.

## См. также

- [Глоссарий](./glossary.md)
- [TypeScript-рецепты](./typescript.md)
- [Переход с прежних API](./migration.md)
- [Тестирование форм](/docs/guides/testing)
