# getCurrentValidationRegistry()

```ts
function getCurrentValidationRegistry(): ValidationRegistry;
```

Defined in: [core/utils/registry-helpers.ts:31](https://github.com/AlexandrBukhtatyy/ReFormer/blob/67c6c21902e727e89d7f622f6fc0ba56c693c0cc/packages/reformer/src/core/utils/registry-helpers.ts#L31)

**`Internal`**

Получить текущий активный ValidationRegistry из context stack

Используется внутри validation schema функций (validate, validateAsync, required и т.д.)
для регистрации валидаторов в активном контексте GroupNode

## Returns

`ValidationRegistry`

Текущий ValidationRegistry или заглушка в production

## Throws

Error если нет активного контекста (только в DEV режиме)

## Example

```typescript
function required(fieldPath, options) {
  const registry = getCurrentValidationRegistry();
  registry.registerSync(path, validator, options);
}
```
