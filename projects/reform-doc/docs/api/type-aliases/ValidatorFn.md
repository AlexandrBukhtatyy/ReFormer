# ValidatorFn()

```ts
type ValidatorFn<T> = (value) => ValidationError | null;
```

Defined in: [core/types/index.ts:39](https://github.com/AlexandrBukhtatyy/ReFormer/blob/9fa60ced367fa684435110fffa6b324fd4b5c03c/packages/reformer/src/core/types/index.ts#L39)

Синхронная функция валидации

## Type Parameters

### T

`T` = [`FormValue`](FormValue.md)

## Parameters

### value

`T`

## Returns

[`ValidationError`](../interfaces/ValidationError.md) \| `null`
