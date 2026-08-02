# Каталог стратегий валидации ReFormer (простая vs пошаговая форма)

## Context

Запрос: «бывают разные стратегии валидации для разных типов форм (простая и пошаговая) — найдём и
выпишем все стратегии». Ниже — полный каталог того, что **реально есть в коде** (не предложения),
собранный тремя Explore-агентами по ядру, cdk-визарду и примерам/докам. Пути — `файл:строка`.

Важное открытие: помимо оси «простая vs пошаговая» валидация делится на **два слоя**, и это ортогонально
типу формы. Плюс существующая дока `projects/reformer-doc/docs/validation/validation-strategies.md`
**устарела и неполна** (см. §Gap) — это кандидат на приведение к полному каталогу.

---

## Два слоя валидации (сквозные, ортогональны типу формы)

- **Слой A — функциональная схема** (`@reformer/core/validation`, `packages/reformer/src/form/validation-schema.ts`).
  Правила в `defineValidationSchema<T>(({model})=>void)`, прогон **по требованию**
  `validateModel(model, schema, { touch? }): Promise<boolean>` (`:283`). Не реактивна, императивный
  запуск. Раннер разносит ошибки по нодам (`setErrors`), гасит валидные диффом, отменяет устаревший
  прогон по идентичности `(model, schema)` (нужны стабильные `const`-ссылки). **Актуальный слой** —
  все примеры форм на нём.
- **Слой B — node-level валидаторы на ноде поля** (`packages/reformer/src/form/nodes/field-node.ts`).
  `validators`/`asyncValidators` в конфиге поля + `updateOn: 'change'|'blur'|'submit'` (дефолт `blur`,
  `:89/121`) + `debounce`. **Реактивные встроенные триггеры**: on-change (`setValue` `:166/178`),
  on-blur (`onMarkAsTouched` `:513`), enable/disable-хуки (`:524/534`). Legacy, но рабочий. В примерах
  форм не используется (там Слой A), но существует и является отдельной стратегией «валидация у поля».

---

## A. Простая (одношаговая) форма

**Точки/стратегии запуска:**
1. **Submit-time (основная).** `form.markAsTouched()` → `await validateModel(model, schema)` → по
   `boolean` решаем слать. Референс: `registration-form/RegistrationForm.tsx:223-248`,
   `registration-form-renderer-json/form-setup.ts:88-120`.
2. **Живая обратная связь (reactive-мост).** `revalidateWhen([deps], () => void validateModel(model, schema))`
   в behavior (`@reformer/core/behaviors` → `state/behaviors-value.ts:215`): перепрогон схемы при
   изменении зависимости. Единственный мост от реактивного слоя к schema-валидации. Референс:
   `examples/behaviors/BehaviorsExamples.tsx`.
3. **On-change / on-blur (Слой B).** `updateOn: 'change'|'blur'` + `debounce` на самой ноде —
   встроенный триггер без `validateModel`. В примерах форм не задействован.
4. **Точечное снятие устаревшей ошибки.** `onChange(field, () => other.clearErrors())` (behavior) —
   как в `registration-form-renderer-json/form-setup.ts:47-51` для cross-field пароля.

**Виды правил (в схеме, Слой A):** `validate` (sync), `validateAsync` (async + `AbortSignal`),
`cross` (cross-field по снапшоту `model.get()`), `each` (по элементам массива), `validateWhen`
(условно — гасит поля выключенной ветки), `apply` (композиция под-схем). Опция `{ touch: true }`
раскрывает ошибки **только провалидированных** полей. `severity:'warning'` не блокирует.

## B. Пошаговая (wizard) форма

**Точки/стратегии запуска:**
1. **Per-step gate («Далее»).** `validateStep(n)` = `validateModel(model, stepSchema, { touch: true })`
   (`define-steps.ts:81-85`). Провал → не пускает дальше, метит только поля шага
   (`FormWizard.tsx:160-193`).
2. **Full-schema на submit.** `validateAll()` = `validateModel(model, fullSchema, { touch: true })`,
   `fullSchema = apply(...шаги, extras)` (`define-steps.ts:76-78,86`). **`extras`** (cross-field/warnings
   всей формы) считаются **только на submit** (`FormWizard.tsx:239-258`, `skipValidation:true` в
   `form.submit`).
3. **Конфиг шагов — два варианта:**
   - **Рекомендованный `defineSteps`** (`packages/reformer-cdk/src/components/form-wizard/define-steps.ts`):
     адресация правил по **selector** шага, `null` для шага без правил, `{ touch: true }` внутри,
     `stepSelectors` (индекс→selector). Референс: `complex-multy-step-form/schemas/validation.ts:580-595`
     (6 шагов `loan|applicant|contacts|employment|additional|confirmation` + `extras`).
   - **Устаревший `STEP_SCHEMAS[step-1]`** массивом по позиции, без `touch`/`extras`. Референс:
     `mcp-credit-application-core-v20/validation.ts:238-253`.
4. **Гейтинг навигации по `completedSteps`.** Прыжок только на шаг 1 или если предыдущий завершён
   (`FormWizard.tsx:210-233`); возврат назад инвалидирует завершённость последующих
   (`pruneCompletedStepsOnBack :34-36`) → повторная валидация при движении вперёд.
5. **Блокировка кнопок.** `Next`/`Submit` disabled при `isValidating`/`isSubmitting`
   (`FormWizardNext.tsx:47`, `FormWizardSubmit.tsx:64`) — защита от двойного клика во время async.
6. **touch по шагам.** Только поля текущего шага метятся (через `{ touch: true }`), следующий шаг не
   «тронут»; на ветках провала визард дополнительно зовёт `form.markAsTouched()` на всю форму
   (`FormWizard.tsx:164,247`).
7. **Внешнее управление.** `FormWizardHandle` (ref): `validateCurrentStep`, `goToNextStep` (с
   валидацией), `submit` (с `validateAll`, → `R | null`).

**Виды правил** — те же, что в простой, плюс `extras` для form-level cross-field/warnings.

## Cross-cutting (обе формы)

- **Severity.** `error` блокирует submit/шаг, `warning` — нет (`validation-schema.ts:241`).
- **Стабильные `const`-ссылки на схемы** — иначе `validateModel` не отменит устаревший прогон.
- **Гашение диффом на пару `(model, schema)`** — шаг-схема и полная схема не мешают друг другу.
- **Headless-прогон** — `validateModel` идентичен на клиенте и в server action/юнит-тесте.
- **Показ ошибки** — `shouldShowError = invalid && (touched || dirty)` (`field-node.ts:153`).

---

## Gap в текущих доках (что устарело/не покрыто)

`projects/reformer-doc/docs/validation/validation-strategies.md`:
- Пошаговый раздел показывает **старый** `STEP_SCHEMAS[step-1]` + `makeValidationConfig`, а не
  `defineSteps` (принят в cdk в этой сессии).
- Нет опции **`{ touch: true }`** и её touch-scoping-семантики.
- Нет **`extras`** (form-level cross-field/warnings только на submit).
- **Нет Слоя B** (`updateOn`/debounce/on-blur) — при этом `overview.md:192` ссылается на эту страницу
  именно как на «`updateOn`, debounce, пошаговые формы» (сломанное обещание).
- Нет явной верхней оси **простая vs пошаговая**.

---

---

# Дизайн: единый декларативный выбор стратегии валидации

Пользователь выбрал спроектировать **единую точку выбора стратегии** (когда запускать schema-валидацию),
чтобы не разводить руками `validateModel`/`revalidateWhen`. Ниже — конкретный API и код для оценки.

## Принцип

Стратегия только решает **КОГДА** звать `validateModel` и **с каким `touch`** — движок прогона не
дублируется (роутинг ошибок, гашение диффом, отмена устаревшего через `AbortController`, дедуп по
`(model, schema)` уже в `validateModel`). Реактивные триггеры (`change`/`blur`) — тем же паттерном, что
`revalidateWhen` (`state/behaviors-value.ts:215`): один `effect`, подписка на листья модели.

Прогон **всей схемы** по триггеру (Вариант A) — раннер сам разнесёт/погасит/отменит; `cross`/`each`/
`validateWhen` работают из коробки. Адресный подпрогон под-схемы поля (Вариант B) — опт-ин на будущее
(`fieldSchemas`), не в MVP.

## Публичный API

```ts
// ── @reformer/core/validation — headless-фабрика (React-free, SSR-safe до start()) ──
export type ValidationStrategyKind = 'submit' | 'blur' | 'change' | 'afterFirstSubmit';

export interface ValidationStrategyOptions {
  strategy?: ValidationStrategyKind;    // default 'submit'
  debounce?: number;                    // мс для live-фаз ('change' и live-часть afterFirstSubmit)
  liveAfterSubmit?: 'change' | 'blur';  // default 'change' — режим после 1-го submit
}

export interface FormValidationController {
  validate(): Promise<boolean>;   // полный прогон, touch:true (submit); двигает afterFirstSubmit в live
  start(): () => void;            // арм реактивных подписок → dispose (не звать при SSR)
  dispose(): void;
  readonly isValidating: boolean;
}

export function createFormValidation<T>(
  model: FormModel<T>,
  schema: ValidationSchema<T>,     // СТАБИЛЬНАЯ ссылка (дедуп/отмена раннера)
  options?: ValidationStrategyOptions,
): FormValidationController;
```

## Эскиз реализации фабрики (ядро идеи)

```ts
import { effect } from '@preact/signals-core';
import { validateModel } from './validation-schema';
import { getNodeForSignal } from '../index';
import { eachLeafSignal } from '../state/form-model'; // новый util: обходит ВСЕ листья (вкл. элементы массивов)

export function createFormValidation(model, schema, opts = {}) {
  const { strategy = 'submit', debounce = 0, liveAfterSubmit = 'change' } = opts;
  let submitted = false, firstRun = true, timer, disposeFx;

  const run = (touch) => validateModel(model, schema, { touch });
  const runLive = () => {
    if (!debounce) return void run(false);
    clearTimeout(timer); timer = setTimeout(() => void run(false), debounce);
  };

  const arm = (readTrigger, live) => effect(() => {
    eachLeafSignal(model, readTrigger);              // change: sig.value | blur: node.touched.value → подписка
    if (firstRun) { firstRun = false; return; }      // пропустить инициализирующий прогон (как revalidateWhen)
    if (strategy === 'afterFirstSubmit' && !submitted) return;
    live();
  });

  return {
    async validate() { submitted = true; return run(true); }, // submit → touch:true (раскрыть всё)
    start() {
      const mode = strategy === 'afterFirstSubmit' ? liveAfterSubmit : strategy;
      if (mode === 'change') disposeFx = arm((sig) => void sig.value, runLive);
      else if (mode === 'blur') disposeFx = arm((sig) => void getNodeForSignal(sig)?.touched.value, () => run(false));
      // 'submit' — реактивно не арминг
      return () => this.dispose();
    },
    dispose() { clearTimeout(timer); disposeFx?.(); disposeFx = undefined; },
    get isValidating() { /* обёртка над in-flight промисом */ return false; },
  };
}
```

## React-хук (размещение — развилка core vs cdk)

```ts
export function useFormValidation<T>(args: {
  model: FormModel<T>; schema: ValidationSchema<T>;
  strategy?: ValidationStrategyKind; debounce?: number; liveAfterSubmit?: 'change' | 'blur';
}): { submit: () => Promise<boolean>; isValidating: boolean } {
  const controller = useMemo(
    () => createFormValidation(args.model, args.schema,
      { strategy: args.strategy, debounce: args.debounce, liveAfterSubmit: args.liveAfterSubmit }),
    [args.model, args.schema, args.strategy, args.debounce, args.liveAfterSubmit],
  );
  useEffect(() => controller.start(), [controller]);   // арм только на клиенте → SSR-safe
  const submit = useCallback(() => controller.validate(), [controller]);
  return { submit, isValidating: controller.isValidating };
}
```

## Использование — простая форма (стратегия = один проп)

```tsx
const registrationValidation = defineValidationSchema<RegistrationFormData>(({ model }) => { /* … */ });

// submit (сегодняшнее поведение, но декларативно):
const { submit } = useFormValidation({ model, schema: registrationValidation });
// change (живо, с дебаунсом):
const { submit } = useFormValidation({ model, schema: registrationValidation, strategy: 'change', debounce: 300 });
// blur (при потере фокуса):
const { submit } = useFormValidation({ model, schema: registrationValidation, strategy: 'blur' });
// afterFirstSubmit (тихо до 1-й отправки, дальше живо):
const { submit } = useFormValidation({ model, schema: registrationValidation, strategy: 'afterFirstSubmit' });

const onSubmit = async (e) => { e.preventDefault(); if (await submit()) await api.register(model.get()); };
```

Сегодня то же самое — руками: `form.markAsTouched(); if (await validateModel(model, schema)) …`, а для live
пришлось бы отдельно поднимать `revalidateWhen` в behavior. Новый API сводит выбор к одному пропу.

## Использование — wizard (аддитивно к defineSteps)

```tsx
const config = defineSteps<'loan'|'applicant'|'confirm', Root>(model, {
  steps: { loan: step1, applicant: step2, confirm: null },
  extras: crossFieldRules,
  strategy: 'blur',                 // НОВОЕ: внутришаговая live-стратегия (per-step gate/submit не меняются)
});

function LoanStepBody() {
  useWizardStepValidation();        // армит стратегию под под-схему ТЕКУЩЕГО шага, снимает при смене шага
  return <>{/* поля шага */}</>;
}
// FormWizard как и раньше сам зовёт config.validateStep («Далее») и config.validateAll (submit).
```

## Файлы (без кода — план правок)

- НОВЫЙ `packages/reformer/src/form/validation-strategy.ts` — типы + `createFormValidation`.
- `packages/reformer/src/form/validation-schema.ts` — `export * from './validation-strategy'` (сабпат
  `@reformer/core/validation` уже указывает сюда — `vite.config.ts:44`); сам раннер не трогаем.
- `packages/reformer/src/state/form-model.ts` — util `eachLeafSignal(model, cb)` (корректный обход, вкл. массивы).
- Хук `useFormValidation` — **core**, `packages/reformer/src/form/hooks/use-form-validation.ts`
  (рядом с `useFormControl`); реэкспорт из core index.
- Wizard: `define-steps.ts` (+`strategy?`/`stepSchemaAt`), новый `use-wizard-step-validation.ts`.
- Пример в `projects/react-playground` (registration на `useFormValidation`) — демо.

## Решения (утверждены пользователем)

1. **Объём — полный:** фабрика + хук + 4 стратегии + wizard-интеграция за один заход.
2. **Размещение хука — core** (`form/hooks/`, рядом с `useFormControl`); фабрика — в `core/validation`.
3. Всё **аддитивно** — `validateModel` не трогаем, `defineSteps` получает опциональные поля, текущая
   ручная разводка и `{validateStep,validateAll}` продолжают работать. **Мажорный релиз не нужен.**

## Фазы реализации (каждая — отдельный коммит, порядок обязателен)

**Фаза 1 — core-фабрика (headless):**
- `packages/reformer/src/state/form-model.ts` — util `eachLeafSignal(model, cb)` (обход всех листьев,
  вкл. элементы массивов; по образцу touch-обхода в `form/behaviors.ts`).
- НОВЫЙ `packages/reformer/src/form/validation-strategy.ts` — типы + `createFormValidation`
  (переиспользует `validateModel`, `getNodeForSignal`, `effect` из `@preact/signals-core`).
- `packages/reformer/src/form/validation-schema.ts` — `export * from './validation-strategy'`.
- Тесты: каждая стратегия → моменты прогона + `touch`; debounce; отмена устаревшего; dispose; массивы.

**Фаза 2 — React-хук в core:**
- НОВЫЙ `packages/reformer/src/form/hooks/use-form-validation.ts` — `useFormValidation`
  (useMemo контроллер, useEffect `start()`, useCallback `submit`, `isValidating` через useState).
  Реэкспорт из core index рядом с `useFormControl`.
- Тест хука (RTL): арм/dispose, submit раскрывает всё, смена стратегии пере-создаёт контроллер.

**Фаза 3 — wizard-интеграция (cdk):**
- `packages/reformer-cdk/src/components/form-wizard/define-steps.ts` — `DefineStepsConfig`
  +`strategy?`/`debounce?`; `WizardStepsConfig` +`stepSchemaAt(step): ValidationSchema<T> | null`.
  `validateStep`/`validateAll` не менять (аддитивно).
- НОВЫЙ `packages/reformer-cdk/src/components/form-wizard/use-wizard-step-validation.ts` —
  `useWizardStepValidation()`: читает текущий шаг из `FormWizardContext`, армит
  `createFormValidation(model, stepSchemaAt(step), {strategy})`, dispose при смене шага/unmount.
- Экспорт из form-wizard index. Тест: смена шага пере-армит под-схему; dispose снимает подписки.

**Фаза 4 — пример + верификация:**
- Мигрировать `registration-form` (или новый пример) на `useFormValidation` (`strategy:'afterFirstSubmit'`);
  wizard-шаг эталона — `blur`.
- `npm run build` (core, cdk) + `npm run typecheck` + пакетные тесты + e2e smoke.

## Риски

- `change` гоняет всю схему на каждый ввод (sync-правила O(поля)) → debounce + дифф-гашение; тяжёлый
  async гасится `AbortSignal`. Точечность — Вариант B на будущее.
- Конфликт со Слоем B (`updateOn`): если у поля есть node-валидаторы И активна schema-стратегия — оба
  пишут `_errors`. Правило: не смешивать; документировать взаимоисключение.
- Стабильность `schema` — обязанность вызывающего (иначе ломается дедуп/отмена); хук мемоизирует контроллер.
- SSR: фабрика чиста до `start()`; арм в `useEffect`.

## Verification

- Юнит-тесты фабрики: каждая стратегия → корректные моменты прогона и `touch`; отмена устаревшего; dispose.
- e2e: registration с `strategy:'afterFirstSubmit'` (тихо до submit, потом live); wizard-шаг с `blur`.
- `npm run build` затронутых пакетов + `npm run typecheck` + пакетные тесты.
- `docs/specs/` не трогать. Доки/llms — follow-up после стабилизации API.
