# AsyncValidatorFn()

```ts
type AsyncValidatorFn<T> = (value) => Promise<ValidationError | null>;
```

Defined in: [core/types/index.ts:31](https://github.com/AlexandrBukhtatyy/ReFormer/blob/2f9343515d3674da9440637d3df644f3d1ac43db/packages/reformer/src/core/types/index.ts#L31)

## Type Parameters

### T

`T` = [`FormValue`](FormValue.md)

## Parameters

### value

`T`

## Returns

`Promise`\<[`ValidationError`](../interfaces/ValidationError.md) \| `null`\>
