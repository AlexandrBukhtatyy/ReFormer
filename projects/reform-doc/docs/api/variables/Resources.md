# Resources

```ts
const Resources: object;
```

Defined in: [core/utils/resources.ts:103](https://github.com/AlexandrBukhtatyy/ReFormer/blob/8c48398964e4c099041999cd19130ed40474d567/packages/reformer/src/core/utils/resources.ts#L103)

## Type Declaration

### partial()

```ts
partial: <T>(loader) => ResourceConfig<T> = partialResource;
```

Парциональная загрузка - данные загружаются порциями с учетом поиска/пагинации

#### Type Parameters

##### T

`T`

#### Parameters

##### loader

(`params?`) => `Promise`\<[`ResourceItem`](../interfaces/ResourceItem.md)\<`T`\>[]\>

функция загрузки, принимает параметры и возвращает массив

#### Returns

[`ResourceConfig`](../interfaces/ResourceConfig.md)\<`T`\>

### preload()

```ts
preload: <T>(loader) => ResourceConfig<T> = preloadResource;
```

Предзагрузка - данные загружаются один раз при первом обращении через функцию

#### Type Parameters

##### T

`T`

#### Parameters

##### loader

(`params?`) => `Promise`\<[`ResourceItem`](../interfaces/ResourceItem.md)\<`T`\>[]\>

функция загрузки, принимает параметры и возвращает массив

#### Returns

[`ResourceConfig`](../interfaces/ResourceConfig.md)\<`T`\>

### static()

```ts
static: <T>(items) => ResourceConfig<T> = staticResource;
```

Статический ресурс - данные загружаются один раз

#### Type Parameters

##### T

`T`

#### Parameters

##### items

[`ResourceItem`](../interfaces/ResourceItem.md)\<`T`\>[]

массив элементов

#### Returns

[`ResourceConfig`](../interfaces/ResourceConfig.md)\<`T`\>
