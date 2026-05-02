## 11. ARRAY CLEANUP PATTERN

```typescript
// CORRECT - cleanup array when checkbox unchecked
watchField(
  path.hasItems,
  (hasItems, ctx) => {
    if (!hasItems && ctx.form.items) {
      ctx.form.items.clear();
    }
  },
  { immediate: false }
);

// WRONG - no immediate: false, no null check
watchField(path.hasItems, (hasItems, ctx) => {
  if (!hasItems) ctx.form.items.clear(); // May crash on init!
});
```
