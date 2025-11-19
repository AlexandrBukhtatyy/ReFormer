# Interface: GroupNodeConfig\<T\>

Defined in: [core/types/index.ts:122](https://github.com/AlexandrBukhtatyy/ReFormer/blob/0a4bb3eb91c092897c9afb429f71c64b1be9df7b/packages/reformer/src/core/types/index.ts#L122)

Конфигурация GroupNode с поддержкой схем
Используется для создания форм с автоматическим применением behavior и validation схем

## Type Parameters

### T

`T` *extends* `Record`\<`string`, [`FormValue`](../type-aliases/FormValue.md)\>

## Properties

### behavior?

> `optional` **behavior**: `BehaviorSchemaFn`\<`T`\>

Defined in: [core/types/index.ts:127](https://github.com/AlexandrBukhtatyy/ReFormer/blob/0a4bb3eb91c092897c9afb429f71c64b1be9df7b/packages/reformer/src/core/types/index.ts#L127)

Схема реактивного поведения (copyFrom, enableWhen, computeFrom и т.д.)

***

### form

> **form**: [`FormSchema`](../type-aliases/FormSchema.md)\<`T`\>

Defined in: [core/types/index.ts:124](https://github.com/AlexandrBukhtatyy/ReFormer/blob/0a4bb3eb91c092897c9afb429f71c64b1be9df7b/packages/reformer/src/core/types/index.ts#L124)

Схема структуры формы (поля и их конфигурация)

***

### validation?

> `optional` **validation**: [`ValidationSchemaFn`](../type-aliases/ValidationSchemaFn.md)\<`T`\>

Defined in: [core/types/index.ts:130](https://github.com/AlexandrBukhtatyy/ReFormer/blob/0a4bb3eb91c092897c9afb429f71c64b1be9df7b/packages/reformer/src/core/types/index.ts#L130)

Схема валидации (required, email, minLength и т.д.)
