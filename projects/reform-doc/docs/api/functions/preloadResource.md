# preloadResource()

```ts
function preloadResource<T>(loader): ResourceConfig<T>;
```

Defined in: [core/utils/resources.ts:56](https://github.com/AlexandrBukhtatyy/ReFormer/blob/2e1775025c7d62faafbd0cf76e1deefd8869e9b3/packages/reformer/src/core/utils/resources.ts#L56)

Предзагрузка - данные загружаются один раз при первом обращении через функцию

## Type Parameters

### T

`T`

## Parameters

### loader

(`params?`) => `Promise`\<[`ResourceItem`](../interfaces/ResourceItem.md)\<`T`\>[]\>

функция загрузки, принимает параметры и возвращает массив

## Returns

[`ResourceConfig`](../interfaces/ResourceConfig.md)\<`T`\>
