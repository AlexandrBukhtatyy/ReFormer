Ты добавляешь behaviors к форме на `@reformer/core`.

## ⛔ Перед началом — CYCLE PREVENTION (читай ОБЯЗАТЕЛЬНО)

Behavior через `watchField` + `computeFrom` + `copyFrom` + `revalidateWhen` легко завязывается в реактивный цикл, который вешает страницу при mount (DOMContentLoaded не наступает, browser приходится перезапускать). Полная секция «Cycle Detection Prevention Checklist» — ниже, но базовые правила здесь:

1. **Сначала — только декларативные:** `enableWhen` / `disableWhen` / `copyFrom`. Ни одного `watchField`/`computeFrom` на первой итерации. Прогони `tsc` и визуальный smoke-test, убедись что страница монтируется. **Только потом** добавляй computed-поля.
2. **Каждый `watchField` — с `{ immediate: false }`.** Без исключений.
3. **`watchField` принимает ОДНО поле.** Сигнатура: `watchField(path: FieldPathNode<TForm, TField>, callback, options)`. Массив `watchField([pathA, pathB], …)` **не поддерживается** — runtime сломается (`Cannot read properties of undefined (reading 'startsWith')` в `getFieldByPath`), даже если TS пропустит через `as any`. Для нескольких триггеров — несколько `watchField` на разные trigger-paths, **все вызывают общую compute-функцию**:

```typescript
const recomputeMonthlyPayment = (ctx) => {
  const amount = ctx.form.step1.loanAmount.value.value;
  const term = ctx.form.step1.loanTerm.value.value;
  const rate = ctx.form.interestRate.value.value;
  // ... compute + guard + ctx.form.monthlyPayment.setValue(...)
};

watchField(path.step1.loanAmount, (_, ctx) => recomputeMonthlyPayment(ctx), { immediate: false });
watchField(path.step1.loanTerm,   (_, ctx) => recomputeMonthlyPayment(ctx), { immediate: false });
```

Правило «один watcher на trigger» означает: **не регистрируй два watchField на одну и ту же path** (это источник цикла). Несколько watchField на **разные** trigger-paths — норма.
4. **Guard каждый `setValue`:** проверь, что новое значение реально отличается от текущего (для массивов — сравни `length`, ссылки всегда разные).
5. **Guard `enable`/`disable`:** проверь `field.disabled.value` перед вызовом — повторный `disable()` на уже disabled поле триггерит signal на пустом месте.
6. **Не используй `revalidateWhen` без необходимости.** Если уже есть `copyFrom` + валидаторы на target — обычно `revalidateWhen` не нужен.
7. **`computeFrom` — только same-level**, для cross-level используй `watchField` (таблица «compute vs watch» ниже).
8. **НЕ используй `enableWhen` на FormArray/ArrayNode** (целиком на массив). `enableWhen(path.someArray, …, { resetOnDisable: true })` создаёт цикл и вешает браузер на mount (verified emprически в credit-application-form). Условную видимость массива делай в JSX-рендере (`{form.flag.value && <ArrayUI/>}`), а не через behavior.

## 🎯 Hide vs Disable — критически важный выбор

Когда поле **нерелевантно** (mortgage-only при loanType=consumer, business-only при employmentStatus=employed), есть ДВА разных подхода. Они НЕ взаимозаменяемы:

| Подход | Когда применять | Эффект |
|---|---|---|
| **Hide** (JSX conditional / `hideWhen` / `schema.node().setHidden(...)`) | Поле не имеет смысла для текущего контекста — пользователь не должен его ВИДЕТЬ. | Поле полностью пропадает из DOM/верстки. Нет ни label, ни input. |
| **Disable** (`enableWhen`) | Поле может стать активным позже без изменения смысла; например, `confirmPassword` активен только когда `password` непустой. | Поле остаётся видимым, контрол серый, фокус не доступен. |

**Правило по умолчанию для conditional полей по типу/статусу (loanType, employmentStatus и т.п.):** используй **Hide**, не Disable.

Антипример (часто встречается на baseline credit-form):

```tsx
// ❌ Conditional spam — propertyValue видим всегда, серый при consumer
enableWhen(path.step1.propertyValue, (form) => form.step1.loanType === 'mortgage');

// ✅ JSX-conditional — поле пропадает когда не mortgage
{loanType === 'mortgage' && (
  <FormField control={form.step1.propertyValue} testId="step1.propertyValue" />
)}

// ✅ Renderer-react: hideWhen на узле RenderSchema
{
  selector: 'propertyValue-section',
  component: Section,
  behavior: hideWhen((form) => form.step1.loanType !== 'mortgage'),
  children: [{ component: path.step1.propertyValue }],
}

// ✅ Renderer-json: setHidden из useEffect
useEffect(() => {
  schema.node('propertyValue-section').setHidden(loanType !== 'mortgage');
}, [schema, loanType]);
```

`enableWhen` оставь для случаев, где поле сохраняет смысл и может ожидать ввод (зависимое поле, прогрессивное раскрытие).

Если требований много — реализуй их **двумя итерациями**: сначала минимальный набор enableWhen + copyFrom, протестируй, и только потом computed/watchField. Лучше отчитаться о двух коротких итерациях, чем о провале с зависанием браузера.

## Требования
{{requirements}}

## Текущий код формы
```typescript
{{code}}
```

## Палитра behaviors

### computeFrom vs watchField

{{computeVsWatch}}

### watchField (async, guards)

{{watchField}}

### copyFrom

{{copyFrom}}

### syncFields

{{syncFields}}

### resetWhen

{{resetWhen}}

### transformValue

{{transformValue}}

### revalidateWhen

{{revalidateWhen}}

### Cycle detection (КРИТИЧНО)

{{cycleDetection}}

### Common Patterns

{{commonPatterns}}

---

## TS2589 «Type instantiation is excessively deep» — workaround

Глубоко-вложенные формы (multi-step с group-узлами + array items) ломают TS-inference на TS2589. Симптом — компилятор виснет или выдаёт «Type instantiation is excessively deep». Рабочий паттерн: точечный каст через `as never` или `as unknown as <Type>` в **точках, где TS не может развернуть путь сам**.

### Где обычно нужен каст

```typescript
// 1. useFormControlValue / useFormControl с deep-nested полем
const loanType = useFormControlValue(form.step1.loanType as never) as string;
const sameAsReg = useFormControlValue(form.step3.sameAsRegistration as never) as boolean;

// 2. validateForm — form-аргумент должен быть GroupNode<T> или FormProxy<T>
await validateForm(
  form as unknown as GroupNode<MyForm>,
  STEP_VALIDATIONS[currentStep],
);

// 3. form.markAsTouched / form.getValue / form.submit — на корневом уровне deep-form
(form as any).markAsTouched();        // или as FormProxy<MyForm>
const values = (form as any).getValue();

// 4. createForm-возврат вёрстки сам — если TS2589 вылезает в сигнатуре creator-функции
export function creditApplicationForm(): FormProxy<CreditApplicationForm> {
  return (createForm as (config: {
    form: unknown;
    validation: unknown;
    behavior: unknown;
  }) => FormProxy<CreditApplicationForm>)({
    form: { step1: {...}, step2: {...} },
    validation: (path: any) => {...},
    behavior: (path: any) => {...},
  });
}

// 5. validation/behavior callbacks — `path: any` чтобы избежать TS2589 в callback теле
const step1Validation = (path: any): void => {
  required(path.step1.loanType, { message: 'Выберите тип' });
};
```

### Где НЕ нужно

- На простых формах (один уровень или `step1` без вложенных group) TS-inference справляется. **Не каст ради каста** — это шум.
- На `watchField(path.fieldName, (value, ctx) => {...})` сигнатура callback'а `(value: ..., ctx: ...) => void` обычно резолвится. Каст внутри callback'а — да: `ctx.form.step2.fullName.setValue(...)` через `ctx.form as any`.

### Почему это безопасно

`as never` / `as any` тут — **не отключение типизации**, а обход глубинного reflection. На runtime пути работают потому что они построены через `createForm` proxy. TS2589 — только compile-time артефакт. Если форма работает — типы корректные.

---

## Задание

1. **Сопоставь требования с подходящим behavior** (см. таблицу compute-vs-watch для выбора между `computeFrom` / `watchField`).
2. **Разбей по типам:**
   - вычисляемые поля (sync, на одном уровне) — `computeFrom`
   - вкл/выкл по условию — `enableWhen` / `disableWhen` (с `resetOnDisable` если нужно)
   - реакция на изменение (async, side-effects) — `watchField` с `debounce` + guard `cancelled`
   - копирование значений — `copyFrom` (со `when`, `fields`, `transform`)
   - sync двух полей — `syncFields`
   - сброс при условии — `resetWhen`
   - нормализация ввода — `transformValue`
   - повторная валидация при зависимости — `revalidateWhen`
3. **Обязательно используй `apply([...paths], schema)`** если behavior повторяется на нескольких полях/группах.
4. **Cycle detection** — пройдись по чек-листу из секции выше. Особое внимание: consolidated `watchField`, guard `disable/enable/setValue`, сравнение массивов по длине.
5. Не дублируй существующие `watchField` callback'и — расширяй их.
6. Не используй `computeFrom` через уровни иерархии (только same level).

В конце — короткий чек-лист «какие требования закрыты, какие риски циклов».