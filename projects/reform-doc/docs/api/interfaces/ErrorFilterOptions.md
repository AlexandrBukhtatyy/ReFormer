# Interface: ErrorFilterOptions

Defined in: [core/types/index.ts:42](https://github.com/AlexandrBukhtatyy/ReFormer/blob/0a4bb3eb91c092897c9afb429f71c64b1be9df7b/packages/reformer/src/core/types/index.ts#L42)

Опции для фильтрации ошибок в методе getErrors()

## Properties

### code?

> `optional` **code**: `string` \| `string`[]

Defined in: [core/types/index.ts:44](https://github.com/AlexandrBukhtatyy/ReFormer/blob/0a4bb3eb91c092897c9afb429f71c64b1be9df7b/packages/reformer/src/core/types/index.ts#L44)

Фильтр по коду ошибки

***

### message?

> `optional` **message**: `string`

Defined in: [core/types/index.ts:47](https://github.com/AlexandrBukhtatyy/ReFormer/blob/0a4bb3eb91c092897c9afb429f71c64b1be9df7b/packages/reformer/src/core/types/index.ts#L47)

Фильтр по сообщению (поддерживает частичное совпадение)

***

### params?

> `optional` **params**: `Record`\<`string`, [`FormValue`](../type-aliases/FormValue.md)\>

Defined in: [core/types/index.ts:50](https://github.com/AlexandrBukhtatyy/ReFormer/blob/0a4bb3eb91c092897c9afb429f71c64b1be9df7b/packages/reformer/src/core/types/index.ts#L50)

Фильтр по параметрам ошибки

***

### predicate()?

> `optional` **predicate**: (`error`) => `boolean`

Defined in: [core/types/index.ts:53](https://github.com/AlexandrBukhtatyy/ReFormer/blob/0a4bb3eb91c092897c9afb429f71c64b1be9df7b/packages/reformer/src/core/types/index.ts#L53)

Кастомный предикат для фильтрации

#### Parameters

##### error

[`ValidationError`](ValidationError.md)

#### Returns

`boolean`
