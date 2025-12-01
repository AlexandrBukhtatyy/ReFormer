# ValidatorFn()

```ts
type ValidatorFn<T> = (value) => ValidationError | null;
```

Defined in: [core/types/index.ts:39](https://github.com/AlexandrBukhtatyy/ReFormer/blob/0ba4d0477dce65d180e9ae66a77e31ad88abc032/packages/reformer/src/core/types/index.ts#L39)

Синхронная функция валидации

## Type Parameters

### T

`T` = [`FormValue`](FormValue.md)

## Parameters

### value

`T`

## Returns

[`ValidationError`](../interfaces/ValidationError.md) \| `null`
