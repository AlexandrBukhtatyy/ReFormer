You add behaviors to a `@reformer/core` form (M1 signal-based architecture).

Behaviors operate on **model signals** (`model.$.<field>`), NOT on a `path` argument. Two equivalent APIs:

- **Standalone primitives** from `@reformer/core` — `computeFrom` / `copyFrom` / `watchField` / `enableWhen` / `disableWhen` / `transformValue` / `resetWhen` / `syncFields` / `revalidateWhen`. Each returns a cleanup function; run them in a `useEffect` after `createForm` and dispose on unmount.
- **Declarative DSL** `defineFormBehavior<T>(({ model, form }) => { … })` + operators from `@reformer/core/behaviors` (`compute` / `copyFrom` / `enableWhen` / `disableWhen` / `onChange` / `transformValue` / `apply`). The operators self-register in the active schema; the form owns their lifecycle (pass `behavior` to `createForm({ model, schema, behavior })`). No manual cleanup array.

There is NO `BehaviorSchemaFn`, NO `behavior: (path) => {…}`, NO `validate(path.x)`. Path-based behaviors were removed. Value-ops write model signals (`model.$.x`); state/UI-ops (`enableWhen`, `updateComponentProps`, array `clear`) touch form nodes (`form.x`).

## Args

- requirements: {{requirements}}

## Current form code

```typescript
{
  {
    code;
  }
}
```

## ⛔ Critical inline rules — CYCLE PREVENTION (do not skip)

A reactive cycle hangs the browser at mount. These rules are non-negotiable:

1. **Start with declarative only**: `enableWhen` / `disableWhen` / `copyFrom`. NO `watchField` / `computeFrom` on iteration 1. Verify mount works, then add computed.
2. **Every `watchField` MUST take `{ immediate: false }`**. No exceptions.
3. **`watchField` accepts ONE source signal** (signature: `watchField(model.$.field, callback, options)`). Array-of-signals is NOT supported. For multiple triggers — multiple `watchField` calls on different signals, all calling a shared compute function.
4. **Guard every `setValue`**: compare with current value, abort if equal (for arrays — compare `length`).
5. **Guard `enable`/`disable`**: check `field.disabled.value` first — re-disable triggers spurious signal.
6. **Don't use `revalidateWhen` if `copyFrom` + validators on target already cover it.**
7. **`computeFrom` sources are arbitrary model signals** — pass `[model.$.a, model.$.b.c]` from anywhere in the tree (cross-level is fine, signals carry their own path). Values arrive **positionally** in the same order: `computeFrom([model.$.price, model.$.qty], model.$.total, (price, qty) => price * qty)`.
8. **NEVER `enableWhen` on a whole `ArrayNode` with `resetOnDisable: true`** — verified browser-hang. For conditional array visibility use JSX-conditional (`{form.flag.value.value && <ArrayUI/>}`) or `hideWhen` (renderer).
9. **NEVER combine raw `effect()` from `@preact/signals-core` with signal-write calls** (`schema.node().setHidden()`, `field.setValue()`, `field.disable()`, etc.) **inside the same callback**. setHidden writes the hidden-signal → effect dependency graph re-runs → infinite loop with «Cycle detected» runtime error.

   **For React-side orchestration (B3 setHidden cascade в renderer-json A4 wizard pair, любые JSX-condition реакции на signals):** используй `useFormControlValue(form.X)` для signal→React-state bridge + **отдельный `useEffect` per source/condition**. React deps prevent infinite re-trigger.

   ```tsx
   // ❌ Cycle detected — effect reads signal, setHidden writes signal
   useEffect(() => {
     const dispose = effect(() => {
       const loanType = form.loanType.value.value;
       schema.node('mortgage-section').setHidden(loanType !== 'mortgage');
       schema.node('car-section').setHidden(loanType !== 'car');
     });
     return dispose;
   }, [schema, form]);

   // ✅ React-mediated — signal subscribed via useFormControlValue, useEffect runs on deps change
   const loanType = useFormControlValue(form.loanType as never) as string;
   useEffect(() => {
     schema.node('mortgage-section').setHidden(loanType !== 'mortgage');
     schema.node('car-section').setHidden(loanType !== 'car');
   }, [schema, loanType]);
   ```

   `effect()` raw — только для side-effects вне React (`console.log`, fetch, broadcasting events). Внутри React tree всегда mediate через `useFormControlValue`.

10. **`computeFrom` passes POSITIONAL plain values, one per source signal.** The callback receives `(...values)` in the exact order of the `sources` array — NOT a keyed object. Subscribe to precisely the leaf signals you read; a nested field is just its own signal `model.$.<group>.<field>`. There is no "group node vs flat leaves" ambiguity under M1 — each source is a signal that carries its own path. **`as never` cast on the sources array is a red flag**: if a cast hides a type error, the source list is mistyped — fix the signal reference, don't cast.

```typescript
// ❌ wrong — expects a keyed `form` object (removed path-based shape); values are positional now
computeFrom(
  [model.$.personalData.lastName, model.$.personalData.firstName] as never,
  model.$.fullName,
  (form) => [form.personalData?.lastName, form.personalData?.firstName].filter(Boolean).join(' ')
);

// ✅ positional values in source order — read them directly
computeFrom(
  [model.$.personalData.lastName, model.$.personalData.firstName, model.$.personalData.middleName],
  model.$.fullName,
  (lastName, firstName, middleName) => [lastName, firstName, middleName].filter(Boolean).join(' ').trim()
);
```

For the DSL variant, `compute(target, fn)` auto-tracks every signal `fn` reads — no explicit source list:

```typescript
compute(model.$.fullName, () =>
  [model.personalData.lastName, model.personalData.firstName].filter(Boolean).join(' ').trim()
);
```

11. **Preact Signal двойной `.value` — обязательно при чтении значения из callback'а.** Для FieldNode `field.value` возвращает **сам Signal-объект** (`Signal<T>`), а **текущее значение** — это `field.value.value`. Сравнение `field.value !== 'foo'` — всегда true (Signal `!==` literal), `field.value === true` — всегда false. Тихий silent fail: hideWhen-условие никогда не срабатывает, секция вечно скрыта/видима, errors нет.

    **Где применимо:** любая callback-функция, которая читает значение поля из `form.<field>` (нода формы) напрямую. В первую очередь — `hideWhen(node, () => …)`, тело `effect()`, тело `useEffect`, `setValue` predicate. Если значение приходит через arg (`computeFrom((...values) => …)`, `watchField((newValue) => …)`, `onChange((value) => …)`) — там уже plain value, второй `.value` не нужен. Behaviors на сигналах модели (`enableWhen`/`disableWhen`/`copyFrom` conditions) читают `model.<field>` (значение через прокси), тоже без `.value`.

    **NB:** именно второй `.value` подписывает effect/computeFrom-deps на signal. Если читаешь `field.value` (один) — subscription **не** регистрируется, реактивность ломается.

    ```typescript
    // ❌ Signal !== literal → всегда true → секция вечно скрыта; effect не подписан
    hideWhen(proxy.node('mortgage-section'), () => form.loanType.value !== 'mortgage');
    hideWhen(proxy.node('properties-array'), () => form.hasProperty.value !== true);

    // ✅ field.value.value — current value; subscription регистрируется правильно
    hideWhen(proxy.node('mortgage-section'), () => form.loanType.value.value !== 'mortgage');
    hideWhen(proxy.node('properties-array'), () => form.hasProperty.value.value !== true);

    // ✅ React-side через useFormControlValue (предпочтительнее в JSX) — bridge сам разворачивает .value.value
    const loanType = useFormControlValue(form.loanType as never) as string;
    {loanType === 'mortgage' && <MortgageSection/>}
    ```

12. **`useFormControl(node)` принимает ТОЛЬКО FieldNode (leaf control), не FormProxy/GroupNode/ArrayNode.** Hook читает `node.componentProps.value` (signal-snapshot) для рендера label/error/disabled/etc. — у GroupNode/ArrayNode/корневой FormProxy НЕТ `componentProps` Signal'а, и hook падает с `TypeError: Cannot read properties of undefined (reading 'value')` либо тихо возвращает stub-объект, который потом упадёт на потребителе.

    **Не делай так** — даже «чтобы подписаться на root формы для re-render»: FormWizard/FormRenderer сами владеют lifecycle'ом, ручная подписка на root не нужна и сломает рендер.

    ```typescript
    // ❌ FormProxy root — hook падает или возвращает мусор
    useFormControl(form);
    useFormControl(form.personalData); // GroupNode — то же самое

    // ✅ FieldNode (leaf)
    useFormControl(form.loanAmount);
    const v = useFormControlValue(form.loanType); // value-only сахар поверх useFormControl
    ```

    Аналогичные API на FormProxy: `useFormControlValue(field)` — value-only; `form.markAsTouched()` / `form.setValue(partial)` — императивные методы (НЕ хуки). Для отслеживания изменений на нескольких полях — несколько отдельных `useFormControlValue` вызовов, по одному на поле.

13. **Не комбинируй `enableWhen + resetOnDisable: true` с `copyFrom` на одной и той же GroupNode (или включающей её).** Они конкурируют: `copyFrom` пишет значения в группу, `enableWhen` с `resetOnDisable` стирает их при срабатывании условия — порядок и тайминг непредсказуемы, а в worst-case race-condition выглядит как «иногда копируется, иногда пусто». Также: правило #8 уже запрещает `enableWhen + resetOnDisable` на whole ArrayNode (cycle на mount), но для GroupNode оно не падает технически, лишь портит данные.

    **Как делать правильно**: оставь `copyFrom` для синхронизации значений; для скрытия секции используй JSX-conditional (`{condition && <Section/>}`) или `hideWhen(proxy.node('selector'), () => …)` в renderer-react. **Не блокируй disable'ом ту же группу, в которую пишет copyFrom**.

    ```typescript
    // ❌ race: copyFrom пишет registrationAddress→residenceAddress, потом enableWhen
    // обнуляет residenceAddress (или наоборот). Видно как "иногда пусто, иногда заполнено".
    copyFrom(model.$.registrationAddress, model.$.residenceAddress, {
      when: () => model.sameAsRegistration === true,
    });
    enableWhen(model.$.residenceAddress, () => model.sameAsRegistration === false, {
      resetOnDisable: true,
    });

    // ✅ copyFrom для значений; enable/disable группы БЕЗ resetOnDisable; скрытие — JSX
    copyFrom(model.$.registrationAddress, model.$.residenceAddress, {
      when: () => model.sameAsRegistration === true,
    });
    enableWhen(model.$.residenceAddress, () => model.sameAsRegistration === false); // без resetOnDisable
    // в index.tsx:
    {!sameAsRegistration && <ResidenceAddressSection control={control}/>}
    ```

    Copying a whole group signal (`model.$.registrationAddress → model.$.residenceAddress`) copies every field; there is no `fields: 'all'` option in M1 — pass the group signal, not a leaf.

14. **TYPED model generic — обязательно. Inline-callback OK для коротких, extract module-level для содержательных.**

    **Часть A — generic.** `createModel<T>` / `defineFormBehavior<T>` параметризованы form-interface'ом. Передай свой type явно — тогда `model.$.<field>` типизирован и опечатка в имени поля подсветится:

    ```typescript
    import type { OrderForm } from './types';

    // ✅ standalone-примитивы (cleanup-массив в useEffect) — model типизирован
    const model = createModel<OrderForm>(INITIAL);
    const form = createForm<OrderForm>({ model, schema: buildSchema(model) });
    useEffect(() => {
      const cleanups = [
        computeFrom([model.$.price, model.$.quantity], model.$.total, (price, qty) => price * qty),
      ];
      return () => cleanups.forEach((c) => c());
    }, [model]);

    // ✅ DSL — generic на defineFormBehavior; операторы сами регистрируются
    const behavior = defineFormBehavior<OrderForm>(({ model }) => {
      compute(model.$.total, () => model.price * model.quantity);
    });
    // передаётся в createForm({ model, schema, behavior })

    // ❌ generic дропнут / model: any — silent fail на опечатках в field-name
    const model = createModel<any>(INITIAL);
    ```

    `as any` cast допустим в редких narrow call-site (например, TS2589 на 70+полевой форме); сужай до конкретного выражения, не на весь callback.

    **Часть B — inline vs extract.** Inline нормально для коротких:

    ```typescript
    // ✅ inline OK
    enableWhen(model.$.discountCode, () => model.subtotal > 100);
    copyFrom(model.$.regAddress, model.$.resAddress, { when: () => model.sameAsReg });
    ```

    Extract обязателен когда: callback >5 строк, async watchField с try/catch, computeFrom с branching, повторно используется. Module-level функция `(form: MyForm) => Result` даёт стабильную типизацию и переиспользование:

    ```typescript
    // ✅ extracted typed helper — читает поля модели по значению
    function computeMonthlyPayment(form: LoanForm): number {
      const P = form.loanAmount,
        n = form.loanTerm,
        annual = form.interestRate;
      if (!P || !n || !annual || P <= 0 || n <= 0) return 0;
      const i = annual / 100 / 12;
      if (i <= 0) return Math.round(P / n);
      const factor = Math.pow(1 + i, n);
      return Math.round((P * (i * factor)) / (factor - 1));
    }

    // DSL: compute auto-tracks сигналы, прочитанные внутри computeMonthlyPayment(model)
    const behavior = defineFormBehavior<LoanForm>(({ model }) => {
      compute(model.$.monthlyPayment, () => computeMonthlyPayment(model));
    });

    // standalone: computeFrom с явными источниками + helper by-reference
    computeFrom(
      [model.$.loanAmount, model.$.loanTerm, model.$.interestRate],
      model.$.monthlyPayment,
      (loanAmount, loanTerm, interestRate) =>
        computeMonthlyPayment({ loanAmount, loanTerm, interestRate } as LoanForm)
    );
    ```

## 🎯 Hide vs Disable

- **Hide** (JSX-conditional / `hideWhen` / `setHidden`) → field disappears from DOM. Use for type/status conditions (`loanType=mortgage`, `employmentStatus=employed`).
- **Disable** (`enableWhen`) → field stays visible, control greyed out. Use only for progressive disclosure (`confirmPassword` after `password`).

For type/status conditional fields **default = Hide, NOT Disable**.

## TS2589 workaround (deeply nested forms)

```typescript
// useFormControlValue with deep path
const v = useFormControlValue(form.step1.foo as never) as string;
// validateFormModel — cast the model/schema узел when deep-nesting trips TS2589
await validateFormModel(model, STEP_SCHEMAS[step] as never);
// DSL behavior — narrow the model param on a single call-site, not the whole callback
const behavior = defineFormBehavior<MyForm>(({ model }) => {
  compute(model.$.total, () => (model as any).price * (model as any).qty);
});
```

Don't cast on simple forms — only when TS2589 actually appears.

## Prerequisites — read these resources via ReadMcpResourceTool

**You MUST read these BEFORE writing behaviors. Skipping = browser hang risk.**

- `reformer://docs/core/cycle-detection-prevention-checklist` (КРИТИЧНО — full checklist)
- `reformer://docs/core/cycle-detected-error` (how the runtime reports it)
- `reformer://docs/core/compute-from-vs-watch-field` (which to choose)
- `reformer://docs/core/async-watchfield-critically-important` (async, debounce, guards)
- `reformer://docs/core/common-patterns` (apply, copyFrom recipes)
- `reformer://docs/core/common-mistakes`
- `reformer://docs/core/extended-common-mistakes`
- `reformer://docs/core` (aggregator — for `copyFrom` / `syncFields` / `resetWhen` / `transformValue` / `revalidateWhen` per-behavior sections)

## Task

1. Pick an API: standalone primitives from `@reformer/core` (cleanup-array in `useEffect`) OR the `defineFormBehavior` DSL (`@reformer/core/behaviors`, passed to `createForm({ behavior })`). Don't mix both for the same form.
2. Map each requirement to a behavior (`computeFrom`/`compute` / `watchField`/`onChange` / `enableWhen` / `disableWhen` / `copyFrom` / `syncFields` / `resetWhen` / `transformValue` / `revalidateWhen`).
3. Use `apply([model.$.a, model.$.b], subBehavior)` (DSL) if a behavior repeats across multiple groups/fields.
4. Walk the cycle-prevention checklist for each `watchField`/`computeFrom` you add.
5. Don't duplicate existing `watchField`/`onChange` callbacks — extend them.
6. `computeFrom` sources are positional model signals (`model.$.<path>`) — cross-level is fine.

## Output checklist

- [ ] Прочитал все ресурсы из Prerequisites: yes/no
- [ ] Behaviors работают на сигналах модели (`model.$.<field>`), НЕ на `path`; нет `BehaviorSchemaFn` / `behavior: (path) => …`
- [ ] Every `watchField` has `{ immediate: false }`
- [ ] Every `setValue` has equality guard
- [ ] No `enableWhen` on whole ArrayNode
- [ ] `computeFrom` callback читает источники **позиционно** в порядке массива sources (rule #10); никаких `as never` cast'ов на источниках, никакого keyed-`values` объекта
- [ ] Никаких raw `effect()` + signal-write комбинаций (rule #9); React orchestration через `useFormControlValue` + `useEffect`
- [ ] Все callback'и (`hideWhen`/`enableWhen`/`disableWhen`/`effect`/`useEffect`), читающие `form.<field>` напрямую, используют **двойной** `.value.value` (rule #11) — single `.value` сравнивается с Signal-объектом и тихо ломает условие
- [ ] `useFormControl` / `useFormControlValue` вызываются ТОЛЬКО на FieldNode (leaf). Никогда на FormProxy root, GroupNode, ArrayNode (rule #12) — иначе TypeError на componentProps.value
- [ ] Никаких `enableWhen + resetOnDisable: true` на той же Group, в которую пишет `copyFrom` (rule #13) — race ломает данные. Скрытие — JSX-conditional / `hideWhen`
- [ ] **Model generic зафиксирован**: `createModel<MyForm>` / `defineFormBehavior<MyForm>` (НЕ `<any>`, НЕ опущен) — silent fail на опечатках имён полей (rule #14, часть A)
- [ ] **Содержательные callback'и (>5 lines, computeFrom, async watchField) extracted module-level** как типизированные функции `(form: MyForm) => Result`; inline OK только для коротких predicates / single setter (rule #14, часть B)
- [ ] **Spec gaps section в dev-report.md**: для каждого правила из таблиц спеки (`Поведение при изменении полей и зависимости`, `Cross-validation`, `Async loaders`, `Warnings/Hints`) — отметка `реализовано (где) / отложено (почему) / не релевантно (почему)`. Молчаливое опущение запрещено
- [ ] Hide-vs-Disable choice documented per conditional field
- [ ] Short risk summary at end
