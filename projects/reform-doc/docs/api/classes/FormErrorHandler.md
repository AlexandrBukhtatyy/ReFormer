# FormErrorHandler

Defined in: [core/utils/error-handler.ts:78](https://github.com/AlexandrBukhtatyy/ReFormer/blob/21a22c7cca8ff4c7a6412f104e9d66a1709f1bf6/packages/reformer/src/core/utils/error-handler.ts#L78)

Централизованный обработчик ошибок для форм

Обеспечивает:
- Единообразное логирование ошибок в DEV режиме
- Гибкие стратегии обработки (throw/log/convert)
- Типобезопасное извлечение сообщений из Error/string/unknown

## Example

```typescript
// В async validator (конвертировать в ValidationError)
try {
  await validateEmail(value);
} catch (error) {
  return FormErrorHandler.handle(error, 'EmailValidator', ErrorStrategy.CONVERT);
}

// В behavior applicator (пробросить критичную ошибку)
try {
  applyBehavior(schema);
} catch (error) {
  FormErrorHandler.handle(error, 'BehaviorApplicator', ErrorStrategy.THROW);
}

// В validator (залогировать и продолжить)
try {
  validator(value);
} catch (error) {
  FormErrorHandler.handle(error, 'Validator', ErrorStrategy.LOG);
}
```

## Constructors

### Constructor

```ts
new FormErrorHandler(): FormErrorHandler;
```

#### Returns

`FormErrorHandler`

## Methods

### createValidationError()

```ts
static createValidationError(
   code, 
   message, 
   field?): ValidationError;
```

Defined in: [core/utils/error-handler.ts:214](https://github.com/AlexandrBukhtatyy/ReFormer/blob/21a22c7cca8ff4c7a6412f104e9d66a1709f1bf6/packages/reformer/src/core/utils/error-handler.ts#L214)

Создать ValidationError с заданными параметрами

Утилитная функция для создания ValidationError объектов

#### Parameters

##### code

`string`

Код ошибки

##### message

`string`

Сообщение ошибки

##### field?

`string`

Поле (опционально)

#### Returns

[`ValidationError`](../interfaces/ValidationError.md)

ValidationError объект

#### Example

```typescript
const error = FormErrorHandler.createValidationError(
  'required',
  'This field is required',
  'email'
);
// { code: 'required', message: 'This field is required', field: 'email' }
```

***

### handle()

```ts
static handle(
   error, 
   context, 
   strategy): void | ValidationError;
```

Defined in: [core/utils/error-handler.ts:118](https://github.com/AlexandrBukhtatyy/ReFormer/blob/21a22c7cca8ff4c7a6412f104e9d66a1709f1bf6/packages/reformer/src/core/utils/error-handler.ts#L118)

Обработать ошибку согласно заданной стратегии

#### Parameters

##### error

`unknown`

Ошибка для обработки (Error | string | unknown)

##### context

`string`

Контекст ошибки для логирования (например, 'AsyncValidator', 'BehaviorRegistry')

##### strategy

[`ErrorStrategy`](../enumerations/ErrorStrategy.md) = `ErrorStrategy.THROW`

Стратегия обработки (THROW | LOG | CONVERT)

#### Returns

`void` \| [`ValidationError`](../interfaces/ValidationError.md)

ValidationError если strategy = CONVERT, undefined если strategy = LOG, никогда не возвращается если strategy = THROW

#### Example

```typescript
// THROW - пробросить ошибку
try {
  riskyOperation();
} catch (error) {
  FormErrorHandler.handle(error, 'RiskyOperation', ErrorStrategy.THROW);
  // Этот код никогда не выполнится
}

// LOG - залогировать и продолжить
try {
  nonCriticalOperation();
} catch (error) {
  FormErrorHandler.handle(error, 'NonCritical', ErrorStrategy.LOG);
  // Продолжаем выполнение
}

// CONVERT - конвертировать в ValidationError
try {
  await validator(value);
} catch (error) {
  const validationError = FormErrorHandler.handle(
    error,
    'AsyncValidator',
    ErrorStrategy.CONVERT
  );
  return validationError;
}
```

***

### isValidationError()

```ts
static isValidationError(value): value is ValidationError;
```

Defined in: [core/utils/error-handler.ts:237](https://github.com/AlexandrBukhtatyy/ReFormer/blob/21a22c7cca8ff4c7a6412f104e9d66a1709f1bf6/packages/reformer/src/core/utils/error-handler.ts#L237)

Проверить, является ли объект ValidationError

Type guard для ValidationError

#### Parameters

##### value

`unknown`

Значение для проверки

#### Returns

`value is ValidationError`

true если value является ValidationError

#### Example

```typescript
if (FormErrorHandler.isValidationError(result)) {
  console.log(result.code); // OK, типобезопасно
}
```
