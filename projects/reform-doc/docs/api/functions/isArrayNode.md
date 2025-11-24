# isArrayNode()

```ts
function isArrayNode(value): value is ArrayNode<FormFields>;
```

Defined in: [core/utils/type-guards.ts:141](https://github.com/AlexandrBukhtatyy/ReFormer/blob/5ceaa6f29bbeaf24a4aaf6730d727f1d0b368936/packages/reformer/src/core/utils/type-guards.ts#L141)

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
