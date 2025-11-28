# useFormControl()

Хук для работы с FieldNode или ArrayNode - возвращает состояние с подписками на сигналы

## Examples

```tsx
const { value, errors, componentProps } = useFormControl(control);

return (
  <div>
    <input value={value} onChange={e => control.setValue(e.target.value)} />
    {errors.length > 0 && <span>{errors[0].message}</span>}
  </div>
);
```

```tsx
const { length } = useFormControl(arrayControl);

return (
  <div>
    {arrayControl.map((item, index) => (
      <ItemComponent key={item.id || index} control={item} />
    ))}
    {length === 0 && <span>Список пуст</span>}
  </div>
);
```

## Call Signature

```ts
function useFormControl<T>(control): ArrayControlState<T>;
```

Defined in: [hooks/useFormControl.ts:41](https://github.com/AlexandrBukhtatyy/ReFormer/blob/9b7d1dcf176674e04dc8b74c64fd99540d095a33/packages/reformer/src/hooks/useFormControl.ts#L41)

Хук для работы с ArrayNode - возвращает состояние массива с подписками на сигналы

### Type Parameters

#### T

`T` *extends* [`FormFields`](../type-aliases/FormFields.md)

### Parameters

#### control

[`ArrayNode`](../classes/ArrayNode.md)\<`T`\> | `undefined`

### Returns

`ArrayControlState`\<`T`\>

## Call Signature

```ts
function useFormControl<T>(control): FieldControlState<T>;
```

Defined in: [hooks/useFormControl.ts:48](https://github.com/AlexandrBukhtatyy/ReFormer/blob/9b7d1dcf176674e04dc8b74c64fd99540d095a33/packages/reformer/src/hooks/useFormControl.ts#L48)

Хук для работы с FieldNode - возвращает состояние поля с подписками на сигналы

### Type Parameters

#### T

`T` *extends* [`FormValue`](../type-aliases/FormValue.md)

### Parameters

#### control

[`FieldNode`](../classes/FieldNode.md)\<`T`\>

### Returns

`FieldControlState`\<`T`\>
