# Interface: FieldConfig\<T\>

Defined in: [core/types/deep-schema.ts:28](https://github.com/AlexandrBukhtatyy/ReFormer/blob/0a4bb3eb91c092897c9afb429f71c64b1be9df7b/packages/reformer/src/core/types/deep-schema.ts#L28)

Конфигурация поля

## Type Parameters

### T

`T`

## Properties

### asyncValidators?

> `optional` **asyncValidators**: [`AsyncValidatorFn`](../type-aliases/AsyncValidatorFn.md)\<`T`\>[]

Defined in: [core/types/deep-schema.ts:33](https://github.com/AlexandrBukhtatyy/ReFormer/blob/0a4bb3eb91c092897c9afb429f71c64b1be9df7b/packages/reformer/src/core/types/deep-schema.ts#L33)

***

### component

> **component**: `ComponentType`\<[`UnknownRecord`](../type-aliases/UnknownRecord.md)\>

Defined in: [core/types/deep-schema.ts:30](https://github.com/AlexandrBukhtatyy/ReFormer/blob/0a4bb3eb91c092897c9afb429f71c64b1be9df7b/packages/reformer/src/core/types/deep-schema.ts#L30)

***

### componentProps?

> `optional` **componentProps**: [`UnknownRecord`](../type-aliases/UnknownRecord.md)

Defined in: [core/types/deep-schema.ts:31](https://github.com/AlexandrBukhtatyy/ReFormer/blob/0a4bb3eb91c092897c9afb429f71c64b1be9df7b/packages/reformer/src/core/types/deep-schema.ts#L31)

***

### debounce?

> `optional` **debounce**: `number`

Defined in: [core/types/deep-schema.ts:37](https://github.com/AlexandrBukhtatyy/ReFormer/blob/0a4bb3eb91c092897c9afb429f71c64b1be9df7b/packages/reformer/src/core/types/deep-schema.ts#L37)

Задержка (в мс) перед запуском асинхронной валидации

***

### disabled?

> `optional` **disabled**: `boolean`

Defined in: [core/types/deep-schema.ts:34](https://github.com/AlexandrBukhtatyy/ReFormer/blob/0a4bb3eb91c092897c9afb429f71c64b1be9df7b/packages/reformer/src/core/types/deep-schema.ts#L34)

***

### updateOn?

> `optional` **updateOn**: `"change"` \| `"blur"` \| `"submit"`

Defined in: [core/types/deep-schema.ts:35](https://github.com/AlexandrBukhtatyy/ReFormer/blob/0a4bb3eb91c092897c9afb429f71c64b1be9df7b/packages/reformer/src/core/types/deep-schema.ts#L35)

***

### validators?

> `optional` **validators**: [`ValidatorFn`](../type-aliases/ValidatorFn.md)\<`T`\>[]

Defined in: [core/types/deep-schema.ts:32](https://github.com/AlexandrBukhtatyy/ReFormer/blob/0a4bb3eb91c092897c9afb429f71c64b1be9df7b/packages/reformer/src/core/types/deep-schema.ts#L32)

***

### value

> **value**: `T` \| `null`

Defined in: [core/types/deep-schema.ts:29](https://github.com/AlexandrBukhtatyy/ReFormer/blob/0a4bb3eb91c092897c9afb429f71c64b1be9df7b/packages/reformer/src/core/types/deep-schema.ts#L29)
