# Возврат `validation.ts` к понятному контракту (убрать `vf` / `mv` / `vs`)

Файл: [schemas/validation.ts](../../projects/react-playground/src/pages/examples/complex-multy-step-form/schemas/validation.ts)

## Context — что понял из задачи

Пользователь смотрит на `complex-multy-step-form/schemas/validation.ts` и спрашивает: **откуда взялись `vf`, `mv`, `vs`** и почему «контракт» валидации перестал быть очевидным. Задача — **убрать криптичные двухбуквенные хелперы и вернуть читаемый, очевидный способ описания валидации**.

### Откуда взялись `vf` / `mv` / `vs`

Они появились **вместе с самим файлом** в коммите `59623eb` (`feat: move flagship validation to the m1 model engine`, 29 июня). До этого валидация жила в другом, императивном виде (legacy `validate(path.field, …)` — см. ниже). При миграции на новый движок `validateFormModel` автор завернул узлы схемы в локальные алиасы:

```ts
type V = ModelValidator;
const mv = (validator: unknown): V => validator as V; // каст одиночного валидатора
const vs = (...validators: unknown[]): V[] => validators as V[]; // каст списка валидаторов
const vf = (signal: any, validators: V[]) => ({ value: signal, validators }); // узел поля
const when =
  (cond) =>
  (...validators) =>
    validators.map(/* условный запуск */);
```

- `vf` = **v**alidate **f**ield → собирает узел `{ value, validators }`.
- `vs` = **v**alidator**s** → собирает массив правил, кастуя их к `ModelValidator[]`.
- `mv` = **m**odel **v**alidator → кастует один валидатор к `ModelValidator`.
- `when` = условная обёртка (правила применяются только если `cond(root)` истинно).

### Почему вообще появились касты (`as V`)

Встроенные фабрики (`required`, `min`, `pattern`, …) возвращают тип `Validator<TForm,TField>` = `(value, control: FormProxy, root: FormProxy) => …` ([validation-schema.ts:35](../../packages/reformer/src/core/types/validation-schema.ts#L35)). Движок же ждёт `ModelValidator` = `(value, model, root) => …` ([validate-model.ts:23](../../packages/reformer/src/core/model/validate-model.ts#L23)). По типам они **структурно несовместимы** (arg2/arg3 — `FormProxy` против `model`/`root`), хотя в рантайме фабрики value-only и аргументы 2–3 игнорируют. Касты `vs`/`mv` (`as V` через `unknown`) глушат это несоответствие.

### Ключевой факт: движку касты НЕ нужны

`validateFormModel<T>(model, schema: unknown)` принимает схему как **`unknown`** — он её вообще не типизирует ([validate-model.ts:166](../../packages/reformer/src/core/model/validate-model.ts#L166)). Значит `vf`/`vs`/`mv` существуют **не из-за требований движка**, а как добровольная (и, по мнению пользователя, ухудшившая читаемость) локальная абстракция. Их можно убрать без изменений в ядре.

### Что важно знать про «прежний контракт»

«Понятный и очевидный» контракт, который помнит пользователь, — это legacy-стиль:

```ts
validate(path.loanType, required({ message: 'Выберите тип кредита' }));
validate(path.loanAmount, min(50000, { message: 'Минимум 50 000 ₽' }));
applyWhen(path.loanType, (t) => t === 'mortgage', mortgageFieldsRules);
```

⚠️ **Операторы `validate` / `apply` / `applyWhen` и тип `FieldPath` УДАЛЕНЫ из `@reformer/core`** breaking-коммитом `56de4ed` (`remove legacy fieldpath, validateform and behavior system`, уже в HEAD). `@reformer/core/validators` сейчас экспортирует только value-only фабрики. Поэтому **дословно вернуть `validate(path.field, …)` нельзя** без восстановления удалённого ядра или написания локального shim'а поверх `validateFormModel`.

---

## Как валидация работает сейчас (детально)

**Три действующих лица.**

1. **Модель `model`** — реактивные данные с двумя «лицами»:
   - `model.field` / `model.personalData.birthDate` — **value-proxy** ([types.ts:58](../../packages/reformer/src/core/model/types.ts#L58)): читаешь обычным доступом, получаешь текущее значение.
   - `model.$.field` — **сигнал** поля (`PathAwareSignal` с `__path`, напр. `'personalData.lastName'`). Это «адрес» поля; именно он кладётся в узел `{ value: … }`.
2. **Валидатор** — чистая функция `(value, scope, root)`: `value` — значение поля (`signal.peek()`); `scope` (param `model`) — ближайшая модель (корень или под-модель элемента массива, value-proxy); `root` — корневая модель (value-proxy). Возврат `ValidationError | null` (или `Promise` для async).
3. **Схема** — дерево обычных объектов трёх видов ([validate-model.ts:67](../../packages/reformer/src/core/model/validate-model.ts#L67)): поле `{ value, validators }` · контейнер `{ children: [...] }` · секция массива `{ componentProps: { control, itemComponent } }`.

**`vf`/`vs`/`mv` — просто сахар над этим деревом:** `vf(m.loanType, vs(required({…})))` ≡ `{ value: m.loanType, validators: [required({…})] }`.

**Движок `validateFormModel(model, schema)` — 4 шага** ([validate-model.ts:166](../../packages/reformer/src/core/model/validate-model.ts#L166)):

1. `walk` обходит дерево, собирая задачи (сигнал + валидаторы + scope). Для секции массива на каждый элемент зовёт `itemComponent(itemModel)` и обходит поддерево со `scope = под-модель элемента`.
2. На каждую задачу: `value = signal.peek()`, прогон `validator(value, scope, root)`.
3. Ошибки складываются в `{ [signal.__path]: ValidationError[] }` (напр. `'coBorrowers.0.email'`).
4. Роутит ошибки в ноды формы через реестр сигнал→нода (`node.setErrors`) — поле краснеет; прошедшие поля очищаются. Возвращает `{ valid, errors }`.

**Публичный API `makeCreditValidationConfig(model)` → `{ validateStep, validateAll }`:** `validateStep(step)` строит `creditStepSchema(step, model)`, гоняет `validateFormModel`, возвращает `noBlocking(errors)` (true, если все ошибки — `severity:'warning'`). `validateAll()` — `creditFullSchema` (все шаги + form-level cross-field/warnings). FormWizard зовёт `validateStep` на «Далее» (блокирует переход), `validateAll` на submit; warnings не блокируют.

## Примеры ДО / ПОСЛЕ

### Простое поле

**ДО (сейчас, криптично):**

```ts
vf(m.loanType, vs(required({ message: 'Выберите тип кредита' })));
```

**ПОСЛЕ (нативный узел движка — без хелперов):**

```ts
{ value: m.loanType, validators: [required({ message: 'Выберите тип кредита' })] }
```

### Поле с несколькими правилами

**ДО:**

```ts
vf(
  m.loanAmount,
  vs(
    required({ message: 'Укажите сумму кредита' }),
    min(50000, { message: 'Минимум 50 000 ₽' }),
    max(10000000, { message: 'Максимум 10 000 000 ₽' })
  )
);
```

**ПОСЛЕ:**

```ts
{
  value: m.loanAmount,
  validators: [
    required({ message: 'Укажите сумму кредита' }),
    min(50000, { message: 'Минимум 50 000 ₽' }),
    max(10000000, { message: 'Максимум 10 000 000 ₽' }),
  ],
}
```

### Условные правила (`when`)

**ДО:**

```ts
const w = when(mortgage);
vf(
  m.propertyValue,
  w(
    required({ message: 'Укажите стоимость недвижимости' }),
    min(1000000, { message: 'Минимум 1 000 000 ₽' })
  )
);
```

**ПОСЛЕ (вариант с явным, читаемо названным хелпером `onlyWhen`):**

```ts
{
  value: m.propertyValue,
  validators: onlyWhen(isMortgage, [
    required({ message: 'Укажите стоимость недвижимости' }),
    min(1000000, { message: 'Минимум 1 000 000 ₽' }),
  ]),
}
```

### Каст одиночного валидатора (`mv`)

**ДО:**

```ts
vf(m.electronicSignature, vs(required({ … }), pattern(/^\d{6}$/, { … }), mv(smsCode)))
```

**ПОСЛЕ (`smsCode` уже типизирован как валидатор — каст не нужен):**

```ts
{
  value: m.electronicSignature,
  validators: [required({ … }), pattern(/^\d{6}$/, { … }), smsCode],
}
```

---

## Blast radius

- Изменения **полностью внутри** [schemas/validation.ts](../../projects/react-playground/src/pages/examples/complex-multy-step-form/schemas/validation.ts).
- Наружу файл отдаёт `makeCreditValidationConfig(model)` → `{ validateStep, validateAll }` (+ `creditStepSchema`/`creditFullSchema`). Эта сигнатура **сохраняется**, поэтому 3 варианта флагмана (base / renderer / renderer-json) не трогаем — они импортируют только `makeCreditValidationConfig`.

## Сравнение вариантов целевого контракта

Сложные места одинаковы во всех вариантах и их стоит **сохранить как именованные функции** (они не криптичны): вложенные группы `addressChildren(s) → { children: [...] }`, элементы массивов `propertyItem/existingLoanItem/coBorrowerItem`, секции массивов `arraySection(control, item) → { componentProps: { control, itemComponent } }`, async `smsCode`. Различие — только в записи **поля** и **условных правил**.

Берём один и тот же репрезентативный срез (ипотечное поле + async-подпись) для всех трёх.

### Вариант 1 — Нативные узлы движка `{ value, validators: [...] }`

```ts
// простое поле
{ value: m.loanType, validators: [required({ message: 'Выберите тип кредита' })] },

// несколько правил
{ value: m.loanAmount, validators: [
  required({ message: 'Укажите сумму кредита' }),
  min(50000, { message: 'Минимум 50 000 ₽' }),
  ...onlyWhen(isMortgage, [loanAmountVsPropertyMinusPayment]),
] },

// условное поле целиком
{ value: m.propertyValue, validators: onlyWhen(isMortgage, [
  required({ message: 'Укажите стоимость недвижимости' }),
  min(1000000, { message: 'Минимум 1 000 000 ₽' }),
]) },

// async — каст mv не нужен, smsCode уже валидатор
{ value: m.electronicSignature, validators: [
  required({ message: 'Введите код из СМС' }), pattern(/^\d{6}$/, { message: 'Только цифры' }), smsCode,
] },
```

- **Очевидность:** максимальная — ровно тот контракт, что документирует `validateFormModel` (узлы `{ value, validators }`, `{ children }`, `{ componentProps }`). Видно структуру без «расшифровки» хелперов.
- **Касты:** не нужны (`schema: unknown`). Остаётся один маленький `any`-стык **внутри** `onlyWhen`, не на колл-сайтах.
- **Объём:** самый многословный per-field (ключи `value:`/`validators:`), но без скрытой логики.
- **Хелперы:** остаётся только `onlyWhen` (читаемая замена `when`); `vf`/`vs`/`mv` удаляются.

### Вариант 2 — Читаемо названные хелперы `field(...)` + `onlyWhen(...)`

```ts
field(m.loanType, [required({ message: 'Выберите тип кредита' })]),

field(m.loanAmount, [
  required({ message: 'Укажите сумму кредита' }),
  min(50000, { message: 'Минимум 50 000 ₽' }),
  ...onlyWhen(isMortgage, [loanAmountVsPropertyMinusPayment]),
]),

field(m.propertyValue, onlyWhen(isMortgage, [
  required({ message: 'Укажите стоимость недвижимости' }),
  min(1000000, { message: 'Минимум 1 000 000 ₽' }),
])),

field(m.electronicSignature, [required({ message: 'Введите код из СМС' }), pattern(/^\d{6}$/, { message: 'Только цифры' }), smsCode]),
```

- **Очевидность:** высокая — `field(signal, rules)` читается как «у этого поля такие правила». По сути это `vf`, переименованный в говорящее имя, а `vs`/`mv` выкинуты (правила — обычный массив).
- **Касты:** убираются за счёт типа-объединения в сигнатуре: `type Rule = ModelValidator | Validator<any, any>; field(signal, rules: Rule[])`. На колл-сайтах `as` нет.
- **Объём:** самый компактный, ближе всего к текущей форме минус крипта.
- **Хелперы:** `field` + `onlyWhen` (2 штуки, оба говорящие).

### Вариант 3 — Локальный императивный DSL (как legacy `validate(...)`)

```ts
validate(m.loanType, required({ message: 'Выберите тип кредита' }));
validate(m.loanAmount, required({ message: 'Укажите сумму кредита' }));
validate(m.loanAmount, min(50000, { message: 'Минимум 50 000 ₽' }));
applyWhen(isMortgage, () => {
  validate(m.propertyValue, required({ message: 'Укажите стоимость недвижимости' }));
  validate(m.propertyValue, min(1000000, { message: 'Минимум 1 000 000 ₽' }));
  validate(m.loanAmount, loanAmountVsPropertyMinusPayment);
});
validate(m.electronicSignature, required({ message: 'Введите код из СМС' }));
validate(m.electronicSignature, smsCode);
```

- **Очевидность:** для колл-сайтов — максимальная и буквально «как раньше» (одно правило = один вызов, условность через блок `applyWhen`).
- **Цена:** нужно написать **локальный shim** (~40–60 строк): билдер-контекст, который аккумулирует вызовы `validate(signal, rule)`, мёржит правила по сигналу в узлы `{ value, validators }`, оборачивает правила внутри `applyWhen` условием, и умеет вложенные группы/массивы (аналог legacy `apply`). Логика прячется в shim — то есть «магия» не исчезает, а переезжает из 3 коротких алиасов в 1 более крупный модуль (который надо покрыть тестом).
- **Касты:** внутри shim'а будет `any`-стык фабрика→`ModelValidator`; на колл-сайтах чисто.
- **Риск/объём:** наибольший (новая инфраструктура), но изолирован в примере.
- **Близость к legacy:** наивысшая; формально это «возврат прежнего контракта», но реализованного заново поверх нового движка.

### Сводка

| Критерий                      | В1 Нативные узлы | В2 `field()`+`onlyWhen()` | В3 DSL-shim             |
| ----------------------------- | ---------------- | ------------------------- | ----------------------- |
| «Очевидность» колл-сайта      | Высокая          | Высокая                   | Наивысшая (как legacy)  |
| Скрытая логика / магия        | Нет              | Минимум (2 хелпера)       | Да (в shim'е)           |
| Объём кода                    | Средний+         | Наименьший                | Наибольший (+shim+тест) |
| Касты `as` на колл-сайтах     | Нет              | Нет                       | Нет                     |
| Близость к буквальному legacy | Низкая           | Низкая                    | Высокая                 |
| Риск изменения                | Низкий           | Низкий                    | Средний                 |

**Предварительная рекомендация (уточнена исследованием ниже):** В1 или В2. Оба убирают `vf`/`vs`/`mv` и касты, не трогают ядро. Итоговая форма после 6-агентного исследования — **типизированный В2 (= В4)**, см. раздел ниже.

## Что показало исследование (6 агентов: DevExp×2, Perf×2, Flexibility×2)

### Сходящийся диагноз

- **Главная боль — не только криптичность, а полная потеря типов.** `vs(...: unknown[])`, `vf(signal: any)`, `eslint-disable no-explicit-any` на весь файл → ноль автокомплита и ноль проверки «правило ↔ тип поля» (`field(m.loanAmount /*number*/, [email()])` пройдёт молча). Касты `mv/vs` — следствие номинального несовпадения `Validator` (2-й арг `FormProxy`) и `ModelValidator` (2-й арг `model`); движку они не нужны (`schema: unknown`).
- **В репозитории уже есть штатная идиома M1.** [registration-form/RegistrationForm.tsx](../../projects/react-playground/src/pages/examples/registration-form/RegistrationForm.tsx) и [examples/validation/ValidationExamples.tsx](../../projects/react-playground/src/pages/examples/validation/ValidationExamples.tsx) пишут схему плоскими литералами `{ value: model.$.x, validators: [required({message}), namedValidator] }`; cross-field читают через **2-й аргумент `model`** (типизированный `ModelValidator<TValue,TModel>`, **без `root as Root`**); async — обычная `async ModelValidator`. Комплексная форма — единственная отступница; её же `behavior.ts` написан читаемо → эталон для выравнивания уже существует в репо.
- **Жёсткость контракта — архитектурная (в движке), не синтаксическая.** Движок знает 3 вида узла, условие — обёртка валидатора (не ветка), ошибка маршрутизируется только по `signal.__path` (нет носителя group/array/form-level). Отсюда: «добавьте ≥1 элемент» висит на чекбоксе, form-level ошибки паразитируют на computed-полях (`fullExtras`), условие дублируется (`emp`×8, `self`×3). Это **не лечится выбором В1/В2/В3** — только правкой движка.
- **Перф сейчас не узкое место** (валидация только на «Далее»/submit), но контракт делает дорогими: мемоизацию (схема пересобирается каждый раз, ~300–400 аллокаций/`validateAll`), sync-путь (всё гонится через async `Promise.all`, реально async только `smsCode`), инкрементальную валидацию одного поля (нет индекса `signal→правила`; `validateFormModel` обходит дерево дважды).

### Сходящаяся рекомендация по форме записи

Три направления сходятся: **автор пишет в типизированном В2 (= В4); В1 — «скомпилированная» форма-цель, которую ест движок; В3 — это то, чем файл уже фактически является (криптичный DSL-shim).**

- `field<TField>(signal: PathAwareSignal<TField>, rules: Rule<TField>[])` — узел поля с выводом типа поля из сигнала → автокомплит + проверка правил; единственный каст локализован внутри `field`.
- `onlyWhen(cond, rules)` — **одна** обёртка на ветку (не на каждое правило): читаемо [devexp], дешевле/мемоизуемо [perf], декларативно как `applyWhen` [flex].
- Cross-field — именованные `ModelValidator<TValue, Root>`, читают зависимости через 2-й арг `model`, **без `root as Root`**.
- Переиспользование: экспортировать `ruName()` (убирает 4 дубля правил ФИО); заменить рукописные `adultAge`/`coBorrowerAge18to80`/`passportIssueNotFuture` на встроенные `minAge`/`maxAge`/`pastDate` (чистые удаления).

## Выбрано: Tier 3 (полный объём)

Tier'ы аддитивны (**0 ⊂ 1 ⊂ 2 ⊂ 3**): рефактор примера + перф + правки движка + i18n + JSON-слот. Детальный пофазный план — ниже.

### Статус выполнения

- **Фаза 0** ✅ — `validation.ts` переписан (типизированные `field/when/applyWhen/crossField`), tsc + lint чисто, e2e 566 passed (3 варианта).
- **Фаза 1** ✅ — схема строится один раз в `makeCreditValidationConfig`; e2e 587 passed.
- **Фаза 2** ✅ (ядро) — `validate-model.ts`: узел-ветка `{when,children}` + один проход (collect→route) + очистка выключенной ветки; `applyWhen` в примере → нативный узел (полифилл удалён); +4 unit-теста; reformer suite 654 passed. **Отложено** (требует новых экспортов в `model/index.ts`, который правит параллельная сессия): sync-путь `validateFormModelSync` (D) и инкрементальная `validateField`/`compileSchema` (E) — вернуться, когда параллельный `model/index.ts` закоммичен.
- **Фаза 3a** ✅ — i18n-резолвер в `reformer-cdk` (один шов в `useFormField` покрывает все 3 варианта через ui-kit FormField). `ValidationMessagesProvider`/`createMessageResolver`/`useValidationErrorResolver`/`defaultErrorResolver` + 6 unit-тестов; e2e 590 passed (non-breaking, дефолт = `message || code`). Миграция примера на коды НЕ сделана (per-field сообщения → смена UX + правка e2e, отдельное решение).
- **Фаза 3b** ⏳ — JSON-слот валидаторов в `reformer-renderer-json` (большой кусок: `json-schema.ts`/`operators.ts`/`converter`/`validate.ts` + регенерация meta-схемы, которая пересекается с pre-existing незакоммиченной правкой `gen-form-json-schema.ts`/`form-schema.schema.json`). Рекомендуется отдельным focused-заходом.
- **Отложено (Фаза 2 D/E)** — sync-путь `validateFormModelSync` + `compileSchema`/`validateField` (новые экспорты в `model/index.ts`, можно вернуть).

## План реализации — фазы 0→1→2→3

Порядок строгий, каждая фаза самодостаточна и проверяема (после каждой — tsc/lint/тесты/e2e зелёные). Эталон записи — sibling-идиома `RegistrationForm.tsx`/`ValidationExamples.tsx`. Объём многопакетный — при старте завести **beads-issue на каждую фазу** (проект на `bd`).

### Условная валидация — итоговый дизайн (воркфлоу: 6 предложений × 3 судьи)

`onlyWhen` внутри `field` (`field(m.x, [...onlyWhen(...)])`) забракован. Дизайн-воркфлоу (агрегатные баллы: per-rule-when 92 ≈ rule-group-node 91 ≈ wildcard-best 89 > branch-group 83) показал: условность — **отдельная конструкция, не spread в массиве правил**, и лучшая конструкция **разная для разных кейсов**. Проверенный всеми судьями факт движка: сейчас `walk` **не** интерпретирует `{ when, children }` (падает в общий контейнер, `when` игнорируется, children валидируются безусловно) → чистый структурный `branch` **молча сломан в фазе 0** и работает только после фазы 2.

**Решение — два хелпера (нейминг по legacy):**

- `applyWhen(cond, [ …узлы ])` — условность на **группу узлов** (= аналог legacy-оператора `applyWhen`): всё-условное поле, много полей под одним предикатом, вложенная группа. Предикат один раз. В фазе 0 — **полифилл** (re-wrap правил дочерних полей предикатом, возвращает `{ children }`); в фазе 2 — нативный `{ when, children }` (skip+clear делает движок). **Колл-сайты при миграции не меняются.** Per-item версия — `applyWhenItem(cond, [...])` (предикат читает `scope` элемента).
- `when<TField>(cond, ...rules): Rule<TField>` — условность на **одно правило внутри поля**, как обычный элемент массива (кейс «смешанное поле»: база всегда + cross-field при условии). Co-located, типобезопасно (`TField` сохранён), phase-0-feasible (при ложном `cond` → `null`).
- Безусловная композиция под-схемы (= legacy `apply`) — просто вложение узлов / `{ children: [...] }`.

Кейсы: всё-условное поле → `applyWhen(isMortgage, [ field(m.$.propertyValue, […]) ])`; смешанное → `field(m.$.loanAmount, [required(…), min(…), when(isMortgage, loanAmountVsCap)])`; много полей → `applyWhen(isEmployed, [ …7 полей ])`; группа адреса → `applyWhen(notSame, addressFields(m.residenceAddress))`; per-item → `applyWhenItem(cond, […])`.

### Фаза 0 — типобезопасный рефактор `validation.ts` (1 файл)

Файл: [schemas/validation.ts](../../projects/react-playground/src/pages/examples/complex-multy-step-form/schemas/validation.ts).

1. Хелперы вместо `vf/vs/mv/when`:
   - `type Rule<TField> = Validator<Root, TField> | ModelValidator<TField, unknown, Root>`.
   - `field<TField>(signal: PathAwareSignal<TField>, rules: Rule<TField>[]) => ({ value: signal, validators: rules as ModelValidator[] })` — **единственный** каст, внутри хелпера.
   - `when<TField>(cond: (r: Root) => boolean, ...rules: Rule<TField>[]): Rule<TField>` — одно условное правило (элемент массива, без spread).
   - `applyWhen(cond: (r: Root) => boolean, children: SchemaNode[]): SchemaNode` — условная группа узлов (= legacy `applyWhen`; фаза 0: полифилл re-wrap → `{ children }`; фаза 2: нативный `{ when, children }`, колл-сайты не меняются). `applyWhenItem(cond: (scope) => boolean, …)` — per-item (читает `scope`).
   - (`onlyWhen` НЕ вводим — забракован, см. «Условная валидация — итоговый дизайн».)
2. Cross-field: `crossField((f: Root) => …)` / `ModelValidator<TValue, unknown, Root>` — соседей читать через типизированный аргумент, **без `root as Root`**; per-item — через типизированный `scope`.
3. Убрать `eslint-disable no-explicit-any`; сигнатуры под-схем `addressChildren(a: ModelSignals<Address>)`, `*Item(im: FormModel<T>)`.
4. Переиспользование: экспортировать `ruName()`, применить в `step2` и `coBorrowerItem` (убрать 4 дубля правил ФИО).
5. Чистые удаления: `adultAge`→`minAge(18)`+`maxAge(70)`, `coBorrowerAge18to80`→`minAge(18)`+`maxAge(80)`, `passportIssueNotFuture`→`pastDate()` (фабрики есть в [validators/index.ts](../../packages/reformer/src/core/validation/validators/index.ts)).
6. Публичный API (`creditStepSchema`/`creditFullSchema`/`makeCreditValidationConfig`) — сигнатуры без изменений → 3 варианта флагмана не трогаем.

### Фаза 1 — перф внутри примера

Файл: `validation.ts` (кэш предпочтительно внутри `makeCreditValidationConfig`).

1. Строить схему **один раз** на `model` (`stepSchemas`/`fullSchema` собираются единожды, `validateStep`/`validateAll` переиспользуют). `new Date()` в `carYear` вынести из build.
2. `applyWhen` (полифилл) — один gate на группу (предикат раз на ветку, не на правило); упрощается в фазе 2 до нативного узла.

### Фаза 2 — движок `@reformer/core` (настоящая гибкость + перф)

Файлы: [validate-model.ts](../../packages/reformer/src/core/model/validate-model.ts), [signal-node-registry.ts](../../packages/reformer/src/core/utils/signal-node-registry.ts), типы; **тесты** в `packages/reformer`.

1. **Один проход**: `validateModel` возвращает собранные `tasks`; `validateFormModel` роутит из них (убрать второй `walk`).
2. **Sync fast-path + async-opt-in**: пометка async-правил; `validateFormModelSync` с роутингом для шагов без async; `validateStep` выбирает sync/async.
3. **Узел-ветка** `{ when: (scope, root) => boolean, children: [...] }` в `walk`: ложно → поддерево пропускается. **Caveat:** поля выключенной ветки нужно **очищать** (`setErrors([])`) — `walk` собирает «все сигналы поддерева» для очистки, а не только активные задачи (иначе залипшие ошибки).
4. **Индекс + инкрементальная `validateField(signal)`**: `compileSchema(model, schema) → { tasks, bySignal: Map, hasAsync }`; `validateField` гоняет правила одного поля (+ объявленный co-validate набор) и роутит. Инвалидация `bySignal` при изменении длины массива.
5. (опц., наибольший дизайн-риск) **носитель ошибки уровня группы/массива/формы** — убирает костыли `notEmptyWhen`-на-чекбоксе и `fullExtras`-на-computed.
6. Переключить `applyWhen`-хелпер с фазы-0 полифилла на нативный `{ when, children }` (колл-сайты не меняются); включить sync-путь.

- Аддитивно (старые узлы работают), но затрагивает всех потребителей `validateFormModel` → прогнать весь reformer test-suite + новые unit-тесты.
- **Follow-up (отдельно):** `packages/*/docs/llms` и MCP-рецепт `add-validation` отстали (легаси `validate/applyWhen`) — перегенерить. Это **не** `docs/specs/`.

### Фаза 3 — i18n + JSON-слот валидаторов

**3a. i18n (резолвер `code→message`).** Файлы: `ValidationError` ([types/index.ts](../../packages/reformer/src/core/types/index.ts)), новый резолвер, [useFormField.ts:182](../../packages/reformer-cdk/src/components/form-field/useFormField.ts#L182) (`errors[0]?.message` → `resolve(errors[0])`), `FormFieldError.tsx`.

- `messages: Record<code,(params?)=>string>` + `resolve(e) = e.message ?? messages[e.code]?.(e.params) ?? e.code`. Disambiguation (`pattern` имён vs телефон) — через `params.kind`.
- Пример: постепенно заменить хардкод-строки на `code`+`params` (`{message}` остаётся как override).

**3b. JSON-слот валидаторов (renderer-json).** Файлы: [json-schema.ts](../../packages/reformer-renderer-json/src/types/json-schema.ts) (`JsonFieldNode.validators?`), [operators.ts](../../packages/reformer-renderer-json/src/operators.ts) (оператор `$validator(...)`), новый validator-by-name registry (зеркало [component-registry.ts](../../packages/reformer-renderer-json/src/registry/component-registry.ts)), [json-to-render-schema.ts](../../packages/reformer-renderer-json/src/converter/json-to-render-schema.ts) (парсить слот → `validators` на узле), [validate.ts](../../packages/reformer-renderer-json/src/validate.ts) (+тест), `schema/form-schema.schema.json` + `gen-form-json-schema.ts` (регенерить мета-схему — уже в работе по git status, **не править руками**).

- Per-field: `validators: ['$validator(required)', '$validator(minLength,2)']` (строковый operator-DSL пакета). Cross-field/async — по имени из реестра (`'$validator(fn:initialPaymentVsProperty)'`), функции регистрирует хост.
- json-вариант флагмана: per-field — в JSON; cross-field/wizard — через `makeCreditValidationConfig`/зарегистрированные fn.
- Самый рискованный кусок — после стабилизации фаз 0–2.

## Verification (по фазам)

- **После каждой фазы:** `tsc`/`npm run build` затронутых пакетов; `npm run lint` (фаза 0 — без `eslint-disable any`); e2e POM `CreditFormPage` (9 спеков, `react-playground-e2e`) на 3 вариантах зелёные; визуальный smoke `/run` (невалидные значения → per-step blocking; warnings не блокируют).
- **Фаза 2:** unit-тесты движка — branch-node активна/неактивна + очистка ошибок выключенной ветки, эквивалентность single-walk, sync vs async, точечность `validateField`; полный reformer test-suite зелёный.
- **Фаза 3a:** смена языковой таблицы меняет тексты ошибок без правки схемы.
- **Фаза 3b:** json-вариант валидирует per-field из JSON (e2e per-step зелёные); тесты `reformer-renderer-json` на новый слот.
- **Контроль:** `git status docs/specs/` — пусто (specs read-only).
