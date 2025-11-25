# ResourceConfig

Defined in: [core/utils/resources.ts:18](https://github.com/AlexandrBukhtatyy/ReFormer/blob/bd45b7bd0af225a0a37544ca26180fb6ed2c99d8/packages/reformer/src/core/utils/resources.ts#L18)

## Type Parameters

### T

`T`

## Properties

### load()

```ts
load: (params?) => Promise<ResourceResult<T>>;
```

Defined in: [core/utils/resources.ts:20](https://github.com/AlexandrBukhtatyy/ReFormer/blob/bd45b7bd0af225a0a37544ca26180fb6ed2c99d8/packages/reformer/src/core/utils/resources.ts#L20)

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

Defined in: [core/utils/resources.ts:19](https://github.com/AlexandrBukhtatyy/ReFormer/blob/bd45b7bd0af225a0a37544ca26180fb6ed2c99d8/packages/reformer/src/core/utils/resources.ts#L19)
