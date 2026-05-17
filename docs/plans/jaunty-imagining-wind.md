# Презентационный пример «схема валидации» для ReFormer

## Context

Пользователь готовит презентацию о ReFormer и хочет один лаконичный, но исчерпывающий пример, показывающий ВСЁ о схеме валидации: встроенные валидаторы, композиция, кастомный sync, async + debounce, cross-field, условная валидация, переиспользуемые под-схемы и валидация массивов.

В кодовой базе уже есть три источника, на которых можно опереться:
- [registration-validation.ts](../../projects/react-playground/src/pages/examples/registration-form/validation/registration-validation.ts) — реальный пример sync + async + cross-field.
- [basic-info-validation.ts](../../projects/react-playground/src/pages/examples/complex-multy-step-form/components/steps/BasicInfo/basic-info-validation.ts) — applyWhen + validateGroup + переиспользуемые под-схемы.
- [ValidationExamples.tsx](../../projects/react-playground/src/pages/examples/validation/ValidationExamples.tsx) — галерея built-in валидаторов.

Никакого presentation-каталога ещё нет — создаём с нуля. Файл должен быть самодостаточным, корректно типизированным относительно публичного API `@reformer/core` и `@reformer/core/validators`, и пригодным для копирования прямо в слайд.

## Решения по объёму и формату

Зафиксировано из уточняющих вопросов:
- **Формат**: только validation-schema (без JSX, без отображения ошибок).
- **Домен**: регистрация пользователя — узнаваемая и компактная.
- **Целевой файл**: `docs/presentation/validation-example.ts` (новый каталог).
- **Объём**: ~70–90 строк (включая 1–2 коротких комментария-разделителя, чтобы аудитория могла сходу разобрать структуру).

## Что должно быть покрыто

Один файл, одна форма, восемь механизмов:

| # | Механизм | Как показать |
|---|---|---|
| 1 | Композиция built-in валидаторов на одном поле | `validate(path.password, required(...))` + `minLength` + `pattern` |
| 2 | Конфигурация сообщений | `required({ message: '...' })` |
| 3 | Кастомный sync-валидатор | `validatePasswordStrength: Validator<...>` |
| 4 | Cross-field валидатор (через `root`) | `validatePasswordsMatch` — читает `root.password.value.value` |
| 5 | Async + debounce | `validateAsync(path.username, checkUsernameAvailable, { debounce: 500 })` |
| 6 | Условная валидация (`applyWhen`) | `applyWhen(path.accountType, v => v === 'business', businessRules)` |
| 7 | Переиспользуемая под-схема (`apply`) | `apply(path.business, businessProfileValidation)` |
| 8 | Валидация элементов массива (`validateItems`) | `validateItems(path.phones, phoneItemValidation)` |

Cross-field через `validateGroup` сознательно опускаем — его роль уже играет `validatePasswordsMatch` (механизм 4) на root. Включение и validateGroup, и `root`-валидатора одновременно раздуло бы пример и заставило объяснять две альтернативы для одной задачи. Оставлю однострочный комментарий, что `validateGroup` — альтернатива для сценариев, где нужен общий scope.

## Доменная модель

```ts
interface RegistrationData {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
  accountType: 'personal' | 'business';
  business: { companyName: string; taxId: string };
  phones: string[];
}
```

Эта модель естественно требует все восемь механизмов: пароль с правилами и подтверждением, уникальность username через API, опциональный бизнес-блок, опциональный массив телефонов.

## План реализации

1. Создать каталог `docs/presentation/` (если не существует).
2. Записать файл `docs/presentation/validation-example.ts` со следующей структурой (порядок важен — он же будет порядком слайдов):
   - Импорты из `@reformer/core` и `@reformer/core/validators`.
   - Тип `RegistrationData`.
   - Три кастомных валидатора подряд: `checkUsernameAvailable` (async), `validatePasswordStrength` (sync), `validatePasswordsMatch` (cross-field через `root`).
   - Под-схема `businessProfileValidation: ValidationSchemaFn<RegistrationData['business']>`.
   - Под-схема `phoneItemValidation` для `validateItems`.
   - Главная экспортируемая `registrationValidation: ValidationSchemaFn<RegistrationData>` — компонует всё через `validate`, `validateAsync`, `applyWhen`, `apply`, `validateItems`.

Размер целевого файла — ~80 строк. Никаких лишних docstring-блоков; короткие однострочные комментарии-маркеры там, где это помогает аудитории на слайде (например, `// async + debounce`, `// условный блок`).

## Итерация 2 — починить `FieldPath<T>` для примитивных T в `@reformer/core`

### Проблема

Пользователь хочет, чтобы синтаксис `apply(path.username, userNameValidation)` работал и был типобезопасен, где `userNameValidation: ValidationSchemaFn<string>`. Сейчас это не компилируется: внутри схемы `path` приходит как `FieldPath<string>`, а тип `FieldPath<T>` определён как mapped type `{ [K in keyof T]: ... }` — для `T = string` это даёт `keyof string`-проекцию (методы строкового прототипа), и TypeScript свёртывает результат до бессмысленного значения, из-за чего `validate(path, required())` падает с `Argument of type 'string' is not assignable to parameter of type 'FieldPathNode<unknown, unknown, unknown>'`.

Откатываться к функции-хелперу пользователь отказался: задача — починить реализацию, чтобы `apply` стал универсальным оператором как для объектных, так и для примитивных полей. Runtime уже корректен: `toFieldPath()` (`packages/reformer/src/core/utils/field-path.ts:162`) создаёт Proxy с `__key`/`__path` для любого узла, включая примитивный.

### Решение

Изменить определение типа `FieldPath<T>` в [packages/reformer/src/core/types/field-path.ts](../../packages/reformer/src/core/types/field-path.ts) (строки 31–39): добавить ветку для случая, когда `T` не объект (или относится к опаковым объектным типам, которые уже сейчас не рекурсятся — Array/Date/File/Blob/AnyFunction). В этой ветке возвращать сам узел `FieldPathNode<unknown, T>` вместо mapped type.

Концептуально:
```ts
export type FieldPath<T> =
  NonNullable<T> extends object
    ? NonNullable<T> extends Array<unknown> | Date | File | Blob | AnyFunction
      ? FieldPathNode<unknown, T>          // опаковые объекты — единый узел
      : {                                   // обычные объекты — рекурсивный mapped type как сейчас
          [K in keyof T]: NonNullable<T[K]> extends Array<unknown>
            ? FieldPathNode<T, T[K], K>
            : NonNullable<T[K]> extends Date | File | Blob | AnyFunction
              ? FieldPathNode<T, T[K], K>
              : NonNullable<T[K]> extends object
                ? FieldPathNode<T, T[K], K> & FieldPath<NonNullable<T[K]>>
                : FieldPathNode<T, T[K], K>;
        }
    : FieldPathNode<unknown, T>;           // примитивы — единый узел (NEW)
```

После правки:
- `FieldPath<RegistrationData>` сохраняет mapped-type поведение — изменений в существующих схемах нет.
- `FieldPath<string>` становится `FieldPathNode<unknown, string>`, и сигнатура `validate(path: FieldPathNode<TForm, TField>, ...)` принимает её.
- Overload `apply<TForm, TField>(field: FieldPathNode<TForm, TField>, schema: ValidationSchemaFn<TField>)` начинает работать для примитивного TField без явных приведений.

### Почему это безопасно

- В отчёте Explore явно сказано: `FieldPath<T>` нигде не итерируется в runtime коде — это исключительно типовый контракт. Никто не разворачивает его в for-of, поэтому правка только типа, без runtime-последствий.
- Текущее поведение `FieldPath<string>` уже бессмысленно (методы прототипа строки) — никто на это положиться не мог. Это не breaking change в практическом смысле.
- Объектные TField не затронуты: для них активна вторая ветка mapped type, идентичная текущей реализации.

### Точечные изменения

1. **`packages/reformer/src/core/types/field-path.ts`** — переписать `export type FieldPath<T>` согласно схеме выше. Это единственная содержательная правка.
2. **`docs/presentation/validation-example.ts`** — обновить пример (отменить «функция-хелпер»-обходник):
   - Вернуть `userNameValidation: ValidationSchemaFn<string>` (не функцию `applyUsernameRules`).
   - Внутри: `validate(path, required())`, `validate(path, minLength(3))`, `validate(path, pattern(...))`.
   - В главной схеме заменить `applyUsernameRules(path.username)` на `apply(path.username, userNameValidation)`.
   - Убрать импорт `FieldPathNode` (он больше не нужен в файле примера).
3. **Тесты** — добавить type-level smoke-тест в `tests/core/validation/core/apply.test.ts` (сейчас TODO skeleton). Минимальный сценарий: объявить форму с примитивным полем, схему `ValidationSchemaFn<string>`, вызвать `apply(path.field, schema)` — `// @ts-expect-error`-блок для негативной проверки опускаем, основная цель — позитивная: код компилируется. ~10 строк. Это фиксирует contract и защищает от будущих регрессий в типе `FieldPath`.

### Verification

- `tsc --noEmit` в пакете `packages/reformer/` — должна проходить без ошибок.
- `tsc --noEmit` (или эквивалент) в `projects/react-playground/` — критическая проверка: ни одна live-схема валидации не должна сломаться. Особое внимание:
  - `projects/react-playground/src/pages/examples/complex-multy-step-form/schemas/credit-application-validation.ts`
  - `projects/react-playground/src/pages/examples/complex-multy-step-form/components/steps/BasicInfo/basic-info-validation.ts`
  - `projects/react-playground/src/pages/examples/complex-multy-step-form/components/nested-forms/Address/address-validation.ts`
  - `projects/react-playground/src/pages/examples/complex-multy-step-form/components/nested-forms/Property/property-validation.ts`
  - `projects/react-playground/src/pages/examples/registration-form/validation/registration-validation.ts`
- IDE diagnostics на [docs/presentation/validation-example.ts](../presentation/validation-example.ts) — ноль ошибок после правки.
- Если есть suite unit-тестов пакета `reformer` (надо проверить наличие `npm test` / `vitest run`) — прогнать целиком, чтобы не было регрессий.

## Критические файлы

- **Создаётся**: `docs/presentation/validation-example.ts`
- **Использовать как образец стиля**: `projects/react-playground/src/pages/examples/registration-form/validation/registration-validation.ts` (live код, отлажен — сигнатуры импортов и кастомных валидаторов точные).
- **Использовать для applyWhen/apply паттернов**: `projects/react-playground/src/pages/examples/complex-multy-step-form/components/steps/BasicInfo/basic-info-validation.ts`.

## Verification

После записи файла:
1. Открыть `docs/presentation/validation-example.ts` в IDE — TS-сервер должен подсветить корректность типов (плагины `@reformer/core` уже доступны в репо).
2. Прогнать через `tsc --noEmit` в контексте `projects/react-playground/tsconfig.json` (временно скопировав или подключив файл) — опционально, как sanity check. Файл специально не подключается ни к какому исполняемому проекту, чтобы остаться чисто презентационным артефактом.
3. Визуально проверить: укладывается ли в ~80 строк, читается ли сверху вниз без перескакивания, очевидно ли соответствие каждого блока пункту из таблицы выше.
