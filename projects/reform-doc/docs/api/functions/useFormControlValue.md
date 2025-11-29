# useFormControlValue()

```ts
function useFormControlValue<T>(control): T;
```

Defined in: [hooks/useFormControl.ts:315](https://github.com/AlexandrBukhtatyy/ReFormer/blob/9fa60ced367fa684435110fffa6b324fd4b5c03c/packages/reformer/src/hooks/useFormControl.ts#L315)

Хук для получения только значения поля без подписки на errors, valid и т.д.
Используйте когда нужно только значение для условного рендеринга.

## Type Parameters

### T

`T` *extends* [`FormValue`](../type-aliases/FormValue.md)

## Parameters

### control

[`FieldNode`](../classes/FieldNode.md)\<`T`\>

## Returns

`T`
