# AsyncValidatorFn()

```ts
type AsyncValidatorFn<T> = (value) => Promise<ValidationError | null>;
```

Defined in: [core/types/index.ts:46](https://github.com/AlexandrBukhtatyy/ReFormer/blob/34c25f8a76648f468be9f6786e03e9ad735d7890/packages/reformer/src/core/types/index.ts#L46)

Асинхронная функция валидации

## Type Parameters

### T

`T` = [`FormValue`](FormValue.md)

## Parameters

### value

`T`

## Returns

`Promise`\<[`ValidationError`](../interfaces/ValidationError.md) \| `null`\>
