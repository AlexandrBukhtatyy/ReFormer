# GroupNodeConfig

Defined in: [core/types/index.ts:152](https://github.com/AlexandrBukhtatyy/ReFormer/blob/34c25f8a76648f468be9f6786e03e9ad735d7890/packages/reformer/src/core/types/index.ts#L152)

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

Defined in: [core/types/index.ts:157](https://github.com/AlexandrBukhtatyy/ReFormer/blob/34c25f8a76648f468be9f6786e03e9ad735d7890/packages/reformer/src/core/types/index.ts#L157)

Схема реактивного поведения (copyFrom, enableWhen, computeFrom и т.д.)

***

### form

```ts
form: FormSchema<T>;
```

Defined in: [core/types/index.ts:154](https://github.com/AlexandrBukhtatyy/ReFormer/blob/34c25f8a76648f468be9f6786e03e9ad735d7890/packages/reformer/src/core/types/index.ts#L154)

Схема структуры формы (поля и их конфигурация)

***

### validation?

```ts
optional validation: ValidationSchemaFn<T>;
```

Defined in: [core/types/index.ts:160](https://github.com/AlexandrBukhtatyy/ReFormer/blob/34c25f8a76648f468be9f6786e03e9ad735d7890/packages/reformer/src/core/types/index.ts#L160)

Схема валидации (required, email, minLength и т.д.)
