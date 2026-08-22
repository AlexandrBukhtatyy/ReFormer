# Форма из спеки, проверенная поведением — юнит-тест сквозного пайплайна

## Context — зачем это

v7 закрыл извлечение знания, но три инструмента генерации остались без настоящей проверки.
Сегодня `plan_form` / `generate_form` / `validate_form` гарантированы только **внутренней
согласованностью**: тесты убеждаются, что файлы бандла ссылаются друг на друга без противоречий
(`C1..C9`), что коды `RF0xx` выставляются, что бандл компилируется. Ни один тест не проверяет,
что форма **работает** — что `required` действительно блокирует отправку, что `min` срабатывает
на границе, что условное поле выключается при смене типа кредита.

В разделе пробелов v7 это записано так: «Полноценная проверка — прогон сгенерированной формы
через e2e, это отдельная работа». **Утверждение неверно, и это выяснилось при разборе кода.**
Поведение формы ReFormer наблюдаемо headless, без React и браузера:

```ts
const form = createForm<Shape>({ model, behavior });   // схема не обязательна
form.propertyValue.disabled.value === true             // enableWhen наблюдаем
await validateModel(model, schema) === false           // валидация возвращает boolean
form.loanAmount.errors.value.map((e) => e.message)     // ошибки маршрутизируются в узлы
```

Идиома отработана в ядре — [scenarios.test.ts:131](../../packages/reformer/tests/behaviors/scenarios.test.ts#L131)
и [validate-model-schema.test.ts:160](../../packages/reformer/tests/core/validation/validate-model-schema.test.ts#L160).
Значит нужен не e2e, а юнит-тест.

**Результат:** сквозной тест `спека → intent → бандл → живая форма`, где утверждения
сформулированы в терминах спеки («сумма меньше 50 000 не проходит», «при выборе ипотеки поле
стоимости включается»), а не в терминах текста сгенерированных файлов.

---

## 1. Что мешает сегодня — замерено

`analyzeSpec` берёт из табличной строки **только идентификатор поля** и угадывает тип по имени
([spec-analyzer.ts:200](../../packages/reformer-mcp/src/utils/spec-analyzer.ts#L200):
`cells.find((c) => /^[a-z][a-zA-Z0-9]*$/.test(c))`). Колонки `Значение` и `Валидация` не
читаются вообще. Прогон на реальной спеке:

```
analyzeSpec(docs/specs/credit-application-form.md)
  → полей 51, условных 5, вычисляемых 5
  → ключей `validation` / `behavior` в результате НЕТ
```

Соответственно `planFormTool` строит intent только из `fields`
([generate-form.ts:100-110](../../packages/reformer-mcp/src/tools/generate-form.ts#L100)),
а `validation` и `behavior` остаются пустыми. Проверять в такой форме нечего.

**Но правила в спеке уже есть, и в машинно-разбираемом виде.** Спеки репозитория используют
HTML-таблицу с фиксированными колонками `№ | Раздел | Ключ в форме | Название поля | Тип поля |
Значение | Валидация | Подсказка | Примечание`:

| Ключ | Тип поля | Значение | Валидация |
| --- | --- | --- | --- |
| `loanType` | `Select` | `'consumer'` | `Обязательное` |
| `loanAmount` | `Input[number]` | `null` | `Обязательное, min: 50000, max: 10000000` |
| `propertyValue` | `Input[number]` | `null` | `Условное (при loanType='mortgage'), min: 1000000` |
| `carBrand` | `Input` | `''` | `Условное (при loanType='car'), minLength: 2, maxLength: 50` |

Формулы вычисляемых полей — наоборот, прозой («Автоматически вычисляется как 20% от стоимости
недвижимости»). **Их не извлекаем и не угадываем**: правдоподобная выдуманная формула хуже
явного пробела, потому что выглядит как проверенная.

Итог: первый шаг — научить парсер читать то, что в спеке **уже написано**.

---

## 2. Пайплайн под тестом

```
tests/fixtures/spec-loan-request.md        ← фикстура в формате репозитория
            │  analyzeSpec (расширенный)
            ▼
   SpecAnalysis: fields[{name,type,component,initialValue,rules,when}]
            │  intentFromSpec
            ▼
   FormIntent: fields + validation[] + behavior[] + warnings[]
            │  buildBundle
            ▼
   model.ts · validation.ts · form.behavior.ts   ← пишутся в песочницу внутри пакета
            │  tsc (гейт типов)   +   dynamic import (гейт исполнения)
            ▼
   createModel → createForm → validateModel      ← утверждения о ПОВЕДЕНИИ
```

---

## 3. Часть A — production-изменения

### A1. `src/utils/spec-analyzer.ts` — читать колонки, а не угадывать

`SpecField` дополняется: `initialValue?: unknown`, `rules: string[]`, `when?: string`.

Новые экспортируемые чистые функции (каждая — отдельный юнит-кейс):

- **`parseHeaderMap(table: string): Record<string, number> | null`** — разбирает строку `<th>`
  в карту `«ключ в форме» → 0, «тип поля» → 1, …` (сравнение по нижнему регистру, без пробелов).
  `null`, если заголовков нет.
- **`parseTypeCell(cell)`** → `{ type, component }`: `Input[number]` → `number`/`Input`,
  `Select` → `string`/`Select`, `Checkbox` → `boolean`/`Checkbox`, `DatePicker` → `date`,
  `Textarea` / `InputMask` / `InputPassword` — как есть. Неизвестное — падение на
  существующий `guessField`.
- **`parseInitialCell(cell, type)`** → `'consumer'` → `"consumer"`, `null` → `null`,
  `0` / `false` / `[]` → соответствующий литерал, пустая ячейка → `undefined`.
- **`parseValidationCell(cell)`** → `{ rules: string[]; when?: string; unparsed: string[] }`:

  | В спеке | В intent |
  | --- | --- |
  | `Обязательное` / `Обязательно` / `required` | `required()` |
  | `min: 50000`, `max: 10000000` | `min(50000)`, `max(10000000)` |
  | `minLength: 2`, `maxLength: 50` | `minLength(2)`, `maxLength(50)` |
  | `email` | `email()` |
  | `Условное (при loanType='mortgage')` | `when: "model.loanType === 'mortgage'"` |
  | `min: 20% от стоимости`, `max: текущий год+1` | → `unparsed`, **не** правило |

  Нечисловой аргумент попадает в `unparsed` и оттуда в `warnings`. Это принципиально: правило,
  которое мы не смогли прочесть, должно быть видно, а не исчезнуть.

`extractFields` получает **два пути**: если `parseHeaderMap` вернул карту — брать ячейки по
индексам колонок; иначе — сегодняшняя позиционная эвристика без изменений. Так спеки
свободного формата продолжают разбираться как сейчас, а спеки в формате репозитория —
точно. Регрессия исключена тем, что старая ветка кода остаётся дословно.

### A2. `src/generate/from-spec.ts` — извлечь построение intent из tool'а

Сейчас intent собирается внутри `planFormTool`, и тест не может получить его иначе как
парсингом markdown-выдачи. Выносим чистую функцию:

```ts
export function intentFromSpec(source: string, target: ReformerTargetStack): FormIntent
```

Помимо переноса существующих строк она добавляет:

- **`validation`** — по одному `ValidationRuleIntent { target, rules, when }` на поле с правилами.
  Контракт уже поддерживает `when` ([form-intent.ts:60](../../packages/reformer-mcp/src/generate/form-intent.ts#L60)),
  и эмиттер уже умеет оборачивать в `validateWhen`
  ([builders.ts:153](../../packages/reformer-mcp/src/generate/builders.ts#L153)) — менять
  типы не нужно.
- **`behavior`** — для каждого поля с `Условное (при X='Y')` добавляется
  `{ kind: 'enableWhen', target, sources: ['X'], expr: "model.X === 'Y'" }`.

  > Два слоя, а не дубль: `when` гейтит **правило** в `validateModel` (это модельный прогон,
  > он про состояние узла не знает), `enableWhen` гейтит **поле** в форме. Тест проверяет оба
  > по отдельности — иначе пропала бы ровно та ошибка, где сделали один из двух.

- **`warnings`** — на каждое поле из `computedFields` без извлечённой формулы:
  «поле `X` помечено в спеке как вычисляемое, формула задана прозой — допишите `behavior`
  вручную», и на каждый `unparsed` фрагмент валидации.

`planFormTool` после этого сводится к `intentFromSpec` + форматирование выдачи.

### A3. `src/generate/builders.ts` — дефект, который вскроется сразу

`buildModelTs` типизирует числовое поле как `number`
([builders.ts:82](../../packages/reformer-mcp/src/generate/builders.ts#L82)), а начальное
значение печатает как есть ([builders.ts:39](../../packages/reformer-mcp/src/generate/builders.ts#L39)).
Как только колонка `Значение` начнёт читаться, спека даст `loanAmount: null` при типе
`number` — и `tsc` упадёт на собственном сгенерированном коде.

Сегодня это не проявляется только потому, что `initialValue` никто не заполняет.

Починка: если `initialValue === null`, тип расширяется до `T | null`. Это не костыль, а
идиома ядра — `min` объявлен как
`min<TForm, TField extends number | null | undefined>` и явно пропускает пустые значения
([min.ts:34](../../packages/reformer/src/form/validators/min.ts#L34)), то есть «пустое число»
в ReFormer — штатное состояние, а `required()` и `min()` рассчитаны на совместную работу.

---

## 4. Часть B — фикстура

`packages/reformer-mcp/tests/fixtures/spec-loan-request.md` (каталога `fixtures/` пока нет).

Компактная спека **в том же HTML-табличном формате**, что `docs/specs/*.md` — иначе тест
проверял бы формат, которого в проекте нет. Девять полей, по одному представителю на класс
поведения:

| Поле | Тип | Значение | Валидация | Что проверяет |
| --- | --- | --- | --- | --- |
| `loanType` | `Select` | `'consumer'` | `Обязательное` | initial из колонки, гейт для условных |
| `loanAmount` | `Input[number]` | `null` | `Обязательное, min: 50000, max: 10000000` | границы + `number \| null` |
| `email` | `Input` | `''` | `Обязательное, email` | валидатор без аргумента |
| `firstName` | `Input` | `''` | `Обязательное, minLength: 2, maxLength: 50` | строковые границы |
| `propertyValue` | `Input[number]` | `null` | `Условное (при loanType='mortgage'), min: 1000000` | `when` + `enableWhen` |
| `carBrand` | `Input` | `''` | `Условное (при loanType='car'), minLength: 2` | второй гейт, другое значение |
| `hasCoBorrower` | `Checkbox` | `false` | — | boolean без правил |
| `monthlyPayment` | `Input[number]` | `null` | — (примечание: «Вычисляется автоматически») | **warning**, а не выдуманная формула |
| `comment` | `Textarea` | `''` | — | поле без правил не ломает прогон |

Фикстура — часть контракта теста, живёт рядом с ним и правится вместе с ним. Под запрет
`docs/specs/` она не подпадает: это не спека продукта, а вход теста.

---

## 5. Часть C — тест

`packages/reformer-mcp/tests/form-from-spec.test.ts`.

**Песочница.** По образцу
[builtin-compiles.test.ts:24](../../projects/reformer-builder/src/templates/builtin-compiles.test.ts#L24):
`mkdtempSync(join(process.cwd(), '.tmp', 'form-from-spec-'))`. Каталог обязан быть **внутри
пакета** — снаружи не резолвятся ни `@reformer/*`, ни относительный `./model`. `.tmp/`
покрыт корневым `.gitignore:26`. Уникальный каталог на прогон снимает кэш модулей vite между
кейсами. Уборка — в `finally`.

**Доступность ядра.** `@reformer/core` у `@reformer/mcp` — необязательный peer, поэтому
поведенческие кейсы идут под `it.runIf(hasCore)` по образцу
[symbols-aliases.test.ts:28](../../packages/reformer-mcp/tests/symbols-aliases.test.ts#L28).
Проверено: из `packages/reformer-mcp` резолвятся `@reformer/core`,
`/behaviors`, `/validation`, `/validators` (`required, email, min, max, minLength, maxLength,
pattern` — все на месте). Разбор спеки и сборка бандла от ядра не зависят и гоняются всегда.

### Кейсы

**Разбор спеки** (без ядра)

1. Поля, типы и компоненты взяты из колонки `Тип поля`, а не угаданы по имени:
   `loanAmount` → `number`/`Input`, `hasCoBorrower` → `boolean`/`Checkbox`.
2. Начальные значения из колонки `Значение`: `loanType === 'consumer'`, `loanAmount === null`.
3. `intent.validation` содержит `required()` у четырёх полей, `min(50000)`/`max(10000000)`
   у `loanAmount`, `minLength(2)`/`maxLength(50)` у `firstName`.
4. Условные правила несут `when: "model.loanType === 'mortgage'"`, и на них же заведён
   `enableWhen` в `intent.behavior`.
5. `monthlyPayment` даёт **warning** о неизвлечённой формуле и **не** попадает в `behavior`.
6. Нераспознанный фрагмент (`min: 20% от стоимости` в отдельном кейсе) уходит в `warnings`,
   а не теряется молча.

**Бандл компилируется** (без ядра, но с его типами)

7. Три файла прогоняются через `ts.createProgram` со `strict: true` и реальными типами
   `@reformer/*` — целиком повторяя приём из `builtin-compiles.test.ts`. Диагностик ноль.
   Именно этот кейс ловит дефект A3.

**Форма работает** (`it.runIf(hasCore)`) — ядро теста

8. `initialFormModel` из сгенерированного `model.ts` совпадает со спекой (`loanType`
   = `'consumer'`, `loanAmount` = `null`).
9. Пустая обязательная форма невалидна; заполненная — валидна:
   ```ts
   const model = createModel(initialFormModel);
   const form = createForm({ model, behavior: formBehavior });
   expect(await validateModel(model, formValidation)).toBe(false);
   Object.assign(model, { loanAmount: 100000, email: 'a@b.c', firstName: 'Иван' });
   expect(await validateModel(model, formValidation)).toBe(true);
   ```
10. Границы, каждая с двух сторон: `loanAmount = 49999` → `false`, `50000` → `true`;
    `firstName = 'И'` → `false`, `'Ин'` → `true`; `email = 'без-собаки'` → `false`.
11. Ошибки маршрутизируются в узлы: после неудачного прогона `form.loanAmount.errors.value`
    непуст и содержит код `min`; после удачного — пуст (проверка очистки).
12. **Условное правило** (`when`): при `loanType = 'consumer'` пустой `propertyValue` формы не
    ломает; при `loanType = 'mortgage'` — ломает; `propertyValue = 500000` → `false`,
    `5000000` → `true`.
13. **Условное поле** (`enableWhen`): `form.propertyValue.disabled.value` — `true` при
    `consumer`, `false` при `mortgage`; `form.carBrand.disabled.value` — зеркально на `car`.
    Реактивно, без пересоздания формы.

---

## 6. Verification

```bash
npm run build -w @reformer/mcp
npm run test  -w @reformer/mcp            # 117 существующих + новые, ни одного падения
npx tsc --noEmit -p packages/reformer-mcp  # A1-A3 меняют публичные типы SpecField
```

Регрессия на реальных спеках — разбор не должен деградировать:

```bash
node -e "const {analyzeSpec}=require('./packages/reformer-mcp/dist/utils/spec-analyzer.js');
const s=require('fs').readFileSync('docs/specs/credit-application-form.md','utf8');
const a=analyzeSpec(s); console.log(a.fields.length, a.fields.filter(f=>f.rules?.length).length)"
# было 51 поле / 0 правил → ожидание: 51 поле и заметно больше нуля правил
```

Сквозная проверка через реальный сервер (что tool отдаёт непустой `validation`):

```bash
node scripts/mcp-call.mjs tools/call \
  '{"name":"plan_form","arguments":{"specPath":"docs/specs/credit-application-form.md"}}'
```

Плюс существующие гейты без изменений: `npm run check:mcp-prompts`,
`npm run check:mcp-render`, `npm run check:packaging -w @reformer/mcp`, `npm run mcp:evaluate`
(корпус про извлечение знания — цифры двигаться не должны; если сдвинулись, что-то задето
не то).

---

## 7. Ключевые файлы

**Создать**

- `packages/reformer-mcp/tests/fixtures/spec-loan-request.md`
- `packages/reformer-mcp/tests/form-from-spec.test.ts`
- `packages/reformer-mcp/src/generate/from-spec.ts`

**Изменить**

- `packages/reformer-mcp/src/utils/spec-analyzer.ts` — `parseHeaderMap` / `parseTypeCell` /
  `parseInitialCell` / `parseValidationCell`, ветка чтения по колонкам в `extractFields`
- `packages/reformer-mcp/src/generate/builders.ts` — `number | null` при `initialValue === null`
- `packages/reformer-mcp/src/tools/generate-form.ts` — `planFormTool` через `intentFromSpec`

**Только чтение (эталоны)**

- [projects/reformer-builder/src/templates/builtin-compiles.test.ts](../../projects/reformer-builder/src/templates/builtin-compiles.test.ts) — песочница + `tsc`
- [packages/reformer/tests/behaviors/scenarios.test.ts](../../packages/reformer/tests/behaviors/scenarios.test.ts) — headless-идиома, `.disabled.value`
- [packages/reformer/tests/core/validation/validate-model-schema.test.ts](../../packages/reformer/tests/core/validation/validate-model-schema.test.ts) — `validateModel`, `.errors.value`

---

## 8. Границы — что тест не проверяет

Названо явно, чтобы зелёный прогон не читался шире, чем он есть.

- **Формулы вычисляемых полей.** В спеке они прозой; тест проверяет, что генератор об этом
  честно предупреждает, а не что он их разобрал.
- **Рендер.** Ни `renderer-react`, ни `renderer-json`: проверяется модель, валидация и
  поведение — то есть слои, где живёт корректность. Разметка остаётся за e2e и
  `validate_json_schema`.
- **Асинхронная валидация, массивы, wizard.** Контракт их поддерживает (`async`, `each`,
  `WizardIntent`), но спека их не выражает — расширять фикстуру имеет смысл только вместе
  с расширением формата спеки.
- **Спеки произвольного формата.** Гарантия даётся на табличный формат репозитория; для
  остальных разбор остаётся эвристическим ровно как сегодня.
