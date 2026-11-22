# Scripts

## analyze-imports.js

Скрипт для анализа импортов в TypeScript/TSX файлах проекта.

### Использование

```bash
# Вывод в консоль
npm run scripts:analize:imports -- <путь к директории>

# Запись в файл (UTF-8) - рекомендуемый способ для Windows
npm run scripts:analize:imports -- <путь к директории> --output имя_файла.md

# Примеры
npm run scripts:analize:imports -- projects/react-playground
npm run scripts:analize:imports -- packages/reformer
npm run scripts:analize:imports -- projects/react-playground/src/pages/demo/complex-multy-step-form --output imports.md
npm run scripts:analize:imports -- projects/react-playground/src -o analysis.md
```

**Важно:**

- Используйте `--` после команды npm для передачи аргументов скрипту
- Используйте флаг `--output` (или `-o`) для записи в файл - это гарантирует правильную UTF-8 кодировку на всех платформах, включая Windows

### Что делает скрипт

1. Рекурсивно находит все `.ts` и `.tsx` файлы в указанной директории
2. Извлекает все импорты из найденных файлов
3. Категоризирует импорты:
   - **External** - импорты из node_modules
   - **Internal** - относительные импорты (начинаются с `.` или `..`)
   - **Absolute** - абсолютные импорты проекта
4. Группирует импорты по модулям
5. Показывает для каждого импорта:
   - Количество использований
   - Файл и номер строки, где используется
6. **Анализирует импортируемые сущности** для внешних пакетов:
   - Список всех уникальных сущностей из каждого пакета
   - Типы импортов (default, named, namespace, side-effect)
   - Количество использований каждого пакета
7. Предоставляет статистику по типам импортов

### Пример вывода

```
📋 EXTERNAL PACKAGES DETAILS

  lucide-react
    Imports count: 3
    Unique entities: 7
    Import types: default: 0, named: 8, namespace: 0
    Entities: CheckIcon, ChevronDownIcon, ChevronUpIcon,
              EyeIcon, EyeOffIcon, SearchIcon, XIcon

  reformer
    Imports count: 5
    Unique entities: 8
    Import types: default: 0, named: 10, namespace: 0
    Entities: ArrayNode, FieldNode, FormFields, FormValue,
              GroupNodeWithControls, ResourceConfig,
              ResourceItem, ValidationSchemaFn
```

Эта информация помогает:

- Понять, какие именно сущности используются из каждой библиотеки
- Выявить лишние зависимости
- Оптимизировать импорты для уменьшения размера бандла

### Примечания

- Скрипт автоматически пропускает директории: `node_modules`, `dist`, `build` и скрытые папки (начинающиеся с `.`)
- Поддерживает все типы импортов:
  ```typescript
  import foo from 'module';
  import { foo, bar } from 'module';
  import * as foo from 'module';
  import 'module';
  import type { Foo } from 'module';
  ```
