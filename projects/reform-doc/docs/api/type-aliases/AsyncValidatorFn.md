# AsyncValidatorFn()

```ts
type AsyncValidatorFn<T> = (value) => Promise<ValidationError | null>;
```

Defined in: [core/types/index.ts:31](https://github.com/AlexandrBukhtatyy/ReFormer/blob/21a22c7cca8ff4c7a6412f104e9d66a1709f1bf6/packages/reformer/src/core/types/index.ts#L31)

## Type Parameters

### T

`T` = [`FormValue`](FormValue.md)

## Parameters

### value

`T`

## Returns

`Promise`\<[`ValidationError`](../interfaces/ValidationError.md) \| `null`\>
