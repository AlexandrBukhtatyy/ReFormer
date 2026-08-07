# Test Utilities

Общие типы и хелперы для тестов пакета `@reformer/core`.

## Contents

- `types.ts` — `ComponentInstance`: тип-заглушка для поля `component` в тестовых схемах
  (в core компонент не интерпретируется, поэтому конкретный React-тип не нужен).

## Usage

```typescript
import { ComponentInstance } from '../../test-utils/types';
```

## Adding New Utilities

Если один и тот же код повторяется в нескольких тестовых файлах — выносите его сюда
отдельным модулем и импортируйте по явному пути (`test-utils/<module>`), без barrel-файла:
barrel быстро обрастает никем не используемыми экспортами.
