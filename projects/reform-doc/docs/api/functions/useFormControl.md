# useFormControl()

Хук для работы с FieldNode или ArrayNode - возвращает состояние с подписками на сигналы

Использует useSyncExternalStore для оптимальной интеграции с React 18+.
Компонент ре-рендерится только когда реально изменились данные контрола.

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

Defined in: [hooks/useFormControl.ts:364](https://github.com/AlexandrBukhtatyy/ReFormer/blob/c914b0e8aa05b7fd141395bf4d8c4eec038cba53/packages/reformer/src/hooks/useFormControl.ts#L364)

Хук для работы с ArrayNode - возвращает состояние массива с подписками на сигналы

### Type Parameters

#### T

`T` *extends* `FormFields`

### Parameters

#### control

[`ArrayNode`](../classes/ArrayNode.md)\<`T`\> | `undefined`

### Returns

`ArrayControlState`\<`T`\>

## Call Signature

```ts
function useFormControl<T>(control): FieldControlState<T>;
```

Defined in: [hooks/useFormControl.ts:372](https://github.com/AlexandrBukhtatyy/ReFormer/blob/c914b0e8aa05b7fd141395bf4d8c4eec038cba53/packages/reformer/src/hooks/useFormControl.ts#L372)

Хук для работы с FieldNode - возвращает состояние поля с подписками на сигналы

### Type Parameters

#### T

`T` *extends* [`FormValue`](../type-aliases/FormValue.md)

### Parameters

#### control

[`FieldNode`](../classes/FieldNode.md)\<`T`\>

### Returns

`FieldControlState`\<`T`\>
