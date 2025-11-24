# partialResource()

```ts
function partialResource<T>(loader): ResourceConfig<T>;
```

Defined in: [core/utils/resources.ts:84](https://github.com/AlexandrBukhtatyy/ReFormer/blob/2e1775025c7d62faafbd0cf76e1deefd8869e9b3/packages/reformer/src/core/utils/resources.ts#L84)

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
