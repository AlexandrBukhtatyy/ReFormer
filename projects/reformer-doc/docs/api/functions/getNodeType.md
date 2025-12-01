# getNodeType()

```ts
function getNodeType(node): string;
```

Defined in: [core/utils/type-guards.ts:182](https://github.com/AlexandrBukhtatyy/ReFormer/blob/dc1362d11717598d8c52ddda4c24a269fc146261/packages/reformer/src/core/utils/type-guards.ts#L182)

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
