# ValidatorRegistration

Defined in: [core/types/validation-schema.ts:127](https://github.com/AlexandrBukhtatyy/ReFormer/blob/2f9343515d3674da9440637d3df644f3d1ac43db/packages/reformer/src/core/types/validation-schema.ts#L127)

**`Internal`**

Регистрация валидатора в системе

## Properties

### condition?

```ts
optional condition: object;
```

Defined in: [core/types/validation-schema.ts:135](https://github.com/AlexandrBukhtatyy/ReFormer/blob/2f9343515d3674da9440637d3df644f3d1ac43db/packages/reformer/src/core/types/validation-schema.ts#L135)

#### conditionFn

```ts
conditionFn: ConditionFn<unknown>;
```

#### fieldPath

```ts
fieldPath: string;
```

***

### fieldPath

```ts
fieldPath: string;
```

Defined in: [core/types/validation-schema.ts:128](https://github.com/AlexandrBukhtatyy/ReFormer/blob/2f9343515d3674da9440637d3df644f3d1ac43db/packages/reformer/src/core/types/validation-schema.ts#L128)

***

### options?

```ts
optional options: 
  | ValidateOptions
  | ValidateAsyncOptions
  | ValidateTreeOptions;
```

Defined in: [core/types/validation-schema.ts:134](https://github.com/AlexandrBukhtatyy/ReFormer/blob/2f9343515d3674da9440637d3df644f3d1ac43db/packages/reformer/src/core/types/validation-schema.ts#L134)

***

### type

```ts
type: "async" | "sync" | "tree";
```

Defined in: [core/types/validation-schema.ts:129](https://github.com/AlexandrBukhtatyy/ReFormer/blob/2f9343515d3674da9440637d3df644f3d1ac43db/packages/reformer/src/core/types/validation-schema.ts#L129)

***

### validator

```ts
validator: 
  | ContextualValidatorFn<unknown, unknown>
  | ContextualAsyncValidatorFn<unknown, unknown>
| TreeValidatorFn<unknown>;
```

Defined in: [core/types/validation-schema.ts:130](https://github.com/AlexandrBukhtatyy/ReFormer/blob/2f9343515d3674da9440637d3df644f3d1ac43db/packages/reformer/src/core/types/validation-schema.ts#L130)
