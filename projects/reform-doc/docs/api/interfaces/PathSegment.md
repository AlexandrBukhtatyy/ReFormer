# Interface: PathSegment

Defined in: [core/utils/field-path-navigator.ts:19](https://github.com/AlexandrBukhtatyy/ReFormer/blob/0a4bb3eb91c092897c9afb429f71c64b1be9df7b/packages/reformer/src/core/utils/field-path-navigator.ts#L19)

Сегмент пути к полю формы

Представляет один сегмент в пути к полю, например:

- `"email" → { key: 'email' }`
- `"items[0]" → { key: 'items', index: 0 }`

## Example

```typescript
// Путь "items[0].name" разбивается на:
[{ key: 'items', index: 0 }, { key: 'name' }];
```

## Properties

### index?

> `optional` **index**: `number`

Defined in: [core/utils/field-path-navigator.ts:29](https://github.com/AlexandrBukhtatyy/ReFormer/blob/0a4bb3eb91c092897c9afb429f71c64b1be9df7b/packages/reformer/src/core/utils/field-path-navigator.ts#L29)

Индекс в массиве (опционально)
Присутствует только для сегментов вида "items[0]"

---

### key

> **key**: `string`

Defined in: [core/utils/field-path-navigator.ts:23](https://github.com/AlexandrBukhtatyy/ReFormer/blob/0a4bb3eb91c092897c9afb429f71c64b1be9df7b/packages/reformer/src/core/utils/field-path-navigator.ts#L23)

Ключ поля
