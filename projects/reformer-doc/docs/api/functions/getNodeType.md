# getNodeType()

```ts
function getNodeType(node): string;
```

Defined in: [core/utils/type-guards.ts:182](https://github.com/AlexandrBukhtatyy/ReFormer/blob/0ba4d0477dce65d180e9ae66a77e31ad88abc032/packages/reformer/src/core/utils/type-guards.ts#L182)

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
