# Type Alias: ContextualAsyncValidatorFn()\<TForm, TField\>

> **ContextualAsyncValidatorFn**\<`TForm`, `TField`\> = (`ctx`) => `Promise`\<[`ValidationError`](../interfaces/ValidationError.md) \| `null`\>

Defined in: [core/types/validation-schema.ts:104](https://github.com/AlexandrBukhtatyy/ReFormer/blob/0a4bb3eb91c092897c9afb429f71c64b1be9df7b/packages/reformer/src/core/types/validation-schema.ts#L104)

Асинхронная функция валидации поля с контекстом

## Type Parameters

### TForm

`TForm`

### TField

`TField`

## Parameters

### ctx

[`ValidationContext`](../interfaces/ValidationContext.md)\<`TForm`, `TField`\>

## Returns

`Promise`\<[`ValidationError`](../interfaces/ValidationError.md) \| `null`\>
