# createForm()

Реализация фабричной функции

## Call Signature

```ts
function createForm<T>(config): any;
```

Defined in: [core/utils/create-form.ts:45](https://github.com/AlexandrBukhtatyy/ReFormer/blob/dcfbc8e01cad51c12ece27c493ae5214ef7de021/packages/reformer/src/core/utils/create-form.ts#L45)

Создать форму с полной конфигурацией (form, behavior, validation)

### Type Parameters

#### T

`T`

### Parameters

#### config

[`GroupNodeConfig`](../interfaces/GroupNodeConfig.md)\<`T`\>

Конфигурация формы с полями, поведением и валидацией

### Returns

`any`

Типизированная форма с Proxy-доступом к полям

### Example

```typescript
const form = createForm<UserForm>({
  form: {
    email: { value: '', component: Input },
    password: { value: '', component: Input },
  },
  validation: (path) => {
    required(path.email);
    email(path.email);
    required(path.password);
    minLength(path.password, 8);
  },
});

// TypeScript знает о полях:
form.email.setValue('test@mail.com');
```

## Call Signature

```ts
function createForm<T>(schema): any;
```

Defined in: [core/utils/create-form.ts:61](https://github.com/AlexandrBukhtatyy/ReFormer/blob/dcfbc8e01cad51c12ece27c493ae5214ef7de021/packages/reformer/src/core/utils/create-form.ts#L61)

Создать форму только со схемой полей (обратная совместимость)

### Type Parameters

#### T

`T`

### Parameters

#### schema

[`FormSchema`](../type-aliases/FormSchema.md)\<`T`\>

Схема полей формы

### Returns

`any`

Типизированная форма с Proxy-доступом к полям

### Example

```typescript
const form = createForm<UserForm>({
  email: { value: '', component: Input },
  password: { value: '', component: Input },
});
```
