# useFormControlValue()

```ts
function useFormControlValue<T>(control): T;
```

Defined in: [hooks/useFormControl.ts:315](https://github.com/AlexandrBukhtatyy/ReFormer/blob/0ba4d0477dce65d180e9ae66a77e31ad88abc032/packages/reformer/src/hooks/useFormControl.ts#L315)

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
