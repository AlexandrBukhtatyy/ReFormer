# Удаление `validateGroup` из API монорепы

## Context

В предыдущей research-фазе мы установили: при критерии «ошибки появляются на тех же полях» оператор `validateGroup` полностью эквивалентен `validate(path.<targetField>, (v, _ctrl, root) => …)` — root-`FormProxy` даёт доступ к остальным полям, scope не нужен (24/24 живых вызова используют root, не вложенное поддерево). `targetField` присутствует во всех 24 production-вызовах. Значит можно убрать API из публичного экспорта и runtime, переписав usages на `validate`, и тем самым сократить поверхность валидационного API.

**Что НЕ затрагиваем:** `.claude/worktrees/validator-redesign/` (рабочий worktree другой ветки), `docs/plans/*.md` (исторические артефакты). Тестов на сам `validateGroup` в `packages/reformer/tests/` нет — проверено грепом.

**Критерий завершения:** `grep -r "validateGroup" packages/ projects/ docs/ --exclude-dir=.claude --exclude-dir=plans` возвращает 0 совпадений; `tsc` и тесты зелёные; форма заявки на кредит в playground работает (cross-field ошибки появляются на тех же полях).

## Алгоритм миграции одного вызова

Каждый вызов в форме:
```ts
validateGroup(path, fn, { targetField: path.X });
// где fn: GroupValidator<TForm> = (scope) => { const f = scope.getValue(); … }
```
становится:
```ts
validate(path.X, fn);
// где fn: Validator<TForm, TFieldOfX> = (_value, _ctrl, root) => { const f = root.getValue(); … }
```

Утилитные cross-field функции (`validatePaymentToIncome`, `validateAge`, `initialPaymentVsPropertyValue` и т.д.) переписываем по той же схеме: тип `GroupValidator<TForm>` → `Validator<TForm, TField>`, `scope.getValue()` → `root.getValue()`, добавляем игнорируемые `_value, _ctrl` параметры.

## Порядок работы

Делаем в один проход (без промежуточных коммитов — `tsc` будет красным до конца). Порядок такой, чтобы не вводить ситуацию, когда тип `GroupValidator` уже удалён, но usages ещё на него ссылаются.

### Шаг 1 — мигрировать все usages в playground

Файлы (8 шт., 24 вызова `validateGroup`, все с `targetField`):

- [projects/react-playground/src/pages/examples/mcp-credit-application-core-clean/schema.ts](projects/react-playground/src/pages/examples/mcp-credit-application-core-clean/schema.ts) — 8 вызовов (строки 1399, 1518, 1638, 1641, 1644, 1647, 1658, 1675). Импорт `validateGroup` убрать.
- [projects/react-playground/src/pages/examples/complex-multy-step-form/schemas/credit-application-validation.ts](projects/react-playground/src/pages/examples/complex-multy-step-form/schemas/credit-application-validation.ts) — 5 вызовов (47, 50, 57, 60, 63).
- [projects/react-playground/src/pages/examples/complex-multy-step-form/components/steps/BasicInfo/basic-info-validation.ts](projects/react-playground/src/pages/examples/complex-multy-step-form/components/steps/BasicInfo/basic-info-validation.ts) — 2 вызова (63, 64) + 2 локальные `GroupValidator`-функции (18, 37) переписать в `Validator`.
- [projects/react-playground/src/pages/examples/complex-multy-step-form/components/steps/ContactInfo/contact-info-validation.ts](projects/react-playground/src/pages/examples/complex-multy-step-form/components/steps/ContactInfo/contact-info-validation.ts) — 2 вызова (85, 86) + локальные функции.
- [projects/react-playground/src/pages/examples/complex-multy-step-form/components/steps/Employment/employment-validation.ts](projects/react-playground/src/pages/examples/complex-multy-step-form/components/steps/Employment/employment-validation.ts) — 3 вызова (96, 136, 137).
- [projects/react-playground/src/pages/examples/complex-multy-step-form/components/nested-forms/PersonalData/personal-data-validation.ts](projects/react-playground/src/pages/examples/complex-multy-step-form/components/nested-forms/PersonalData/personal-data-validation.ts) — 1 вызов (138).
- [projects/react-playground/src/pages/examples/complex-multy-step-form/components/nested-forms/CoBorrower/co-borrower-validation.ts](projects/react-playground/src/pages/examples/complex-multy-step-form/components/nested-forms/CoBorrower/co-borrower-validation.ts) — 1 вызов (102).
- [projects/react-playground/src/pages/examples/complex-multy-step-form/components/nested-forms/ExistingLoan/existing-loan-validation.ts](projects/react-playground/src/pages/examples/complex-multy-step-form/components/nested-forms/ExistingLoan/existing-loan-validation.ts) — 2 вызова (76, 77).
- Утилитные файлы под `complex-multy-step-form/utils/` — найти `GroupValidator<…>` определения и переписать в `Validator<…>`.

После шага все импорты `validateGroup` из `@reformer/core/validators` и типа `GroupValidator` из `@reformer/core` удалены, заменены на `validate` и `Validator`.

### Шаг 2 — презентационные примеры

- [docs/presentation/validation-example.ts](docs/presentation/validation-example.ts) — `validateGroup` есть только в импорте, в коде не используется. Просто убрать из импорта.
- [docs/presentation/validation-example copy.ts](docs/presentation/validation-example%20copy.ts) — вызов на 106–111 **без `targetField`** (ошибка сейчас теряется). Переписать на `validate(path.confirmPassword, (v, _ctrl, root) => v === root.password.value.value ? { code: 'sameValues' } : null)`. Убрать импорт.

### Шаг 3 — удалить API из `@reformer/core`

Опираемся на карту, собранную Explore-агентом:

| Файл | Изменение |
|---|---|
| [packages/reformer/src/core/validation/core/validate-group.ts](packages/reformer/src/core/validation/core/validate-group.ts) | Удалить целиком |
| [packages/reformer/src/core/validation/core/index.ts](packages/reformer/src/core/validation/core/index.ts) | Удалить `export { validateGroup } from './validate-group'` (стр. 7) |
| [packages/reformer/src/core/validation/index.ts](packages/reformer/src/core/validation/index.ts) | Удалить `export { validateGroup } from './core/validate-group'` (стр. 8) |
| [packages/reformer/src/core/types/validation-schema.ts](packages/reformer/src/core/types/validation-schema.ts) | Удалить тип `GroupValidator` (77–80) и интерфейс `ValidateGroupOptions` (119–122). В `ValidatorRegistration` (str ~145, ~149) убрать ветвь `'group'` и `GroupValidator` из union. Обновить вступительный комментарий (стр. 5, 19, 54–75). |
| [packages/reformer/src/core/types/index.ts](packages/reformer/src/core/types/index.ts) | Удалить `GroupValidator,` и `ValidateGroupOptions,` из экспортов (стр. 144–145) |
| [packages/reformer/src/core/validation/validation-registry.ts](packages/reformer/src/core/validation/validation-registry.ts) | Удалить метод `registerGroup()` (~233–263). Удалить импорты `GroupValidator`, `ValidateGroupOptions` (стр. 16, 20). В `groupValidators`-методе (~336–347) убрать ветвь `registration.type === 'group'`. |
| [packages/reformer/src/core/validation/validation-applicator.ts](packages/reformer/src/core/validation/validation-applicator.ts) | Удалить метод `applyGroupValidators()` (~182–241). В `apply()` (~56–61) убрать деструктуризацию `groupValidators` и вызов applicator'а. В private `groupValidators()` (~63–85) убрать ветвь `'group'`, возвращать только `{ validatorsByField }`. Импорт `GroupValidator` (стр. 19) удалить. |
| [packages/reformer/src/core/types/form-context.ts](packages/reformer/src/core/types/form-context.ts) | В JSDoc на строке 6 убрать `{@link GroupValidator}` (заменить на просто `Validator`) |

### Шаг 4 — обновить документацию

**`packages/reformer/llms.txt`** — 13 упоминаний:
- Удалить JSDoc-секцию `validateGroup` (8775–8830) и сигнатуру (198).
- Убрать из таблицы импортов (52) и перечислений операторов (444, 553).
- Переписать примеры на строках 589, 1360, 1369, 1946, 1958, 6528, 6535 на `validate(path.X, (v,_,root) => …)`.

**`packages/reformer/docs/llms/*.md`** — 5 файлов:
- [01-api-reference.md:12](packages/reformer/docs/llms/01-api-reference.md) — убрать из таблицы импортов.
- [03-api-signatures.md](packages/reformer/docs/llms/03-api-signatures.md) — удалить сигнатуру (15), переписать пример (44–56).
- [04-common-patterns.md](packages/reformer/docs/llms/04-common-patterns.md) — убрать из перечисления (136), переписать пример (246–281) на `validate`.
- [14-extended-mistakes.md](packages/reformer/docs/llms/14-extended-mistakes.md) — раздел «validateGroup Typing» (92–117) переписать на демонстрацию `Validator<TForm, TField>`.
- [21-array-operations.md](packages/reformer/docs/llms/21-array-operations.md) — оба примера (71–98) переписать на `validate` с inline-логикой.

**`projects/reformer-doc/`** — переписать примеры (не удалять разделы):
- [docs/validation/overview.md](projects/reformer-doc/docs/validation/overview.md) — стр. 14, убрать из перечисления операторов.
- [docs/validation/custom.md](projects/reformer-doc/docs/validation/custom.md) — пример 228–239 на `validate(path.endDate, …)`.
- [docs/validation/validation-strategies.md](projects/reformer-doc/docs/validation/validation-strategies.md) — 3 примера (352–382, 414–435, 450–465) переписать; раздел «Extracting Nested Rules» (709–798) — убрать упоминания типа.
- [i18n/ru/.../validation-strategies.md](projects/reformer-doc/i18n/ru/docusaurus-plugin-content-docs/current/validation/validation-strategies.md) — идентично EN.

## Critical files quick-list

```
packages/reformer/src/core/validation/core/validate-group.ts             [DELETE]
packages/reformer/src/core/validation/core/index.ts                       [-1 line]
packages/reformer/src/core/validation/index.ts                            [-1 line]
packages/reformer/src/core/types/validation-schema.ts                     [-types]
packages/reformer/src/core/types/index.ts                                 [-exports]
packages/reformer/src/core/validation/validation-registry.ts              [-method]
packages/reformer/src/core/validation/validation-applicator.ts            [-method]
packages/reformer/src/core/types/form-context.ts                          [JSDoc tweak]
projects/react-playground/.../**/*-validation.ts (8 files)                [rewrite to validate]
projects/react-playground/.../mcp-credit-application-core-clean/schema.ts [rewrite to validate]
docs/presentation/validation-example.ts                                   [remove import]
docs/presentation/validation-example copy.ts                              [rewrite line 106–111]
packages/reformer/llms.txt                                                [rewrite sections]
packages/reformer/docs/llms/*.md (5 files)                                [rewrite examples]
projects/reformer-doc/docs/validation/*.md (3 files) + ru i18n             [rewrite examples]
```

## Verification

В таком порядке:

1. **Type-check** на корневом workspace: `pnpm -r tsc --noEmit` (или эквивалент в скрипте `package.json`). Должен пройти без ошибок про отсутствующий `validateGroup`/`GroupValidator`.
2. **Unit tests** в core: `pnpm --filter @reformer/core test`. Все зелёные (на самом `validateGroup` тестов нет, но другие не должны сломаться от вырезанного `registerGroup`/`applyGroupValidators`).
3. **Build playground:** `pnpm --filter react-playground build`. Должен собраться.
4. **Финальный грep:**
   ```bash
   grep -r "validateGroup\|GroupValidator\|ValidateGroupOptions" \
     packages/reformer/src packages/reformer/docs packages/reformer/llms.txt \
     projects/react-playground/src projects/reformer-doc/docs projects/reformer-doc/i18n \
     docs/presentation
   ```
   Должен вернуть 0 строк. (`.claude/worktrees/` и `docs/plans/` исключаем — там артефакты других веток / истории.)
5. **Smoke playground формы:** запустить dev-server playground, открыть форму заявки на кредит, потыкать поля с cross-field правилами (initialPayment vs propertyValue, монтлы payment, возраст) — ошибки должны появляться на тех же полях, что и до миграции.
6. **bd issue:** перед стартом создать `bd create --title="Удалить validateGroup из API" --type=task --priority=2`, в конце `bd close <id>`. По правилу проекта **не коммитить и не пушить** без отдельной команды от пользователя.
