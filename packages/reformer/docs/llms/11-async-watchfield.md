## 10. ASYNC WATCHFIELD (CRITICALLY IMPORTANT)

```typescript
// CORRECT - async watchField with ALL safeguards
watchField(
  path.parentField,
  async (value, ctx) => {
    if (!value) return;  // Guard clause

    try {
      const { data } = await fetchData(value);
      ctx.form.dependentField.updateComponentProps({ options: data });
    } catch (error) {
      console.error('Failed:', error);
      ctx.form.dependentField.updateComponentProps({ options: [] });
    }
  },
  { immediate: false, debounce: 300 }  // REQUIRED options
);

// WRONG - missing safeguards
watchField(path.field, async (value, ctx) => {
  const { data } = await fetchData(value);  // Will fail silently!
});
```

### Required Options for async watchField:
- `immediate: false` - prevents execution during initialization
- `debounce: 300` - prevents excessive API calls (300-500ms recommended)
- Guard clause - skip if value is empty
- try-catch - handle errors explicitly
