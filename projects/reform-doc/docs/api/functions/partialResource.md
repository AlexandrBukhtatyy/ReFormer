# partialResource()

```ts
function partialResource<T>(loader): ResourceConfig<T>;
```

Defined in: [core/utils/resources.ts:84](https://github.com/AlexandrBukhtatyy/ReFormer/blob/dcfbc8e01cad51c12ece27c493ae5214ef7de021/packages/reformer/src/core/utils/resources.ts#L84)

Парциональная загрузка - данные загружаются порциями с учетом поиска/пагинации

## Type Parameters

### T

`T`

## Parameters

### loader

(`params?`) => `Promise`\<[`ResourceItem`](../interfaces/ResourceItem.md)\<`T`\>[]\>

функция загрузки, принимает параметры и возвращает массив

## Returns

[`ResourceConfig`](../interfaces/ResourceConfig.md)\<`T`\>
