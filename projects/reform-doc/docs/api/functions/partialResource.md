# partialResource()

```ts
function partialResource<T>(loader): ResourceConfig<T>;
```

Defined in: [core/utils/resources.ts:84](https://github.com/AlexandrBukhtatyy/ReFormer/blob/00d059d4c214534c0160525e911b62a54789ee88/packages/reformer/src/core/utils/resources.ts#L84)

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
