# TreeValidatorFn()

```ts
type TreeValidatorFn<TForm> = (ctx) => ValidationError | null;
```

Defined in: [core/types/validation-schema.ts:71](https://github.com/AlexandrBukhtatyy/ReFormer/blob/a3c7aab04746efd72e6c230f052496b66681f449/packages/reformer/src/core/types/validation-schema.ts#L71)

Функция cross-field валидации

## Type Parameters

### TForm

`TForm`

## Parameters

### ctx

[`FormContext`](../interfaces/FormContext.md)\<`TForm`\>

## Returns

[`ValidationError`](../interfaces/ValidationError.md) \| `null`

## Example

```typescript
validateTree((ctx) => {
  const password = ctx.form.password.value.value;
  const confirm = ctx.form.confirmPassword.value.value;
  if (password !== confirm) {
    return { code: 'mismatch', message: 'Passwords must match' };
  }
  return null;
});
```
