# getNodeType()

```ts
function getNodeType(node): string;
```

Defined in: [core/utils/type-guards.ts:173](https://github.com/AlexandrBukhtatyy/ReFormer/blob/a3c7aab04746efd72e6c230f052496b66681f449/packages/reformer/src/core/utils/type-guards.ts#L173)

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
