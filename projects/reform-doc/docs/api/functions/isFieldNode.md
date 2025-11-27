# isFieldNode()

```ts
function isFieldNode(value): value is FieldNode<FormValue>;
```

Defined in: [core/utils/type-guards.ts:71](https://github.com/AlexandrBukhtatyy/ReFormer/blob/004c1ffc7ad7a532d48a1818bbddff4ad2796ac4/packages/reformer/src/core/utils/type-guards.ts#L71)

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
