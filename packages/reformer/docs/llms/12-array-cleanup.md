## 11. ARRAY CLEANUP PATTERN

Очистка массива при выключении флага — через `onChange` на сигнале флага + `clear()` на
модели-массиве. Колбит выполняется вне effect-контекста, поэтому мутировать массив безопасно.

```typescript
import { defineFormBehavior, onChange } from '@reformer/core/behaviors';

const behavior = defineFormBehavior<MyForm>(({ model }) => {
  // при снятии флага — очистить массив
  onChange(model.$.hasItems, (hasItems) => {
    if (!hasItems) model.items.clear();
  });
});
```

Переиспользуемый оператор (как в монорепо):

```typescript
import { onChange } from '@reformer/core/behaviors';
import type { ReadonlySignal } from '@reformer/core/behaviors';

function clearWhenOff(flag: ReadonlySignal<boolean>, array: { clear(): void }): void {
  onChange(flag, (on) => {
    if (!on) array.clear();
  });
}

// в схеме поведения:
clearWhenOff(model.$.hasProperty, model.properties);
```
