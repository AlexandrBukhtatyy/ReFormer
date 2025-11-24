# getCurrentValidationRegistry()

```ts
function getCurrentValidationRegistry(): ValidationRegistry;
```

Defined in: [core/utils/registry-helpers.ts:31](https://github.com/AlexandrBukhtatyy/ReFormer/blob/5ceaa6f29bbeaf24a4aaf6730d727f1d0b368936/packages/reformer/src/core/utils/registry-helpers.ts#L31)

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
