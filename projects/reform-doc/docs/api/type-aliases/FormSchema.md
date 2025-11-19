# Type Alias: FormSchema\<T\>

> **FormSchema**\<`T`\> = \{ \[K in keyof T\]: NonNullable\<T\[K\]\> extends (infer U)\[\] ? U extends FormFields ? \[FormSchema\<U\>\] : FieldConfig\<T\[K\]\> : NonNullable\<T\[K\]\> extends FormFields ? NonNullable\<T\[K\]\> extends Date \| File \| Blob ? FieldConfig\<T\[K\]\> : FormSchema\<NonNullable\<T\[K\]\>\> \| FieldConfig\<T\[K\]\> : FieldConfig\<T\[K\]\> \}

Defined in: [core/types/deep-schema.ts:87](https://github.com/AlexandrBukhtatyy/ReFormer/blob/0a4bb3eb91c092897c9afb429f71c64b1be9df7b/packages/reformer/src/core/types/deep-schema.ts#L87)

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
