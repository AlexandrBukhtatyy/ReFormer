# Две ambient-схемы (валидация ⟂ поведение) — листинг многошаговой формы

Синтаксис C2 (одна ambient-функция, голые операторы), но **валидация и UI-поведение — ДВЕ раздельные схемы**:

- **`defineBehaviorSchema`** — реактивное UI-поведение (= существующий `defineFormBehavior` из `@reformer/core/behaviors`);
- **`defineValidationSchema`** — только валидация (новый ambient-раннер того же терсового стиля).

Оба контракта ambient и терсовые, но независимы: поведение кормится в `createForm({ behavior })`, валидация — в конфиг wizard'а
(`{ validateStep, validateAll }`). Разделение concern'ов сохранено; «магии» одного блока-на-всё нет.

```
┌─ defineValidationSchema(({model}) => { step/rule/cross/whenActive/each }) ─→ { validateStep, validateAll } ─→ FormWizard
└─ defineBehaviorSchema(({model, form}) => { compute/copyFrom/enableWhen/onChange/apply }) ─→ createForm({ behavior })
```

---

## 0. Тип многошаговой формы (компактный, но покрывает все сценарии)

```ts
interface Address { region: string; city: string; street: string; house: string; apartment?: string; postalCode: string; }
interface CoBorrower { firstName: string; lastName: string; email: string; monthlyIncome: number; relationship: string; fullName: string; }
interface ExistingLoan { bank: string; amount: number; remainingAmount: number; maturityDate: string; }

interface LoanForm {
  // Шаг 1 — кредит
  loanType: 'consumer' | 'mortgage' | 'car';
  loanAmount: number; loanTerm: number; loanPurpose: string;
  propertyValue: number; initialPayment: number;                 // условные (ипотека)
  carBrand: string; carModel: string; carYear: number; carPrice: number; // условные (авто)
  // Шаг 2 — личные
  firstName: string; lastName: string; middleName: string; birthDate: string; gender: string;
  passportSeries: string; inn: string;
  age: number; fullName: string;                                 // вычисляемые
  // Шаг 3 — контакты
  phoneMain: string; phoneAdditional: string; email: string; emailAdditional: string; sameEmail: boolean;
  registrationAddress: Address; residenceAddress: Address; sameAsRegistration: boolean;
  // Шаг 4 — занятость
  employmentStatus: 'employed' | 'selfEmployed' | 'unemployed';
  companyName: string; companyInn: string; position: string; businessInn: string;
  monthlyIncome: number; additionalIncome: number; additionalIncomeSource: string;
  totalIncome: number; paymentToIncomeRatio: number;             // вычисляемые
  // Шаг 5 — активы/массивы
  maritalStatus: string; dependents: number;
  hasProperty: boolean; hasCoBorrower: boolean;
  coBorrowers: CoBorrower[]; existingLoans: ExistingLoan[];
  // Шаг 6 — подтверждение
  agreeTerms: boolean; confirmAccuracy: boolean; smsCode: string;
}
```

---

## 1. Инфраструктура ВАЛИДАЦИИ — `defineValidationSchema` (новый ambient-раннер)

Это Contract B, но с **ambient-коллектором** (голый `rule(...)` вместо `v(...)`) и хелперами `step/whenActive/each`.
Ambient-окно контролируемое: коллектор жив только на время синхронного прогона `fn` внутри одного `validate()`;
операторы вне прогона бросают. Функция **пере-прогоняется** на каждый `validate` (как Contract B) — поэтому `whenActive`,
`each`, `cross` естественно считают текущее состояние.

```ts
import {
  getNodeForSignal, type FormModel, type PathAwareSignal, type ValidationError,
} from '@reformer/core';

type M = FormModel<LoanForm>;
type Rule<T> = (v: T) => ValidationError | null | Promise<ValidationError | null>;

interface VScope {
  model: M;
  errors: Map<PathAwareSignal<unknown>, ValidationError[]>;
  pending: Promise<void>[];
  stepFilter: number | null;      // null = validateAll
  currentStep: number | null;     // проставляет step()
  whenStack: Array<() => boolean>; // активные whenActive-условия
}

let VS: VScope | null = null;
const vs = (): VScope => { if (!VS) throw new Error('validation op called outside validate()'); return VS; };
const touch = (sig: PathAwareSignal<unknown>) => {
  const m = vs().errors; let b = m.get(sig); if (!b) m.set(sig, (b = [])); return b;
};
// поле участвует в ЭТОМ прогоне: validateAll — всегда; validateStep(n) — только текущий шаг n
const inScope = () => { const c = vs(); return c.stepFilter === null || c.currentStep === c.stepFilter; };
const gated = () => vs().whenStack.every((c) => c());  // все активные whenActive истинны
const hasBlocking = (errs: Map<unknown, ValidationError[]>) => {
  for (const l of errs.values()) for (const e of l) if (e.severity !== 'warning') return true;
  return false;
};

// ── ambient-операторы валидации ──

/** Группировка по шагу wizard'а. */
export function step(n: number, cb: () => void): void {
  const c = vs(); const prev = c.currentStep; c.currentStep = n;
  try { cb(); } finally { c.currentStep = prev; }
}
/** value-правила поля (типобезопасны против типа сигнала). */
export function rule<T>(sig: PathAwareSignal<T>, ...rules: Rule<T>[]): void {
  if (!inScope()) return;                       // не наш шаг — не трогаем (ни очистки, ни проверки)
  const bucket = touch(sig as PathAwareSignal<unknown>);   // наш шаг ⇒ участвует ⇒ попадёт в очистку
  if (!gated()) return;                         // выключенная whenActive-ветка ⇒ bucket пуст ⇒ setErrors([])
  const value = sig.peek();
  for (const r of rules) {
    const res = r(value);
    if (res && typeof (res as Promise<unknown>).then === 'function')
      vs().pending.push((res as Promise<ValidationError | null>).then((e) => { if (e) bucket.push(e); }));
    else if (res) bucket.push(res as ValidationError);
  }
}
/** cross-field: fn читает снапшот модели. Для warning верните `severity:'warning'`. */
export function cross(sig: PathAwareSignal<unknown>, fn: (f: LoanForm) => ValidationError | null): void {
  if (!inScope()) return;
  const bucket = touch(sig);
  if (!gated()) return;
  const e = fn(vs().model.get()); if (e) bucket.push(e);
}
/** условная валидация: правила внутри активны/гасятся по cond (НЕ трогает enable — это дело поведения). */
export function whenActive(cond: () => boolean, cb: () => void): void {
  vs().whenStack.push(cond); try { cb(); } finally { vs().whenStack.pop(); }
}
/** per-item: применить правила к каждому элементу текущего массива. */
export function each<U>(arr: { length: number; at(i: number): FormModel<U> }, itemFn: (im: FormModel<U>) => void): void {
  for (let i = 0; i < arr.length; i++) itemFn(arr.at(i));
}

/** Фабрика: одна ambient-схема → { validateStep, validateAll }. Пер-фильтровый owned + генерация против stale-async. */
export function defineValidationSchema(fn: (ctx: { model: M }) => void) {
  return (model: M) => {
    const ownedBy = new Map<number | 'all', Set<PathAwareSignal<unknown>>>();
    let generation = 0;
    const run = async (stepFilter: number | null): Promise<boolean> => {
      const gen = ++generation;
      const key = stepFilter ?? 'all';
      let owned = ownedBy.get(key); if (!owned) ownedBy.set(key, (owned = new Set()));
      const scope: VScope = { model, errors: new Map(), pending: [], stepFilter, currentStep: null, whenStack: [] };
      VS = scope;
      try { fn({ model }); } finally { VS = null; }          // регистрация синхронна; ambient-окно закрыто
      if (scope.pending.length) await Promise.all(scope.pending);
      for (const s of scope.errors.keys()) owned.add(s);
      if (gen === generation)                                 // не устаревший прогон — только тогда роутим/гасим
        for (const s of owned) getNodeForSignal(s)?.setErrors(scope.errors.get(s) ?? []);
      return !hasBlocking(scope.errors);
    };
    return { validateStep: (n: number) => run(n), validateAll: () => run(null) };
  };
}
```

---

## 2. Схема ВАЛИДАЦИИ — одна ambient-функция, все сценарии, по шагам

```ts
import { required, min, max, minLength, maxLength, pattern, email, minAge } from '@reformer/core/validators';

const RU_NAME = /^[А-ЯЁа-яё\s-]+$/;
const PHONE = /^\+7\s\(\d{3}\)\s\d{3}-\d{2}-\d{2}$/;

// переиспользуемый набор правил (ФИО)
const ruName = (label: string): Rule<string>[] => [
  required({ message: `${label} обязательно` }),
  minLength(2, { message: 'Минимум 2 символа' }),
  pattern(RU_NAME, { message: 'Только русские буквы, пробелы и дефис' }),
];

// cross-field (обычные функции над снапшотом)
const loanVsProperty = (f: LoanForm): ValidationError | null =>
  f.loanAmount && f.propertyValue && f.initialPayment && f.loanAmount > f.propertyValue - f.initialPayment
    ? { code: 'loanExceedsMax', message: 'Сумма кредита превышает стоимость минус взнос' } : null;
const phoneDiffers = (f: LoanForm): ValidationError | null =>
  f.phoneAdditional && f.phoneMain === f.phoneAdditional
    ? { code: 'phoneDup', message: 'Доп. телефон должен отличаться' } : null;
const incomeSourceRequired = (f: LoanForm): ValidationError | null =>
  f.additionalIncome > 0 && !f.additionalIncomeSource
    ? { code: 'srcReq', message: 'Укажите источник дополнительного дохода' } : null;
// warning — не блокирует submit
const warnHighDebt = (f: LoanForm): ValidationError | null =>
  f.paymentToIncomeRatio > 40 && f.paymentToIncomeRatio <= 50
    ? { code: 'highDebt', message: 'Высокая долговая нагрузка', severity: 'warning' } : null;

// async + отмена: сетевой сбой НЕ блокирует
const smsValid: Rule<string> = async (value) => {
  if (!value || value.length !== 6) return null;
  await new Promise((r) => setTimeout(r, 200));
  return value !== '123456' ? { code: 'sms', message: 'Неверный код (демо: 123456)' } : null;
};

export const loanValidation = defineValidationSchema(({ model }) => {
  // ── Шаг 1 — кредит: value + cross-field + УСЛОВНОЕ (whenActive) ──
  step(1, () => {
    rule(model.$.loanAmount, required({ message: 'Сумма кредита' }), min(50000, { message: 'Минимум 50 000 ₽' }), max(10_000_000, {}));
    rule(model.$.loanTerm, required({ message: 'Срок' }), min(6, {}), max(240, {}));
    rule(model.$.loanPurpose, required({ message: 'Цель' }), minLength(10, {}), maxLength(500, {}));
    whenActive(() => model.loanType === 'mortgage', () => {
      rule(model.$.propertyValue, required({ message: 'Стоимость' }), min(1_000_000, { message: 'Минимум 1 000 000 ₽' }));
      rule(model.$.initialPayment, required({ message: 'Взнос' }), min(0, {}));
      cross(model.$.loanAmount, loanVsProperty);           // cross-field активен только при ипотеке
    });
    whenActive(() => model.loanType === 'car', () => {
      rule(model.$.carBrand, required({ message: 'Марка' }), minLength(2, {}));
      rule(model.$.carModel, required({ message: 'Модель' }));
      rule(model.$.carYear, required({ message: 'Год' }), min(2000, {}));
      rule(model.$.carPrice, required({ message: 'Цена' }), min(300000, {}));
    });
  });

  // ── Шаг 2 — личные: reuse-набор + возраст ──
  step(2, () => {
    rule(model.$.lastName, ...ruName('Фамилия'));
    rule(model.$.firstName, ...ruName('Имя'));
    rule(model.$.middleName, ...ruName('Отчество'));
    rule(model.$.birthDate, required({ message: 'Дата рождения' }), minAge(18, { message: 'Не младше 18' }));
    rule(model.$.gender, required({ message: 'Пол' }));
    rule(model.$.passportSeries, required({ message: 'Серия' }), pattern(/^\d{2}\s\d{2}$/, { message: '00 00' }));
    rule(model.$.inn, required({ message: 'ИНН' }), pattern(/^\d{12}$/, { message: '12 цифр' }));
  });

  // ── Шаг 3 — контакты: cross-field + условный адрес проживания ──
  step(3, () => {
    rule(model.$.phoneMain, required({ message: 'Телефон' }), pattern(PHONE, { message: '+7 (___) ___-__-__' }));
    rule(model.$.phoneAdditional, pattern(PHONE, { message: '+7 (___) ___-__-__' }));
    cross(model.$.phoneAdditional, phoneDiffers);
    rule(model.$.email, required({ message: 'Email' }), email({ message: 'Некорректный email' }));
    // адрес регистрации — всегда; адрес проживания — только если отличается
    addressRules(model.registrationAddress);
    whenActive(() => model.sameAsRegistration === false, () => addressRules(model.residenceAddress));
  });

  // ── Шаг 4 — занятость: условные ветки + cross-field ──
  step(4, () => {
    rule(model.$.employmentStatus, required({ message: 'Статус занятости' }));
    whenActive(() => model.employmentStatus === 'employed', () => {
      rule(model.$.companyName, required({ message: 'Компания' }), minLength(3, {}));
      rule(model.$.companyInn, required({ message: 'ИНН компании' }), pattern(/^\d{10}$/, { message: '10 цифр' }));
      rule(model.$.position, required({ message: 'Должность' }));
    });
    whenActive(() => model.employmentStatus === 'selfEmployed', () => {
      rule(model.$.businessInn, required({ message: 'ИНН ИП' }), pattern(/^\d{12}$/, { message: '12 цифр' }));
    });
    rule(model.$.monthlyIncome, required({ message: 'Доход' }), min(10000, { message: 'Минимум 10 000 ₽' }));
    cross(model.$.additionalIncomeSource, incomeSourceRequired);
  });

  // ── Шаг 5 — активы: per-item массивы ──
  step(5, () => {
    rule(model.$.maritalStatus, required({ message: 'Семейное положение' }));
    rule(model.$.dependents, required({ message: 'Иждивенцы' }), min(0, {}), max(10, {}));
    each(model.coBorrowers, (im) => {
      rule(im.$.lastName, ...ruName('Фамилия'));
      rule(im.$.email, required({ message: 'Email созаёмщика' }), email({}));
      rule(im.$.monthlyIncome, required({ message: 'Доход' }), min(10000, {}));
    });
    each(model.existingLoans, (im) => {
      const loan = im.get();
      rule(im.$.bank, required({ message: 'Банк' }), minLength(3, {}));
      rule(im.$.amount, required({ message: 'Сумма' }), min(1000, {}));
      cross(im.$.remainingAmount, () => loan.remainingAmount > loan.amount
        ? { code: 'remExceeds', message: 'Остаток > суммы' } : null);
    });
  });

  // ── Шаг 6 — подтверждение: async ──
  step(6, () => {
    rule(model.$.agreeTerms, required({ message: 'Согласие с условиями' }));
    rule(model.$.confirmAccuracy, required({ message: 'Подтверждение точности' }));
    rule(model.$.smsCode, required({ message: 'Код из СМС' }), pattern(/^\d{6}$/, { message: '6 цифр' }), smsValid);
  });

  // ── Form-level warning (вне step ⇒ только validateAll) ──
  cross(model.$.paymentToIncomeRatio, warnHighDebt);
});

// под-набор адреса — обычная функция (reuse без операторов)
function addressRules(am: FormModel<Address>): void {
  rule(am.$.region, required({ message: 'Регион' }), minLength(2, {}));
  rule(am.$.city, required({ message: 'Город' }), minLength(2, {}));
  rule(am.$.street, required({ message: 'Улица' }), minLength(3, {}));
  rule(am.$.house, required({ message: 'Дом' }));
  rule(am.$.postalCode, required({ message: 'Индекс' }), pattern(/^\d{6}$/, { message: '6 цифр' }));
}
```

---

## 3. Схема ПОВЕДЕНИЯ — одна ambient-функция, все сценарии (существующий `defineFormBehavior`)

```ts
import {
  defineFormBehavior, compute, copyFrom, onChange, enableWhen, disableWhen, resetWhen, syncFields, transformValue, apply, applyEach,
} from '@reformer/core/behaviors';
import { computeMonthlyPayment, computeInitialPayment, computeAge, computeFullName, computeTotalIncome, computePaymentRatio } from './utils';
import { fetchCarModels } from './api';

export const loanBehavior = defineFormBehavior<LoanForm>(({ model, form }) => {
  // ── compute (auto-track) + compute с when ──
  compute(model.$.age, () => computeAge(model));
  compute(model.$.fullName, () => computeFullName(model));
  compute(model.$.monthlyPayment as any, () => computeMonthlyPayment(model));
  compute(model.$.totalIncome, () => computeTotalIncome(model));
  compute(model.$.paymentToIncomeRatio, () => computePaymentRatio(model));
  compute(model.$.initialPayment, () => computeInitialPayment(model), { when: () => model.loanType === 'mortgage' }); // тот же when, что у enable ниже

  // ── copyFrom: скаляр + группа (ambient умеет группу одной строкой) ──
  copyFrom(model.$.email, model.$.emailAdditional, { when: () => model.sameEmail === true, transform: (v) => v.trim().toLowerCase() });
  copyFrom(model.$.registrationAddress, model.$.residenceAddress, { when: () => model.sameAsRegistration === true });

  // ── enableWhen: массив + resetOnDisable; группа без сброса ──
  enableWhen([model.$.propertyValue, model.$.initialPayment], () => model.loanType === 'mortgage', { resetOnDisable: true });
  enableWhen([model.$.carBrand, model.$.carModel, model.$.carYear, model.$.carPrice], () => model.loanType === 'car', { resetOnDisable: true });
  enableWhen([model.$.companyName, model.$.companyInn, model.$.position], () => model.employmentStatus === 'employed', { resetOnDisable: true });
  enableWhen(model.$.businessInn, () => model.employmentStatus === 'selfEmployed', { resetOnDisable: true });
  enableWhen(model.$.residenceAddress, () => model.sameAsRegistration === false);       // группа, без сброса
  // ── disableWhen / resetWhen / syncFields / transformValue ──
  disableWhen(model.$.smsCode, () => !model.agreeTerms);
  resetWhen(model.$.additionalIncomeSource, () => model.additionalIncome === 0);
  transformValue(model.$.inn, (v) => (v ?? '').replace(/\D/g, '').slice(0, 12));

  // ── onChange side-effects: лимиты компонентов + debounced загрузка опций + очистка массивов ──
  onChange(model.$.totalIncome, (inc) => { if (inc) form.loanAmount.updateComponentProps({ max: Math.min(inc * 120, 10_000_000) }); });
  onChange(model.$.age, (age) => { if (age >= 18) form.loanTerm.updateComponentProps({ max: Math.min((70 - age) * 12, 240) }); });
  onChange(model.$.carBrand, async (b) => {
    form.carModel.reset();
    form.carModel.updateComponentProps({ options: b ? (await fetchCarModels(b)).data : [] });
  }, { debounce: 300 });
  onChange(model.$.hasProperty, (on) => { if (!on) form.properties?.clear(); });
  onChange(model.$.hasCoBorrower, (on) => { if (!on) form.coBorrowers.clear(); });

  // ── под-схема к группам (apply) + per-item к массиву, reactive для новых (applyEach) ──
  apply([model.$.registrationAddress, model.$.residenceAddress], addressBehavior);
  applyEach(model.coBorrowers, (im) => {
    compute(im.$.fullName, () => `${im.firstName} ${im.lastName}`.trim());
  });
});

// под-схема адреса — обычная behavior-функция
const addressBehavior = defineFormBehavior<Address>(({ model }) => {
  transformValue(model.$.postalCode, (v) => (v ?? '').replace(/\D/g, '').slice(0, 6));
});
```

---

## 4. Сборка формы — два независимых канала

```ts
import { createModel, createForm } from '@reformer/core';
import { FormWizard } from '@reformer/ui-kit/form-wizard';

export function createLoanForm() {
  const model = createModel<LoanForm>(INITIAL);

  // канал ПОВЕДЕНИЯ — форма владеет lifecycle
  const form = createForm<LoanForm>({ model, schema: layoutSchema, behavior: loanBehavior });

  // канал ВАЛИДАЦИИ — независимо, конфиг wizard'а
  const validation = loanValidation(model);          // { validateStep, validateAll }

  return { model, form, wizardConfig: validation };
}

// В layout (TS-схема или JSON): wizard получает config: validation
//   { component: FormWizard, componentProps: { config: wizardConfig, steps: [ /* layout БЕЗ правил */ ] } }
// JSON-вариант: layout сериализуемый JSON; loanBehavior и loanValidation — TS-функции, инъектируются в рантайме.
```

---

## Итог: что где

| | Схема ВАЛИДАЦИИ | Схема ПОВЕДЕНИЯ |
|---|---|---|
| Контракт | `defineValidationSchema(({model}) => …)` (новый) | `defineFormBehavior(({model, form}) => …)` (существует) |
| Операторы | `step / rule / cross / whenActive / each` | `compute / copyFrom / enableWhen / disableWhen / resetWhen / onChange / transformValue / apply / applyEach` |
| Куда идёт | `{ validateStep, validateAll }` → `FormWizard.config` | `createForm({ behavior })` |
| Семантика | снапшот, по submit/шагу; пере-прогон на каждый `validate` | реактивно, живые подписки |
| Ambient-окно | только во время `validate()` (контролируемо) | во время построения формы (`createForm`) |

Оба контракта — терсовые ambient-функции в стиле C2, но **раздельные**: валидация ничего не знает про UI-ноды/реактивность,
поведение — про правила. Один канал можно менять/тестировать, не трогая другой. Единственный новый код — раннер
`defineValidationSchema` (раздел 1); всё остальное — уже существующие примитивы.

**Осторожно с ambient:** операторы `rule/cross/step/whenActive/each` работают ТОЛЬКО внутри `defineValidationSchema`-fn
(во время `validate()`); вызов снаружи бросит понятную ошибку. Это плата за терсовость — та же, что у `defineFormBehavior`.
