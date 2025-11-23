# useFormControl()

```ts
function useFormControl<T>(control): object;
```

Defined in: [hooks/useFormControl.ts:23](https://github.com/AlexandrBukhtatyy/ReFormer/blob/81b4edf889773afad8bd14cea3a7a05de464964e/packages/reformer/src/hooks/useFormControl.ts#L23)

Хук для работы с FieldNode - возвращает сигналы напрямую

Оптимальный способ использования: сигналы можно использовать напрямую в JSX,
они автоматически обновляют компонент при изменении.

## Type Parameters

### T

`T` *extends* [`FormValue`](../type-aliases/FormValue.md)

## Parameters

### control

[`FieldNode`](../classes/FieldNode.md)\<`T`\>

## Returns

`object`

### dirty

```ts
dirty: ReadonlySignal<boolean> = control.dirty;
```

### disabled

```ts
disabled: ReadonlySignal<boolean> = control.disabled;
```

### errors

```ts
errors: ReadonlySignal<ValidationError[]> = control.errors;
```

### invalid

```ts
invalid: ReadonlySignal<boolean> = control.invalid;
```

### pending

```ts
pending: ReadonlySignal<boolean> = control.pending;
```

### shouldShowError

```ts
shouldShowError: ReadonlySignal<boolean> = control.shouldShowError;
```

### touched

```ts
touched: ReadonlySignal<boolean> = control.touched;
```

### valid

```ts
valid: ReadonlySignal<boolean> = control.valid;
```

### value

```ts
value: ReadonlySignal<T> = control.value;
```

## Example

```tsx
const { value, errors } = useFormControl(control);

return (
  <div>
    <input value={value.value} onChange={e => control.setValue(e.target.value)} />
    {errors.value.length > 0 && <span>{errors.value[0].message}</span>}
  </div>
);
```
