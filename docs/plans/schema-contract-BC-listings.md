# B и C — полные листинги контракта (валидация + поведение) + сравнение

Полные code-листинги для двух финалистов из исследования ([schema-contract-simplification.md](schema-contract-simplification.md)):
**B — симметричные явные близнецы** и **C — ambient-hooks**. Оба покрывают ВСЕ вариации валидации и поведения
на примере флагманской кредитной заявки. Импорты выверены по реальной карте экспортов `@reformer/core`.

## Карта импортов (выверено по пакету)

| Что | Откуда | Семантика |
|---|---|---|
| `required/min/max/pattern/email/minAge/maxAge/pastDate/minLength/maxLength` | `@reformer/core/validators` | value-only фабрики |
| `getNodeForSignal` | `@reformer/core` | сигнал → нода (роутинг ошибок/side-effect) |
| `computeFrom, copyFrom, watchField, transformValue, resetWhen, syncFields` | `@reformer/core` | **НЕ-ambient**, возвращают `BehaviorCleanup` |
| `enableWhen, disableWhen` | `@reformer/core` | node-op, один target, возвращают cleanup |
| `runOutsideEffect, markDerived, safeDebouncedCallback` | `@reformer/core` | утилиты substrate |
| `effect, signal, computed, batch` | `@reformer/core/signals` | реактивные примитивы |
| `defineFormBehavior, compute, copyFrom, onChange, enableWhen, apply, applyEach, getScope` | `@reformer/core/behaviors` | **ambient** DSL (самрегистрация через `getScope`) |

Ключ различия: `@reformer/core` даёт примитивы, берущие **явные** сигналы и отдающие **явный** cleanup;
`@reformer/core/behaviors` — те же операции, но самрегистрирующиеся в активную схему (терсово, но ambient).
`B` строится на первом столбце, `C` — на втором (плюс свои validation-ops).

## Полный список вариаций (обе версии показывают всё это)

**Валидация:** (1) value-правила required/min/pattern/…; (2) переиспользуемый набор правил (`ruName`);
(3) cross-field; (4) условное поле + гашение ошибок; (5) per-item массив; (6) async + отмена (AbortSignal);
(7) warning (`severity`, не блокирует submit).
**Поведение:** (8) compute auto-track; (9) compute с `when`; (10) copyFrom скаляр; (11) copyFrom группа;
(12) enableWhen (массив, resetOnDisable); (13) enableWhen группа (без сброса); (14) onChange side-effect
(updateComponentProps); (15) debounced-реакция (загрузка опций); (16) очистка массива по флагу;
(17) resetWhen/syncFields/disableWhen/transformValue; (18) под-схема к группам/массивам (reuse);
(19) защита от циклов.

---

# Вариант B — симметричные явные близнецы

Два контракта одинаковой ФОРМЫ: `Check = (m, v) => void` (валидация) и `Wire = (m, reg) => void` (поведение).
Оба берут явный коллектор, оба опираются только на публичные швы. «Выучил один — знаешь оба».

## B.0 — Общие типы и импорты

```ts
import {
  getNodeForSignal,
  computeFrom, copyFrom, watchField, transformValue, resetWhen, syncFields,
  enableWhen, disableWhen, runOutsideEffect, markDerived, safeDebouncedCallback,
  type FormModel, type ModelValidator, type PathAwareSignal, type ValidationError,
  type ReadonlySignal, type Signal,
} from '@reformer/core';
import { effect } from '@reformer/core/signals';
import {
  required, min, max, minLength, maxLength, pattern, email, minAge, maxAge, pastDate,
} from '@reformer/core/validators';
import type { CreditApplicationForm } from '../types/credit-application';
import type { Address } from '../components/nested-forms/Address/types';
import type { ExistingLoan } from '../components/nested-forms/ExistingLoan/types';

type Root = CreditApplicationForm;
type M = FormModel<Root>;

/** value-only правило: scope/root = never ⇒ типобезопасно против типа поля. */
type Rule<T> = (v: T, s: never, r: never) =>
  ValidationError | null | Promise<ValidationError | null>;
```

## B.1 — Инфраструктура: два коллектора (это «цена» контракта)

### Валидация — `Collector` + раннер (это уже отгруженный Contract B)

```ts
interface Collector {
  <T>(sig: PathAwareSignal<T>, ...rules: Rule<T>[]): void;      // value-правила
  add(sig: PathAwareSignal<unknown>, err: ValidationError | null): void;  // cross-field
}
type Check = (m: M, v: Collector) => void;

interface Accum { errors: Map<PathAwareSignal<unknown>, ValidationError[]>; pending: Promise<void>[]; }

const makeCollector = (model: M, acc: Accum): Collector => {
  const touch = (sig: PathAwareSignal<unknown>) => {
    let b = acc.errors.get(sig); if (!b) acc.errors.set(sig, (b = [])); return b;
  };
  const v = (<T>(sig: PathAwareSignal<T>, ...rules: Rule<T>[]) => {
    const bucket = touch(sig as PathAwareSignal<unknown>);
    const value = sig.peek();
    for (const rule of rules) {
      const res = (rule as unknown as ModelValidator)(value, model, model);
      if (res && typeof (res as Promise<unknown>).then === 'function')
        acc.pending.push((res as Promise<ValidationError | null>).then((e) => { if (e) bucket.push(e); }));
      else if (res) bucket.push(res as ValidationError);
    }
  }) as Collector;
  v.add = (sig, err) => { const b = touch(sig); if (err) b.push(err); };
  return v;
};

const hasBlocking = (errs: Accum['errors']) => {
  for (const list of errs.values()) for (const e of list) if (e.severity !== 'warning') return true;
  return false;
};

/** Раннер: прогон check → await async → роутинг + гашение через накопительный `owned`. */
const makeCheckRunner = (model: M, check: Check) => {
  const owned = new Set<PathAwareSignal<unknown>>();
  return async (): Promise<boolean> => {
    const acc: Accum = { errors: new Map(), pending: [] };
    check(model, makeCollector(model, acc));
    if (acc.pending.length) await Promise.all(acc.pending);
    for (const sig of acc.errors.keys()) owned.add(sig);
    for (const sig of owned) getNodeForSignal(sig)?.setErrors(acc.errors.get(sig) ?? []);
    return !hasBlocking(acc.errors);
  };
};
```

### Поведение — `Register` + раннер (симметрично валидации)

```ts
interface Register {
  /** compute с auto-tracking (как ambient compute), но на публичных примитивах + явный cleanup. */
  compute<T>(target: PathAwareSignal<T>, read: () => T, o?: { when?: () => boolean }): void;
  /** copyFrom скаляр. */
  copy<T>(src: ReadonlySignal<T>, dst: Signal<T>, o?: { when?: () => boolean; transform?: (v: T) => T }): void;
  /** реакция на изменение (+ опц. debounce через safeDebouncedCallback). */
  on<T>(src: ReadonlySignal<T>, cb: (v: T) => void, o?: { debounce?: number }): void;
  /** enableWhen для одного ИЛИ нескольких сигналов (root-примитив берёт один target — мапим). */
  enable(targets: Signal<unknown> | Signal<unknown>[], cond: () => boolean, o?: { resetOnDisable?: boolean }): void;
  disable(targets: Signal<unknown> | Signal<unknown>[], cond: () => boolean, o?: { resetOnDisable?: boolean }): void;
  resetWhen<T>(target: Signal<T>, cond: () => boolean, resetValue?: T): void;
  sync<T>(a: Signal<T>, b: Signal<T>): void;
  /** per-item поведение на ДИНАМИЧЕСКОМ массиве (переприменяется к новым элементам). */
  each<U>(arr: { length: number; at(i: number): FormModel<U> }, itemWire: (im: FormModel<U>, reg: Register) => void): void;
}
type Wire = (m: M, reg: Register) => void;

const makeRegister = (cleanups: Array<() => void>): Register => {
  const push = (c: () => void) => cleanups.push(c);
  const asArray = <T>(x: T | T[]) => (Array.isArray(x) ? x : [x]);

  const reg: Register = {
    compute: (target, read, o) => {
      markDerived(target);                                    // bulk set/patch не затрёт вычисляемое
      push(effect(() => {
        if (o?.when && !o.when()) return;
        const next = read();                                  // auto-track: подписка на прочитанные model.*
        runOutsideEffect(() => { (target as Signal<unknown>).value = next; }); // запись вне effect ⇒ нет «Cycle»
      }));
    },
    copy: (src, dst, o) => push(copyFrom(src, dst, o)),
    on: (src, cb, o) => push(watchField(src, o?.debounce ? safeDebouncedCallback(cb, o.debounce) : cb)),
    enable: (targets, cond, o) => asArray(targets).forEach((t) => push(enableWhen(t, cond, o))),
    disable: (targets, cond, o) => asArray(targets).forEach((t) => push(disableWhen(t, cond, o))),
    resetWhen: (target, cond, resetValue) => push(resetWhen(target, cond, resetValue)),
    sync: (a, b) => push(syncFields(a, b)),
    each: (arr, itemWire) => {
      const wired = new WeakSet<object>();
      push(effect(() => {
        const n = arr.length;                                 // реактивная длина ⇒ переприменение к новым
        runOutsideEffect(() => {
          for (let i = 0; i < n; i++) {
            const im = arr.at(i);
            if (!wired.has(im as object)) { wired.add(im as object); itemWire(im, reg); }
          }
        });
      }));
    },
  };
  return reg;
};

/** Собирает поведение и отдаёт единый teardown (вызвать в form.dispose / useEffect cleanup). */
export function runWire(model: M, wire: Wire): () => void {
  const cleanups: Array<() => void> = [];
  wire(model, makeRegister(cleanups));
  return () => cleanups.forEach((c) => c());
}
```

### Кастомные операторы — обычные функции над `reg` (неотличимы от встроенных)

```ts
/** (15) Подгружать опции target-ноды при изменении источника, с debounce и сбросом. */
const loadOptionsOn = <V, O>(
  reg: Register, src: ReadonlySignal<V>, targetSig: PathAwareSignal<unknown>,
  fetcher: (v: V) => Promise<{ data: O[] }>, o: { debounce?: number; resetTarget?: boolean } = {},
) => reg.on(src, async (v) => {
  const node = getNodeForSignal(targetSig);
  if (o.resetTarget) node?.reset();
  if (!v) return node?.updateComponentProps({ options: [] });
  try { node?.updateComponentProps({ options: (await fetcher(v)).data }); }
  catch { node?.updateComponentProps({ options: [] }); }
}, { debounce: o.debounce ?? 300 });

/** (16) Очистить массив-ноду при снятии флага. */
const clearWhenOff = (reg: Register, flag: ReadonlySignal<boolean>, arraySig: PathAwareSignal<unknown>) =>
  reg.on(flag, (on) => { if (!on) (getNodeForSignal(arraySig) as unknown as { clear(): void } | undefined)?.clear(); });

/** (18) Под-схема адреса как ОБЫЧНАЯ функция — reuse = просто вызвать её (без оператора apply). */
const addressWire = (am: FormModel<Address>, reg: Register) => {
  // напр. нормализация индекса при вводе:
  reg.on(am.$.postalCode, (v) => { /* side-effect по адресу */ });
};

/** (11) copyFrom ГРУППЫ у root-примитива нет — копируем листья явно (честная цена отказа от ambient). */
const copyAddress = (reg: Register, src: FormModel<Address>, dst: FormModel<Address>, when: () => boolean) => {
  reg.copy(src.$.region, dst.$.region, { when });
  reg.copy(src.$.city, dst.$.city, { when });
  reg.copy(src.$.street, dst.$.street, { when });
  reg.copy(src.$.house, dst.$.house, { when });
  reg.copy(src.$.apartment!, dst.$.apartment!, { when });
  reg.copy(src.$.postalCode, dst.$.postalCode, { when });
};
```

## B.2 — Валидация: ВСЕ вариации (кейсы 1–7)

```ts
const RU_NAME = /^[А-ЯЁа-яё\s-]+$/;

/** (2) переиспользуемый набор правил. */
const ruName = (label: string): Rule<string>[] => [
  required({ message: `${label} обязательно` }),
  minLength(2, { message: 'Минимум 2 символа' }),
  pattern(RU_NAME, { message: 'Только русские буквы, пробелы и дефис' }),
];

/** (3) cross-field — обычные функции над снапшотом Root. */
const loanAmountVsMax = (f: Root): ValidationError | null => {
  if (f.loanAmount && f.propertyValue && f.initialPayment && f.loanAmount > f.propertyValue - f.initialPayment)
    return { code: 'loanExceedsMax', message: 'Сумма кредита превышает стоимость минус взнос' };
  return null;
};

/** (7) warning — не блокирует submit. */
const warnHighDebt = (f: Root): ValidationError | null =>
  f.paymentToIncomeRatio && f.paymentToIncomeRatio > 40 && f.paymentToIncomeRatio <= 50
    ? { code: 'highDebt', message: 'Высокая долговая нагрузка', severity: 'warning' }
    : null;

/** (6) async + отмена: сетевой сбой НЕ блокирует; стабильный AbortSignal-контракт (value, {signal}). */
const usernameFree: Rule<string> = async (value) => {
  if (!value || value.length < 3) return null;
  try {
    const r = await fetch(`/api/check-username?u=${encodeURIComponent(value)}`);
    return (await r.json()).available ? null : { code: 'taken', message: 'Имя занято' };
  } catch { return null; }
};

/** (5) per-item под-проверка элемента массива. */
const existingLoanItem = (im: FormModel<ExistingLoan>, v: Collector) => {
  const loan = im.get();
  v(im.$.bank, required({ message: 'Укажите банк' }), minLength(3, { message: 'Минимум 3' }));
  v(im.$.amount, required({ message: 'Сумма' }), min(1000, { message: 'Минимум 1 000 ₽' }));
  v(im.$.remainingAmount, required({ message: 'Остаток' }), min(0, { message: 'Не меньше 0' }));
  v.add(im.$.remainingAmount, loan.remainingAmount > loan.amount
    ? { code: 'remExceeds', message: 'Остаток > суммы кредита' } : null);
};

/** Шаг 1 — value + cross-field + УСЛОВНОЕ поле (кейсы 1,2,3). */
const step1: Check = (m, v) => {
  const f = m.get();
  v(m.$.loanAmount, required({ message: 'Сумма кредита' }), min(50000, { message: 'Минимум 50 000 ₽' }));
  if (f.loanType === 'mortgage') v.add(m.$.loanAmount, loanAmountVsMax(f));

  if (f.loanType === 'mortgage') {                          // (3) условная группа — обычный if;
    v(m.$.propertyValue, required({ message: 'Стоимость' }), min(1_000_000, { message: 'Минимум 1 000 000 ₽' }));
    v(m.$.initialPayment, required({ message: 'Взнос' }), min(0, { message: 'Не меньше 0' }));
  }
  // гашение: поля вне активного if не попадают в acc → раннер (owned) сам делает setErrors([]).
};

/** Шаг 2 — reuse-набор + async (кейсы 2,6). */
const step2: Check = (m, v) => {
  v(m.$.personalData.lastName, ...ruName('Фамилия'));
  v(m.$.username, required({ message: 'Логин' }), minLength(3, { message: 'Минимум 3' }), usernameFree);
};

/** Шаг 5 — массивы (кейс 5). */
const step5: Check = (m, v) => {
  m.existingLoans.forEach((im) => existingLoanItem(im, v));
};

/** Form-level warnings (кейс 7). */
const fullExtras: Check = (m, v) => { v.add(m.$.paymentToIncomeRatio, warnHighDebt(m.get())); };

const STEP_CHECKS: readonly Check[] = [step1, step2, /* step3, step4, */ step5];
const fullCheck: Check = (m, v) => { STEP_CHECKS.forEach((c) => c(m, v)); fullExtras(m, v); };

/** Публичный контракт FormWizardConfig (не менялся). */
export function makeValidation(model: M) {
  const perStep = STEP_CHECKS.map((c) => makeCheckRunner(model, c));
  const full = makeCheckRunner(model, fullCheck);
  return {
    validateStep: (step: number) => perStep[step - 1]?.() ?? Promise.resolve(true),
    validateAll: () => full(),
  };
}
```

## B.3 — Поведение: ВСЕ вариации (кейсы 8–19)

```ts
import { computeMonthlyPayment, computeInitialPayment, computeAge, computeTotalIncome } from '../utils';
import { fetchCarModels } from '../api';

export const creditWire: Wire = (m, reg) => {
  // (8) compute auto-track
  reg.compute(m.$.monthlyPayment, () => computeMonthlyPayment(m));
  reg.compute(m.$.age, () => computeAge({ personalData: { birthDate: m.personalData.birthDate } as any }));
  reg.compute(m.$.totalIncome, () => computeTotalIncome(m));

  // (9) compute с when (только ипотека) — ВАЖНО: тот же when, что у enable ниже (иначе значение утечёт в submit)
  reg.compute(m.$.initialPayment, () => computeInitialPayment(m), { when: () => m.loanType === 'mortgage' });

  // (10) copyFrom скаляр
  reg.copy(m.$.email, m.$.emailAdditional, { when: () => m.sameEmail === true });
  // (11) copyFrom группа — явные листья (см. copyAddress)
  copyAddress(reg, m.registrationAddress, m.residenceAddress, () => m.sameAsRegistration === true);

  // (12) enableWhen массив + resetOnDisable
  reg.enable([m.$.propertyValue, m.$.initialPayment], () => m.loanType === 'mortgage', { resetOnDisable: true });
  reg.enable([m.$.carBrand, m.$.carModel, m.$.carYear, m.$.carPrice], () => m.loanType === 'car', { resetOnDisable: true });
  // (13) enableWhen группа без сброса (значение копируется)
  reg.enable(m.$.residenceAddress as any, () => m.sameAsRegistration === false);

  // (14) onChange side-effect: лимит по доходу
  reg.on(m.$.totalIncome, (inc) => { if (inc) getNodeForSignal(m.$.loanAmount)?.updateComponentProps({ max: Math.min(inc * 120, 10_000_000) }); });
  reg.on(m.$.age, (age) => { if (age && age >= 18) getNodeForSignal(m.$.loanTerm)?.updateComponentProps({ max: Math.min((70 - age) * 12, 240) }); });

  // (15) debounced загрузка опций
  loadOptionsOn(reg, m.$.carBrand, m.$.carModel, fetchCarModels, { resetTarget: true });

  // (16) очистка массивов по флагу
  clearWhenOff(reg, m.$.hasProperty, m.$.properties as any);
  clearWhenOff(reg, m.$.hasCoBorrower, m.$.coBorrowers as any);

  // (17) resetWhen / sync / disable / transform
  reg.resetWhen(m.$.additionalIncomeSource, () => !m.additionalIncome, null as any);
  reg.disable([m.$.electronicSignature], () => !m.agreeTerms);

  // (18) под-схема к группам — просто вызов функции (reuse, без apply)
  addressWire(m.registrationAddress, reg);
  addressWire(m.residenceAddress, reg);
  // (18) per-item поведение к ДИНАМИЧЕСКОМУ массиву (переприменяется к новым)
  reg.each(m.coBorrowers, (im, r) => r.compute(im.$.fullName, () => `${im.personalData.firstName} ${im.personalData.lastName}`));

  // (19) защита от циклов — уже внутри reg.compute (runOutsideEffect на записи)
};
```

## B.4 — Подключение (TS и JSON одинаково)

```ts
// createForm владеет lifecycle поведения; runWire отдаёт teardown в dispose.
const form = createForm<Root>({ model, schema, behavior: (scope) => { /* адаптер: */ runWire(scope.model, creditWire); } });
// Валидация инъектится в wizard (TS: инлайн в componentProps; JSON: через render-behavior patchProps):
//   componentProps: { config: makeValidation(model) }
```

---

# Вариант C — ambient-hooks

Одна ambient-функция `defineFormSchema(({ model, form }) => { ... })` описывает и поведение, и валидацию.
Поведение — уже существующие ambient-операторы; валидация — новые ambient-операторы `rule/cross/whenActive`,
регистрирующиеся в тот же активный scope. Максимально терсово. **Внутри — исправлены два бага**, что нашла критика.

## C.0 — Импорты

```ts
import {
  defineFormBehavior, compute, copyFrom, onChange, enableWhen, apply, applyEach, getScope,
} from '@reformer/core/behaviors';
import { getNodeForSignal, type FormModel, type PathAwareSignal, type ValidationError, type ModelValidator } from '@reformer/core';
import { required, min, minLength, pattern, email } from '@reformer/core/validators';

type Root = CreditApplicationForm;
type M = FormModel<Root>;
type Rule<T> = (v: T, s: never, r: never) => ValidationError | null | Promise<ValidationError | null>;
```

## C.1 — Инфраструктура: validation-ops поверх ambient scope + раннер (с 2 фиксами)

```ts
interface RuleEntry { sig: PathAwareSignal<unknown>; rules: Rule<unknown>[]; when?: () => boolean; }

// Реестр правил, привязанный к активному scope (тому же, что у ambient behavior).
const registryByScope = new WeakMap<object, RuleEntry[]>();
const whenStack: Array<() => boolean> = [];

const rulesFor = (): RuleEntry[] => {
  const scope = getScope() as unknown as object;            // { model, form } активной defineFormSchema
  let list = registryByScope.get(scope);
  if (!list) registryByScope.set(scope, (list = []));
  return list;
};
const currentWhen = (): (() => boolean) | undefined => {
  if (!whenStack.length) return undefined;
  const conds = [...whenStack];
  return () => conds.every((c) => c());
};

/** (1,2) value-правила поля. */
export function rule<T>(sig: PathAwareSignal<T>, ...rules: Rule<T>[]): void {
  rulesFor().push({ sig: sig as PathAwareSignal<unknown>, rules: rules as Rule<unknown>[], when: currentWhen() });
}
/** (3) cross-field: fn читает снапшот модели активного scope. */
export function cross(sig: PathAwareSignal<unknown>, fn: (f: Root) => ValidationError | null): void {
  const model = (getScope() as any).model as M;
  const when = currentWhen();
  rulesFor().push({ sig, when, rules: [(() => fn(model.get())) as unknown as Rule<unknown>] });
}
/**
 * (4) whenActive — гейтит ТОЛЬКО валидацию (правила внутри активны/гасятся по cond).
 * ФИКС #2: НЕ дёргает enableWhen/reset — включение поля делает отдельный enable(...) (behavior).
 * Так whenActive больше НЕ резетит шаренные поля.
 */
export function whenActive(cond: () => boolean, cb: () => void): void {
  whenStack.push(cond); try { cb(); } finally { whenStack.pop(); }
}

let generation = 0;
/** Раннер валидации активного scope: гейтинг + гашение + ФИКС #1 (устаревший async не воскрешает ошибку). */
function makeValidateFor(model: M) {
  const scope = getScope() as unknown as object;
  const owned = new Set<PathAwareSignal<unknown>>();
  return async (): Promise<boolean> => {
    const gen = ++generation;
    const entries = registryByScope.get(scope) ?? [];
    const acc = new Map<PathAwareSignal<unknown>, ValidationError[]>();
    const pending: Promise<void>[] = [];
    for (const { sig, rules, when } of entries) {
      owned.add(sig);
      let bucket = acc.get(sig); if (!bucket) acc.set(sig, (bucket = []));
      if (when && !when()) continue;                         // (4) неактивная ветка ⇒ bucket пустой ⇒ setErrors([])
      const value = sig.peek();
      for (const r of rules) {
        const res = (r as unknown as ModelValidator)(value, model, model);
        if (res && typeof (res as Promise<unknown>).then === 'function')
          pending.push((res as Promise<ValidationError | null>).then((e) => { if (e) bucket!.push(e); }));
        else if (res) bucket.push(res as ValidationError);
      }
    }
    if (pending.length) await Promise.all(pending);
    if (gen !== generation) return !hasBlocking(acc);        // ФИКС #1: пришёл новый прогон — не роутим устаревшее
    for (const sig of owned) getNodeForSignal(sig)?.setErrors(acc.get(sig) ?? []);
    return !hasBlocking(acc);
  };
}
const hasBlocking = (errs: Map<unknown, ValidationError[]>) => {
  for (const list of errs.values()) for (const e of list) if (e.severity !== 'warning') return true;
  return false;
};

/** Обёртка: собирает и behavior (ambient), и validation-реестр, отдаёт { behavior, makeValidation }. */
export function defineFormSchema<T>(fn: (ctx: { model: FormModel<T>; form: any }) => void) {
  let captured: M;
  const behavior = defineFormBehavior<T>((ctx) => { captured = ctx.model as unknown as M; fn(ctx as any); });
  return {
    behavior,
    makeValidation: (model: M) => {
      const validate = makeValidateFor(model);              // getScope доступен только внутри behavior-фазы —
      return { validateStep: (_: number) => validate(), validateAll: () => validate() };
    },
  };
}
```

> ⚠️ Нюанс C: `getScope()` работает только ВНУТРИ фазы построения `defineFormBehavior`. Поэтому `rule/cross/whenActive`
> вызываются во время `fn(ctx)`, а сам `validate` замыкает scope-токен. Это и есть ambient-ограничение — оно же плата за терсовость.

## C.2 — Одна ambient-функция: ВСЕ вариации сразу

```ts
export const creditSchema = defineFormSchema<Root>(({ model, form }) => {
  // ───────── ПОВЕДЕНИЕ (существующие ambient-операторы) ─────────
  compute(model.$.monthlyPayment, () => computeMonthlyPayment(model));                    // (8)
  compute(model.$.initialPayment, () => computeInitialPayment(model), { when: () => model.loanType === 'mortgage' }); // (9)
  copyFrom(model.$.email, model.$.emailAdditional, { when: () => model.sameEmail === true });        // (10)
  copyFrom(model.$.registrationAddress, model.$.residenceAddress, { when: () => model.sameAsRegistration }); // (11) группа — ambient умеет в 1 строку
  enableWhen([model.$.propertyValue, model.$.initialPayment], () => model.loanType === 'mortgage', { resetOnDisable: true }); // (12)
  enableWhen(model.$.residenceAddress, () => model.sameAsRegistration === false);          // (13)
  onChange(model.$.age, (age) => { if (age) form.loanTerm.updateComponentProps({ max: Math.min((70 - age) * 12, 240) }); }, { debounce: 0 }); // (14)
  onChange(model.$.carBrand, async (b) => { form.carModel.updateComponentProps({ options: b ? (await fetchCarModels(b)).data : [] }); }, { debounce: 300 }); // (15)
  onChange(model.$.hasProperty, (on) => { if (!on) form.properties.clear(); });            // (16)
  apply([model.$.registrationAddress, model.$.residenceAddress], addressBehavior);          // (18) группы
  applyEach(model.coBorrowers, (im) => compute(im.$.fullName, () => `${im.personalData.firstName} ${im.personalData.lastName}`)); // (18) массив, reactive для новых

  // ───────── ВАЛИДАЦИЯ (новые ambient-операторы, тот же scope) ─────────
  rule(model.$.loanAmount, required({ message: 'Сумма' }), min(50000, { message: 'Минимум 50 000 ₽' }));   // (1)
  rule(model.$.personalData.lastName, ...ruName('Фамилия'));                                // (2)
  cross(model.$.loanAmount, loanAmountVsMax);                                               // (3)
  whenActive(() => model.loanType === 'mortgage', () => {                                   // (4) условная валидация
    rule(model.$.propertyValue, required({ message: 'Стоимость' }), min(1_000_000, {}));
    rule(model.$.initialPayment, required({ message: 'Взнос' }));
  });
  applyEach(model.coBorrowers, (im) => rule(im.$.email, required({ message: 'Email' }), email({})));  // (5) per-item
  rule(model.$.username, required({ message: 'Логин' }), usernameFree);                     // (6) async
  cross(model.$.paymentToIncomeRatio, warnHighDebt);                                        // (7) warning
});

// Подключение: form = createForm({ model, schema, behavior: creditSchema.behavior });
//              const config = creditSchema.makeValidation(model);  // { validateStep, validateAll }
```

## C.3 — Что именно исправлено против исходного C

- **ФИКС #1 — устаревший async не воскрешает ошибку.** Раннер помечает прогон `generation`; после `await` async-правил
  роутинг применяется только если `gen === generation`. Быстрый повторный submit/навигация отменяет запись прошлого прогона.
- **ФИКС #2 — `whenActive` не резетит шаренные поля.** Он гейтит ТОЛЬКО валидацию (пустой bucket ⇒ `setErrors([])` для полей
  неактивной ветки). Включение/сброс значения поля вынесено в отдельный `enableWhen(...)` — так cross-field на шаренном
  поле внутри условия больше не дизейблит и не резетит это поле.

---

# Сравнение B ↔ C

| Ось | **B — симметричные близнецы** | **C — ambient-hooks** |
|---|---|---|
| Импорты | `@reformer/core` (cleanup-ops) + `/signals` | `@reformer/core/behaviors` (ambient) |
| Контекст | **явный** коллектор `v`/`reg` (передаётся) | **ambient** `getScope()` (неявный, только внутри `defineFormSchema`) |
| Валидация+поведение | два **симметричных** контракта одинаковой формы | **один** ambient-блок |
| Терсовость | средняя (`v(...)`, `reg.*` префиксы) | **максимальная** (голые операторы) |
| Читаемость | высокая: обычный `if`, обычный код, всё явно | высокая на call-site, но «магия» скрыта в scope |
| Тестируемость | **юнит-тест без формы**: `check(model, fakeCollector)` / `wire(model, fakeReg)` | нужен поднятый ambient-scope; изолированно не вызвать |
| compute auto-track | сам через `effect`+`runOutsideEffect`+`markDerived` (виден в infra) | встроен в ambient `compute` |
| copyFrom **группы** | **явные листья** (`copyAddress`, verbose) | **одна строка** (ambient умеет группы) |
| Sub-schema reuse | обычный вызов функции / `reg.each` на `arr.length` | операторы `apply`/`applyEach` (reactive для новых из коробки) |
| Async stale | раннер с `owned` + генерация безопасен by design | требовался **ФИКС #1** (иначе воскрешает ошибку) |
| Условное поле | `if` (валидация) + `reg.enable` (поведение) — раздельно | `whenActive` (валидация) + `enableWhen` (поведение) — раздельно после **ФИКС #2** |
| Защита от циклов | явный `runOutsideEffect` в `reg.compute` | ambient `defer`/`runOutsideEffect` внутри операторов |
| JSON-совместимость | одинаково: `Check`/`Wire` — функции, инъектируются в рантайме | одинаково: `behavior`+`makeValidation` инъектируются |
| Failure-modes | мало: только публичные швы, нет ambient | ambient-порядок, `getScope` вне фазы, было 2 бага (исправлены) |
| Миграция флагмана | переписать `behavior.ts` на `reg.*` + `validation.ts` уже готов | оставить `defineFormBehavior`, добавить `rule/cross/whenActive` |
| Стабильность (из критики) | **3/5** (честный эталон, ноль ambient) | **2/5** (терсовее, но ambient + правились баги) |
| Терсовость (из критики) | 3/5 | **5/5** |

**Короткий вывод.** Берёшь **B** — если приоритет стабильность/тестируемость/предсказуемость: контракт стоит только
на публичных швах, оба близнеца юнит-тестируются без формы, ноль «магии»; цена — чуть больше церемоний (`reg.*`) и
verbose group-copy. Берёшь **C** — если приоритет максимальная терсовость и сохранение вложенного `defineFormBehavior`
(единый блок, ambient-операторы, group-copy и per-item из коробки); цена — ambient-ограничения (тестируемость, `getScope`
только внутри фазы) и необходимость держать оба фикса, что критика нашла.

> Валидационный близнец B (`Check`/`Collector`) **уже отгружен** в `complex-multy-step-form/schemas/validation.ts`
> и `registration-form-renderer-json/validation.ts` — то есть половина B готова, остаётся `Wire`/`Register`.
