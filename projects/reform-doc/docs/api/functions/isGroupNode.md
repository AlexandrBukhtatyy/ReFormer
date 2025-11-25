# isGroupNode()

```ts
function isGroupNode(value): value is GroupNode<FormFields>;
```

Defined in: [core/utils/type-guards.ts:106](https://github.com/AlexandrBukhtatyy/ReFormer/blob/8c48398964e4c099041999cd19130ed40474d567/packages/reformer/src/core/utils/type-guards.ts#L106)

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
