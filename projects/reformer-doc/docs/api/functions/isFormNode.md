# isFormNode()

```ts
function isFormNode(value): value is FormNode<FormValue>;
```

Defined in: [core/utils/type-guards.ts:45](https://github.com/AlexandrBukhtatyy/ReFormer/blob/dc1362d11717598d8c52ddda4c24a269fc146261/packages/reformer/src/core/utils/type-guards.ts#L45)

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
