# ResourceConfig

Defined in: [core/utils/resources.ts:18](https://github.com/AlexandrBukhtatyy/ReFormer/blob/cfe63ccdb422f5ff2245f12de46311ef4d5a36a2/packages/reformer/src/core/utils/resources.ts#L18)

## Type Parameters

### T

`T`

## Properties

### load()

```ts
load: (params?) => Promise<ResourceResult<T>>;
```

Defined in: [core/utils/resources.ts:20](https://github.com/AlexandrBukhtatyy/ReFormer/blob/cfe63ccdb422f5ff2245f12de46311ef4d5a36a2/packages/reformer/src/core/utils/resources.ts#L20)

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

Defined in: [core/utils/resources.ts:19](https://github.com/AlexandrBukhtatyy/ReFormer/blob/cfe63ccdb422f5ff2245f12de46311ef4d5a36a2/packages/reformer/src/core/utils/resources.ts#L19)
