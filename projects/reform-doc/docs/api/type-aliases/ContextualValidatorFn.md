# ContextualValidatorFn()

```ts
type ContextualValidatorFn<TForm, TField> = (value, ctx) => ValidationError | null;
```

Defined in: [core/types/validation-schema.ts:34](https://github.com/AlexandrBukhtatyy/ReFormer/blob/21a22c7cca8ff4c7a6412f104e9d66a1709f1bf6/packages/reformer/src/core/types/validation-schema.ts#L34)

Функция валидации поля с контекстом

Новый паттерн: (value, ctx: FormContext) => ValidationError | null

## Type Parameters

### TForm

`TForm`

### TField

`TField`

## Parameters

### value

`TField`

### ctx

[`FormContext`](../interfaces/FormContext.md)\<`TForm`\>

## Returns

[`ValidationError`](../interfaces/ValidationError.md) \| `null`

## Example

```typescript
validate(path.email, (value, ctx) => {
  if (!value) return { code: 'required', message: 'Email required' };
  const confirm = ctx.form.confirmEmail.value.value;
  if (value !== confirm) return { code: 'mismatch', message: 'Must match' };
  return null;
});
```
