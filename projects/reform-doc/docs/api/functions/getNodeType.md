# getNodeType()

```ts
function getNodeType(node): string;
```

Defined in: [core/utils/type-guards.ts:173](https://github.com/AlexandrBukhtatyy/ReFormer/blob/a90f09dd6532f27be3e08d4c85d7d4a30f44c424/packages/reformer/src/core/utils/type-guards.ts#L173)

Получить тип узла как строку (для отладки)

Полезно для логирования и отладки

## Parameters

### node

`unknown`

Узел для проверки

## Returns

`string`

Строковое название типа узла

## Example

```typescript
console.log('Node type:', getNodeType(node)); // "FieldNode" | "GroupNode" | "ArrayNode" | "FormNode" | "Unknown"
```
