# GroupNodeConfig

Defined in: [core/types/index.ts:122](https://github.com/AlexandrBukhtatyy/ReFormer/blob/a90f09dd6532f27be3e08d4c85d7d4a30f44c424/packages/reformer/src/core/types/index.ts#L122)

Конфигурация GroupNode с поддержкой схем
Используется для создания форм с автоматическим применением behavior и validation схем

## Type Parameters

### T

`T`

## Properties

### behavior?

```ts
optional behavior: BehaviorSchemaFn<T>;
```

Defined in: [core/types/index.ts:127](https://github.com/AlexandrBukhtatyy/ReFormer/blob/a90f09dd6532f27be3e08d4c85d7d4a30f44c424/packages/reformer/src/core/types/index.ts#L127)

Схема реактивного поведения (copyFrom, enableWhen, computeFrom и т.д.)

***

### form

```ts
form: FormSchema<T>;
```

Defined in: [core/types/index.ts:124](https://github.com/AlexandrBukhtatyy/ReFormer/blob/a90f09dd6532f27be3e08d4c85d7d4a30f44c424/packages/reformer/src/core/types/index.ts#L124)

Схема структуры формы (поля и их конфигурация)

***

### validation?

```ts
optional validation: ValidationSchemaFn<T>;
```

Defined in: [core/types/index.ts:130](https://github.com/AlexandrBukhtatyy/ReFormer/blob/a90f09dd6532f27be3e08d4c85d7d4a30f44c424/packages/reformer/src/core/types/index.ts#L130)

Схема валидации (required, email, minLength и т.д.)
