# getCurrentBehaviorRegistry()

```ts
function getCurrentBehaviorRegistry(): BehaviorRegistry;
```

Defined in: [core/utils/registry-helpers.ts:75](https://github.com/AlexandrBukhtatyy/ReFormer/blob/21a22c7cca8ff4c7a6412f104e9d66a1709f1bf6/packages/reformer/src/core/utils/registry-helpers.ts#L75)

**`Internal`**

Получить текущий активный BehaviorRegistry из context stack

Используется внутри behavior schema функций (copyFrom, enableWhen, computeFrom и т.д.)
для регистрации поведений в активном контексте GroupNode

## Returns

`BehaviorRegistry`

Текущий BehaviorRegistry или заглушка в production

## Throws

Error если нет активного контекста (только в DEV режиме)

## Example

```typescript
function copyFrom(target, source, options) {
  const registry = getCurrentBehaviorRegistry();
  const handler = createCopyBehavior(target, source, options);
  registry.register(handler, { debounce: options?.debounce });
}
```
