# partialResource()

```ts
function partialResource<T>(loader): ResourceConfig<T>;
```

Defined in: [core/utils/resources.ts:84](https://github.com/AlexandrBukhtatyy/ReFormer/blob/a90f09dd6532f27be3e08d4c85d7d4a30f44c424/packages/reformer/src/core/utils/resources.ts#L84)

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
