# FormSchema

```ts
type FormSchema<T> = { [K in keyof T]: NonNullable<T[K]> extends string | number | boolean ? FieldConfig<T[K]> : NonNullable<T[K]> extends (infer U)[] ? U extends string | number | boolean ? FieldConfig<T[K]> : U extends Date | File | Blob | AnyFunction ? FieldConfig<T[K]> : [FormSchema<U>] : NonNullable<T[K]> extends Date | File | Blob | AnyFunction ? FieldConfig<T[K]> : FormSchema<NonNullable<T[K]>> };
```

Defined in: [core/types/deep-schema.ts:81](https://github.com/AlexandrBukhtatyy/ReFormer/blob/8ff0e4e0843184094d947de69314442db46de23d/packages/reformer/src/core/types/deep-schema.ts#L81)

Автоматически определяет тип схемы на основе TypeScript типа:
- `T[] -> [FormSchema<T>]` (массив с одним элементом)
- `object -> FormSchema<T>` (группа)
- `primitive -> FieldConfig<T>` (поле)

Использует NonNullable для корректной обработки опциональных полей

## Type Parameters

### T

`T`

## Example

```typescript
interface Form {
  name: string;                    // → FieldConfig<string>
  address: {                       // → FormSchema<Address>
    city: string;
    street: string;
  };
  items?: Array<{                  // → [FormSchema<Item>] (опциональный)
    title: string;
    price: number;
  }>;
}

const schema: FormSchema<Form> = {
  name: { value: '', component: Input },
  address: {
    city: { value: '', component: Input },
    street: { value: '', component: Input },
  },
  items: [{
    title: { value: '', component: Input },
    price: { value: 0, component: Input },
  }],
};
```
