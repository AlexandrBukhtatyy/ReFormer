# Test Utilities

Общие типы и хелперы для тестов пакета `@reformer/core`.

## Contents

- `types.ts` — `ComponentInstance`: тип-заглушка для поля `component` в тестовых схемах
  (в core компонент не интерпретируется, поэтому конкретный React-тип не нужен).
- `form-from-fields.ts` — сборка формы из компактного описания «значение и компонент рядом»:
  `formFromFields` (форма), `arrayFromFields` (массив под-форм), `fieldOf` (одна нода поля).
  Внутри — обычные `createModel` и `createFormFromModel`. Описание читается по форме записи: поле,
  чьё значение само объект вида `{ value }`, помощник примет за группу — такую форму собирайте
  напрямую из модели.

## Usage

```typescript
import { ComponentInstance } from '../../test-utils/types';
import { formFromFields } from '../../test-utils/form-from-fields';

const form = formFromFields<{ email: string; address: { city: string } }>({
  email: { value: '', component: null as ComponentInstance },
  address: { city: { value: '' } },
});
```

## Adding New Utilities

Если один и тот же код повторяется в нескольких тестовых файлах — выносите его сюда
отдельным модулем и импортируйте по явному пути (`test-utils/<module>`), без barrel-файла:
barrel быстро обрастает никем не используемыми экспортами.
