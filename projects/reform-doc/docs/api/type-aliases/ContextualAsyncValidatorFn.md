# ContextualAsyncValidatorFn()

```ts
type ContextualAsyncValidatorFn<TForm, TField> = (value, ctx) => Promise<ValidationError | null>;
```

Defined in: [core/types/validation-schema.ts:51](https://github.com/AlexandrBukhtatyy/ReFormer/blob/ea2ae035215d691e049dbb965a182b2d4c638892/packages/reformer/src/core/types/validation-schema.ts#L51)

Асинхронная функция валидации поля с контекстом

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

`Promise`\<[`ValidationError`](../interfaces/ValidationError.md) \| `null`\>

## Example

```typescript
validateAsync(path.email, async (value, ctx) => {
  const exists = await checkEmailExists(value);
  if (exists) return { code: 'exists', message: 'Email already taken' };
  return null;
});
```
