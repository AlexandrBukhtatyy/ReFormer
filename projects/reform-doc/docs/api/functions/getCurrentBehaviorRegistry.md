# Function: getCurrentBehaviorRegistry()

> **getCurrentBehaviorRegistry**(): `BehaviorRegistry`

Defined in: [core/utils/registry-helpers.ts:75](https://github.com/AlexandrBukhtatyy/ReFormer/blob/0a4bb3eb91c092897c9afb429f71c64b1be9df7b/packages/reformer/src/core/utils/registry-helpers.ts#L75)

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
