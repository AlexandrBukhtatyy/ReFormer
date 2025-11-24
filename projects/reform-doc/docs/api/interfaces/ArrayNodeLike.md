# ArrayNodeLike

Defined in: [core/types/index.ts:162](https://github.com/AlexandrBukhtatyy/ReFormer/blob/5ceaa6f29bbeaf24a4aaf6730d727f1d0b368936/packages/reformer/src/core/types/index.ts#L162)

Интерфейс для узлов, похожих на ArrayNode (с методом at)
Используется для duck typing при обходе путей

## Properties

### length

```ts
length: unknown;
```

Defined in: [core/types/index.ts:164](https://github.com/AlexandrBukhtatyy/ReFormer/blob/5ceaa6f29bbeaf24a4aaf6730d727f1d0b368936/packages/reformer/src/core/types/index.ts#L164)

## Methods

### at()

```ts
at(index): FormNode<unknown> | undefined;
```

Defined in: [core/types/index.ts:163](https://github.com/AlexandrBukhtatyy/ReFormer/blob/5ceaa6f29bbeaf24a4aaf6730d727f1d0b368936/packages/reformer/src/core/types/index.ts#L163)

#### Parameters

##### index

`number`

#### Returns

[`FormNode`](../classes/FormNode.md)\<`unknown`\> \| `undefined`
