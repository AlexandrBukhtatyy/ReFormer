# Function: isFieldNode()

> **isFieldNode**(`value`): `value is FieldNode<FormValue>`

Defined in: [core/utils/type-guards.ts:71](https://github.com/AlexandrBukhtatyy/ReFormer/blob/0a4bb3eb91c092897c9afb429f71c64b1be9df7b/packages/reformer/src/core/utils/type-guards.ts#L71)

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
