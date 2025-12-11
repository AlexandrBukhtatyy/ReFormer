## 17. COMPUTE FROM vs WATCH FIELD

### computeFrom - Same Nesting Level Only

```typescript
// Works: all source fields and target at same level
computeFrom(
  [path.price, path.quantity],
  path.total,
  ({ price, quantity }) => (price || 0) * (quantity || 0)
);

// Works: all nested at same level
computeFrom(
  [path.address.houseNumber, path.address.streetName],
  path.address.fullAddress,
  ({ houseNumber, streetName }) => `${houseNumber} ${streetName}`
);

// FAILS: different nesting levels
computeFrom(
  [path.nested.price, path.nested.quantity],
  path.rootTotal,  // Different level - won't work!
  ...
);
```

### watchField - Any Level

```typescript
// Works for cross-level computation
watchField(path.nested.price, (price, ctx) => {
  const quantity = ctx.form.quantity.value.value;  // Sibling in nested
  ctx.setFieldValue('rootTotal', price * quantity); // Full path to root
});

// Works for multiple dependencies
watchField(path.loanAmount, (amount, ctx) => {
  const term = ctx.form.loanTerm.value.value;
  const rate = ctx.form.interestRate.value.value;

  if (amount && term && rate) {
    const monthly = calculateMonthlyPayment(amount, term, rate);
    ctx.setFieldValue('monthlyPayment', monthly);
  }
});
```

### Rule of Thumb

| Scenario | Use |
|----------|-----|
| All fields share same parent | `computeFrom` (simpler, auto-cleanup) |
| Fields at different levels | `watchField` (more flexible) |
| Multiple dependencies | `watchField` |
| Async computation | `watchField` with async callback |
