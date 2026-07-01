## 10. ASYNC REACTION — onChange (CRITICALLY IMPORTANT)

Для async-реакции на изменение поля (загрузка зависимых опций, справочников) используй
`onChange` из `@reformer/core/behaviors`. Колбэк выполняется ВНЕ effect-контекста (можно
безопасно писать сигналы/ноды), а 2-й аргумент — `{ signal }` (AbortSignal): при следующей
смене значения предыдущий вызов аннулируется — передавай `signal` в `fetch`.

```typescript
import { defineFormBehavior, onChange } from '@reformer/core/behaviors';

const behavior = defineFormBehavior<MyForm>(({ model, form }) => {
  // CORRECT — async onChange со всеми safeguards
  onChange(
    model.$.parentField,
    async (value, { signal }) => {
      if (!value) {
        form.dependentField.updateComponentProps({ options: [] });
        return;
      }
      try {
        const data = await fetchData(value, { signal }); // отмена устаревших запросов
        form.dependentField.updateComponentProps({ options: data });
      } catch (error) {
        if ((error as Error).name === 'AbortError') return;
        form.dependentField.updateComponentProps({ options: [] });
      }
    },
    { debounce: 300 } // не fetch на каждое нажатие
  );
});
```

### Опции onChange

- `debounce: 300` — не дёргать сеть на каждый keystroke (300–500 мс рекомендуется).
- `immediate: true` — вызвать колбэк сразу при регистрации (по умолчанию `false`).
- Guard-clause — пропустить пустое значение.
- try/catch + проверка `AbortError` — обработка отмены и ошибок.

### Низкоуровневый примитив watchField

`watchField` из `@reformer/core` — базовая подписка на изменение сигнала (без debounce и
AbortSignal). `onChange` построен поверх него. Для простых синхронных реакций:

```typescript
import { watchField } from '@reformer/core';

// вызывается при каждом изменении (по умолчанию НЕ на инициализации)
const stop = watchField(model.$.country, (country) => {
  model.city = ''; // сброс зависимого поля
});
// stop() — отписаться
```
