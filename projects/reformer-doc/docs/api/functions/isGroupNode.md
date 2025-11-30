# isGroupNode()

```ts
function isGroupNode(value): value is GroupNode<FormFields>;
```

Defined in: [core/utils/type-guards.ts:115](https://github.com/AlexandrBukhtatyy/ReFormer/blob/34c25f8a76648f468be9f6786e03e9ad735d7890/packages/reformer/src/core/utils/type-guards.ts#L115)

Проверить, является ли значение GroupNode (объект с вложенными полями)

GroupNode представляет объект с вложенными полями формы
и имеет методы для применения validation/behavior схем

## Parameters

### value

`unknown`

Значение для проверки

## Returns

`value is GroupNode<FormFields>`

true если value является GroupNode

## Example

```typescript
if (isGroupNode(node)) {
  node.applyValidationSchema(schema); //  OK
  node.getFieldByPath('user.email'); //  OK
}
```
