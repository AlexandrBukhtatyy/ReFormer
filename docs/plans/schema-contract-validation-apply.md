# Валидация: шаги как функции + `apply` + внешний раннер (имена `validate`/`validateWhen`/`validateAsync`)

Ревизия схемы валидации из [two-ambient listing](schema-contract-two-ambient-listing.md): **без `step`**, с именами
операторов как в старом (удалённом) path-based API ReFormer — `validate(...)` вместо `rule`, `validateWhen(...)` вместо `whenActive`,
плюс отдельный `validateAsync(...)` для асинхронных правил. **`validate` принимает массив валидаторов** вторым аргументом.

## Как я понял

- Каждый шаг — **отдельная функция-схема** (`step1Validation`, `step2Validation`, …), обычная JS-функция над моделью.
- В валидацию всей формы шаги **добавляются через `apply(...)`** (композиция под-схем) — `apply` заменяет `step`.
- Провалидировать можно что угодно **внешним раннером**: передал схему одного шага — провалидировал шаг; схему формы — всё.
- Операторы: **`validate(field, [rules])`** (было `rule`, теперь массив), **`validateAsync(field, [asyncRules])`** (async),
  **`validateWhen(cond, cb)`** (было `whenActive`), `cross`, `each`.

> ⚠️ **Коллизия имён.** Ты называл внешний раннер `validate(model, schema)`, но раз оператор поля теперь тоже `validate`,
> я переименовал раннер в **`runValidation(model, schema)`** — иначе один символ означал бы и «провалидировать поле правилами»,
> и «прогнать схему по модели». Если хочешь другое имя раннера (напр. `validateSchema`, `check`) — скажи.

```
runValidation(model, step2Validation)   // провалидировать ТОЛЬКО шаг 2
runValidation(model, formValidation)     // форма = apply(...всех шагов) → провалидировать всё
```

---

## 1. Инфраструктура — `runValidation` + операторы (`validate`/`validateAsync`/`validateWhen`/`cross`/`each`/`apply`)

```ts
import { getNodeForSignal, type FormModel, type PathAwareSignal, type ValidationError } from '@reformer/core';

type Rule<T> = (v: T) => ValidationError | null;                       // синхронное правило
type AsyncRule<T> = (v: T) => Promise<ValidationError | null>;         // асинхронное правило

/** Схема валидации — ОБЫЧНАЯ функция над (под)моделью. First-class значение. */
export type ValidationSchema<T> = (ctx: { model: FormModel<T> }) => void;

interface VScope {
  model: FormModel<unknown>;
  errors: Map<PathAwareSignal<unknown>, ValidationError[]>;
  pending: Promise<void>[];
  whenStack: Array<() => boolean>;
}
let VS: VScope | null = null;
const vs = (): VScope => { if (!VS) throw new Error('validation op called outside runValidation()'); return VS; };
const touch = (sig: PathAwareSignal<unknown>) => {
  const m = vs().errors; let b = m.get(sig); if (!b) m.set(sig, (b = [])); return b;
};
const gated = () => vs().whenStack.every((c) => c());
const hasBlocking = (errs: Map<unknown, ValidationError[]>) => {
  for (const l of errs.values()) for (const e of l) if (e.severity !== 'warning') return true;
  return false;
};

// ── ambient-операторы ──

/** Синхронные правила поля (было `rule`). Вторым аргументом — МАССИВ. Типобезопасно против типа сигнала. */
export function validate<T>(sig: PathAwareSignal<T>, rules: Rule<T>[]): void {
  const bucket = touch(sig as PathAwareSignal<unknown>);   // touch ⇒ поле участвует ⇒ попадёт в очистку
  if (!gated()) return;                                    // выключенная validateWhen-ветка ⇒ bucket пуст ⇒ setErrors([])
  const value = sig.peek();
  for (const r of rules) { const e = r(value); if (e) bucket.push(e); }
}
/** Асинхронные правила поля (зеркалит движковое `asyncValidators`). Раннер их дожидается. */
export function validateAsync<T>(sig: PathAwareSignal<T>, rules: AsyncRule<T>[]): void {
  const bucket = touch(sig as PathAwareSignal<unknown>);
  if (!gated()) return;
  const value = sig.peek();
  for (const r of rules) vs().pending.push(r(value).then((e) => { if (e) bucket.push(e); }));
}
/** cross-field: fn читает снапшот модели (для warning верните `severity:'warning'`). */
export function cross<T>(sig: PathAwareSignal<unknown>, fn: (f: T) => ValidationError | null): void {
  const bucket = touch(sig);
  if (!gated()) return;
  const e = fn(vs().model.get() as T); if (e) bucket.push(e);
}
/** Условная валидация (было `whenActive`): правила внутри активны/гасятся по cond. */
export function validateWhen(cond: () => boolean, cb: () => void): void {
  vs().whenStack.push(cond); try { cb(); } finally { vs().whenStack.pop(); }
}
/** per-item: применить правила к каждому элементу текущего массива. */
export function each<U>(arr: { length: number; at(i: number): FormModel<U> }, itemFn: (im: FormModel<U>) => void): void {
  for (let i = 0; i < arr.length; i++) itemFn(arr.at(i));
}
/** apply — КОМПОЗИЦИЯ под-схем в текущую (заменяет step). Все под-схемы над той же моделью. */
export function apply<T>(...schemas: ValidationSchema<T>[]): void {
  const model = vs().model as FormModel<T>;
  for (const s of schemas) s({ model });
}

// ── внешний раннер ──

// owned на пару (model, schema): runValidation(model, step2) и runValidation(model, form) не мешают друг другу гасить ошибки.
const ownedBy = new WeakMap<object, WeakMap<object, Set<PathAwareSignal<unknown>>>>();
let generation = 0;

/** Провалидировать модель ЛЮБОЙ схемой (шаг или вся форма). true, если нет блокирующих ошибок. */
export async function runValidation<T>(model: FormModel<T>, schema: ValidationSchema<T>): Promise<boolean> {
  let perSchema = ownedBy.get(model as object);
  if (!perSchema) ownedBy.set(model as object, (perSchema = new WeakMap()));
  let owned = perSchema.get(schema);
  if (!owned) perSchema.set(schema, (owned = new Set()));

  const gen = ++generation;
  const scope: VScope = { model: model as FormModel<unknown>, errors: new Map(), pending: [], whenStack: [] };
  VS = scope;
  try { schema({ model }); } finally { VS = null; }         // регистрация синхронна; ambient-окно закрыто
  if (scope.pending.length) await Promise.all(scope.pending); // ← дожидаемся validateAsync
  for (const s of scope.errors.keys()) owned.add(s);
  if (gen === generation)                                    // не устаревший прогон — только тогда роутим/гасим
    for (const s of owned) getNodeForSignal(s)?.setErrors(scope.errors.get(s) ?? []);
  return !hasBlocking(scope.errors);
}
```

Операторы `validate/validateAsync/validateWhen/cross/each/apply` ambient, но контролируемо: живут только во время
синхронного прогона `schema` внутри одного `runValidation()`; снаружи бросают понятную ошибку.

---

## 2. Схемы шагов — каждый шаг отдельная функция

Тип формы `LoanForm` и sync-хелперы (`ruName`, cross-field) — из [предыдущего листинга](schema-contract-two-ambient-listing.md).

### async-правила (для `validateAsync`) — сетевой сбой НЕ блокирует

```ts
/** Проверка кода из СМС (демо: 123456). */
const smsValid: AsyncRule<string> = async (value) => {
  if (!value || value.length !== 6) return null;
  await new Promise((r) => setTimeout(r, 200));
  return value !== '123456' ? { code: 'sms', message: 'Неверный код (демо: 123456)' } : null;
};

/** Проверка ИНН в реестре: сбой сети → null (не блокируем submit). */
const innRegistered: AsyncRule<string> = async (value) => {
  if (!/^\d{12}$/.test(value)) return null;
  try {
    const res = await fetch(`/api/check-inn?inn=${encodeURIComponent(value)}`);
    return (await res.json()).ok ? null : { code: 'innUnknown', message: 'ИНН не найден в реестре' };
  } catch { return null; }
};
```

### шаги

```ts
import { required, min, max, minLength, maxLength, pattern, email, minAge } from '@reformer/core/validators';

type M = FormModel<LoanForm>;

// ── Шаг 1 — кредит: value + cross-field + УСЛОВНЫЕ ветки ──
export const step1Validation: ValidationSchema<LoanForm> = ({ model }) => {
  validate(model.$.loanAmount, [required({ message: 'Сумма кредита' }), min(50000, { message: 'Минимум 50 000 ₽' }), max(10_000_000, {})]);
  validate(model.$.loanTerm, [required({ message: 'Срок' }), min(6, {}), max(240, {})]);
  validate(model.$.loanPurpose, [required({ message: 'Цель' }), minLength(10, {}), maxLength(500, {})]);
  validateWhen(() => model.loanType === 'mortgage', () => {
    validate(model.$.propertyValue, [required({ message: 'Стоимость' }), min(1_000_000, { message: 'Минимум 1 000 000 ₽' })]);
    validate(model.$.initialPayment, [required({ message: 'Взнос' }), min(0, {})]);
    cross(model.$.loanAmount, loanVsProperty);
  });
  validateWhen(() => model.loanType === 'car', () => {
    validate(model.$.carBrand, [required({ message: 'Марка' }), minLength(2, {})]);
    validate(model.$.carModel, [required({ message: 'Модель' })]);
    validate(model.$.carYear, [required({ message: 'Год' }), min(2000, {})]);
    validate(model.$.carPrice, [required({ message: 'Цена' }), min(300000, {})]);
  });
};

// ── Шаг 2 — личные: reuse-набор + ASYNC (проверка ИНН) ──
export const step2Validation: ValidationSchema<LoanForm> = ({ model }) => {
  validate(model.$.lastName, ruName('Фамилия'));           // ruName возвращает Rule<string>[] — массив уже готов
  validate(model.$.firstName, ruName('Имя'));
  validate(model.$.middleName, ruName('Отчество'));
  validate(model.$.birthDate, [required({ message: 'Дата рождения' }), minAge(18, { message: 'Не младше 18' })]);
  validate(model.$.gender, [required({ message: 'Пол' })]);
  validate(model.$.passportSeries, [required({ message: 'Серия' }), pattern(/^\d{2}\s\d{2}$/, { message: '00 00' })]);
  validate(model.$.inn, [required({ message: 'ИНН' }), pattern(/^\d{12}$/, { message: '12 цифр' })]);
  validateAsync(model.$.inn, [innRegistered]);             // ← async: сначала формат (sync), потом реестр (async)
};

// ── Шаг 3 — контакты: cross-field + условный адрес (reuse под-схемы адреса ОБЫЧНЫМ вызовом) ──
export const step3Validation: ValidationSchema<LoanForm> = ({ model }) => {
  validate(model.$.phoneMain, [required({ message: 'Телефон' }), pattern(PHONE, { message: '+7 (___) ___-__-__' })]);
  validate(model.$.phoneAdditional, [pattern(PHONE, { message: '+7 (___) ___-__-__' })]);
  cross(model.$.phoneAdditional, phoneDiffers);
  validate(model.$.email, [required({ message: 'Email' }), email({ message: 'Некорректный email' })]);
  // схема адреса — это функция над FormModel<Address>: применяем к под-модели прямым вызовом
  addressValidation({ model: model.registrationAddress });
  validateWhen(() => model.sameAsRegistration === false, () => addressValidation({ model: model.residenceAddress }));
};

// ── Шаг 4 — занятость: условные ветки + cross-field ──
export const step4Validation: ValidationSchema<LoanForm> = ({ model }) => {
  validate(model.$.employmentStatus, [required({ message: 'Статус занятости' })]);
  validateWhen(() => model.employmentStatus === 'employed', () => {
    validate(model.$.companyName, [required({ message: 'Компания' }), minLength(3, {})]);
    validate(model.$.companyInn, [required({ message: 'ИНН компании' }), pattern(/^\d{10}$/, { message: '10 цифр' })]);
    validate(model.$.position, [required({ message: 'Должность' })]);
  });
  validateWhen(() => model.employmentStatus === 'selfEmployed', () => {
    validate(model.$.businessInn, [required({ message: 'ИНН ИП' }), pattern(/^\d{12}$/, { message: '12 цифр' })]);
  });
  validate(model.$.monthlyIncome, [required({ message: 'Доход' }), min(10000, { message: 'Минимум 10 000 ₽' })]);
  cross(model.$.additionalIncomeSource, incomeSourceRequired);
};

// ── Шаг 5 — активы: per-item массивы ──
export const step5Validation: ValidationSchema<LoanForm> = ({ model }) => {
  validate(model.$.maritalStatus, [required({ message: 'Семейное положение' })]);
  validate(model.$.dependents, [required({ message: 'Иждивенцы' }), min(0, {}), max(10, {})]);
  each(model.coBorrowers, (im) => {
    validate(im.$.lastName, ruName('Фамилия'));
    validate(im.$.email, [required({ message: 'Email созаёмщика' }), email({})]);
    validate(im.$.monthlyIncome, [required({ message: 'Доход' }), min(10000, {})]);
  });
  each(model.existingLoans, (im) => {
    const loan = im.get();
    validate(im.$.bank, [required({ message: 'Банк' }), minLength(3, {})]);
    validate(im.$.amount, [required({ message: 'Сумма' }), min(1000, {})]);
    cross(im.$.remainingAmount, () => loan.remainingAmount > loan.amount ? { code: 'remExceeds', message: 'Остаток > суммы' } : null);
  });
};

// ── Шаг 6 — подтверждение: sync-правила + ASYNC (код из СМС) ──
export const step6Validation: ValidationSchema<LoanForm> = ({ model }) => {
  validate(model.$.agreeTerms, [required({ message: 'Согласие с условиями' })]);
  validate(model.$.confirmAccuracy, [required({ message: 'Подтверждение точности' })]);
  validate(model.$.smsCode, [required({ message: 'Код из СМС' }), pattern(/^\d{6}$/, { message: '6 цифр' })]);
  validateAsync(model.$.smsCode, [smsValid]);              // ← async: формат sync, серверная проверка async
};

// ── Переиспользуемая под-схема адреса: функция над FormModel<Address> ──
export const addressValidation: ValidationSchema<Address> = ({ model }) => {
  validate(model.$.region, [required({ message: 'Регион' }), minLength(2, {})]);
  validate(model.$.city, [required({ message: 'Город' }), minLength(2, {})]);
  validate(model.$.street, [required({ message: 'Улица' }), minLength(3, {})]);
  validate(model.$.house, [required({ message: 'Дом' })]);
  validate(model.$.postalCode, [required({ message: 'Индекс' }), pattern(/^\d{6}$/, { message: '6 цифр' })]);
};

// ── Form-level extras (warning) — отдельная схема ──
export const formExtras: ValidationSchema<LoanForm> = ({ model }) => {
  cross(model.$.paymentToIncomeRatio, warnHighDebt);       // severity:'warning' — не блокирует
};
```

---

## 3. Композиция формы через `apply` + внешняя валидация

```ts
/** Валидация ВСЕЙ формы = apply(...всех шагов, extras). apply заменяет step. */
export const formValidation: ValidationSchema<LoanForm> = ({ model }) => {
  apply(
    step1Validation, step2Validation, step3Validation,
    step4Validation, step5Validation, step6Validation,
    formExtras,
  );
};

// Порядок шагов для wizard'а (validateStep по индексу).
const STEP_SCHEMAS: ValidationSchema<LoanForm>[] = [
  step1Validation, step2Validation, step3Validation,
  step4Validation, step5Validation, step6Validation,
];

/** Конфиг FormWizard: и per-step, и полная — через ОДИН внешний runValidation(model, schema). */
export function makeValidationConfig(model: M) {
  return {
    validateStep: (n: number) => runValidation(model, STEP_SCHEMAS[n - 1]),   // провалидировать один шаг
    validateAll: () => runValidation(model, formValidation),                  // провалидировать всё
  };
}

// ── использование напрямую, ВНЕ схемы ──
await runValidation(model, step2Validation);   // провалидировать шаг 2 (включая async-проверку ИНН)
await runValidation(model, formValidation);    // перед submit (дожидается всех validateAsync)
await runValidation(model.registrationAddress, addressValidation);  // даже под-модель — тем же раннером
```

Каждая `stepNValidation` — самостоятельное значение: её можно передать в `runValidation`, скомпоновать в другую схему
через `apply`, применить к под-модели прямым вызовом, и юнит-тестировать без формы (`runValidation(fakeModel, step1Validation)`).

---

## 4. Поведение — без изменений

Схема поведения (`defineFormBehavior`) остаётся ровно как в разделе 3 [предыдущего листинга](schema-contract-two-ambient-listing.md) —
второй независимый канал (`createForm({ behavior })`). Здесь менялась только валидация.

---

## Имена и что изменилось vs `step()`

Имена операторов совпадают со старым (удалённым) path-based API ReFormer — только теперь над M1-моделью (сигналы `model.$.x`),
а не над путями:

| Роль | Старый API (path) | Сейчас (M1-модель) |
|---|---|---|
| правило поля (sync) | `validate(path.x, …)` | `validate(model.$.x, [rules])` |
| async-правило | `validateAsync(path.x, …)` | `validateAsync(model.$.x, [asyncRules])` |
| условная валидация | `validateWhen(…)` | `validateWhen(() => …, () => …)` |
| внешний прогон | (движок/submit) | `runValidation(model, schema)` |

| | Было (`step` / `rule`) | Стало |
|---|---|---|
| Шаг | `step(2, () => { … })` | отдельная функция `step2Validation` |
| Композиция формы | одна схема со `step`-блоками | `apply(step1Validation, …, formExtras)` |
| Валидация шага | `validateStep(2)` фильтровал по номеру | `runValidation(model, step2Validation)` |
| Оператор поля | `rule(sig, …rules)` (variadic) | `validate(sig, [rules])` (массив) |
| Async | смешивался с sync в `rule` | отдельный `validateAsync(sig, [asyncRules])` |
| Условие | `whenActive(cond, cb)` | `validateWhen(cond, cb)` |
| Раннер | `stepFilter`/`currentStep`/`inScope` | **проще**: `owned` на пару (model, schema) |

Оператор `step` удалён; его роль («что валидируем») теперь — **выбор функции-схемы**, передаваемой в `runValidation`.
`apply` собирает шаги в форму. Sync/async разделены (`validate`/`validateAsync`) как `validators`/`asyncValidators` в движке.
Генерация против stale-async и `owned`-гашение — как раньше.
