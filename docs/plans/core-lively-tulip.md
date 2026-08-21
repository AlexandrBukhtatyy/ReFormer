# Свой DSL поверх ядра: анализ швов + листинги

> Статус: **аналитическая записка + эскизы**, не план имплементации. Вопрос был «можно ли»,
> ответ и варианты — ниже; что из этого делать, решает пользователь.

## Context

Вопрос: можно ли поверх `@reformer/core` написать собственный DSL для схем **поведения** и
**валидации** — и как он должен выглядеть, чтобы его было одинаково удобно и ревьюить человеку,
и генерировать моделью.

Сегодня в ядре два DSL-контракта одного стиля (`defineFormBehavior` / `defineValidationSchema`,
см. [contract-spec.md](contract-spec.md)), а сериализуемый DSL есть только у **layout**
(`@reformer/renderer-json` с операторами `$model(...)`/`$component(...)`). Правила и поведение в
JSON намеренно не выражаются —
[06-validation.md](../../packages/reformer-renderer-json/docs/llms/06-validation.md) фиксирует это
как решение: «JSON-DSL несёт только layout». Ниша «DSL для правил и поведения» открыта.

Выбранные рамки (из уточнения): расписать все четыре формы записи, покрыть **обе схемы одним
артефактом**, и удержать **и** типобезопасность, **и** сериализуемость — ценой объёма.

---

## 1. Короткий ответ

**Да.** Ядро спроектировано под это явно, швов три — от самого дешёвого к самому мощному.

| Уровень | Шов | Что даёт | Цена |
|---|---|---|---|
| **L0. Примитивы** | `computeFrom`/`copyFrom`/`watchField`/… из `@reformer/core` и `/model` — возвращают `cleanup` | любой рантайм поверх, вплоть до своего движка | lifecycle на себе |
| **L1. Свои операторы** | публичный набор авторинга `onDispose` / `getScope` / `effect` / `defer` из `@reformer/core/behaviors` | новые операторы, **неотличимые от встроенных** на месте вызова | нет — это штатный путь |
| **L2. Свой контракт схемы** | `defineFormBehavior(fn)` / `defineValidationSchema(fn)` принимают **любую** функцию; `createCoreForm` принимает результат | компилировать свои данные (TS-литерал или JSON) в вызовы операторов | компилятор ~50 строк |

Опоры, найденные в коде:

- [behaviors/context.ts:77](../../packages/reformer/src/form/behaviors/context.ts#L77) — секция буквально
  названа «Низкоуровневый набор авторинга» (`effect`, `defer`), выше — `onDispose` и `getScope`
  («escape hatch для кросс-операторов»). Всё это **экспортируется** из сабпата
  ([behaviors/index.ts:30](../../packages/reformer/src/form/behaviors/index.ts#L30)).
- [behaviors/index.ts:8](../../packages/reformer/src/form/behaviors/index.ts#L8) — формулировка дизайна:
  «пользовательские операторы пишутся так же и **неотличимы от встроенных**».
- [tests/behaviors/custom-operators.ts](../../packages/reformer/tests/behaviors/custom-operators.ts) —
  готовый эталон пользовательских операторов с пометкой «это НЕ часть публичного API — намеренно;
  такие операторы пишутся в пользовательском коде».
- Мост «строка ↔ сигнал» публичен в обе стороны: `model.signalAt(path)`
  ([model/types.ts:213](../../packages/reformer/src/model/types.ts#L213)) и `PathAwareSignal.__path`
  ([model/types.ts:25](../../packages/reformer/src/model/types.ts#L25)) — достаточно для сериализуемого DSL.
- **Готовая «розетка» для DSL** — [create-core-form.ts:36](../../packages/reformer/src/form/create-core-form.ts#L36):
  `CreateFormConfigBase<T, B>` = `{ initial | model, behavior, validation, seed, setup }` +
  `CoreForm<T> = { model, form, validation? }`. Оба существующих DSL (`createReactForm`,
  `createJsonForm`) повторяют её один в один — новый DSL встраивается тем же способом и бесплатно
  получает совместимость с `useFormBundle`, `FormWizard` и `defineSteps`.

**Асимметрия, которую надо знать.** У behaviors набор авторинга публичный; у validation
`requireCtx`/`touch`/`gated`/`runWithContext` внутренние — наружу
([validation/index.ts](../../packages/reformer/src/form/validation/index.ts)) торчат только операторы.
Практического ограничения нет: `cross(sig, () => err)` — универсальный выход (любая ошибка любой
`severity` на любой сигнал), а `ValidationSchema<T>` — обычная функция, которую можно собрать из
данных. Новый *примитив* валидации написать нельзя, новый *DSL* — можно.

**Кодогенерация не нужна.** `defineFormBehavior` не выполняет `setup` немедленно — он упаковывает
его и открывает ambient-окно в `__run`, который зовёт `createForm`
([context.ts:59](../../packages/reformer/src/form/behaviors/context.ts#L59)). Значит `setup` может быть
замыканием, построенным из данных в рантайме. То же у `defineValidationSchema` (identity-обёртка) и
раннера `validateModel`. DSL получается **интерпретатором**, а не эмиттером кода.

---

## 2. Ключевая идея: один артефакт, три выхода

Ядро держит валидацию и поведение раздельно намеренно (снапшот vs живые подписки), и на
**исполнении** это правильно. Но у *авторства* границы другие: одна бизнес-ветка («ипотечные поля»)
сегодня пишется трижды и в трёх местах может разъехаться:

```ts
// поведение
compute(model.$.initialPayment, () => model.propertyValue * 0.2, { when: () => model.loanType === 'mortgage' });
enableWhen([model.$.propertyValue, model.$.initialPayment], () => model.loanType === 'mortgage', { resetOnDisable: true });
// валидация — то же условие, другой файл
validateWhen(() => model.loanType === 'mortgage', () => { validate(model.$.propertyValue, [required(), min(1_000_000)]); });
```

Риск не гипотетический: MCP-гайд `add-behavior.md` держит отдельное правило о том, что `compute` и
`enableWhen({ resetOnDisable })` на одном поле обязаны нести **один и тот же** `when`, иначе мусор
доедет до submit — а ядро этого не проверяет.

Отсюда форма DSL: **артефакт авторства один, каналов исполнения три**, `when` объявляется ровно раз.

```
                        ┌─ behavior       → createForm({ behavior })
FieldSpec (одна строка) ─┼─ validation     → FormValidation<T> → buildValidation / validateModel
                        └─ renderBehavior → hideWhen(selector)   (опционально, слой рендера)
```

Третий канал — потому что `visible/hidden` в ядре нет вообще: `enableWhen`/`disableWhen` управляют
только `disabled` через статус-машину ноды, а скрытие живёт в `RenderBehaviorFn`
(`hideWhen` / `node(selector).setHidden`) пакета `@reformer/renderer-react`. Единый `when`
естественно закрывает и его.

---

## 3. Листинг 1 — словарь DSL (типы)

Весь язык — один тип на поле. Осознанно плоский: одна строка = одно поле, ключ = путь.

```ts
// dsl/types.ts
import type { ValidationError } from '@reformer/core';
import type { AsyncRule, Rule } from '@reformer/core/validation';

/** Точечные пути по форме T. Шаблон — Path<T> из renderer-json/src/operators.ts:45. */
type Path<T, D extends unknown[] = []> = D['length'] extends 5
  ? never
  : T extends object
    ? { [K in keyof T & string]: T[K] extends object ? K | `${K}.${Path<T[K], [...D, 0]>}` : K }[keyof T & string]
    : never;
type At<T, P> = P extends `${infer K}.${infer R}`
  ? K extends keyof T ? At<T[K], R> : never
  : P extends keyof T ? T[P] : never;

export interface FieldSpec<T, V> {
  /** ОДНА ветка на поле → enableWhen + compute.when + validateWhen (+ hideWhen). */
  when?: (m: T) => boolean;
  /** Шаг визарда: компилятор сам разложит правила в FormValidation.steps. */
  step?: string;
  // ── поведение
  compute?: (m: T) => V;
  copyFrom?: Path<T>;
  transform?: (v: V) => V;
  onChange?: (v: V, ctx: { signal: AbortSignal }) => void;
  debounce?: number;
  // ── валидация
  rules?: Rule<V>[];
  asyncRules?: AsyncRule<V>[];
  cross?: (m: T) => ValidationError | null;
}

export type Spec<T> = { [P in Path<T>]?: FieldSpec<T, At<T, P>> };
export const defineSpec = <T,>(s: Spec<T>): Spec<T> => s;   // identity, ради вывода типов
```

---

## 4. Листинг 2 — компилятор (единственный новый код)

```ts
// dsl/compile.ts
import type { FormModel, FormValidation, Signal } from '@reformer/core';
import type { FormBehavior } from '@reformer/core/behaviors';
import {
  defineFormBehavior, compute, copyFrom, enableWhen, transformValue, onChange,
} from '@reformer/core/behaviors';
import {
  defineValidationSchema, validate, validateAsync, validateWhen, cross,
  type ValidationSchema,
} from '@reformer/core/validation';
import type { FieldSpec, Spec } from './types';

type Entry<T> = [string, FieldSpec<T, never>];

export function compileSpec<T extends object>(
  spec: Spec<T>,
  opts: Pick<FormValidation<T>, 'strategy' | 'debounce'> = {}
): { behavior: FormBehavior<T>; validation: FormValidation<T> } {
  const entries = Object.entries(spec) as Entry<T>[];
  const sig = (m: FormModel<T>, path: string) => {
    const s = m.signalAt(path);
    if (!s) throw new Error(`[spec] неизвестный путь "${path}"`);
    return s;
  };

  // ── канал 1: поведение (живые подписки, lifecycle у формы)
  const behavior = defineFormBehavior<T>(({ model }) => {
    const m = model as unknown as T;               // value-proxy: чтение поля = реактивная подписка
    for (const [path, f] of entries) {
      const target = sig(model, path) as Signal<never>;
      const when = f.when && (() => f.when!(m));
      if (f.compute) compute(target, () => f.compute!(m) as never, when && { when });
      if (f.copyFrom) copyFrom(sig(model, f.copyFrom), target, { when });
      if (f.transform) transformValue(target, f.transform as never);
      if (f.onChange) onChange(target, f.onChange as never, { debounce: f.debounce });
      if (when) enableWhen(target, when, { resetOnDisable: true }); // ветка выключена ⇒ поле чистое
    }
  });

  // ── канал 2: валидация (снапшот, прогон по требованию)
  const rulesOf = (list: Entry<T>[]): ValidationSchema<T> =>
    defineValidationSchema<T>(({ model }) => {
      const m = model as unknown as T;
      for (const [path, f] of list) {
        const target = sig(model, path);
        const body = () => {
          if (f.rules) validate(target, f.rules as never);
          if (f.asyncRules) validateAsync(target, f.asyncRules as never);
          if (f.cross) cross(target, f.cross as never);
        };
        if (f.when) validateWhen(() => f.when!(m), body);
        else body();
      }
    });

  // Поля с `step` → FormValidation.steps (per-step gate визарда), остальные → extras (только submit).
  const byStep = new Map<string | null, Entry<T>[]>();
  for (const e of entries) {
    const key = e[1].step ?? null;
    if (!byStep.has(key)) byStep.set(key, []);
    byStep.get(key)!.push(e);
  }
  const loose = byStep.get(null) ?? [];
  byStep.delete(null);

  const validation: FormValidation<T> = byStep.size
    ? {
        steps: Object.fromEntries([...byStep].map(([s, l]) => [s, rulesOf(l)])),
        ...(loose.length ? { extras: rulesOf(loose) } : {}),
        ...opts,
      }
    : { schema: rulesOf(loose), ...opts };

  return { behavior, validation };
}
```

Ни одного обхода приватного API: `signalAt`, все операторы, обе `define*`-обёртки и тип
`FormValidation<T>` публичны. Сборка формы — штатной фабрикой, спрэдом:

```ts
import { createCoreForm } from '@reformer/core';

const { model, form, validation } = createCoreForm<CreditForm>({
  initial: INITIAL,
  schema: (m) => layout(m),          // layout отдельно — DSL правил его не трогает
  ...compileSpec(creditSpec, { strategy: 'afterFirstSubmit', debounce: 400 }),
});
// validation — готовый бандл: validateStep / validateAll / controller (армится useFormBundle)
```

---

## 5. Листинг 3 — как это читается на месте (data-first TS)

Один экран покрывает и правила, и поведение; ветка `mortgage` объявлена по разу на поле.

```ts
// credit.spec.ts
import { defineSpec } from './dsl/types';
import { required, min, max, pattern, email } from '@reformer/core/validators';

const isMortgage = (m: CreditForm) => m.loanType === 'mortgage';

export const creditSpec = defineSpec<CreditForm>({
  loanType:        { step: 'loan', rules: [required()] },
  loanAmount:      { step: 'loan', rules: [required(), min(50_000), max(10_000_000)] },
  loanTerm:        { step: 'loan', rules: [required(), min(6), max(240)] },

  propertyValue:   { step: 'loan', when: isMortgage, rules: [required(), min(1_000_000)] },
  initialPayment:  { step: 'loan', when: isMortgage, compute: (m) => Math.round(m.propertyValue * 0.2) },

  monthlyPayment:  { compute: (m) => annuity(m.loanAmount, m.loanTerm, m.interestRate) },
  totalIncome:     { compute: (m) => m.monthlyIncome + m.additionalIncome },

  inn:             { step: 'applicant',
                     transform: (v) => (v ?? '').replace(/\D/g, '').slice(0, 12),
                     rules: [required(), pattern(/^\d{12}$/)] },

  email:           { step: 'contacts', rules: [required(), email()] },
  emailAdditional: { step: 'contacts', when: (m) => m.sameEmail, copyFrom: 'email' },
  confirmEmail:    { step: 'contacts',
                     cross: (m) => m.email !== m.confirmEmail
                       ? { code: 'email-mismatch', message: 'Email не совпадает' } : null },

  carModel:        { when: (m) => m.loanType === 'car', debounce: 300,
                     onChange: async (_, { signal }) => loadModels(signal) },
});
```

Что здесь важно для ревью: у поля `propertyValue` условие, правила и (на соседней строке) его
вычисляемый спутник видны одним взглядом; разъехаться `when` между тремя каналами физически нечему.

---

## 6. Листинг 4 — тот же артефакт как чистый JSON

Форма записи та же, но выражения заменены закрытым словарём тегов, а функции адресуются по имени
из реестра — приём уже принят в renderer-json как `$fn(...)`.

```json
{
  "loanAmount":      { "step": "loan", "rules": ["required", ["min", 50000], ["max", 10000000]] },
  "propertyValue":   { "step": "loan", "when": ["eq", "loanType", "mortgage"],
                       "rules": ["required", ["min", 1000000]] },
  "initialPayment":  { "step": "loan", "when": ["eq", "loanType", "mortgage"],
                       "compute": ["fn", "pct20", "propertyValue"] },
  "monthlyPayment":  { "compute": ["fn", "annuity", "loanAmount", "loanTerm", "interestRate"] },
  "inn":             { "step": "applicant", "transform": ["fn", "digits12"],
                       "rules": ["required", ["pattern", "^\\d{12}$"]] },
  "emailAdditional": { "step": "contacts", "when": ["truthy", "sameEmail"], "copyFrom": "email" }
}
```

Сообщений в JSON нет специально: встроенные фабрики кладут в ошибку `code` + `params`
(`min` → `{ code:'min', params:{ min, actual } }`), а текст резолвит `createMessageResolver(table)`
из `@reformer/cdk` — то есть локализация не растекается по схеме.

Интерпретатор переводит JSON в тот же `Spec<T>`, и компилятор из §4 переиспользуется как есть:

```ts
// dsl/from-json.ts
import type { FormModel } from '@reformer/core';
import { required, min, max, minLength, pattern } from '@reformer/core/validators';
import type { Spec } from './types';

const RULES = { required, min, max, minLength, pattern: (re: string) => pattern(new RegExp(re)) };
const mkRule = (r: string | unknown[]) =>
  typeof r === 'string'
    ? RULES[r as keyof typeof RULES]()
    : RULES[r[0] as keyof typeof RULES](...(r.slice(1) as never));

/** read(path) — реактивное чтение: подписка нужна и для when, и для compute. */
const evalExpr = (e: unknown[], read: (p: string) => unknown): boolean => {
  const [op, a, b] = e as [string, string, unknown];
  switch (op) {
    case 'eq':     return read(a) === b;
    case 'ne':     return read(a) !== b;
    case 'gt':     return (read(a) as number) > (b as number);
    case 'in':     return (b as unknown[]).includes(read(a));
    case 'truthy': return Boolean(read(a));
    case 'not':    return !evalExpr(a as unknown as unknown[], read);
    default: throw new Error(`[spec] неизвестный оператор "${op}"`);
  }
};

export function specFromJson<T extends object>(
  json: Record<string, Record<string, unknown>>,
  fns: Record<string, (...a: never[]) => unknown>,
  model: FormModel<T>
): Spec<T> {
  const read = (p: string) => model.signalAt(p)!.value;   // .value, НЕ model.get() — иначе нет подписки
  const call = (e: unknown[]) => fns[e[1] as string](...((e.slice(2) as string[]).map(read) as never[]));
  const out: Record<string, unknown> = {};
  for (const [path, f] of Object.entries(json)) {
    out[path] = {
      step:      f.step,
      copyFrom:  f.copyFrom,
      when:      f.when      ? () => evalExpr(f.when as unknown[], read) : undefined,
      compute:   f.compute   ? () => call(f.compute as unknown[]) : undefined,
      transform: f.transform ? (fns[(f.transform as unknown[])[1] as string] as (v: unknown) => unknown) : undefined,
      rules:     (f.rules as (string | unknown[])[] | undefined)?.map(mkRule),
    };
  }
  return out as Spec<T>;
}
```

Так закрываются оба приоритета: **сериализуемое ядро** (JSON — хранится в БД, приходит с сервера,
диффается, проверяется мета-схемой) и **типизированный фасад** над той же формой записи (§3–§5:
опечатка в пути и несовпадение типа правила — ошибка компиляции). Плата честная и видимая:
inline-функция в TS-варианте делает спеку несериализуемой; сериализуемым остаётся только
`["fn", …]`.

---

## 7. Листинг 5 — доменные операторы (минимум инфраструктуры)

Если компилятор не нужен, а нужен словарь предметной области — пишутся обычные функции поверх
набора авторинга. Нового слоя нет, синтаксис ядра сохраняется.

```ts
// schemas/operators.ts
import {
  onChange, transformValue, enableWhen, effect, onDispose, getScope,
  type ReadonlySignal, type Signal,
} from '@reformer/core/behaviors';

/** ИНН/СНИЛС/индекс: только цифры, фиксированная длина. Идемпотентно ⇒ цикла нет. */
export const digitsMask = (t: Signal<string>, len: number) =>
  transformValue(t, (v) => (v ?? '').replace(/\D/g, '').slice(0, len));

/** Ветка формы: одно условие — включение + очистка при выключении. */
export const branch = (targets: object[], cond: () => boolean) =>
  enableWhen(targets, cond, { resetOnDisable: true });

/** Свой примитив: автосохранение черновика (effect + onDispose — как у встроенных операторов). */
export function autosave(key: string, ms = 1000): void {
  const { model } = getScope<unknown>();
  let timer: ReturnType<typeof setTimeout>;
  effect(() => {
    const snapshot = (model as { $: ReadonlySignal<unknown> }).$.value;  // подписка на всю модель
    clearTimeout(timer);
    timer = setTimeout(() => localStorage.setItem(key, JSON.stringify(snapshot)), ms);
  });
  onDispose(() => clearTimeout(timer));
}
```

На месте вызова неотличимо от встроенных операторов:

```ts
export const creditBehavior = defineFormBehavior<CreditForm>(({ model }) => {
  digitsMask(model.$.inn, 12);
  branch([model.$.propertyValue, model.$.initialPayment], () => model.loanType === 'mortgage');
  autosave('credit-draft');
});
```

---

## 8. Листинг 6 — fluent-фасад (сахар над тем же спеком)

Второго рантайма нет: цепочка просто собирает `FieldSpec` из §3.

```ts
// dsl/fluent.ts
import { required, min, max } from '@reformer/core/validators';
import type { FieldSpec } from './types';

const wrap = <T, V>(s: FieldSpec<T, V>) => ({
  required: () => wrap<T, V>({ ...s, rules: [...(s.rules ?? []), required()] }),
  min: (n: number) => wrap<T, V>({ ...s, rules: [...(s.rules ?? []), min(n) as never] }),
  max: (n: number) => wrap<T, V>({ ...s, rules: [...(s.rules ?? []), max(n) as never] }),
  when: (c: (m: T) => boolean) => wrap<T, V>({ ...s, when: c }),
  computed: (fn: (m: T) => V) => wrap<T, V>({ ...s, compute: fn }),
  done: (): FieldSpec<T, V> => s,
});
export const field = <T, V>() => wrap<T, V>({});
```

```ts
export const creditSpec = defineSpec<CreditForm>({
  loanAmount:     field<CreditForm, number>().required().min(50_000).max(10_000_000).done(),
  initialPayment: field<CreditForm, number>().when(isMortgage).computed((m) => m.propertyValue * 0.2).done(),
});
```

Честная оценка: на коротких полях чуть приятнее, но `.done()` — шум, а для статического анализа и
генерации цепочка хуже литерала (нужно исполнить, чтобы узнать содержимое). Держать как
**необязательный** фасад, канонической формой считать литерал.

---

## 9. Сравнение вариантов

| | Ревью человеком | Генерация моделью | Статическая проверка | Сериализуемость | Новый код |
|---|---|---|---|---|---|
| **§5 TS-литерал** | лучший diff: поле = строка | отличная: закрытая форма, порядок вызовов не важен | полная (пути, типы правил) | нет (inline-функции) | компилятор ~50 строк |
| **§6 JSON** | хуже (нет типов в редакторе) | лучшая: чистые данные | мета-схемой + резолв путей в рантайме | да | + интерпретатор ~30 строк |
| **§7 операторы** | как сейчас | средняя: свободный порядок вызовов | только `tsc` | нет | ~0 |
| **§8 fluent** | приятно на коротких | хуже литерала | полная | нет | ~15 строк |

Отдельный довод за data-формы, связанный именно с ИИ: MCP-инструмент `check_behaviors`
([check-behaviors.ts](../../packages/reformer-mcp/src/tools/check-behaviors.ts)) сегодня требует,
чтобы агент **вручную продекларировал** `{ target, reads }` — потому что схема поведения это код, а
зависимости `compute` определяются авто-трекингом в рантайме. В data-DSL граф выводится из спеки
механически (в `compute: ["fn", name, ...args]` аргументы и есть `reads`), значит проверку на циклы
можно гонять в CI, а не просить агента переписать её от руки.

---

## 10. Границы — чего DSL не даст

- **Порядок пересчёта не меняется.** Граф строит `@preact/signals-core`; порядок записей в спеке ни
  на что не влияет. Детект циклов остаётся рантайм-эвристикой (peek-guard + перехват preact-ошибки
  «Cycle detected» в [internals.ts](../../packages/reformer/src/form/behaviors/internals.ts)).
  Статический анализ появляется только поверх data-формы.
- **Новый примитив валидации не пишется** — авторинг-набор validation внутренний (§1); всё
  выражается через `validate`/`cross`.
- **`visible/hidden` не в ядре** — третий канал (`hideWhen`) обязан идти в `RenderBehaviorFn`
  рендер-слоя и адресуется по `selector`, а не по пути модели.
- **Массивы требуют вложенной формы записи.** У поведения — `applyEach(model.$.items, itemBehavior)`
  (принимает `FormBehavior`, не колбэк), у валидации — `each(model.items, (im) => …)` (принимает
  колбэк и **value-proxy**, не `$`). Плоский ключ `items.0.amount` для них не годится; нужен узел
  `items: { each: { …FieldSpec… } }` — в листингах опущен, добавляется одним полем и одной веткой
  в каждом канале компилятора.
- **Нодами становятся только top-level массивы** — `createFormFromModel` обходит `Object.entries`
  корневой формы модели; вложенный `a.b.items` живёт только в модели.
- **Два синтаксиса пути.** Модель: `items.0.name` (`resolveSignalAt` режет по `.`). Форма:
  `items[0].name` (`GroupNode.getFieldByPath` парсит `key[index]`). DSL, резолвящий пути в обе
  стороны, обязан конвертировать.
- **Коллизия имён.** `computeFrom`/`copyFrom`/`enableWhen` экспортируются И из `@reformer/core`
  (возвращают cleanup), И из `@reformer/core/behaviors` (регистрируют cleanup сами). Импортировать
  только явным сабпатом.
- **Один рантайм сигналов обязателен.** Harvest в `createForm` различает лист по
  `value instanceof Signal`; `Signal` берётся только из `@reformer/core/signals`. Второй экземпляр
  `@preact/signals-core` в графе зависимостей — и поля молча теряют конфиг.
- **`Path<T>` придётся продублировать**: сегодня он живёт в
  [renderer-json/src/operators.ts:45](../../packages/reformer-renderer-json/src/operators.ts#L45), то
  есть в рендер-пакете. DSL правил и поведения от рендера зависеть не должен.
- **Инференса «конфиг → тип модели» в ядре нет** — везде явный generic `T`. DSL наследует это:
  тип формы объявляет разработчик, DSL проверяет пути и типы правил против него.

---

## 11. Как проверить, что это работает

От самого дешёвого доказательства к полному:

1. **Точечный тест компилятора** рядом с существующими —
   `packages/reformer/tests/behaviors/`, запуск `npm test -w @reformer/core` (в корне агрегированного
   `test` нет, это заглушка). Проверить, что одна запись с `when` даёт и `disabled` на поле, и
   гашение правил (образцы — `f6.test.ts`, `scenarios.test.ts`,
   `tests/core/validation/validate-model-schema.test.ts`).
2. **Эквивалентность живому примеру.** Взять
   `projects/react-playground/src/pages/examples/mcp-credit-application-core-v20/` (`form.behavior.ts`
   + `validation.ts` — там уже есть и `validateWhen`, и `each`, и cross-field), переписать в спеку и
   сравнить поведение формы: e2e из
   `projects/react-playground-e2e/tests/pages/complex-multy-step-form/` переиспользуются как есть.
3. **JSON-ветка**: та же спека, поданная строкой через `specFromJson`, должна давать тот же результат
   на тех же тестах — это и есть доказательство «одно ядро, два входа».
4. **Статический контур**: вывести из спеки граф `{ target, reads }` и скормить
   `mcp__reformer__check_behaviors` — убедиться, что цикл ловится до рантайма.
5. **Границы слоёв**: `npm run typecheck` и `npm run lint` из корня. ESLint запрещает
   `src/model/** → src/form/**` и React в `src/form/**`; отдельный пакет DSL этими правилами не
   связан, но повторить разделение стоит.
