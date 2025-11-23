# FormContext

Defined in: [core/types/form-context.ts:35](https://github.com/AlexandrBukhtatyy/ReFormer/blob/a90f09dd6532f27be3e08d4c85d7d4a30f44c424/packages/reformer/src/core/types/form-context.ts#L35)

Единый контекст для работы с формой

Предоставляет:
- `form` - типизированный Proxy-доступ к полям формы
- `setFieldValue` - безопасная установка значения (emitEvent: false)

## Type Parameters

### TForm

`TForm`

## Properties

### form

```ts
readonly form: any;
```

Defined in: [core/types/form-context.ts:66](https://github.com/AlexandrBukhtatyy/ReFormer/blob/a90f09dd6532f27be3e08d4c85d7d4a30f44c424/packages/reformer/src/core/types/form-context.ts#L66)

Форма с типизированным Proxy-доступом к полям

Позволяет обращаться к полям напрямую через точечную нотацию:
- `ctx.form.email` → FieldNode
- `ctx.form.address.city` → FieldNode (вложенный)
- `ctx.form.items` → ArrayNode

#### Example

```typescript
// Получить значение
ctx.form.email.value.value

// Установить значение (⚠️ может вызвать цикл в behavior!)
ctx.form.email.setValue('new@mail.com')

// Безопасно установить значение
ctx.form.email.setValue('new@mail.com', { emitEvent: false })

// Обновить пропсы компонента
ctx.form.city.updateComponentProps({ options: cities })

// Валидация поля
await ctx.form.email.validate()

// Работа с массивами
ctx.form.items.push({ title: 'New' })
ctx.form.items.clear()
```

## Methods

### setFieldValue()

```ts
setFieldValue(path, value): void;
```

Defined in: [core/types/form-context.ts:85](https://github.com/AlexandrBukhtatyy/ReFormer/blob/a90f09dd6532f27be3e08d4c85d7d4a30f44c424/packages/reformer/src/core/types/form-context.ts#L85)

Безопасно установить значение поля по строковому пути

Автоматически использует `emitEvent: false` для предотвращения
бесконечных циклов в behavior схемах.

#### Parameters

##### path

`string`

Путь к полю (например, "address.city", "items[0].name")

##### value

`unknown`

Новое значение

#### Returns

`void`

#### Example

```typescript
// Сброс города при смене страны
watchField(path.country, (country, ctx) => {
  ctx.setFieldValue('city', null);
});
```
