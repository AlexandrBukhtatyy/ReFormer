# Function: useFormControl()

> **useFormControl**(`control`): `object`

Defined in: [hooks/useFormControl.ts:5](https://github.com/AlexandrBukhtatyy/ReFormer/blob/0a4bb3eb91c092897c9afb429f71c64b1be9df7b/packages/reformer/src/hooks/useFormControl.ts#L5)

## Parameters

### control

[`FieldNode`](../classes/FieldNode.md)\<[`FormValue`](../type-aliases/FormValue.md)\>

## Returns

`object`

### disabled

> **disabled**: `boolean`

### errors

> **errors**: [`ValidationError`](../interfaces/ValidationError.md)[]

### pending

> **pending**: `boolean`

### value

> **value**: `string` \| `number` \| `boolean` \| `Date` \| `File` \| [`FormValue`](../type-aliases/FormValue.md)[] \| \{\[`key`: `string`\]: [`FormValue`](../type-aliases/FormValue.md); \} \| `null` \| `undefined`
