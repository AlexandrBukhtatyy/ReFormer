# AsyncValidatorFn()

```ts
type AsyncValidatorFn<T> = (value) => Promise<ValidationError | null>;
```

Defined in: [core/types/index.ts:31](https://github.com/AlexandrBukhtatyy/ReFormer/blob/ea2ae035215d691e049dbb965a182b2d4c638892/packages/reformer/src/core/types/index.ts#L31)

## Type Parameters

### T

`T` = [`FormValue`](FormValue.md)

## Parameters

### value

`T`

## Returns

`Promise`\<[`ValidationError`](../interfaces/ValidationError.md) \| `null`\>
