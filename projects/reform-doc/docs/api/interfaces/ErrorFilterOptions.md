# ErrorFilterOptions

Defined in: [core/types/index.ts:66](https://github.com/AlexandrBukhtatyy/ReFormer/blob/9fa60ced367fa684435110fffa6b324fd4b5c03c/packages/reformer/src/core/types/index.ts#L66)

Опции для фильтрации ошибок в методе getErrors()

## Properties

### code?

```ts
optional code: string | string[];
```

Defined in: [core/types/index.ts:68](https://github.com/AlexandrBukhtatyy/ReFormer/blob/9fa60ced367fa684435110fffa6b324fd4b5c03c/packages/reformer/src/core/types/index.ts#L68)

Фильтр по коду ошибки

***

### message?

```ts
optional message: string;
```

Defined in: [core/types/index.ts:71](https://github.com/AlexandrBukhtatyy/ReFormer/blob/9fa60ced367fa684435110fffa6b324fd4b5c03c/packages/reformer/src/core/types/index.ts#L71)

Фильтр по сообщению (поддерживает частичное совпадение)

***

### params?

```ts
optional params: FormFields;
```

Defined in: [core/types/index.ts:74](https://github.com/AlexandrBukhtatyy/ReFormer/blob/9fa60ced367fa684435110fffa6b324fd4b5c03c/packages/reformer/src/core/types/index.ts#L74)

Фильтр по параметрам ошибки

***

### predicate()?

```ts
optional predicate: (error) => boolean;
```

Defined in: [core/types/index.ts:77](https://github.com/AlexandrBukhtatyy/ReFormer/blob/9fa60ced367fa684435110fffa6b324fd4b5c03c/packages/reformer/src/core/types/index.ts#L77)

Кастомный предикат для фильтрации

#### Parameters

##### error

[`ValidationError`](ValidationError.md)

#### Returns

`boolean`
