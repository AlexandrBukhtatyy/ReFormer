# ValidatorFn()

```ts
type ValidatorFn<T> = (value) => ValidationError | null;
```

Defined in: [core/types/index.ts:39](https://github.com/AlexandrBukhtatyy/ReFormer/blob/dc1362d11717598d8c52ddda4c24a269fc146261/packages/reformer/src/core/types/index.ts#L39)

Синхронная функция валидации

## Type Parameters

### T

`T` = [`FormValue`](FormValue.md)

## Parameters

### value

`T`

## Returns

[`ValidationError`](../interfaces/ValidationError.md) \| `null`
