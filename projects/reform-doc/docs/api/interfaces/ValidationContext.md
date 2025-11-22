# Interface: ValidationContext\<TForm, TField\>

Defined in: [core/types/validation-schema.ts:31](https://github.com/AlexandrBukhtatyy/ReFormer/blob/0a4bb3eb91c092897c9afb429f71c64b1be9df7b/packages/reformer/src/core/types/validation-schema.ts#L31)

Контекст валидации для отдельного поля
Предоставляет доступ к:

- Значению текущего поля
- Значениям других полей
- Всей форме

## Type Parameters

### TForm

`TForm`

### TField

`TField`

## Methods

### formValue()

> **formValue**(): `TForm`

Defined in: [core/types/validation-schema.ts:55](https://github.com/AlexandrBukhtatyy/ReFormer/blob/0a4bb3eb91c092897c9afb429f71c64b1be9df7b/packages/reformer/src/core/types/validation-schema.ts#L55)

Получить значения всей формы

#### Returns

`TForm`

---

### getControl()

> **getControl**(): `any`

Defined in: [core/types/validation-schema.ts:60](https://github.com/AlexandrBukhtatyy/ReFormer/blob/0a4bb3eb91c092897c9afb429f71c64b1be9df7b/packages/reformer/src/core/types/validation-schema.ts#L60)

Получить контроллер поля

#### Returns

`any`

---

### getField()

#### Call Signature

> **getField**\<`K`\>(`path`): `TForm`\[`K`\]

Defined in: [core/types/validation-schema.ts:41](https://github.com/AlexandrBukhtatyy/ReFormer/blob/0a4bb3eb91c092897c9afb429f71c64b1be9df7b/packages/reformer/src/core/types/validation-schema.ts#L41)

Получить значение другого поля по пути

##### Type Parameters

###### K

`K` _extends_ `string` \| `number` \| `symbol`

##### Parameters

###### path

`K`

Путь к полю (например, 'loanType', 'personalData.firstName')

##### Returns

`TForm`\[`K`\]

#### Call Signature

> **getField**(`path`): `unknown`

Defined in: [core/types/validation-schema.ts:42](https://github.com/AlexandrBukhtatyy/ReFormer/blob/0a4bb3eb91c092897c9afb429f71c64b1be9df7b/packages/reformer/src/core/types/validation-schema.ts#L42)

##### Parameters

###### path

`string`

##### Returns

`unknown`

---

### getForm()

> **getForm**(): `any`

Defined in: [core/types/validation-schema.ts:65](https://github.com/AlexandrBukhtatyy/ReFormer/blob/0a4bb3eb91c092897c9afb429f71c64b1be9df7b/packages/reformer/src/core/types/validation-schema.ts#L65)

Получить GroupNode

#### Returns

`any`

---

### setField()

#### Call Signature

> **setField**\<`K`\>(`path`, `value`): `void`

Defined in: [core/types/validation-schema.ts:49](https://github.com/AlexandrBukhtatyy/ReFormer/blob/0a4bb3eb91c092897c9afb429f71c64b1be9df7b/packages/reformer/src/core/types/validation-schema.ts#L49)

Установить значение другого поля по пути

##### Type Parameters

###### K

`K` _extends_ `string` \| `number` \| `symbol`

##### Parameters

###### path

`K`

Путь к полю (например, 'loanType', 'personalData.firstName')

###### value

`TForm`\[`K`\]

Новое значение поля

##### Returns

`void`

#### Call Signature

> **setField**(`path`, `value`): `void`

Defined in: [core/types/validation-schema.ts:50](https://github.com/AlexandrBukhtatyy/ReFormer/blob/0a4bb3eb91c092897c9afb429f71c64b1be9df7b/packages/reformer/src/core/types/validation-schema.ts#L50)

##### Parameters

###### path

`string`

###### value

`unknown`

##### Returns

`void`

---

### value()

> **value**(): `TField`

Defined in: [core/types/validation-schema.ts:35](https://github.com/AlexandrBukhtatyy/ReFormer/blob/0a4bb3eb91c092897c9afb429f71c64b1be9df7b/packages/reformer/src/core/types/validation-schema.ts#L35)

Получить текущее значение поля

#### Returns

`TField`
