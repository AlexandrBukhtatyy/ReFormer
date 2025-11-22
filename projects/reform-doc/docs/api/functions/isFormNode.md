# isFormNode()

```ts
function isFormNode(value): value is FormNode<FormValue>;
```

Defined in: [core/utils/type-guards.ts:39](https://github.com/AlexandrBukhtatyy/ReFormer/blob/82f7a382c065e1c53e721ca1f2d0088e6c1b9020/packages/reformer/src/core/utils/type-guards.ts#L39)

Проверить, является ли значение любым FormNode

Проверяет базовые свойства, общие для всех типов узлов

## Parameters

### value

`unknown`

Значение для проверки

## Returns

`value is FormNode<FormValue>`

true если value является FormNode

## Example

```typescript
if (isFormNode(value)) {
  value.setValue(newValue);
  value.validate();
}
```
