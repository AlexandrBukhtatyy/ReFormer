# AsyncValidatorFn()

```ts
type AsyncValidatorFn<T> = (value) => Promise<ValidationError | null>;
```

Defined in: [core/types/index.ts:31](https://github.com/AlexandrBukhtatyy/ReFormer/blob/8ff0e4e0843184094d947de69314442db46de23d/packages/reformer/src/core/types/index.ts#L31)

## Type Parameters

### T

`T` = [`FormValue`](FormValue.md)

## Parameters

### value

`T`

## Returns

`Promise`\<[`ValidationError`](../interfaces/ValidationError.md) \| `null`\>
