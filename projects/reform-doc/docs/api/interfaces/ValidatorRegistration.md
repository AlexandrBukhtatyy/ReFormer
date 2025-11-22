# Interface: ValidatorRegistration

Defined in: [core/types/validation-schema.ts:167](https://github.com/AlexandrBukhtatyy/ReFormer/blob/0a4bb3eb91c092897c9afb429f71c64b1be9df7b/packages/reformer/src/core/types/validation-schema.ts#L167)

**`Internal`**

Регистрация валидатора в системе

## Properties

### condition?

> `optional` **condition**: `object`

Defined in: [core/types/validation-schema.ts:175](https://github.com/AlexandrBukhtatyy/ReFormer/blob/0a4bb3eb91c092897c9afb429f71c64b1be9df7b/packages/reformer/src/core/types/validation-schema.ts#L175)

#### conditionFn

> **conditionFn**: [`ConditionFn`](../type-aliases/ConditionFn.md)\<`unknown`\>

#### fieldPath

> **fieldPath**: `string`

---

### fieldPath

> **fieldPath**: `string`

Defined in: [core/types/validation-schema.ts:168](https://github.com/AlexandrBukhtatyy/ReFormer/blob/0a4bb3eb91c092897c9afb429f71c64b1be9df7b/packages/reformer/src/core/types/validation-schema.ts#L168)

---

### options?

> `optional` **options**: [`ValidateOptions`](ValidateOptions.md) \| [`ValidateAsyncOptions`](ValidateAsyncOptions.md) \| [`ValidateTreeOptions`](ValidateTreeOptions.md)

Defined in: [core/types/validation-schema.ts:174](https://github.com/AlexandrBukhtatyy/ReFormer/blob/0a4bb3eb91c092897c9afb429f71c64b1be9df7b/packages/reformer/src/core/types/validation-schema.ts#L174)

---

### type

> **type**: `"async"` \| `"sync"` \| `"tree"`

Defined in: [core/types/validation-schema.ts:169](https://github.com/AlexandrBukhtatyy/ReFormer/blob/0a4bb3eb91c092897c9afb429f71c64b1be9df7b/packages/reformer/src/core/types/validation-schema.ts#L169)

---

### validator

> **validator**: [`ContextualValidatorFn`](../type-aliases/ContextualValidatorFn.md)\<`unknown`, `unknown`\> \| [`ContextualAsyncValidatorFn`](../type-aliases/ContextualAsyncValidatorFn.md)\<`unknown`, `unknown`\> \| [`TreeValidatorFn`](../type-aliases/TreeValidatorFn.md)\<`unknown`\>

Defined in: [core/types/validation-schema.ts:170](https://github.com/AlexandrBukhtatyy/ReFormer/blob/0a4bb3eb91c092897c9afb429f71c64b1be9df7b/packages/reformer/src/core/types/validation-schema.ts#L170)
