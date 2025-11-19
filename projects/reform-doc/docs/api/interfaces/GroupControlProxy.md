# Interface: GroupControlProxy\<T\>

Defined in: [core/types/deep-schema.ts:146](https://github.com/AlexandrBukhtatyy/ReFormer/blob/0a4bb3eb91c092897c9afb429f71c64b1be9df7b/packages/reformer/src/core/types/deep-schema.ts#L146)

Интерфейс для GroupProxy (вложенные формы)

Предоставляет методы для работы с группой полей как с единой формой

## Type Parameters

### T

`T` *extends* [`FormFields`](../type-aliases/FormFields.md)

## Properties

### dirty

> **dirty**: `boolean`

Defined in: [core/types/deep-schema.ts:160](https://github.com/AlexandrBukhtatyy/ReFormer/blob/0a4bb3eb91c092897c9afb429f71c64b1be9df7b/packages/reformer/src/core/types/deep-schema.ts#L160)

Хотя бы одно поле группы было изменено

***

### errors

> **errors**: [`ValidationError`](ValidationError.md)[]

Defined in: [core/types/deep-schema.ts:154](https://github.com/AlexandrBukhtatyy/ReFormer/blob/0a4bb3eb91c092897c9afb429f71c64b1be9df7b/packages/reformer/src/core/types/deep-schema.ts#L154)

Все ошибки валидации в группе

***

### invalid

> **invalid**: `boolean`

Defined in: [core/types/deep-schema.ts:151](https://github.com/AlexandrBukhtatyy/ReFormer/blob/0a4bb3eb91c092897c9afb429f71c64b1be9df7b/packages/reformer/src/core/types/deep-schema.ts#L151)

Хотя бы одно поле группы невалидно

***

### touched

> **touched**: `boolean`

Defined in: [core/types/deep-schema.ts:157](https://github.com/AlexandrBukhtatyy/ReFormer/blob/0a4bb3eb91c092897c9afb429f71c64b1be9df7b/packages/reformer/src/core/types/deep-schema.ts#L157)

Хотя бы одно поле группы было touched

***

### valid

> **valid**: `boolean`

Defined in: [core/types/deep-schema.ts:148](https://github.com/AlexandrBukhtatyy/ReFormer/blob/0a4bb3eb91c092897c9afb429f71c64b1be9df7b/packages/reformer/src/core/types/deep-schema.ts#L148)

Все поля группы валидны

## Methods

### getValue()

> **getValue**(): `T`

Defined in: [core/types/deep-schema.ts:165](https://github.com/AlexandrBukhtatyy/ReFormer/blob/0a4bb3eb91c092897c9afb429f71c64b1be9df7b/packages/reformer/src/core/types/deep-schema.ts#L165)

Получить значения всех полей группы

#### Returns

`T`

***

### markAsTouched()

> **markAsTouched**(): `void`

Defined in: [core/types/deep-schema.ts:180](https://github.com/AlexandrBukhtatyy/ReFormer/blob/0a4bb3eb91c092897c9afb429f71c64b1be9df7b/packages/reformer/src/core/types/deep-schema.ts#L180)

Пометить все поля группы как touched

#### Returns

`void`

***

### reset()

> **reset**(): `void`

Defined in: [core/types/deep-schema.ts:185](https://github.com/AlexandrBukhtatyy/ReFormer/blob/0a4bb3eb91c092897c9afb429f71c64b1be9df7b/packages/reformer/src/core/types/deep-schema.ts#L185)

Сбросить все поля группы к начальным значениям

#### Returns

`void`

***

### setValue()

> **setValue**(`value`): `void`

Defined in: [core/types/deep-schema.ts:170](https://github.com/AlexandrBukhtatyy/ReFormer/blob/0a4bb3eb91c092897c9afb429f71c64b1be9df7b/packages/reformer/src/core/types/deep-schema.ts#L170)

Установить значения полей группы

#### Parameters

##### value

`Partial`\<`T`\>

#### Returns

`void`

***

### validate()

> **validate**(): `Promise`\<`boolean`\>

Defined in: [core/types/deep-schema.ts:175](https://github.com/AlexandrBukhtatyy/ReFormer/blob/0a4bb3eb91c092897c9afb429f71c64b1be9df7b/packages/reformer/src/core/types/deep-schema.ts#L175)

Валидировать все поля группы

#### Returns

`Promise`\<`boolean`\>
