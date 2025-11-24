# ArrayNodeLike

Defined in: [core/types/index.ts:162](https://github.com/AlexandrBukhtatyy/ReFormer/blob/21a22c7cca8ff4c7a6412f104e9d66a1709f1bf6/packages/reformer/src/core/types/index.ts#L162)

Интерфейс для узлов, похожих на ArrayNode (с методом at)
Используется для duck typing при обходе путей

## Properties

### length

```ts
length: unknown;
```

Defined in: [core/types/index.ts:164](https://github.com/AlexandrBukhtatyy/ReFormer/blob/21a22c7cca8ff4c7a6412f104e9d66a1709f1bf6/packages/reformer/src/core/types/index.ts#L164)

## Methods

### at()

```ts
at(index): FormNode<unknown> | undefined;
```

Defined in: [core/types/index.ts:163](https://github.com/AlexandrBukhtatyy/ReFormer/blob/21a22c7cca8ff4c7a6412f104e9d66a1709f1bf6/packages/reformer/src/core/types/index.ts#L163)

#### Parameters

##### index

`number`

#### Returns

[`FormNode`](../classes/FormNode.md)\<`unknown`\> \| `undefined`
