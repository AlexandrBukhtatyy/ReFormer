# useFormControlValue()

```ts
function useFormControlValue<T>(control): T;
```

Defined in: [hooks/useFormControl.ts:315](https://github.com/AlexandrBukhtatyy/ReFormer/blob/c914b0e8aa05b7fd141395bf4d8c4eec038cba53/packages/reformer/src/hooks/useFormControl.ts#L315)

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
