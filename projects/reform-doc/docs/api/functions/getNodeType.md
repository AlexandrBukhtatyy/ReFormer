# getNodeType()

```ts
function getNodeType(node): string;
```

Defined in: [core/utils/type-guards.ts:173](https://github.com/AlexandrBukhtatyy/ReFormer/blob/004c1ffc7ad7a532d48a1818bbddff4ad2796ac4/packages/reformer/src/core/utils/type-guards.ts#L173)

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
