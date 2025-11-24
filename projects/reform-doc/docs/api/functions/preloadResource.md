# preloadResource()

```ts
function preloadResource<T>(loader): ResourceConfig<T>;
```

Defined in: [core/utils/resources.ts:56](https://github.com/AlexandrBukhtatyy/ReFormer/blob/21a22c7cca8ff4c7a6412f104e9d66a1709f1bf6/packages/reformer/src/core/utils/resources.ts#L56)

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
