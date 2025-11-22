# TreeValidatorFn()

```ts
type TreeValidatorFn<TForm> = (ctx) => ValidationError | null;
```

Defined in: [core/types/validation-schema.ts:71](https://github.com/AlexandrBukhtatyy/ReFormer/blob/82f7a382c065e1c53e721ca1f2d0088e6c1b9020/packages/reformer/src/core/types/validation-schema.ts#L71)

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
