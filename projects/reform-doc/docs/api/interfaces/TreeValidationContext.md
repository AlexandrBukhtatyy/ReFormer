# Interface: TreeValidationContext\<TForm\>

Defined in: [core/types/validation-schema.ts:72](https://github.com/AlexandrBukhtatyy/ReFormer/blob/0a4bb3eb91c092897c9afb429f71c64b1be9df7b/packages/reformer/src/core/types/validation-schema.ts#L72)

Контекст для cross-field валидации
Имеет доступ ко всей форме, но не к конкретному полю

## Type Parameters

### TForm

`TForm`

## Methods

### formValue()

> **formValue**(): `TForm`

Defined in: [core/types/validation-schema.ts:82](https://github.com/AlexandrBukhtatyy/ReFormer/blob/0a4bb3eb91c092897c9afb429f71c64b1be9df7b/packages/reformer/src/core/types/validation-schema.ts#L82)

Получить значения всей формы

#### Returns

`TForm`

---

### getField()

#### Call Signature

> **getField**\<`K`\>(`path`): `TForm`\[`K`\]

Defined in: [core/types/validation-schema.ts:76](https://github.com/AlexandrBukhtatyy/ReFormer/blob/0a4bb3eb91c092897c9afb429f71c64b1be9df7b/packages/reformer/src/core/types/validation-schema.ts#L76)

Получить значение поля по пути

##### Type Parameters

###### K

`K` _extends_ `string` \| `number` \| `symbol`

##### Parameters

###### path

`K`

##### Returns

`TForm`\[`K`\]

#### Call Signature

> **getField**(`path`): `unknown`

Defined in: [core/types/validation-schema.ts:77](https://github.com/AlexandrBukhtatyy/ReFormer/blob/0a4bb3eb91c092897c9afb429f71c64b1be9df7b/packages/reformer/src/core/types/validation-schema.ts#L77)

##### Parameters

###### path

`string`

##### Returns

`unknown`

---

### getForm()

> **getForm**(): `any`

Defined in: [core/types/validation-schema.ts:87](https://github.com/AlexandrBukhtatyy/ReFormer/blob/0a4bb3eb91c092897c9afb429f71c64b1be9df7b/packages/reformer/src/core/types/validation-schema.ts#L87)

Получить GroupNode

#### Returns

`any`
