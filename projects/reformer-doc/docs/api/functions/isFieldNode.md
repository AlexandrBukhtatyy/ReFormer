# isFieldNode()

```ts
function isFieldNode(value): value is FieldNode<FormValue>;
```

Defined in: [core/utils/type-guards.ts:80](https://github.com/AlexandrBukhtatyy/ReFormer/blob/34c25f8a76648f468be9f6786e03e9ad735d7890/packages/reformer/src/core/utils/type-guards.ts#L80)

Проверить, является ли значение FieldNode (примитивное поле)

FieldNode представляет примитивное поле формы (string, number, boolean и т.д.)
и имеет валидаторы, но не имеет вложенных полей или элементов массива

## Parameters

### value

`unknown`

Значение для проверки

## Returns

`value is FieldNode<FormValue>`

true если value является FieldNode

## Example

```typescript
if (isFieldNode(node)) {
  node.validators; //  OK
  node.asyncValidators; //  OK
  node.markAsTouched(); //  OK
}
```
