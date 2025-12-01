# isArrayNode()

```ts
function isArrayNode(value): value is ArrayNode<FormFields>;
```

Defined in: [core/utils/type-guards.ts:150](https://github.com/AlexandrBukhtatyy/ReFormer/blob/dd72ad9a2510f54227bee8d21a0ffe3772504268/packages/reformer/src/core/utils/type-guards.ts#L150)

Проверить, является ли значение ArrayNode (массив форм)

ArrayNode представляет массив вложенных форм (обычно GroupNode)
и имеет array-like методы (push, removeAt, at)

## Parameters

### value

`unknown`

Значение для проверки

## Returns

`value is ArrayNode<FormFields>`

true если value является ArrayNode

## Example

```typescript
if (isArrayNode(node)) {
  node.push(); //  OK - добавить элемент
  node.removeAt(0); //  OK - удалить элемент
  const item = node.at(0); //  OK - получить элемент
}
```
