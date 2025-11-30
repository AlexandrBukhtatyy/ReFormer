# ResourceConfig

Defined in: [core/utils/resources.ts:18](https://github.com/AlexandrBukhtatyy/ReFormer/blob/dc1362d11717598d8c52ddda4c24a269fc146261/packages/reformer/src/core/utils/resources.ts#L18)

## Type Parameters

### T

`T`

## Properties

### load()

```ts
load: (params?) => Promise<ResourceResult<T>>;
```

Defined in: [core/utils/resources.ts:20](https://github.com/AlexandrBukhtatyy/ReFormer/blob/dc1362d11717598d8c52ddda4c24a269fc146261/packages/reformer/src/core/utils/resources.ts#L20)

#### Parameters

##### params?

[`ResourceLoadParams`](ResourceLoadParams.md)

#### Returns

`Promise`\<[`ResourceResult`](ResourceResult.md)\<`T`\>\>

***

### type

```ts
type: "static" | "preload" | "partial";
```

Defined in: [core/utils/resources.ts:19](https://github.com/AlexandrBukhtatyy/ReFormer/blob/dc1362d11717598d8c52ddda4c24a269fc146261/packages/reformer/src/core/utils/resources.ts#L19)
