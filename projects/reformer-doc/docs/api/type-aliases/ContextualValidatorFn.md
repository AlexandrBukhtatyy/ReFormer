# ContextualValidatorFn()

```ts
type ContextualValidatorFn<TForm, TField> = (value, ctx) => ValidationError | null;
```

Defined in: [core/types/validation-schema.ts:34](https://github.com/AlexandrBukhtatyy/ReFormer/blob/dd72ad9a2510f54227bee8d21a0ffe3772504268/packages/reformer/src/core/types/validation-schema.ts#L34)

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
