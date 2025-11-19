# Interface: FieldPathNode\<TForm, TField, TKey\>

Defined in: [core/types/field-path.ts:45](https://github.com/AlexandrBukhtatyy/ReFormer/blob/0a4bb3eb91c092897c9afb429f71c64b1be9df7b/packages/reformer/src/core/types/field-path.ts#L45)

Узел в пути поля
Содержит метаинформацию о поле для валидации

## Type Parameters

### TForm

`TForm`

### TField

`TField`

### TKey

`TKey` *extends* keyof `TForm` = keyof `TForm`

## Properties

### \_\_fieldType?

> `readonly` `optional` **\_\_fieldType**: `TField`

Defined in: [core/types/field-path.ts:53](https://github.com/AlexandrBukhtatyy/ReFormer/blob/0a4bb3eb91c092897c9afb429f71c64b1be9df7b/packages/reformer/src/core/types/field-path.ts#L53)

Тип поля

***

### \_\_formType?

> `readonly` `optional` **\_\_formType**: `TForm`

Defined in: [core/types/field-path.ts:51](https://github.com/AlexandrBukhtatyy/ReFormer/blob/0a4bb3eb91c092897c9afb429f71c64b1be9df7b/packages/reformer/src/core/types/field-path.ts#L51)

Тип формы

***

### \_\_key

> `readonly` **\_\_key**: `TKey`

Defined in: [core/types/field-path.ts:47](https://github.com/AlexandrBukhtatyy/ReFormer/blob/0a4bb3eb91c092897c9afb429f71c64b1be9df7b/packages/reformer/src/core/types/field-path.ts#L47)

Ключ поля

***

### \_\_path

> `readonly` **\_\_path**: `string`

Defined in: [core/types/field-path.ts:49](https://github.com/AlexandrBukhtatyy/ReFormer/blob/0a4bb3eb91c092897c9afb429f71c64b1be9df7b/packages/reformer/src/core/types/field-path.ts#L49)

Путь к полю (для вложенных объектов)
