# ReFormer renderer-json — реализация бенчмарка

`@reformer/renderer-json` (+ `@reformer/renderer-react`, `@reformer/cdk`) — форма описана
JSON-документом, честная пара к RJSF. Порт демо
`projects/react-playground/src/pages/demo/registration-form-renderer-json` и
`…/complex-multy-step-form-renderer-json` на нейтральный UI.

## Паттерны и документация

Документация — `packages/reformer-renderer-json/docs/llms/*.md`,
`packages/reformer-renderer-react/docs/llms/*.md` и `packages/reformer/docs/llms/*.md`.

### Общее для форм

| Паттерн                                                                                                                                                                                                                             | Где                                                                                              | Документ                                                                     |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| Разметка и поля — JSON-документ (`format: 2`, `$model`, `$component`, `$html`)                                                                                                                                                      | `registration/form.json`, `credit/form.json`                                                     | renderer-json `01`–`05`, `10-format-2.md`                                    |
| Сборка `createForm({ schema: json, registry, initial, validation, flow })` + `FormRenderer`                                                                                                                                         | `*/…Form.tsx`, `../reformer-kit/credit/form.ts`                                                  | renderer-json `06-validation.md`                                             |
| Правила — TS-схема `defineValidation` (в JSON-DSL валидаторов нет by design)                                                                                                                                                        | `../reformer-kit/*rules.ts`                                                                      | renderer-json `06-validation.md`                                             |
| Реестр компонентов `defineRegistry`, обёртка поля `FIELD_WRAPPER`; общие записи — `registerBase`, реестр формы — свой модуль                                                                                                        | `kit/base-registry.ts`, `kit/registry.ts`, `kit/credit-registry.ts`, `../reformer-kit/Field.tsx` | renderer-json `03-registry.md`                                               |
| Отправка `bundle.submission.submit(handler)` (у визарда отказ переводит поток на первый шаг с ошибкой — `onInvalidSubmit: 'firstInvalidStep'` потока, общего с JSX-вариантом); сборка из контекста рендерера `useFormBundleContext` | `kit/form-shell.tsx`, `../reformer-kit/credit/rules.ts`                                          | renderer-json `07-form-wizard.md`, `@reformer/cdk` `03-form-navigation.md`   |
| «Очистить» — `bundle.form.reset()` из `<form>` реестра (значения, ноды, тихая фаза `afterFirstSubmit`)                                                                                                                              | `kit/form-shell.tsx`                                                                             | core `28-submit-and-reset.md`                                                |
| Путь DOM-контракта поля — `testId`, который рендерер выводит из живого пути поля в модели (у строки массива — с текущим индексом)                                                                                                   | `../reformer-kit/Field.tsx` (`FieldWrapper`)                                                     | renderer-json `05-cookbook.md`, renderer-react llms.txt, core `10-arrays.md` |
| `validateFormSchema` (ajv, точка входа `@reformer/renderer-json/validate`) страницы не вызывают; в prod-бандл ajv не попадает (проверяет сборка)                                                                                    | —                                                                                                | renderer-json `06-validation.md`                                             |

### Кредит (`credit/`)

| Паттерн                                                                                                                                                                                                   | Где                                                           | Документ                                                                |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Визард — узел `selector: 'wizard'`, шаги — его дети `$component(Step)` с `selector` = id шага потока                                                                                                      | `credit/form.json`                                            | renderer-json `07-form-wizard.md`                                       |
| Свой визард реестра на общей разметке: `__selfManagedChildren` (узлы шагов данными + `renderNode`), поток — из сборки в контексте                                                                         | `kit/layout.tsx` (`Wizard`), `../reformer-kit/wizard.tsx`     | renderer-react `02-render-schema.md`, renderer-json `07-form-wizard.md` |
| Поток шагов и правила шагов — общие с JSX-вариантом (`flow.steps[].rules`)                                                                                                                                | `../reformer-kit/credit/rules.ts`                             | renderer-json `06-validation.md`, core `13-multi-step.md`               |
| Адрес и строки массивов — части документа `parts` (`$part(...)`, пути относительны группе/строке)                                                                                                         | `credit/form.json`                                            | renderer-json `02-json-schema.md`, `10-format-2.md`                     |
| Массив под-форм — свой компонент реестра (`ArrayComponentProps`: `items`, `onAdd`, `onRemove`) на общих `ArrayFrame`/`ArrayRow`; шаблон строки — `arrayOf(blank)` в модели                                | `kit/layout.tsx` (`ArraySection`)                             | renderer-json `02-json-schema.md`, renderer-react `types.ts`            |
| Условные секции — `hideWhen(schema.node(selector))` в поведении, поля — `enableWhen` того же условия                                                                                                      | `credit/CreditForm.tsx`, `../reformer-kit/credit/behavior.ts` | renderer-json `07-form-wizard.md`, core `18-conditional-fields.md`      |
| Вычисляемые — контейнер `$component(ReadonlyValue)` с `value: "$model(…)"` (рендерер разворачивает сигнал)                                                                                                | `credit/form.json`                                            | renderer-json `02-json-schema.md`                                       |
| Справочники (регионы, типы имущества) — сигналы страницы в реестре `reg.dataSource('REGIONS', signal)`, в документе `"options": "$dataSource(REGIONS)"`; реестр формы + справочники — `composeRegistries` | `credit/CreditForm.tsx`, `credit/form.json`                   | core `32-async-options-loading.md`, renderer-json `03-registry.md`      |
| Живая фаза шага после первого «Далее» — `liveAfterStep: 'change'` сборки, общей с JSX-вариантом (живой только текущий шаг)                                                                                | `../reformer-kit/credit/form.ts`                              | core `13-multi-step.md`, `33-validation-strategy.md`                    |
| Поведение (compute, copyFrom, onChange, опции городов и моделей, массивы по флагам) — общее с JSX-вариантом                                                                                               | `../reformer-kit/credit/behavior.ts`                          | см. `../reformer-core/README.md`                                        |

`../reformer-kit/` и `kit/` — обвязка; в объёме кода считаются этой реализации.

## Отклонения от контракта и обходы

- Обработчик отправки приходит со страницы через React-контекст (`FormActionsContext`): JSON не
  выражает рантайм-функции.
- `Group` (`kit/layout.tsx`) — контейнер без разметки для корня части документа: у контейнера
  JSON обязателен `component`, а эталонная разметка ставит поля прямо в секцию/строку.
- Документ `credit/form.json` собран один раз из общих метаданных полей (`CREDIT_FIELDS`:
  подписи, контролы, маски, опции) и дальше — обычный JSON; статические опции вписаны в документ,
  справочники — `$dataSource(...)`, опции по значению (города, модели) — `options: []`, их раздаёт
  поведение.
