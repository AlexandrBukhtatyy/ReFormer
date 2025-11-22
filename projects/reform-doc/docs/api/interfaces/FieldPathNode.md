# FieldPathNode

Defined in: [core/types/field-path.ts:45](https://github.com/AlexandrBukhtatyy/ReFormer/blob/6c591333cce7039afe1dde0903d75315103b9850/packages/reformer/src/core/types/field-path.ts#L45)

Узел в пути поля
Содержит метаинформацию о поле для валидации

## Type Parameters

### TForm

`TForm`

### TField

`TField`

### TKey

`TKey` = `unknown`

## Properties

### \_\_fieldType?

```ts
readonly optional __fieldType: TField;
```

Defined in: [core/types/field-path.ts:53](https://github.com/AlexandrBukhtatyy/ReFormer/blob/6c591333cce7039afe1dde0903d75315103b9850/packages/reformer/src/core/types/field-path.ts#L53)

Тип поля

***

### \_\_formType?

```ts
readonly optional __formType: TForm;
```

Defined in: [core/types/field-path.ts:51](https://github.com/AlexandrBukhtatyy/ReFormer/blob/6c591333cce7039afe1dde0903d75315103b9850/packages/reformer/src/core/types/field-path.ts#L51)

Тип формы

***

### \_\_key

```ts
readonly __key: TKey;
```

Defined in: [core/types/field-path.ts:47](https://github.com/AlexandrBukhtatyy/ReFormer/blob/6c591333cce7039afe1dde0903d75315103b9850/packages/reformer/src/core/types/field-path.ts#L47)

Ключ поля

***

### \_\_path

```ts
readonly __path: string;
```

Defined in: [core/types/field-path.ts:49](https://github.com/AlexandrBukhtatyy/ReFormer/blob/6c591333cce7039afe1dde0903d75315103b9850/packages/reformer/src/core/types/field-path.ts#L49)

Путь к полю (для вложенных объектов)
