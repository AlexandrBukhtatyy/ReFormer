# AsyncValidatorFn()

```ts
type AsyncValidatorFn<T> = (value) => Promise<ValidationError | null>;
```

Defined in: [core/types/index.ts:31](https://github.com/AlexandrBukhtatyy/ReFormer/blob/dcfbc8e01cad51c12ece27c493ae5214ef7de021/packages/reformer/src/core/types/index.ts#L31)

## Type Parameters

### T

`T` = [`FormValue`](FormValue.md)

## Parameters

### value

`T`

## Returns

`Promise`\<[`ValidationError`](../interfaces/ValidationError.md) \| `null`\>
