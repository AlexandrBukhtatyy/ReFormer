## 17. COMPUTE FROM vs WATCH FIELD

### computeFrom — Same Nesting Level (annotate destructured arg!)

The compute callback receives the **whole form** (`(values: TForm) => T`),
so to get exact field types on the destructured argument you must annotate
it with the form type. Without annotation, fields are typed as `unknown`
and you'll be forced into `as` casts.

```typescript
// ✅ Works: all source fields at the same level, annotated with form type
computeFrom(
  [path.price, path.quantity],
  path.total,
  ({ price, quantity }: MyForm) => (price ?? 0) * (quantity ?? 0)
);

// ✅ Works: nested-to-nested at same level
computeFrom(
  [path.address.houseNumber, path.address.streetName],
  path.address.fullAddress,
  ({ address }: MyForm) => `${address.houseNumber} ${address.streetName}`
);

// ✅ Cross-level via group-node subscription: subscribe to the group node,
//    not individual leaves; destructure the group inside.
computeFrom([path.personalData], path.fullName, ({ personalData }: MyForm) =>
  [personalData.firstName, personalData.lastName].filter(Boolean).join(' ')
);

// ❌ FAILS: subscribing nested leaves with target at root level
computeFrom(
  [path.nested.price, path.nested.quantity],
  path.rootTotal,
  ...
);
// Use group-node subscription (above) or watchField (below) instead.
```

### watchField - Any Level

```typescript
// Works for cross-level computation
watchField(
  path.nested.price,
  (price, ctx) => {
    const quantity = ctx.form.quantity.value.value; // Sibling in nested
    ctx.form.rootTotal.setValue(price * quantity); // ctx.form.<path>.setValue, NOT ctx.setFieldValue
  },
  { immediate: false }
); // REQUIRED!

// Works for multiple dependencies
watchField(
  path.loanAmount,
  (amount, ctx) => {
    const term = ctx.form.loanTerm.value.value;
    const rate = ctx.form.interestRate.value.value;

    if (amount && term && rate) {
      const monthly = calculateMonthlyPayment(amount, term, rate);
      // Guard: only setValue if value really changed (cycle prevention)
      if (Math.abs(ctx.form.monthlyPayment.value.value - monthly) > 0.01) {
        ctx.form.monthlyPayment.setValue(monthly);
      }
    }
  },
  { immediate: false }
); // REQUIRED!
```

### Cross-level write API

Inside a `watchField` callback, write to other fields via `ctx.form.<path>.setValue(value)` —
**`ctx.setFieldValue(name, value)` does not exist** (that was a documentation typo, fixed).
For reads use `ctx.form.<path>.value.value` (the inner `.value` reads the signal).
For enable/disable: `ctx.form.<path>.enable()` / `.disable()` / read `.disabled.value`.

````

### Rule of Thumb

| Scenario | Use |
|----------|-----|
| All fields share same parent | `computeFrom` (simpler, auto-cleanup) |
| Fields at different levels | `watchField` (more flexible) |
| Multiple dependencies | `watchField` |
| Async computation | `watchField` with async callback |

### Stage-pattern for chained computeds

When several computeds depend on each other (e.g. `interestRate` → `monthlyPayment` → `paymentToIncomeRatio`), put the whole chain inside ONE `watchField` for the upstream trigger. Do NOT split into one watcher per target — that creates cross-watcher signal bouncing and risks cycles. Read intermediate values from the `new` local you just computed, not from `ctx.form.intermediate.value.value` (which still holds the old value during the cascade).

### Multiple triggers, one cascade

`watchField` accepts a **single** `FieldPathNode` — there is no `watchField([pathA, pathB], ...)` overload. If a single computed depends on several independent triggers (e.g. `monthlyPayment` depends on `loanAmount`, `loanTerm`, `interestRate`), register one `watchField` per trigger and have them all call the same compute function:

```typescript
function recomputeMonthlyPayment(ctx: BehaviorContext<MyForm>) {
  const amount = ctx.form.step1.loanAmount.value.value;
  const term   = ctx.form.step1.loanTerm.value.value;
  const rate   = ctx.form.interestRate.value.value;
  if (!amount || !term || !rate) return;
  const monthly = annuity(amount, term, rate);
  if (Math.abs((ctx.form.monthlyPayment.value.value as number) - monthly) > 0.01) {
    ctx.form.monthlyPayment.setValue(monthly);
  }
}

watchField(path.step1.loanAmount, (_v, ctx) => recomputeMonthlyPayment(ctx), { immediate: false });
watchField(path.step1.loanTerm,   (_v, ctx) => recomputeMonthlyPayment(ctx), { immediate: false });
watchField(path.interestRate,     (_v, ctx) => recomputeMonthlyPayment(ctx), { immediate: false });
````

The "one watcher per trigger" cycle-prevention rule means **never register two watchField on the same path**, not "consolidate all triggers into one". Multiple watchers on different trigger paths is the canonical pattern for multi-source recomputes — try `watchField([…], …)` and you get a runtime `getFieldByPath` failure (the array form does not exist).
