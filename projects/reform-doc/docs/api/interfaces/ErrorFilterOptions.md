# ErrorFilterOptions

Defined in: [core/types/index.ts:44](https://github.com/AlexandrBukhtatyy/ReFormer/blob/204ba50383b17498d832dd1de227d67f7a68b06b/packages/reformer/src/core/types/index.ts#L44)

Опции для фильтрации ошибок в методе getErrors()

## Properties

### code?

```ts
optional code: string | string[];
```

Defined in: [core/types/index.ts:46](https://github.com/AlexandrBukhtatyy/ReFormer/blob/204ba50383b17498d832dd1de227d67f7a68b06b/packages/reformer/src/core/types/index.ts#L46)

Фильтр по коду ошибки

***

### message?

```ts
optional message: string;
```

Defined in: [core/types/index.ts:49](https://github.com/AlexandrBukhtatyy/ReFormer/blob/204ba50383b17498d832dd1de227d67f7a68b06b/packages/reformer/src/core/types/index.ts#L49)

Фильтр по сообщению (поддерживает частичное совпадение)

***

### params?

```ts
optional params: FormFields;
```

Defined in: [core/types/index.ts:52](https://github.com/AlexandrBukhtatyy/ReFormer/blob/204ba50383b17498d832dd1de227d67f7a68b06b/packages/reformer/src/core/types/index.ts#L52)

Фильтр по параметрам ошибки

***

### predicate()?

```ts
optional predicate: (error) => boolean;
```

Defined in: [core/types/index.ts:55](https://github.com/AlexandrBukhtatyy/ReFormer/blob/204ba50383b17498d832dd1de227d67f7a68b06b/packages/reformer/src/core/types/index.ts#L55)

Кастомный предикат для фильтрации

#### Parameters

##### error

[`ValidationError`](ValidationError.md)

#### Returns

`boolean`
