# isFormNode()

```ts
function isFormNode(value): value is FormNode<FormValue>;
```

Defined in: [core/utils/type-guards.ts:45](https://github.com/AlexandrBukhtatyy/ReFormer/blob/0ba4d0477dce65d180e9ae66a77e31ad88abc032/packages/reformer/src/core/utils/type-guards.ts#L45)

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
