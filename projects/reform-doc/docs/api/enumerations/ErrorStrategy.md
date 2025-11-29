# ErrorStrategy

Defined in: [core/utils/error-handler.ts:26](https://github.com/AlexandrBukhtatyy/ReFormer/blob/c914b0e8aa05b7fd141395bf4d8c4eec038cba53/packages/reformer/src/core/utils/error-handler.ts#L26)

Стратегия обработки ошибок

Определяет, что делать с ошибкой после логирования

## Enumeration Members

### CONVERT

```ts
CONVERT: "convert";
```

Defined in: [core/utils/error-handler.ts:43](https://github.com/AlexandrBukhtatyy/ReFormer/blob/c914b0e8aa05b7fd141395bf4d8c4eec038cba53/packages/reformer/src/core/utils/error-handler.ts#L43)

Конвертировать ошибку в ValidationError
Используется в async validators для отображения ошибки валидации пользователю

***

### LOG

```ts
LOG: "log";
```

Defined in: [core/utils/error-handler.ts:37](https://github.com/AlexandrBukhtatyy/ReFormer/blob/c914b0e8aa05b7fd141395bf4d8c4eec038cba53/packages/reformer/src/core/utils/error-handler.ts#L37)

Залогировать и проглотить ошибку (продолжить выполнение)
Используется когда ошибка не критична

***

### THROW

```ts
THROW: "throw";
```

Defined in: [core/utils/error-handler.ts:31](https://github.com/AlexandrBukhtatyy/ReFormer/blob/c914b0e8aa05b7fd141395bf4d8c4eec038cba53/packages/reformer/src/core/utils/error-handler.ts#L31)

Пробросить ошибку дальше (throw)
Используется когда ошибка критична и должна остановить выполнение
