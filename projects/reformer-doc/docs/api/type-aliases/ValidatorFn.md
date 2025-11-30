# ValidatorFn()

```ts
type ValidatorFn<T> = (value) => ValidationError | null;
```

Defined in: [core/types/index.ts:39](https://github.com/AlexandrBukhtatyy/ReFormer/blob/8fb78cbcd4dc6409ef1f3e23e9b6b2b668787a30/packages/reformer/src/core/types/index.ts#L39)

Синхронная функция валидации

## Type Parameters

### T

`T` = [`FormValue`](FormValue.md)

## Parameters

### value

`T`

## Returns

[`ValidationError`](../interfaces/ValidationError.md) \| `null`
