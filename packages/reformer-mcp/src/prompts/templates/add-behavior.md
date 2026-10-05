You add behavior to a `@reformer/*` form.

A form has **ONE behavior** — `form.behavior.ts`, one function, one `behavior` field of the assembly:

```typescript
import { defineFormBehavior, compute, enableWhen, hideWhen } from '@reformer/core/behaviors';

export const formBehavior = defineFormBehavior<MyForm>(({ model, form, schema }) => {
  const isMortgage = () => model.loanType === 'mortgage';

  // links over the model
  compute(model.$.total, () => model.price * model.quantity);
  enableWhen(model.$.propertyValue, isMortgage, { resetOnDisable: true });

  // rules for schema nodes — addressed by `selector`
  hideWhen(schema.node('mortgage'), () => !isMortgage());
});
```

- **Links over the model** bind to the handle `model.$.<field>`: `compute` / `copyFrom` / `enableWhen` / `disableWhen` / `onChange` / `transformValue` / `resetWhen` / `syncFields` / `revalidateWhen`; `apply(model.$.group, groupBehavior)` for a sub-form, `applyEach(model.$.items, itemBehavior)` for array rows.
- **Rules for schema nodes** address a node by `selector`: `hideWhen(schema.node('x'), cond)`, `onComponentEvent(schema.node('wizard'), 'onSubmit', handler)`, `onMount(schema.node('boundary'), load)`, `renderEffect(schema, fn)`. They are imported from the SAME module, `@reformer/core/behaviors`, and are executed by `FormRenderer`. When the markup is written by hand in JSX they do nothing — there visibility, submit and loading stay in JSX.
- Conditions read the **model** (`model.loanType`), in both kinds of rules — so one constant serves `enableWhen` and `hideWhen`.
- Operators self-register in the active behavior; the form owns their lifecycle. Pass the behavior to the assembly: `createForm({ …, behavior: formBehavior })`. No manual cleanup array.

The former contract — a second behavior for the render layer (`form.render.ts`, the `renderBehavior` field, a factory `(form, model, validation) => (schema) => …`) — is gone: ❌ do not emit it. There is also NO `BehaviorSchemaFn`, NO `behavior: (path) => {…}`, NO `validate(path.x)`: path-based behaviors were removed.

**Standalone primitives** from `@reformer/core` (`computeFrom` / `copyFrom` / `watchField` / `enableWhen` / …) still exist for code that lives outside a form's behavior: each returns a cleanup function, run them in a `useEffect` and dispose on unmount. For a form's own behavior prefer the DSL above; don't mix both for the same form.

Value-ops write model signals (`model.$.x`); state/UI-ops (`enableWhen`, `updateComponentProps`, array `clear`) touch form nodes (`form.x`).

## Args

- requirements: {{requirements}}

## Current form code

```typescript
{{code}}
```

## ⛔ Critical inline rules — CYCLE PREVENTION (do not skip)

A reactive cycle hangs the browser at mount. These rules are non-negotiable:

1. **Start with declarative only**: `enableWhen` / `disableWhen` / `copyFrom`. NO `watchField` / `computeFrom` on iteration 1. Verify mount works, then add computed.
2. **Every `watchField` MUST take `{ immediate: false }`**. No exceptions.
3. **`watchField` accepts ONE source signal** (signature: `watchField(model.$.field, callback, options)`). Array-of-signals is NOT supported. For multiple triggers — multiple `watchField` calls on different signals, all calling a shared compute function.
4. **Guard every `setValue`**: compare with current value, abort if equal (for arrays — compare `length`).
5. **Guard `enable`/`disable`**: check `field.disabled.value` first — re-disable triggers spurious signal.
6. **`revalidateWhen` bridges behavior→validation — its callback runs the separate validation layer: `revalidateWhen([model.$.dep], () => void validateModel(model, schema))`.** Validation is a standalone layer (`@reformer/core/validation`, a `defineValidationSchema(({ model }) => …)` function run by `validateModel`); layout/behavior nodes carry NO validators. Add `revalidateWhen` only when a behavior writes a field the user isn't editing (a `copyFrom`/`compute` target) whose validity must be re-checked — the wizard's `validateStep`/`validateAll` (both `validateModel`) already re-run on submit/step for user-edited fields, so don't double-run.
7. **`computeFrom` sources are arbitrary model signals** — pass `[model.$.a, model.$.b.c]` from anywhere in the tree (cross-level is fine, signals carry their own path). Values arrive **positionally** in the same order: `computeFrom([model.$.price, model.$.qty], model.$.total, (price, qty) => price * qty)`.
8. **NEVER `enableWhen` on a whole `ArrayNode` with `resetOnDisable: true`** — verified browser-hang. For conditional array visibility use the node rule `hideWhen(schema.node('array-selector'), () => !model.flag)`, or a JSX conditional when the markup is written by hand.
9. **NEVER combine raw `effect()` from `@preact/signals-core` with signal-write calls** (`schema.node().setHidden()`, `field.setValue()`, `field.disable()`, etc.) **inside the same callback**. setHidden writes the hidden-signal → effect dependency graph re-runs → infinite loop with «Cycle detected» runtime error. Node visibility is DECLARED in the behavior, not driven by hand:

   ```tsx
   // ❌ Cycle detected — effect reads a signal, setHidden writes a signal
   useEffect(() => {
     const dispose = effect(() => {
       const loanType = form.loanType.value.value;
       bundle.render.node('mortgage-section').setHidden(loanType !== 'mortgage');
       bundle.render.node('car-section').setHidden(loanType !== 'car');
     });
     return dispose;
   }, [bundle, form]);

   // ✅ a rule for the node, in form.behavior.ts — the form owns its lifecycle
   hideWhen(schema.node('mortgage-section'), () => model.loanType !== 'mortgage');
   hideWhen(schema.node('car-section'), () => model.loanType !== 'car');
   ```

   Imperative `setHidden` / `patchProps` (`bundle.render.node('x').setHidden(true)`) is for one-off actions from event handlers — a button that collapses a section. `effect()` raw — только для side-effects вне React (`console.log`, fetch, broadcasting events). Внутри React tree читай значение через `useFormControlValue`.

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
  (lastName, firstName, middleName) =>
    [lastName, firstName, middleName].filter(Boolean).join(' ').trim()
);
```

For the DSL variant, `compute(target, fn)` auto-tracks every signal `fn` reads — no explicit source list:

```typescript
compute(model.$.fullName, () =>
  [model.personalData.lastName, model.personalData.firstName].filter(Boolean).join(' ').trim()
);
```

11. **Условие читает МОДЕЛЬ, а не ноду формы.** Внутри поведения значение поля — это `model.<field>`: чтение через модель и даёт значение, и подписывает правило на изменения. Одинаково для связей над моделью (`enableWhen`/`disableWhen`/`copyFrom`) и для правил узлов (`hideWhen`).

    Нода формы (`form.<field>`) значением не является: `field.value` возвращает **сам Signal-объект** (`Signal<T>`), текущее значение — `field.value.value`. Сравнение `field.value !== 'foo'` — всегда true (Signal `!==` literal), `field.value === true` — всегда false. Тихий silent fail: условие никогда не срабатывает, секция вечно скрыта/видима, errors нет. Если значение приходит аргументом (`computeFrom((...values) => …)`, `onChange((value) => …)`) — там уже plain value.

    ```typescript
    // ❌ Signal !== literal → всегда true → секция вечно скрыта; подписки нет
    hideWhen(schema.node('mortgage-section'), () => form.loanType.value !== 'mortgage');

    // ❌ работает, но это запись прежнего контракта: условие читало ноду формы
    hideWhen(schema.node('mortgage-section'), () => form.loanType.value.value !== 'mortgage');

    // ✅ условие читает модель
    hideWhen(schema.node('mortgage-section'), () => model.loanType !== 'mortgage');
    hideWhen(schema.node('properties-array'), () => !model.hasProperty);

    // ✅ в JSX (разметка руками) — useFormControlValue: bridge сам разворачивает .value.value
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

    **Как делать правильно**: оставь `copyFrom` для синхронизации значений; для скрытия секции используй правило узла `hideWhen(schema.node('selector'), () => …)` (в разметке руками — JSX-conditional `{condition && <Section/>}`). **Не блокируй disable'ом ту же группу, в которую пишет copyFrom**.

    ```typescript
    // ❌ race: copyFrom пишет registrationAddress→residenceAddress, потом enableWhen
    // обнуляет residenceAddress (или наоборот). Видно как "иногда пусто, иногда заполнено".
    copyFrom(model.$.registrationAddress, model.$.residenceAddress, {
      when: () => model.sameAsRegistration === true,
    });
    enableWhen(model.$.residenceAddress, () => model.sameAsRegistration === false, {
      resetOnDisable: true,
    });

    // ✅ copyFrom для значений; enable/disable группы БЕЗ resetOnDisable; скрытие — правило узла
    copyFrom(model.$.registrationAddress, model.$.residenceAddress, {
      when: () => model.sameAsRegistration === true,
    });
    enableWhen(model.$.residenceAddress, () => model.sameAsRegistration === false); // без resetOnDisable
    hideWhen(schema.node('residence'), () => model.sameAsRegistration === true);
    ```

    Copying a whole group signal (`model.$.registrationAddress → model.$.residenceAddress`) copies every field; there is no `fields: 'all'` option in M1 — pass the group signal, not a leaf.

14. **TYPED model generic — обязательно. Inline-callback OK для коротких, extract module-level для содержательных.**

    **Часть A — generic.** `createModel<T>` / `defineFormBehavior<T>` параметризованы form-interface'ом. Передай свой type явно — тогда `model.$.<field>` типизирован и опечатка в имени поля подсветится:

    ```typescript
    import type { OrderForm } from './types';

    // ✅ standalone-примитивы (cleanup-массив в useEffect) — model типизирован сборкой
    const { model } = useFormBundle(() =>
      createForm<OrderForm>({ initial: INITIAL, schema: formSchema })
    );
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
    // передаётся полем `behavior` в сборку формы

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

- **Hide** (`hideWhen(schema.node('selector'), cond)` — a rule for a schema node; a JSX conditional when the markup is written by hand) → the node disappears from DOM. Use for type/status conditions (`loanType=mortgage`, `employmentStatus=employed`). Hiding does NOT take the field out of the model: it is still validated.
- **Disable** (`enableWhen`) → field stays visible, control greyed out, and it stops participating in validation. Use for progressive disclosure (`confirmPassword` after `password`).

For type/status conditional fields **default = Hide, NOT Disable**. When a hidden field must also stop being validated, the two stand side by side with one shared condition: `enableWhen(model.$.propertyValue, isMortgage, { resetOnDisable: true })` + `hideWhen(schema.node('mortgage'), () => !isMortgage())`.

**Scopes are isolated.** `schema.node(selector)` sees the nodes of its own scope only: the root behavior — the root tree without the contents of array `item`s and sub-form `part`s. A node inside a row or a part is addressed from the sub-behavior, which receives its own `schema`:

```typescript
const addressBehavior = defineFormBehavior<Address>(({ model, schema }) => {
  hideWhen(schema.node('apartment'), () => model.house === ''); // looked up inside the part
});

apply([model.$.registrationAddress, model.$.residenceAddress], addressBehavior);
applyEach(model.$.properties, propertyBehavior);
```

## TS2589 workaround (deeply nested forms)

```typescript
// useFormControlValue with deep path
const v = useFormControlValue(form.step1.foo as never) as string;
// validateModel — cast the model/schema узел when deep-nesting trips TS2589
await validateModel(model, STEP_SCHEMAS[step] as never);
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

1. Write the form's behavior as ONE `defineFormBehavior<T>(({ model, form, schema }) => …)` in `form.behavior.ts`, passed as the `behavior` field of `createForm`. Standalone primitives (cleanup-array in `useEffect`) are for code outside the form; don't mix both for the same form.
2. Map each requirement to a rule: a link over the model (`compute` / `onChange` / `enableWhen` / `disableWhen` / `copyFrom` / `syncFields` / `resetWhen` / `transformValue` / `revalidateWhen`) or a rule for a schema node (`hideWhen` / `onComponentEvent` / `onMount`). Not sure which of two similar operators — tool `choose_api`.
3. Use `apply([model.$.a, model.$.b], subBehavior)` if a behavior repeats across groups, `applyEach(model.$.items, itemBehavior)` for array rows.
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
- [ ] Поведение одно: правила узлов (`hideWhen` по `selector`) стоят в том же `defineFormBehavior`, что и связи над моделью — нет `form.render.ts` и `renderBehavior` (прежний контракт)
- [ ] Никаких raw `effect()` + signal-write комбинаций (rule #9); видимость узлов объявлена правилами `hideWhen`
- [ ] Условия читают модель (`model.<field>`), а не ноду формы (rule #11) — `form.<field>.value` сравнивается с Signal-объектом и тихо ломает условие
- [ ] Узлы внутри строки массива и подформы адресуются из под-поведения (`applyEach` / `apply`), а не из корневого
- [ ] `useFormControl` / `useFormControlValue` вызываются ТОЛЬКО на FieldNode (leaf). Никогда на FormProxy root, GroupNode, ArrayNode (rule #12) — иначе TypeError на componentProps.value
- [ ] Никаких `enableWhen + resetOnDisable: true` на той же Group, в которую пишет `copyFrom` (rule #13) — race ломает данные. Скрытие — правило узла `hideWhen` (в разметке руками — JSX-conditional)
- [ ] **Model generic зафиксирован**: `createModel<MyForm>` / `defineFormBehavior<MyForm>` (НЕ `<any>`, НЕ опущен) — silent fail на опечатках имён полей (rule #14, часть A)
- [ ] **Содержательные callback'и (>5 lines, computeFrom, async watchField) extracted module-level** как типизированные функции `(form: MyForm) => Result`; inline OK только для коротких predicates / single setter (rule #14, часть B)
- [ ] **Spec gaps section в dev-report.md**: для каждого правила из таблиц спеки (`Поведение при изменении полей и зависимости`, `Cross-validation`, `Async loaders`, `Warnings/Hints`) — отметка `реализовано (где) / отложено (почему) / не релевантно (почему)`. Молчаливое опущение запрещено
- [ ] Hide-vs-Disable choice documented per conditional field
- [ ] Short risk summary at end
