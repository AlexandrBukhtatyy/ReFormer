# AsyncValidatorFn()

```ts
type AsyncValidatorFn<T> = (value) => Promise<ValidationError | null>;
```

Defined in: [core/types/index.ts:46](https://github.com/AlexandrBukhtatyy/ReFormer/blob/0ba4d0477dce65d180e9ae66a77e31ad88abc032/packages/reformer/src/core/types/index.ts#L46)

Асинхронная функция валидации

## Type Parameters

### T

`T` = [`FormValue`](FormValue.md)

## Parameters

### value

`T`

## Returns

`Promise`\<[`ValidationError`](../interfaces/ValidationError.md) \| `null`\>
