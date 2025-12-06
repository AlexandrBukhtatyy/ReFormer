# Issues Log - Credit Application Form

Этот файл содержит проблемы, обнаруженные при реализации формы заявки на кредит с использованием @reformer/core и reformer-mcp. Проблемы отмечаются для последующего улучшения библиотеки или LLMs.txt.

## Шаблон

### Issue #X: [Название]
- **Дата**: YYYY-MM-DD
- **Категория**: [Bug | Enhancement | Documentation | DX]
- **Компонент**: [@reformer/core | reformer-mcp | UI Components]
- **Серьёзность**: [Critical | Major | Minor]
- **Статус**: [Open | Resolved | Workaround Applied]

**Описание:**
[Подробное описание проблемы]

**Ожидаемое поведение:**
[Что должно происходить]

**Фактическое поведение:**
[Что происходит на самом деле]

**Workaround (если есть):**
[Шаги обхода проблемы]

**Предложение по исправлению:**
[Возможное решение]

---

## Активные проблемы

### Issue #4: Вложенные вычисляемые поля через computeFrom
- **Дата**: 2024-XX-XX
- **Категория**: DX
- **Компонент**: @reformer/core
- **Серьёзность**: Minor
- **Статус**: Workaround Applied

**Описание:**
computeFrom не работает для вычислений из вложенных полей в корневые (например, `personalData.lastName` -> `fullName`). Приходится использовать множество watchField.

**Ожидаемое поведение:**
computeFrom должен работать для любых уровней вложенности.

**Workaround:**
Использую несколько watchField для каждого исходного поля.

**Предложение по исправлению:**
Либо расширить computeFrom, либо добавить специальный синтаксис для cross-level вычислений.

---

## Решённые проблемы

### Issue #5: Функция `when` не существует - нужна `applyWhen`
- **Дата**: 2024-12-06
- **Категория**: Documentation
- **Компонент**: @reformer/core LLMs.txt
- **Серьёзность**: Critical
- **Статус**: ✅ Resolved (заменено when → applyWhen в llms.txt)

**Решение:** Обновлён llms.txt - заменено `when` на `applyWhen` с правильной сигнатурой.

---

### Issue #1: Схема массивов - формат не соответствует LLMs.txt
- **Дата**: 2024-12-06
- **Категория**: Documentation
- **Компонент**: @reformer/core LLMs.txt
- **Серьёзность**: Major
- **Статус**: ✅ Resolved

**Решение:** Добавлена секция "9. ARRAY SCHEMA FORMAT" в llms.txt с правильным tuple форматом.

---

### Issue #3: Нет информации о createForm API
- **Дата**: 2024-12-06
- **Категория**: Documentation
- **Компонент**: @reformer/core LLMs.txt
- **Серьёзность**: Major
- **Статус**: ✅ Resolved

**Решение:** Добавлена секция "8. CREATEFORM API" в llms.txt с полным описанием API.

---

### Issue #2: Неясна типизация для watchField callback context
- **Дата**: 2024-12-06
- **Категория**: Documentation
- **Компонент**: @reformer/core LLMs.txt
- **Серьёзность**: Minor
- **Статус**: ✅ Resolved

**Решение:** Добавлен интерфейс `BehaviorContext` в секцию Behaviors в llms.txt.

---

### Issue #6: Типы для validateTree callback
- **Дата**: 2024-12-06
- **Категория**: DX
- **Компонент**: @reformer/core
- **Серьёзность**: Minor
- **Статус**: ✅ Resolved

**Решение:** Добавлен JSDoc с `@remarks` секцией и примером явной типизации в validate-tree.ts.

---

### Issue #7: Неоднозначная структура каталогов для array items
- **Дата**: 2024-12-06
- **Категория**: Documentation
- **Компонент**: reformer-mcp / LLMs.txt
- **Серьёзность**: Minor
- **Статус**: ✅ Resolved

**Решение:** Документировано в llms.txt раздел "COMMON PATTERNS" - использовать watchField для cross-level вычислений.

---

## Заметки для улучшения reformer-mcp

### Выполненные улучшения (2024-12-06)

#### Новые паттерны в get-pattern.ts
- `async-watchfield` - правильная работа с async в watchField
- `array-cleanup` - очистка массива при изменении checkbox
- `dynamic-options` - загрузка options по зависимости
- `multi-step-validation` - STEP_VALIDATIONS map для step форм
- `nested-form-composition` - вложенные формы без apply()
- `project-structure` - рекомендуемая структура файлов (colocation)

#### Новые промпты
- `generate-step-form` - генерация multi-step wizard форм
- `generate-array-form` - генерация форм с динамическими массивами

#### Расширение explain-error.ts
- Добавлены паттерны: Cycle detected, Maximum call stack, immediate false, undefined assignable, async error silent, debounce, queueMicrotask

#### Расширение get-function-signature.ts
- Array методы: `clear`, `push`, `removeAt`, `at`, `map`, `length`
- Field методы: `updateComponentProps`, `setValue`, `markAsTouched`, `reset`
- Form методы: `validate`, `toJSON`
- Hooks: `useFormControl`, `useStepForm`
- Validators: `applyWhen`

#### Расширение llms.txt
- Секция 10: ASYNC WATCHFIELD с полными safeguards
- Секция 11: ARRAY CLEANUP PATTERN
- Секция 12: MULTI-STEP FORM VALIDATION
- Секция 13: EXTENDED COMMON MISTAKES (behavior composition, infinite loop, validateTree typing)
- Секция 14: PROJECT STRUCTURE (COLOCATION) - рекомендуемая структура файлов

---

### Будущие улучшения

1. **Генерация схемы**: reformer-mcp мог бы автоматически генерировать схему формы из спецификации.

2. **Генерация валидации**: Автоматическая генерация валидаторов из описания полей в спецификации.
