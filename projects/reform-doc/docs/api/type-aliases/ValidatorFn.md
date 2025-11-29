# ValidatorFn()

```ts
type ValidatorFn<T> = (value) => ValidationError | null;
```

Defined in: [core/types/index.ts:39](https://github.com/AlexandrBukhtatyy/ReFormer/blob/c914b0e8aa05b7fd141395bf4d8c4eec038cba53/packages/reformer/src/core/types/index.ts#L39)

Синхронная функция валидации

## Type Parameters

### T

`T` = [`FormValue`](FormValue.md)

## Parameters

### value

`T`

## Returns

[`ValidationError`](../interfaces/ValidationError.md) \| `null`
