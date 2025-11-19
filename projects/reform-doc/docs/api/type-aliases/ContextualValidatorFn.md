# Type Alias: ContextualValidatorFn()\<TForm, TField\>

> **ContextualValidatorFn**\<`TForm`, `TField`\> = (`ctx`) => [`ValidationError`](../interfaces/ValidationError.md) \| `null`

Defined in: [core/types/validation-schema.ts:97](https://github.com/AlexandrBukhtatyy/ReFormer/blob/0a4bb3eb91c092897c9afb429f71c64b1be9df7b/packages/reformer/src/core/types/validation-schema.ts#L97)

Функция валидации поля с контекстом

## Type Parameters

### TForm

`TForm`

### TField

`TField`

## Parameters

### ctx

[`ValidationContext`](../interfaces/ValidationContext.md)\<`TForm`, `TField`\>

## Returns

[`ValidationError`](../interfaces/ValidationError.md) \| `null`
