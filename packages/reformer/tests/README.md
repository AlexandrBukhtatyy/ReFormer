# ReFormer Tests

Все тесты пакета `@reformer/core`.

> ⚠️ **Структура тестов НЕ зеркалит `src/`.** Каталог `tests/core/**` остался от раскладки
> `src/core/**`, снесённой при разделении на слои (`src/model/` + `src/form/`, июль 2026).
> Переструктурирование вынесено в отдельную задачу; ниже — фактическое соответствие.

## Directory Structure

```
tests/
├── behaviors/              # DSL поведения          → src/form/behaviors/
├── core/
│   ├── factories/          # NodeFactory            → src/form/factories/
│   ├── model/              # модель данных          → src/model/
│   ├── nodes/              # узлы формы             → src/form/nodes/
│   ├── types/              # типы                   → src/form/types/
│   ├── utils/              # СМЕШАННЫЙ каталог: derived-registry / safe-effect → src/model/,
│   │                       #   create-* / type-guards / subscription-manager  → src/form/
│   └── validation/         # раннер и правила       → src/form/validation/, src/form/validators/
├── hooks/                  # React-хуки             → src/platforms/react/hooks/
├── model/                  # сабпат @reformer/core/model (гарантия единого рантайма)
└── test-utils/             # общие типы для тестов
```

## Принципы

1. **Один исходник — один тестовый файл.** Крупные модули дробятся по темам:
   `field-node-cleanup.test.ts`, `field-node-error-handling.test.ts`, …
2. **Импорт по относительному пути** к `src/`. ⚠️ `tsc` каталог `tests/` НЕ проверяет
   (`tsconfig.json` → `include: ["src"]`), поэтому битый путь всплывёт только на прогоне тестов —
   после любого переноса файлов в `src/` гоняйте `npm test`, а не только `npm run typecheck`.
3. **Общие типы — в `test-utils/`**, импорт явным путём:
   `import { ComponentInstance } from '../../test-utils/types'`

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run specific test file
npm test -- field-node.test.ts

# Run tests with coverage
npm test -- --coverage
```

## Test Statistics

- **Total Test Files**: 58
- **Total Tests**: 808

## Writing New Tests

When adding a new source file:

1. Положите тест в каталог, соответствующий слою исходника — см. таблицу соответствия выше
   (относительный путь НЕ совпадает с `src/`, пока переструктурирование не выполнено)
2. Use the test types from `test-utils/` where applicable
3. Follow the existing test patterns and structure
4. Ensure all tests pass before committing

## Test File Template

```typescript
/**
 * Unit tests for [ModuleName]
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { [Module] } from '../../../src/[path]/[module]';

describe('[ModuleName]', () => {
  beforeEach(() => {
    // Setup test environment
  });

  describe('Feature name', () => {
    it('should do something', () => {
      // Test implementation
      expect(true).toBe(true);
    });
  });
});
```

## CI/CD

Tests are automatically run on:

- Pull requests
- Commits to main branch
- Pre-commit hooks (if configured)

All tests must pass before merging.
