# preloadResource()

```ts
function preloadResource<T>(loader): ResourceConfig<T>;
```

Defined in: [core/utils/resources.ts:56](https://github.com/AlexandrBukhtatyy/ReFormer/blob/9b7d1dcf176674e04dc8b74c64fd99540d095a33/packages/reformer/src/core/utils/resources.ts#L56)

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
