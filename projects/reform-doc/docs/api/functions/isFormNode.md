# Function: isFormNode()

> **isFormNode**(`value`): `value is FormNode<FormValue>`

Defined in: [core/utils/type-guards.ts:39](https://github.com/AlexandrBukhtatyy/ReFormer/blob/0a4bb3eb91c092897c9afb429f71c64b1be9df7b/packages/reformer/src/core/utils/type-guards.ts#L39)

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
