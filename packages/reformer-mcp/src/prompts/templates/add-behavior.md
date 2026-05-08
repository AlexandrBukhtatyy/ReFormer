You add behaviors to a `@reformer/core` form.

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
3. **`watchField` accepts ONE path** (signature: `watchField(path, callback, options)`). Array-of-paths is NOT supported — runtime breaks (`Cannot read properties of undefined (reading 'startsWith')`). For multiple triggers — multiple `watchField` calls on different paths, all calling a shared compute function.
4. **Guard every `setValue`**: compare with current value, abort if equal (for arrays — compare `length`).
5. **Guard `enable`/`disable`**: check `field.disabled.value` first — re-disable triggers spurious signal.
6. **Don't use `revalidateWhen` if `copyFrom` + validators on target already cover it.**
7. **`computeFrom` only same-level** — for cross-level use `watchField`.
8. **NEVER `enableWhen` on a whole `ArrayNode` with `resetOnDisable: true`** — verified browser-hang. For conditional array visibility use JSX-conditional (`{form.flag.value && <ArrayUI/>}`).
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

10. **`computeFrom` source-subscription rule** — values-объект, который computeFn получает, строится по **last-segment keys** path-источников. Если computeFn читает `form.<group>.<field>` (nested), подписывайся на **group node** (`[path.<group>]`) — values придёт как `{ <group>: { <field>: ... } }`. Если подписаться на отдельные leaves (`[path.<group>.<fieldA>, path.<group>.<fieldB>]`), values станет flat (`{ <fieldA>, <fieldB> }`) — computeFn получит plain object без вложенности и тихо вернёт пустоту/0/undefined. **`as never` cast в `[...sources] as never` — red flag**: если cast скрывает type error в `computeFrom` — это значит subscription mistyped. Зарефактори: либо подписка на group, либо computeFn перепиши под flat shape.

```typescript
// ❌ silent fail — computeFn видит { lastName, firstName, middleName }, а читает form.personalData.lastName
computeFrom<MyForm, string>(
  [path.personalData.lastName, path.personalData.firstName, path.personalData.middleName] as never,
  path.fullName,
  (form) => [form.personalData?.lastName, form.personalData?.firstName].filter(Boolean).join(' ')
);

// ✅ group node subscription — computeFn получает { personalData: { lastName, firstName, ... } }
computeFrom([path.personalData], path.fullName, (values) => {
  const pd = values.personalData;
  return [pd?.lastName, pd?.firstName, pd?.middleName].filter(Boolean).join(' ').trim();
});
```

11. **Preact Signal двойной `.value` — обязательно при чтении значения из callback'а.** Для FieldNode `field.value` возвращает **сам Signal-объект** (`Signal<T>`), а **текущее значение** — это `field.value.value`. Сравнение `field.value !== 'foo'` — всегда true (Signal `!==` literal), `field.value === true` — всегда false. Тихий silent fail: hideWhen-условие никогда не срабатывает, секция вечно скрыта/видима, errors нет.

    **Где применимо:** любая callback-функция, которая читает значение поля из `form.<field>` напрямую. В первую очередь — `hideWhen(node, () => …)`, `enableWhen`, `disableWhen`, тело `effect()`, тело `useEffect`, `setValue` predicate. Если значение приходит через arg (`computeFrom((values) => …)`, `watchField((newValue) => …)`) — там уже plain value, второй `.value` не нужен.

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
    copyFrom(path.registrationAddress, path.residenceAddress, {
      when: (form) => form.sameAsRegistration === true,
      fields: 'all',
    });
    enableWhen(path.residenceAddress, (form) => form.sameAsRegistration === false, {
      resetOnDisable: true,
    });

    // ✅ только copyFrom; скрытие — JSX
    copyFrom(path.registrationAddress, path.residenceAddress, {
      when: (form) => form.sameAsRegistration === true,
      fields: 'all',
    });
    // в index.tsx:
    {!sameAsRegistration && <ResidenceAddressSection control={control}/>}
    ```

14. **TYPED schema generic — обязательно. Inline-callback OK для коротких, extract module-level для содержательных.**

    **Часть A — generic.** `BehaviorSchemaFn<T>` параметризован form-interface'ом. Передай свой type явно:

    ```typescript
    import type { OrderForm } from './types';

    // ✅ generic зафиксирован — values, ctx, value во всех callback'ах инферятся правильно
    const behavior: BehaviorSchemaFn<OrderForm> = (path) => {
      computeFrom([path.price, path.quantity], path.total, (values) => values.price * values.quantity);
    };

    // ❌ generic дропнут или path: any — silent fail на опечатках в field-name
    const behavior: BehaviorSchemaFn<any> = (path: any) => { ... };
    ```

    `as any` cast допустим в редких narrow call-site (например, TS2589 на 70+полевой форме); сужай до конкретного выражения, не на весь callback parameter.

    **Часть B — inline vs extract.** Inline нормально для коротких:

    ```typescript
    // ✅ inline OK
    enableWhen(path.discountCode, (form) => form.subtotal > 100);
    copyFrom(path.regAddress, path.resAddress, { when: (form) => form.sameAsReg, fields: 'all' });
    ```

    Extract обязателен когда: callback >5 строк, async watchField с try/catch, computeFrom с branching, повторно используется. Особенно важно для `computeFrom` — inline-arrow часто теряет inference `(values: TForm)` и заставляет писать `(values: any)`. Module-level функция избегает этого:

    ```typescript
    // ✅ extracted typed helper — TS инферит signature по reference
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

    const behavior: BehaviorSchemaFn<LoanForm> = (path) => {
      computeFrom(
        [path.loanAmount, path.loanTerm, path.interestRate],
        path.monthlyPayment,
        computeMonthlyPayment // by-reference, без inline-arrow
      );
    };
    ```

## 🎯 Hide vs Disable

- **Hide** (JSX-conditional / `hideWhen` / `setHidden`) → field disappears from DOM. Use for type/status conditions (`loanType=mortgage`, `employmentStatus=employed`).
- **Disable** (`enableWhen`) → field stays visible, control greyed out. Use only for progressive disclosure (`confirmPassword` after `password`).

For type/status conditional fields **default = Hide, NOT Disable**.

## TS2589 workaround (deeply nested forms)

```typescript
// useFormControlValue with deep path
const v = useFormControlValue(form.step1.foo as never) as string;
// validateForm root cast
await validateForm(form as unknown as GroupNode<MyForm>, STEP_VALIDATIONS[step]);
// validation/behavior callbacks
const behavior = (path: any): void => { ... };
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

1. Map each requirement to a behavior (`computeFrom` / `watchField` / `enableWhen` / `disableWhen` / `copyFrom` / `syncFields` / `resetWhen` / `transformValue` / `revalidateWhen`).
2. Use `apply([...paths], schema)` if a behavior repeats across multiple fields/groups.
3. Walk the cycle-prevention checklist for each `watchField`/`computeFrom` you add.
4. Don't duplicate existing `watchField` callbacks — extend them.
5. `computeFrom` only same-level.

## Output checklist

- [ ] Прочитал все ресурсы из Prerequisites: yes/no
- [ ] Every `watchField` has `{ immediate: false }`
- [ ] Every `setValue` has equality guard
- [ ] No `enableWhen` on whole ArrayNode
- [ ] `computeFrom` not used cross-level
- [ ] `computeFrom` sources subscribe to group node когда computeFn читает nested fields (rule #10); никаких `as never` cast'ов на источниках
- [ ] Никаких raw `effect()` + signal-write комбинаций (rule #9); React orchestration через `useFormControlValue` + `useEffect`
- [ ] Все callback'и (`hideWhen`/`enableWhen`/`disableWhen`/`effect`/`useEffect`), читающие `form.<field>` напрямую, используют **двойной** `.value.value` (rule #11) — single `.value` сравнивается с Signal-объектом и тихо ломает условие
- [ ] `useFormControl` / `useFormControlValue` вызываются ТОЛЬКО на FieldNode (leaf). Никогда на FormProxy root, GroupNode, ArrayNode (rule #12) — иначе TypeError на componentProps.value
- [ ] Никаких `enableWhen + resetOnDisable: true` на той же Group, в которую пишет `copyFrom` (rule #13) — race ломает данные. Скрытие — JSX-conditional / `hideWhen`
- [ ] **Schema generic зафиксирован**: `BehaviorSchemaFn<MyForm>` (НЕ `<any>`, НЕ опущен) — silent fail на опечатках имён полей (rule #14, часть A)
- [ ] **Содержательные callback'и (>5 lines, computeFrom, async watchField) extracted module-level** как типизированные функции `(form: MyForm) => Result`; inline OK только для коротких predicates / single setter (rule #14, часть B)
- [ ] **Spec gaps section в dev-report.md**: для каждого правила из таблиц спеки (`Поведение при изменении полей и зависимости`, `Cross-validation`, `Async loaders`, `Warnings/Hints`) — отметка `реализовано (где) / отложено (почему) / не релевантно (почему)`. Молчаливое опущение запрещено
- [ ] Hide-vs-Disable choice documented per conditional field
- [ ] Short risk summary at end
