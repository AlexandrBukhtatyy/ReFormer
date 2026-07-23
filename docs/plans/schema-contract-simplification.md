# Контракт описания схем (валидация + поведение): исследование вариантов

> Автогенерировано из мульти-агентного исследования (аудит стабильных примитивов + 5 дивергентных дизайнов + адверсариальная критика каждого). Цель — максимально лаконичный, читаемый и **стабильный** контракт с опорой на JS-примитивы. Раздел «Рекомендация» — курируемый вывод.

## Сводная матрица

Баллы (1–5) — из адверсариальной критики (не самооценка авторов вариантов). `Avg` = среднее laconic/readable/stable.

| Вариант | Laconic | Readable | Stable | Unified | **Avg** |
|---|:---:|:---:|:---:|:---:|:---:|
| A — Единый явный `ctx` | 4 | 2 | 3 | да | **3.0** |
| B — Симметричные близнецы | 3 | 4 | 3 | нет | **3.3** |
| C — Ambient-hooks (расширить defineFormBehavior) | 5 | 3 | 2 | да | **3.3** |
| D — Плоские данные + интерпретатор | 4 | 3 | 2 | да | **3.0** |
| E — Поле-центричный fluent | 4 | 3 | 2 | да | **3.0** |

## Оси решения

- **Явный контекст vs ambient-магия** — передавать `v`/`ctx`/`b` явно (стабильно, тестируемо) против самрегистрации операторов через `getScope()` (терсово, но «работает только внутри», чувствительно к порядку).
- **Функции vs данные** — императивный TS-код против тегированных POJO + интерпретатор (ближе к сериализации/JSON, но интерпретатор — новая точка отказа).
- **Единый vs симметричный** — одна функция на валидацию+поведение против двух одинаковых по форме контрактов.
- **Опора только на публичные швы** — `signal.peek()` / `model.get()` / `getNodeForSignal(sig).setErrors()` / value-ops (`computeFrom`/`copyFrom`/`onChange`/`enableWhen`), НЕ на `walk`-угадывание форм объектов и НЕ на строковые пути.

---

## A — Единый явный `ctx`

**Одна функция schema(m, ctx) описывает И валидацию И поведение поля рядом; явный ctx интерпретируется двумя рантаймами, а один ctx.when даёт сразу enable+reset, условную валидацию и гашение ошибок.**

Тип: **единый** контракт · JS-примитивы: Обычные JS-функции и плейн-объект. Schema = (m, ctx) => void — просто функция; Rule = (value) => error|null — функция; ctx — plain-объект с 7 методами (не прокси, не угадывание форм). Условия when/compute — колбэки () => boolean. each работает через нативный arr.forEach. Внутри движка состояние — обычные массивы (стек when-условий, список enable-целей) и Set/Map (owned, accum). Никакого декларативного дерева узлов, которое интерпретируется по «магическим» ключам объекта: движок читает ТОЛЬКО факт вызова метода ctx и его аргументы-сигналы.

Оценки — самооценка (L/R/S): 4/3/4 · критика (L/R/S): 4/2/3

### Форма контракта

```ts
// Значение-only правило (типобезопасно: scope/root помечены never)
type Rule<TField> = (v: TField, s: never, r: never) =>
  ValidationError | null | Promise<ValidationError | null>;

// ЕДИНЫЙ явный контекст. Валидация и поведение поля со-локализованы.
interface Ctx<Root> {
  // — валидация —
  rule<T>(sig: PathAwareSignal<T>, ...rules: Rule<T>[]): void;
  cross(sig: PathAwareSignal<unknown>, fn: () => ValidationError | null): void;
  each<Item>(arr: ArrayModel<Item>, body: (im: FormModel<Item>) => void): void;
  // — ОБЩИЙ условный блок (работает и в валидации, и в поведении) —
  when(cond: () => boolean, body: () => void): void;
  // — поведение —
  compute<T>(sig: PathAwareSignal<T>, fn: () => T, opts?: { when?: () => boolean }): void;
  copy<T>(src: PathAwareSignal<T>, tgt: PathAwareSignal<T>, opts?: { when?: () => boolean }): void;
  on<T>(sig: PathAwareSignal<T>, fn: (v: T, form: FormProxy<Root>) => void,
        opts?: { debounce?: number }): void;
}

// Схема — ОДНА функция на scope. Никакого декларативного дерева.
type Schema<Root> = (m: FormModel<Root>, ctx: Ctx<Root>) => void;

// Компиляция одной схемы в ОБА рантайма:
function compileSchema<Root>(schema: Schema<Root>): {
  behavior: FormBehavior<Root>;                                  // → createForm({ behavior })
  makeValidator: (m: FormModel<Root>) => () => Promise<boolean>; // → submit
};
```

### Инфраструктура контракта («цена»)

```ts
// ═══ ЦЕНА КОНТРАКТА: движок = типы + ДВА ctx-рантайма + компилятор. ~90 строк, весь тут. ═══
import {
  getNodeForSignal, type FormModel, type FormProxy, type PathAwareSignal,
  type ValidationError, type ModelValidator,
} from '@reformer/core';
import {
  defineFormBehavior, compute as coreCompute, copyFrom as coreCopy,
  enableWhen as coreEnableWhen, onChange as coreOnChange, type FormBehavior,
} from '@reformer/core/behaviors';

type Rule<TField> = (v: TField, s: never, r: never) =>
  ValidationError | null | Promise<ValidationError | null>;
type ArrayModel<Item> = { forEach(cb: (im: FormModel<Item>) => void): void };
type AnySig = PathAwareSignal<unknown>;

interface Ctx<Root> {
  rule<T>(sig: PathAwareSignal<T>, ...rules: Rule<T>[]): void;
  cross(sig: AnySig, fn: () => ValidationError | null): void;
  each<Item>(arr: ArrayModel<Item>, body: (im: FormModel<Item>) => void): void;
  when(cond: () => boolean, body: () => void): void;
  compute<T>(sig: PathAwareSignal<T>, fn: () => T, opts?: { when?: () => boolean }): void;
  copy<T>(src: PathAwareSignal<T>, tgt: PathAwareSignal<T>, opts?: { when?: () => boolean }): void;
  on<T>(sig: PathAwareSignal<T>, fn: (v: T, form: FormProxy<Root>) => void, opts?: { debounce?: number }): void;
}
type Schema<Root> = (m: FormModel<Root>, ctx: Ctx<Root>) => void;

const isPromise = (x: unknown): x is Promise<unknown> => !!x && typeof (x as any).then === 'function';
const hasBlocking = (errs: Map<AnySig, ValidationError[]>): boolean => {
  for (const list of errs.values()) for (const e of list) if (e.severity !== 'warning') return true;
  return false;
};

// ── ctx №1: ВАЛИДАЦИЯ. Активны rule/cross/each/when; compute/copy/on — no-op. ──
interface Accum { errors: Map<AnySig, ValidationError[]>; pending: Promise<void>[]; }
function makeValidationCtx<Root>(model: FormModel<Root>, acc: Accum): Ctx<Root> {
  let suppressed = false; // внутри when(cond=false): только «касаемся» полей (owned), правила не гоняем
  const touch = (sig: AnySig): ValidationError[] => {
    let b = acc.errors.get(sig); if (!b) { b = []; acc.errors.set(sig, b); } return b;
  };
  return {
    rule: (sig, ...rules) => {
      const b = touch(sig as AnySig); if (suppressed) return;
      const value = (sig as AnySig).peek();
      for (const r of rules) {
        const res = (r as unknown as ModelValidator)(value, model, model);
        if (isPromise(res)) acc.pending.push(res.then((e) => { if (e) b.push(e as ValidationError); }));
        else if (res) b.push(res as ValidationError);
      }
    },
    cross: (sig, fn) => { const b = touch(sig); if (suppressed) return; const e = fn(); if (e) b.push(e); },
    each: (arr, body) => arr.forEach(body),
    when: (cond, body) => {
      if (cond()) body();
      else { const p = suppressed; suppressed = true; body(); suppressed = p; } // → поля скрытого блока очистятся
    },
    compute: () => {}, copy: () => {}, on: () => {}, // поведение здесь не исполняется
  };
}

// ── ctx №2: ПОВЕДЕНИЕ. Активны compute/copy/on/when; rule собирает enable-цели внутри when. ──
function makeBehaviorCtx<Root>(model: FormModel<Root>, form: FormProxy<Root>): Ctx<Root> {
  const stack: Array<() => boolean> = []; // активные when-условия (для вложенных when + compute/copy)
  let targets: AnySig[] | null = null;    // enable-цели текущего when-блока
  const merged = (extra?: () => boolean): (() => boolean) | undefined => {
    const cs = extra ? [...stack, extra] : stack;
    return cs.length ? () => cs.every((c) => c()) : undefined;
  };
  return {
    rule: (sig) => { if (targets) targets.push(sig as AnySig); }, // «валидируемое-в-when» = «включаемое-в-when»
    cross: () => {}, each: () => {},                              // cross/per-item — не поведение
    when: (cond, body) => {
      const outer = targets, own: AnySig[] = []; targets = own; stack.push(cond);
      body();
      stack.pop(); targets = outer;
      if (own.length) coreEnableWhen(own, cond, { resetOnDisable: true }); // enable + reset одним оператором
    },
    compute: (sig, fn, opts) => coreCompute(sig, fn, { when: merged(opts?.when) }),
    copy: (src, tgt, opts) => coreCopy(src, tgt, { when: merged(opts?.when) }),
    on: (sig, fn, opts) => coreOnChange(sig, (v) => fn(v, form), opts),
  };
}

// ── КОМПИЛЯТОР: одна Schema → { behavior, makeValidator } ──
export function compileSchema<Root>(schema: Schema<Root>) {
  const behavior: FormBehavior<Root> =
    defineFormBehavior<Root>(({ model, form }) => schema(model, makeBehaviorCtx(model, form)));
  const makeValidator = (model: FormModel<Root>) => {
    const owned = new Set<AnySig>(); // копит все затронутые сигналы — чтобы гасить ставшие валидными/скрытыми
    return async (): Promise<boolean> => {
      const acc: Accum = { errors: new Map(), pending: [] };
      schema(model, makeValidationCtx(model, acc));
      if (acc.pending.length) await Promise.all(acc.pending);
      for (const s of acc.errors.keys()) owned.add(s);
      for (const s of owned) getNodeForSignal(s)?.setErrors(acc.errors.get(s) ?? []);
      return !hasBlocking(acc.errors);
    };
  };
  return { behavior, makeValidator };
}
export type { Rule, Ctx, Schema };
```

### Валидация (кейсы 1–5)

```ts
import { required, min, max, minLength, pattern, email } from '@reformer/core/validators';
import type { CreditApplicationForm } from './types';
import { compileSchema, type Rule, type Schema } from './contract'; // sharedInfra
import { computeMonthlyPayment } from './utils';

type Root = CreditApplicationForm;
const PHONE = /^\+7\s\(\d{3}\)\s\d{3}-\d{2}-\d{2}$/;

// value-only кастомные правила — типобезопасны (value: string), переиспользуемы как встроенные
const usernameFree: Rule<string> = async (value) => {                // кейс 5
  if (!value || value.length < 3) return null;
  try {
    const r = await fetch(`/api/check-username?u=${encodeURIComponent(value)}`);
    return (await r.json()).available ? null : { code: 'username-taken', message: 'Имя занято' };
  } catch { return null; }                                           // сетевой сбой НЕ блокирует submit
};

// cross-field: читает снапшот Root, возвращает ошибку или null
const loanAmountVsMax = (f: Root): ValidationError | null =>
  f.loanAmount && f.propertyValue && f.initialPayment && f.loanAmount > f.propertyValue - f.initialPayment
    ? { code: 'loanExceedsMax',
        message: `Сумма > стоимость − взнос (${(f.propertyValue - f.initialPayment).toLocaleString('ru-RU')} ₽)` }
    : null;

// ═══ ЕДИНАЯ схема: первая половина тела — ВАЛИДАЦИЯ (кейсы 1-5) ═══
export const creditSchema: Schema<Root> = (m, ctx) => {
  // 1) required + pattern
  ctx.rule(m.$.phoneMain,
    required({ message: 'Телефон обязателен' }),
    pattern(PHONE, { message: 'Формат +7 (___) ___-__-__' }));
  ctx.rule(m.$.loanAmount,
    required({ message: 'Укажите сумму' }),
    min(50000, { message: 'Минимум 50 000 ₽' }),
    max(10_000_000, { message: 'Максимум 10 млн ₽' }));

  // 5) async — network fail не блокирует (правило вернуло null в catch)
  ctx.rule(m.$.username,
    required({ message: 'Обязательно' }), minLength(3, { message: 'Минимум 3' }), usernameFree);

  // 3) УСЛОВНОЕ поле: ОДИН when = enable+reset (поведение) + условная валидация + гашение ошибок при выключении.
  //    Когда loanType!=='mortgage': поля не валидируются, но «касаются» (owned) → раннер выставит setErrors([]).
  ctx.when(() => m.loanType === 'mortgage', () => {
    ctx.rule(m.$.propertyValue,
      required({ message: 'Укажите стоимость' }), min(1_000_000, { message: 'Минимум 1 млн ₽' }));
    ctx.rule(m.$.initialPayment,
      required({ message: 'Укажите взнос' }), min(0, { message: 'Не отрицательный' }));
    // 2) cross-field — со-локализован с полями, от которых зависит
    ctx.cross(m.$.loanAmount, () => loanAmountVsMax(m.get()));
  });

  // 4) per-item валидация массива (живой forEach по элементам)
  ctx.each(m.coBorrowers, (im) => {
    ctx.rule(im.$.email,
      required({ message: 'Email созаёмщика обязателен' }), email({ message: 'Некорректный email' }));
    ctx.rule(im.$.monthlyIncome,
      required({ message: 'Укажите доход' }), min(10000, { message: 'Минимум 10 000 ₽' }));
  });

  // …вторая половина тела (поведение, кейсы 6-8) — см. behaviorCode. Это ТА ЖЕ функция.
};
```

### Поведение (кейсы 6–8)

```ts
// ═══ ПРОДОЛЖЕНИЕ тела той же creditSchema — ПОВЕДЕНИЕ (кейсы 6-8). Тот же ctx, те же сигналы. ═══
//   (в validationCode эти ctx.compute/copy/on были no-op; тут no-op — ctx.rule/cross/each.)

  // 6) computed (auto-tracking): monthlyPayment = fn(model), подписки собирает движок сигналов
  ctx.compute(m.$.monthlyPayment, () => computeMonthlyPayment(m));
  // взнос считаем только для ипотеки — условие явно (внутри when было бы неявно, из стека условий)
  ctx.compute(m.$.initialPayment, () => m.propertyValue * 0.2, { when: () => m.loanType === 'mortgage' });

  // 7) copyFrom с when: адрес проживания ← адрес регистрации, когда галка совпадения включена
  ctx.copy(m.$.registrationAddress, m.$.residenceAddress, { when: () => m.sameAsRegistration === true });

  // 8) onChange side-effect: возраст → max срока кредита. form приходит вторым аргументом колбэка
  //    (доступен только в behave-режиме; в validate-режиме on() — no-op, колбэк не вызывается).
  ctx.on(m.$.age, (age, form) => {
    if (age && age >= 18) form.loanTerm.updateComponentProps({ max: Math.min(Math.max(70 - age, 1) * 12, 240) });
  });
}; // ← конец единой creditSchema

// ── использование: одна схема → два рантайма ──
const { behavior, makeValidator } = compileSchema(creditSchema);
const form = createForm<Root>({ model, schema: tree, behavior }); // поведение — реактивно, форма владеет lifecycle
const validate = makeValidator(model);                           // валидация — на submit: const ok = await validate();
```

### JSON-совместимость

Schema — это TS-функция, сериализовать её в JSON нельзя, и это by design совпадает с текущим раскладом ReFormer: JSON несёт ТОЛЬКО layout (JsonFieldNode), а оператора $validator/$behavior в DSL нет. Схема живёт отдельным .ts-модулем и инъектируется в рантайме: JSON → convertJsonToM1Tree(json, registry, model) строит дерево, а compileSchema(creditSchema) даёт { behavior, makeValidator }. behavior уходит в createForm({ model, schema: tree, behavior }); makeValidator(model) вешается на submit. Контракт агностичен к способу сборки дерева — оба ctx работают исключительно через model.$ (сигналы), getNodeForSignal(sig).setErrors() и FormProxy, а не через узлы JSON, поэтому JSON-собранная форма обслуживается тем же кодом, что и TS-собранная. Единственный нюанс: ctx.on-side-effect адресует form-ноды по пути (form.loanTerm) — после convertJsonToM1Tree FormProxy доступен, так что путь валиден; но имена нод в JSON и пути в схеме надо держать согласованными (это цена того, что layout и логика разъехались по разным файлам/источникам). Итог: серверный/редактируемый JSON меняем, не трогая правила и поведение, и наоборот — как в текущем renderer-json примере.

### Компромиссы (автор)

ПЛЮСЫ: (1) настоящая унификация — валидация, реактивное поведение и условность ОДНОГО поля стоят рядом в одном when; правишь фичу в одном месте. (2) ctx явный, не ambient: оба рантайма — чистые фабрики makeValidationCtx/makeBehaviorCtx, тестируются прогоном схемы с фейковой моделью, без getScope-магии и без чувствительности к месту вызова. (3) Только публичные примитивы (compute/copyFrom/enableWhen/onChange/getNodeForSignal/peek/setErrors), типобезопасный Rule<T>, без угадывания форм объектов.
 МИНУСЫ (честно): (1) Би-модальность — одна функция значит ДВА разных исполнения; половина методов ctx в каждом режиме — no-op. На месте вызова ctx.compute(...) в «валидационном чтении» кода это мёртвый вызов, что сбивает читателя (главный удар по readable). (2) Неявная связь: «поле, у которого есть rule ВНУТРИ when» автоматически становится enable-целью с resetOnDisable. Если хотелось условной валидации БЕЗ сброса значения — сюрприз; это соглашение, а не тип. (3) form в side-effect прокинут параметром колбэка ctx.on, а не лексически — чуть неудобно. (4) Per-item ПОВЕДЕНИЕ через each не покрыто (each — только валидация; для behave нужен apply/sub-schema) — в 8 кейсах не встречается, но это дыра контракта. (5) Цена движка выше, чем у раздельных контрактов: две реализации Ctx вместо одного коллектора.

### Критика (адверсариальная)

**Сильные стороны**

- Валидационный ctx (makeValidationCtx) действительно ambient-free и изолированно тестируем: прогоняется с фейковой моделью + Accum, использует только signal.peek()/getNodeForSignal(sig).setErrors() — это честно сильная половина контракта.
- Якорь поля — идентичность сигнала (model.$.<path>), а не строковый путь; value-only Rule<T> типобезопасен; НЕТ walk-дерева с угадыванием форм объектов. По ключевым осям аудита (identity-binding, value-only rules, никаких {value,validators}-эвристик) вариант делает правильный выбор.
- Настоящая ко-локация: required+pattern, cross-field, условность, enable+reset и async одного поля стоят в одном when — правка фичи в одном месте (кейсы 1-5 читаемы на месте авторинга).
- JSON-совместимость by construction: Schema — TS-функция, инъектируется в рантайме через createForm({behavior}) + makeValidator(model); layout остаётся сериализуемым JSON. Оба ctx работают через model.$ и getNodeForSignal, а не через JSON-узлы.
- Async унифицирован с sync: правило возвращает Promise, раннер await'ит acc.pending; сетевой сбой → catch→null → не блокирует submit (кейс 5 покрыт корректно).
- Честная само-оценка: бимодальность, форсированный resetOnDisable и дыра per-item behavior признаны в tradeoffs, а не спрятаны.

**Риски / failure-modes**

- ЛОЖЬ О СТАБИЛЬНОСТИ #1: поведенческий ctx НЕ ambient-free. makeBehaviorCtx строится целиком на coreCompute/coreCopy/coreEnableWhen/coreOnChange из @reformer/core/behaviors, а они (behaviors.ts:216-337 → effect→onDispose→requireCtx, throw на строках 67-75) бросают 'вызван вне defineFormBehavior' вне ambient-окна. Значит заявленное 'оба рантайма — чистые фабрики, тестируются прогоном схемы с фейковой моделью, без getScope-магии' ВЕРНО только для валидации; поведение нельзя юнит-тестить прогоном схемы и оно чувствительно к месту вызова (методы обязаны выполняться синхронно внутри setup). Половина контракта осталась ambient, просто обёрнута.
- БЕСПОКОЙНАЯ НЕЯВНАЯ СВЯЗЬ: соглашение 'rule ВНУТРИ when ⇒ enableWhen(resetOnDisable:true)'. Это самодельная shape-конвенция, изобретённая самим контрактом — хуже, чем угадывание форм движком, т.к. bespoke и невидима в типах. Невозможно выразить условную валидацию, СОХРАНЯЮЩУЮ значение поля (напр. скрыть/показать без сброса) — контракт форсирует reset. Разработчик, пишущий просто условную проверку, молча получает reset+disable.
- ДОКУМЕНТИРОВАННЫЙ FOOTGUN усилён: behaviors-node.ts:28-46 требует, чтобы compute-цель, которая ТАКЖЕ resetOnDisable enableWhen, несла ТОТ ЖЕ when, иначе значение утечёт в submit. В варианте enableWhen для initialPayment создаётся НЕЯВНО валидационным when-блоком, а compute({when:mortgage}) написан отдельно в поведенческой половине — инвариант разнесён по двум местам/режимам, увидеть согласованность труднее, не легче. Совпадение 'mortgage==mortgage' здесь — везение.
- ТИХИЙ ДРОП ОШИБОК: getNodeForSignal возвращает undefined на промах (signal-node-registry.ts:68-70), раннер делает getNodeForSignal(s)?.setErrors(...). Для нем材ериализованных элементов массива и для JSON-дерева, НЕ привязанного по идентичности к тому же экземпляру model, ошибки просто не показываются — ни throw, ни warn. Валидация 'проходит' визуально, будучи сломанной.
- БИМОДАЛЬНОСТЬ: одна функция — два исполнения; половина методов ctx в каждом режиме no-op. На месте чтения кода ctx.compute(...) в валидационном проходе — мёртвый вызов; читатель обязан держать в голове 'функция гоняется дважды по-разному'. Главный удар по readable.
- STATEFUL-ВАЛИДАТОР: makeValidator замыкает общий owned Set. Двойной submit / submit во время pending-async гоняют схему повторно, деля owned и ноды: упавшая сеть при ре-ране username молча сбросит реальную ошибку 'занято' (last-writer-wins). owned растёт неограниченно при add/remove элементов массива; после реиндексации возможен setErrors([]) по устаревшей ноде живого элемента.
- ПОТЕРЯ ТИПОВ в cross: cross(sig: PathAwareSignal<unknown>) стирает T; целевая нода ошибки развязана с тем, что реально проверяет fn (fn читает m.get() независимо) — надо вручную помнить, к какому сигналу привязать ошибку.
- ASYNC БЕЗ ОТМЕНЫ в валидации: Rule<T> = (v, s:never, r:never) — value-only, БЕЗ {signal}. В отличие от onChange (behaviors.ts:289-320, есть AbortSignal), async-правило username не может отменить устаревший ответ — при быстрой ре-валидации возможна гонка stale-response, применяющая протухший результат.
- ЦЕНА ДВИЖКА: две реализации Ctx + defineFormBehavior + компилятор (~90 строк), которые команда обязана владеть и поддерживать — больше поверхности, чем один коллектор из Contract B.

**Пробелы покрытия**

- Кейс 3 (условное поле): механизм гашения работает (when всегда гоняет body суппресированно → touch → setErrors([])), НО контракт ФОРСИРУЕТ resetOnDisable через неявную связь rule-in-when⇒enableWhen. Выразить 'условная валидация БЕЗ сброса значения' невозможно. Плюс корректность держится на инварианте 'поле всегда упомянуто в when-блоке, исполняемом на каждый validate'.
- Кейс 4 (per-item массив): рантайм-API есть и типизирован (ModelArray.forEach→FormModel<Item>), но (а) роутинг ошибок требует материализованных item-нод, иначе getNodeForSignal→undefined→тихий дроп; (б) owned копит устаревшие item-сигналы, риск stale-clear после реиндексации; (в) per-item ПОВЕДЕНИЕ вообще не покрыто — each только для валидации, для behave нужен apply/sub-schema (дыра контракта, признана автором).
- Кейс 5 (async): не блокирует — да, но нет AbortSignal в валидационном правиле → гонка устаревших ответов при частой ре-валидации не отменяема (в отличие от onChange).
- Кейс 2 (cross-field): работает через m.get(), но помещён внутрь when(mortgage) — это связывает cross с условием (для non-mortgage cross не гоняется) и теряет типобезопасность цели (AnySig).
- Кейс 7 (copyFrom групп): опирается на fragile group-copy движка (readGroup/writeGroup — дак-тайпинг isSignal по .peek + Object.keys, зависимость от __path на уровне группы) — наследованная хрупкость, не привнесённая вариантом, но кейс на ней стоит.

**Вердикт:** Умная унификация с реально сильной валидационной половиной, но заявленная 'стабильность' переоценена. Валидационный ctx честно ambient-free, типобезопасен, использует identity+getNodeForSignal и value-only Rule<T> — это заслуженно. Однако поведенческая половина полностью ambient (coreCompute/coreCopy/coreEnableWhen/coreOnChange бросают вне defineFormBehavior), поэтому обещание 'оба рантайма — чистые изолированно-тестируемые фабрики без getScope-магии' для неё ложно. Хуже того, контракт ИЗОБРЕТАЕТ собственную неявную shape-конвенцию (rule-внутри-when ⇒ enableWhen+resetOnDisable) — bespoke-магию, которая невидима в типах и форсирует сброс значения; это троп 'меняем угадывание форм движка на своё угадывание'. Добавьте тихий дроп ошибок при промахе getNodeForSignal (JSON-инъекция / нематериализованные массивы), stateful race-prone валидатор (общий owned) и разнесённый по двум режимам инвариант 'compute-when==enableWhen-when' — и честная оценка стабильности не 4, а 3. Годится для рукописных форм, если команда принимает бимодальную модель и документирует связь when; но контракт НЕ выполняет главное своё обещание 'никакой ambient-магии, полностью изолированно тестируемо'.

---

## B — Симметричные близнецы

**Два чистых близнеца одной формы: validate(m,v) копит ошибки, behave(m,b) копит wiring'и — оба «коммитит» раннер. Выучил один — знаешь оба; ambient изолирован в 4-строчном мосте.**

Тип: **симметричные** контракты · JS-примитивы: Опора только на нативный JS, без DSL-дерева. ФУНКЦИИ: контракты (Check/Behavior) и все правила/read/cond/cb — обычные замыкания над model.$ и снапшотом m.get(); под-check'и (coBorrower) — обычные функции, принимающие коллектор; кастомный оператор поведения = обычная функция, комбинирующая методы b. МАССИВЫ: spread правил `v(sig, ...rules)`, буфер wiring'ов `Wire[]`, живой массив под-моделей `m.coBorrowers.forEach`. ОБЪЕКТЫ: коллекторы v и b — простые объекты с методами (никаких «магических» ключей вроде {value,validators}/{when,children}); options-мешки {when}/{resetOnDisable}/{resetValue}; ValidationError — plain object. Движок видит только вызовы публичных функций-операторов и setErrors — форму узла он не «угадывает».

Оценки — самооценка (L/R/S): 4/5/4 · критика (L/R/S): 3/4/3

### Форма контракта

```ts
// БЛИЗНЕЦ A — валидация (текущий Contract B, без изменений):
type Rule<T> = (value: T, s: never, r: never)
  => ValidationError | null | Promise<ValidationError | null>;     // value-only, типобезоп.
interface Collector {
  <T>(sig: PathAwareSignal<T>, ...rules: Rule<T>[]): void;         // v(sig, ...rules)
  add(sig: PathAwareSignal<unknown>, err: ValidationError | null): void;  // v.add — cross-field
}
type Check<T> = (m: FormModel<T>, v: Collector) => void;           // validate: (m, v) => void

// БЛИЗНЕЦ B — поведение: зеркало Collector, но методы = ЯВНЫЕ обёртки над публичными операторами.
interface Behave<T> {
  compute<R>(target: Signal<R>, read: () => R, o?: { when?: () => boolean }): void;
  copy<V>(source: ReadonlySignal<V>, target: Signal<V>, o?: { when?: () => boolean; transform?: (v: V) => V }): void;
  enable(t: ReadonlySignal<unknown> | ReadonlySignal<unknown>[], cond: () => boolean, o?: { resetOnDisable?: boolean }): void;
  disable(t: ReadonlySignal<unknown> | ReadonlySignal<unknown>[], cond: () => boolean, o?: { resetOnDisable?: boolean }): void;
  reset<V>(target: Signal<V>, cond: () => boolean, o?: { resetValue?: V }): void;
  on<V>(source: ReadonlySignal<V>, cb: (v: V, ctx: ChangeContext) => void, o?: { immediate?: boolean; debounce?: number }): void;
  each<I>(arraySig: ReadonlySignal<I[]>, item: Behavior<I>): void; // per-item = тот же близнец рекурсивно
  node(sig: Signal<unknown>): FormNode<unknown> | undefined;       // = getNodeForSignal, зеркало разноса ошибок в v
  effect(fn: () => void | (() => void)): void;                     // escape hatch
}
type Behavior<T> = (m: FormModel<T>, b: Behave<T>) => void;        // behave: (m, b) => void

// Оба «коммитятся» раннером — единственной точкой контакта с движком:
makeValidator<T>(model, validate): () => Promise<boolean>          // прогон → await → setErrors в ноды
toBehavior<T>(behave): FormBehavior<T>                             // ставит wiring'и в scope (для createForm)
```

### Инфраструктура контракта («цена»)

```ts
// ═══════════════════════════════════════════════════════════════════════════════
// sharedInfra — ЦЕНА контракта: ДВА симметричных «движка» (validate + behave).
// Инвариант обоих: контракт = (m, collector) => void, который НАПОЛНЯЕТ буфер;
// раннер «коммитит» буфер в форму. У обоих раннер — единственная точка контакта с движком.
// ═══════════════════════════════════════════════════════════════════════════════
import {
  defineFormBehavior, compute, copyFrom, enableWhen, disableWhen, resetWhen,
  onChange, effect, applyEach, getNodeForSignal,
  type FormModel, type FormNode, type FormBehavior, type Signal, type ReadonlySignal,
  type PathAwareSignal, type ValidationError, type ModelValidator, type ChangeContext,
} from '@reformer/core';

// ── ПОЛОВИНА 1: VALIDATE (текущий Contract B — 1:1 с эталонной validation.ts) ────
export type Rule<TField> = (
  value: TField, scope: never, root: never
) => ValidationError | null | Promise<ValidationError | null>;

export interface Collector {
  <T>(signal: PathAwareSignal<T>, ...rules: Rule<T>[]): void;
  add(signal: PathAwareSignal<unknown>, error: ValidationError | null): void;
}
export type Check<T> = (m: FormModel<T>, v: Collector) => void;

interface Accum { errors: Map<PathAwareSignal<unknown>, ValidationError[]>; pending: Promise<void>[] }

const makeCollector = <T,>(model: FormModel<T>, acc: Accum): Collector => {
  const touch = (s: PathAwareSignal<unknown>) => {
    let b = acc.errors.get(s); if (!b) acc.errors.set(s, (b = [])); return b;
  };
  const v = (<V>(sig: PathAwareSignal<V>, ...rules: Rule<V>[]) => {
    const bucket = touch(sig as PathAwareSignal<unknown>);
    const value = sig.peek();
    for (const rule of rules) {
      const r = (rule as unknown as ModelValidator)(value, model, model);
      if (r && typeof (r as Promise<unknown>).then === 'function')
        acc.pending.push((r as Promise<ValidationError | null>).then((e) => { if (e) bucket.push(e); }));
      else if (r) bucket.push(r as ValidationError);
    }
  }) as Collector;
  v.add = (sig, err) => { const b = touch(sig); if (err) b.push(err); };
  return v;
};

const blocking = (errs: Accum['errors']) => {
  for (const list of errs.values()) for (const e of list) if (e.severity !== 'warning') return true;
  return false;
};

/** РАННЕР A: прогон check → await async → разнос ошибок в ноды + гашение owned-полей ([]). */
export const makeValidator = <T,>(model: FormModel<T>, check: Check<T>) => {
  const owned = new Set<PathAwareSignal<unknown>>();
  return async (): Promise<boolean> => {
    const acc: Accum = { errors: new Map(), pending: [] };
    check(model, makeCollector(model, acc));            // контракт наполняет буфер
    if (acc.pending.length) await Promise.all(acc.pending);
    for (const s of acc.errors.keys()) owned.add(s);
    for (const s of owned) getNodeForSignal(s)?.setErrors(acc.errors.get(s) ?? []); // коммит в форму
    return !blocking(acc.errors);
  };
};

// ── ПОЛОВИНА 2: BEHAVE (симметричный близнец) ──────────────────────────────────
export interface Behave<T> {
  compute<R>(target: Signal<R>, read: () => R, o?: { when?: () => boolean }): void;
  copy<V>(source: ReadonlySignal<V>, target: Signal<V>, o?: { when?: () => boolean; transform?: (v: V) => V }): void;
  enable(t: ReadonlySignal<unknown> | ReadonlySignal<unknown>[], cond: () => boolean, o?: { resetOnDisable?: boolean }): void;
  disable(t: ReadonlySignal<unknown> | ReadonlySignal<unknown>[], cond: () => boolean, o?: { resetOnDisable?: boolean }): void;
  reset<V>(target: Signal<V>, cond: () => boolean, o?: { resetValue?: V }): void;
  on<V>(source: ReadonlySignal<V>, cb: (v: V, ctx: ChangeContext) => void, o?: { immediate?: boolean; debounce?: number }): void;
  each<I>(arraySig: ReadonlySignal<I[]>, item: Behavior<I>): void;
  node(sig: Signal<unknown>): FormNode<unknown> | undefined;
  effect(fn: () => void | (() => void)): void;
}
export type Behavior<T> = (m: FormModel<T>, b: Behave<T>) => void;

type Wire = () => void; // отложенный install одного wiring — исполняется ВНУТРИ активного scope

// Коллектор B: методы лишь КОПЯТ install-thunk. В момент вызова движок не тронут (нет getScope,
// нет compute()). Симметрия с v: v копит ошибки, b копит wiring'и — оба отдают буфер раннеру.
const makeBehave = <T,>(out: Wire[]): Behave<T> => ({
  compute: (t, read, o) => { out.push(() => compute(t, read, o)); },
  copy:    (s, t, o)    => { out.push(() => copyFrom(s, t, o)); },
  enable:  (t, c, o)    => { out.push(() => enableWhen(t as ReadonlySignal<unknown>, c, o)); },
  disable: (t, c, o)    => { out.push(() => disableWhen(t as ReadonlySignal<unknown>, c, o)); },
  reset:   (t, c, o)    => { out.push(() => resetWhen(t, c, o)); },
  on:      (s, cb, o)   => { out.push(() => onChange(s, cb, o)); },
  each:    (arr, item)  => { out.push(() => applyEach(arr, toBehavior(item))); }, // тот же близнец рекурсивно
  node:    (sig)        => getNodeForSignal(sig),          // pure lookup — работает и в cb, и на install
  effect:  (fn)         => { out.push(() => effect(fn)); },
});

/** РАННЕР B: единственная точка, где behave-контракт касается движка/ambient. Ставит scope ОДИН
 *  раз (defineFormBehavior) и коммитит собранные wiring'и — операторы самрегистрируются здесь. */
export const toBehavior = <T,>(behave: Behavior<T>): FormBehavior<T> =>
  defineFormBehavior<T>(({ model }) => {
    const wires: Wire[] = [];
    behave(model, makeBehave<T>(wires)); // контракт наполняет буфер — движок ещё не тронут
    wires.forEach((w) => w());           // коммит: каждый wiring встаёт в активный scope
  });
```

### Валидация (кейсы 1–5)

```ts
// ── БЛИЗНЕЦ A: validate: (m, v) => void — покрывает кейсы 1–5 ──────────────────
// Типы Root/Address/CoBorrower — обычные интерфейсы формы; Rule/Collector/Check — из sharedInfra.
type M = FormModel<Root>;

const usernameFmt = /^[a-z0-9_]{3,20}$/;
const NAME = /^[A-ZА-ЯЁ][a-zа-яё-]+$/;

// (5) async-правило: сетевой сбой НЕ блокирует отправку — возвращаем null, а не ошибку.
const usernameFree: Rule<string> = async (value) => {
  if (!value || value.length < 3) return null;
  try {
    const res = await fetch(`/api/username-free?u=${encodeURIComponent(value)}`);
    const { available, message } = await res.json();
    return available ? null : { code: 'username-taken', message: message ?? 'Имя занято' };
  } catch {
    return null; // сеть недоступна — не мешаем сабмиту
  }
};

// (2) cross-field: сумма кредита ≤ стоимость − первый взнос (только ипотека). Обычный код над снапшотом.
const loanWithinCollateral = (f: Root): ValidationError | null => {
  if (f.loanType !== 'mortgage' || !f.loanAmount || !f.propertyValue) return null;
  const cap = f.propertyValue - (f.initialPayment ?? 0);
  return f.loanAmount > cap
    ? { code: 'loan-over-collateral', message: `Не более ${cap.toLocaleString('ru-RU')} ₽ (стоимость − взнос)` }
    : null;
};

// (4) per-item: правила ОДНОГО созаёмщика — обычная под-функция, тот же коллектор v.
const coBorrower = (im: FormModel<CoBorrower>, v: Collector): void => {
  v(im.$.fullName, required({ message: 'ФИО обязательно' }), pattern(NAME, { message: 'Только буквы' }));
  v(im.$.email, required({ message: 'Email обязателен' }), email({ message: 'Некорректный email' }));
  v(im.$.monthlyIncome, required(), min(10000, { message: 'Минимум 10 000 ₽' }));
};

export const validate: Check<Root> = (m, v) => {
  const f = m.get(); // снапшот для cross-field/условий

  // (1) required + pattern (+5 async на том же поле — правила просто перечисляются)
  v(m.$.username,
    required({ message: 'Укажите имя' }),
    pattern(usernameFmt, { message: 'Латиница, цифры, _ (3–20)' }),
    usernameFree);

  v(m.$.loanAmount, required(), min(50000, { message: 'Минимум 50 000 ₽' }));
  v.add(m.$.loanAmount, loanWithinCollateral(f)); // (2)

  // (3) условное поле: валидируем propertyValue+initialPayment ТОЛЬКО для ипотеки.
  //     когда loanType≠mortgage — просто не касаемся их; раннер сам погасит ошибки
  //     через накопительный owned → getNodeForSignal(sig).setErrors([]).
  if (f.loanType === 'mortgage') {
    v(m.$.propertyValue, required({ message: 'Укажите стоимость' }), min(1_000_000, { message: 'Минимум 1 млн ₽' }));
    v(m.$.initialPayment, required({ message: 'Укажите взнос' }), min(0));
  }

  // (4) per-item массива — обычный forEach живого массива под-моделей
  m.coBorrowers.forEach((im) => coBorrower(im, v));
};
```

### Поведение (кейсы 6–8)

```ts
// ── БЛИЗНЕЦ B: behave: (m, b) => void — покрывает кейсы 6–8 ────────────────────
// Читается как validate: та же форма (m, коллектор) => void, тот же control-flow.
// Ни ambient getScope, ни defineFormBehavior здесь НЕ видно — только методы b.

export const behave: Behavior<Root> = (m, b) => {
  // (6) computed поле с auto-tracking: read-fn читает model.$ напрямую → движок сам подписывает
  b.compute(m.$.monthlyPayment, () => {
    const P = m.loanAmount, n = m.loanTerm, r = 0.12 / 12;
    return P && n ? Math.round((P * r) / (1 - Math.pow(1 + r, -n))) : 0;
  });

  // condition-bound compute (взнос = 20% стоимости, только ипотека) + условное включение
  // тем же when — иначе disabled-поле молча заполнится и утечёт в submit (правило enableWhen+compute).
  b.compute(m.$.initialPayment, () => Math.round(m.propertyValue * 0.2), { when: () => m.loanType === 'mortgage' });
  b.enable([m.$.propertyValue, m.$.initialPayment], () => m.loanType === 'mortgage', { resetOnDisable: true });

  // (7) copyFrom с when: адрес проживания ← адрес регистрации, пока стоит галка «совпадают»
  b.copy(m.$.registrationAddress, m.$.residenceAddress, { when: () => m.sameAsRegistration === true });

  // (8) onChange side-effect: при смене возраста правим max у loanTerm. Доступ к ноде — через b.node
  //     (= getNodeForSignal), симметрично тому, как v разносит ошибки в ноды. `form` в сигнатуру не течёт.
  b.on(m.$.age, (age) => {
    if (age >= 18) b.node(m.$.loanTerm)?.updateComponentProps({ max: Math.max(1, 70 - age) * 12 });
  });
};

// подключение обоих близнецов (для формы из TS-схемы ИЛИ из JSON — см. jsonCompat):
//   const validateAll = makeValidator(model, validate);
//   const form = createForm({ model, schema, behavior: toBehavior(behave) });
```

### JSON-совместимость

Оба близнеца — TS-функции, живущие ОТДЕЛЬНО от layout, что и требует JSON-вариант: JSON несёт только layout (функции не сериализуются), а validate/behave инъектируются в рантайме. Схема приходит из JSON-конвертера как model+schema; validate цепляется через `makeValidator(model, validate)` независимо от способа сборки формы, behave — через `createForm({ model, schema, behavior: toBehavior(behave) })` (JSON-рендерер строится поверх того же createForm). Оба коллектора — тонкие обёртки над публичными ops, поэтому код правил/реактивности идентичен для формы из TS-схемы и из JSON. Симметричные близнецы — это как раз «serialization-friendly» половина: layout уезжает как JSON, а две функции едут рядом как код. КАВЕАТ (тот же, что у ambient-поведения): node-операции behave (enable/on→updateComponentProps, each) требуют, чтобы целевые поля/массивы были МАТЕРИАЛИЗОВАНЫ в форме — getNodeForSignal должен резолвить ноду; JSON-layout обязан объявить эти узлы (и `{array,item}` для each). Value-операции (compute/copy на model.$) и вся валидация работают независимо от материализации. Ортогонально этому остаётся render-behavior (schema.node/hideWhen/onComponentEvent) — он про чисто layout-реакции (показать/скрыть узел, повесить onClick), тогда как value/state-логика формы живёт в двух близнецах.

### Компромиссы (автор)

ПЛЮСЫ. (1) Идеальная симметрия: оба близнеца — `(m, collector) => void` + раннер, который «коммитит» буфер (v: ошибки → ноды; b: wiring'и → scope). Ментальная модель одна: «наполни коллектор, раннер разнесёт». Выучил v — читаешь b без переучивания (сравни validationCode и behaviorCode: тот же if/forEach/перечисление). (2) Явный коллектор вместо ambient: автор behave НЕ вызывает getScope/defineFormBehavior и не зависит от «места вызова» — b приходит параметром, ровно как v. (3) Максимальная развязка: behave — чистая функция, при вызове НЕ трогает движок (методы лишь копят thunk); весь контакт с движком/ambient заперт в 4-строчном toBehavior. Замени мост — контракт движок-агностичен. (4) Только публичные примитивы (compute/copyFrom/enableWhen/onChange/resetWhen/effect/applyEach/getNodeForSignal/defineFormBehavior), полная типобезопасность, НИКАКОГО угадывания форм объектов (`walk` не участвует — операторы вызываются напрямую). (5) b.node(sig) зеркалит разнос ошибок в v: доступ к нодам единообразен, `form` не течёт в сигнатуру.

МИНУСЫ. (1) Платишь за ДВА движка: два коллектора + два раннера (~2× инфры против единого контракта) — симметрия куплена дублированием. (2) Ambient не устранён, а локализован: операторы всё ещё самрегистрируются через getScope, просто toBehavior гарантирует активный scope и прячет его в себя — честно «без ambient» только на поверхности автора, не на уровне движка. (3) Собранные wiring'и — непрозрачные thunk'и: выигрыш «нет контакта с движком при авторинге» есть, но глубокой интроспекции («зарегистрирован ли compute для monthlyPayment?») нет — для неё нужны структурные записи + интерпретатор (ещё инфра). (4) Два коллектора = две тонко разные семантики «когда буфер коммитится» (v: после await, роутит ошибки; b: сразу, ставит wiring'и) при одинаковой форме — можно спутать. (5) Коллектор НЕ убирает footgun'ы движка: связку compute+enableWhen с одинаковым when (см. initialPayment в behaviorCode) и требование материализации нод для enable/on/each автор держит в голове сам.

### Критика (адверсариальная)

**Сильные стороны**

- Близнец A (валидация = текущий Contract B) действительно образцово-стабилен и подтверждается кодом: `makeCollector` трогает только `sig.peek()`, `model.get()`, `getNodeForSignal(sig).setErrors()` — ноль shape-guessing, ноль `walk`, полная типобезопасность правил Rule<T>. Это ровно та половина, которую аудит называет эталоном.
- Cross-field / условное / per-item в валидации выражены обычным control-flow (if по `m.get()`, `m.coBorrowers.forEach`), и `forEach` реально существует на value-proxy массива (form-model.ts:265, yields под-FormModel с `.$` через facadeCache) — кейсы 1,2,4 в валидации работают на публичных примитивах.
- Ментальная симметрия `(m, collector) => void` + раннер — настоящая и педагогически чистая: behaviorCode читается тем же if/forEach/перечислением, что и validationCode. `b.node(sig)` = `getNodeForSignal` зеркалит разнос ошибок, `form` не течёт в сигнатуру behave (чище, чем ambient `defineFormBehavior(({model,form})=>…)`).
- Для АВТОРА behave угадывание формы объекта (`{value,validators}`/`{when,children}` walk — худший пункт аудита) действительно исключено: операторы вызываются напрямую как функции, движок видит только вызовы `compute`/`copyFrom`/`setErrors`.
- JSON-совместимость архитектурно реальна и подтверждена reference-кодом: `createForm({ model, schema, behavior })` принимает инъекцию (create-form.ts:283), а `makeValidator(model, validate)` не зависит от layout — форма из JSON собирается тем же `createForm` (form-setup.ts:66-71).

**Риски / failure-modes**

- ФАКТИЧЕСКАЯ ОШИБКА ИМПОРТА В sharedInfra: `compute/onChange/effect/applyEach/defineFormBehavior` импортируются из `@reformer/core`, где их НЕТ — умбрелла-barrel (src/index.ts) тянет только state/index (value-ops) + form/index (enableWhen/disableWhen из behaviors-node), а ambient-операторы живут ТОЛЬКО на subpath `@reformer/core/behaviors` (vite.config.ts:41 → src/form/behaviors.ts). Доказано всеми реальными консумерами: form-setup.ts:10, mcp-…-v20/form.behavior.ts:4-5 берут их из `@reformer/core/behaviors`; из умбреллы их не берёт НИКТО. Как написано — undefined/ошибка сборки.
- LAYER-MIXING → УТЕЧКА CLEANUP: `copyFrom/enableWhen/disableWhen/resetWhen` из `@reformer/core` — это НЕ-ambient близнецы (behaviors-value.ts / behaviors-node.ts), они ВОЗВРАЩАЮТ BehaviorCleanup и НЕ самрегистрируются. `makeBehave.copy/enable/disable/reset` = `out.push(() => copyFrom(...))` — возвращённый cleanup ВЫБРАСЫВАЕТСЯ. Значит эти эффекты никогда не отпишутся в `form.dispose()` (стойкая утечка/зомби-эффект). Единственная связная починка — брать ВСЁ из `@reformer/core/behaviors` (ambient), но тогда см. следующий риск.
- «Ambient изолирован в 4-строчном мосте» / «движок-агностичен, замени мост» — ЛОЖНО. Если чинить импорт на `@reformer/core/behaviors`, то каждый метод `b` = прямой вызов ambient-оператора, который через `onDispose→requireCtx` (behaviors.ts:67-75) БРОСАЕТ при вызове вне `defineFormBehavior`. Буфер `Wire[]` исполним ТОЛЬКО внутри `toBehavior`'s scope; мост не заменяемый, а обязательный каркас. `b` — это просто переименование ambient getScope-самрегистрации, вся её хрупкость (порядок/место вызова, невозможность юнит-теста без поднятого scope) сохранена под обёрткой.
- ДВА РАССОГЛАСОВАННЫХ КАНАЛА ВАЛИДАЦИИ: `createForm({schema})` авто-вешает `validateFormModel(model, schema)` на submit ноды (create-form.ts:273-279), а близнец A `makeValidator` — отдельный канал, который надо звать руками и вручную гейтить submit (ровно как костыль в form-setup.ts:79 `await validate()`). «Раннер — единственная точка контакта» опровергается: у submit свой контакт.
- ТИП-ЭРОЗИЯ НА СТЫКАХ (реинтродукция дыр, которые контракт обещал закрыть): `enable` кастит массив `as ReadonlySignal<unknown>`; `Behave.copy<V>` типизирует ГРУППУ как `Signal<V>` (кейс 7 — реально group-copy через duck-typing readGroup/writeGroup по `.peek`, behaviors.ts:143-157 — audit-flagged, тихо ломается при смене формы группы); `each` типизирует массив как `ReadonlySignal<I[]>`, хотя core `applyEach` ждёт `{__path}`-объект. Несколько `as`-кастов возвращают ту самую нетипобезопасность.
- `owned: Set<PathAwareSignal>` в makeValidator — МОНОТОННЫЙ STRONG-Set, который держит сильные ссылки на сигналы удалённых строк массива, побеждая GC-safe WeakMap реестра сигнал→нода. При add/remove многих co-borrowers сигналы мёртвых строк живут вечно (утечка, растущая с числом операций над массивом).
- ЦЕНА: два коллектора + два раннера (~2× инфры) при том, что раннеры имеют тонко разную семантику коммита (A: после await, роутит ошибки; B: синхронно, ставит wiring) при одинаковой форме — спутать легко. Симметрия куплена дублированием движка, что бьёт по оси laconic на уровне инфраструктуры.

**Пробелы покрытия**

- Кейс 5 (async): «non-blocking» выполнен (catch→null), НО race-unsafe — Rule<T> = `(value, s: never, r: never)` СТРУКТУРНО запрещает передать `{signal}`, а makeCollector зовёт правило как `(value, model, model)` без AbortSignal. Два быстрых validate() (пользователь печатает) резолвятся вне порядка и пишут устаревший вердикт «занято/свободно» в ноду username. Аудит прямо требовал AbortSignal-контракт — вариант его исключает типом.
- Кейс 7 (copyFrom групп): работает в рантайме, но через duck-typing по `.peek`/Object.keys (behaviors.ts readGroup/writeGroup) — тихая поломка при смене формы группы/не-сигнальном листе; `Behave.copy` сигнатура (Signal<V>) это скрывает, типобезопасности группового копирования НЕТ.
- Кейс 4 (per-item массива): валидация обходит live-массив ок, но (а) очистка ошибок для УДАЛЁННЫХ строк держит их сигналы в strong `owned` (leak); (б) per-item роутинг ошибок требует МАТЕРИАЛИЗАЦИИ массива (узел {array,item}); (в) `b.each` для поведения массива в behaviorCode вообще НЕ продемонстрирован (untested surface, тип-сигнатура расходится с core applyEach).
- Кейс 3 (условное поле): очистка ошибок через накопительный `owned` корректна ТОЛЬКО если validate хоть раз прогнан при mortgage; но связка compute+enableWhen с одинаковым `when` (иначе disabled-поле молча заполнится и утечёт в submit — задокументированный footgun, behaviors-node.ts:28-46) коллектором НЕ обеспечивается — автор держит её в голове, ровно как в ambient.

**Вердикт:** Половинчатая устойчивость. Близнец A (валидация) — честный эталон стабильности: только публичные швы (peek/get/getNodeForSignal.setErrors), ноль ambient, ноль shape-guessing, полная типобезопасность; кейсы 1-4 в валидации держит хорошо (кейс 5 — non-blocking да, но race-unsafe из-за запрета AbortSignal в Rule). Близнец B — косметика поверх того самого ambient-слоя, который аудит велит НЕ делать швом контракта: как написано в sharedInfra он не соберётся (ambient-операторы импортируются из умбреллы `@reformer/core`, где их нет — доказано всеми реальными консумерами, берущими их из `@reformer/core/behaviors`), а при «правильной» починке либо теряет cleanup не-ambient операторов (утечка), либо становится на 100% ambient, обнуляя главные заявления («без ambient», «замени мост»). Плюс type-эрозия на стыках (as-касты для enable/copy/each) возвращает нетипобезопасность, `owned` strong-Set побеждает GC-safe WeakMap, а валидация де-факто не подключена к submit. Симметрия и читаемость авторинга — реальны и ценны (readable 4), но заявленная стабильность держится только на валидационной половине; поведенческая половина стабильна лишь на поверхности. Итог: stability 3, readable 4, laconic 3 — приемлемо как «терсый сахар над ambient + образцовая валидация», но НЕ как единый стабильный контракт: behave остаётся ambient-зависимым, а презентованная инфра содержит конкретный wrong-import и discarded-cleanup баги.

---

## C — Ambient-hooks (расширить defineFormBehavior)

**Одна ambient-функция на всё: валидация — такие же самрегистрирующиеся операторы (rule/cross/whenActive), как compute/copyFrom/onChange.**

Тип: **единый** контракт · JS-примитивы: Обычные JS-функции (правило = (value)=>error|null, никакого DSL-дерева и угадывания форм объектов), spread-массивы (...rules), plain-объекты ValidationError, Symbol (ключи слотов в error-bus), WeakMap (bus нода→слоты, авто-GC), замыкания + module-level `cur` (ambient-стек блоков). Роль узла НЕ выводится из формы объекта — она задаётся именем оператора (rule/cross/compute), а поле адресуется типизированным сигналом model.$.x, а не строкой пути.

Оценки — самооценка (L/R/S): 5/3/2 · критика (L/R/S): 5/3/2

### Форма контракта

```ts
// Единый контракт: валидация И поведение в ОДНОМ ambient-setup.
type Rule<V> = (value: V) => ValidationError | null | Promise<ValidationError | null>; // value-only, как @reformer/core/validators
type SchemaScope<T> = { model: FormModel<T>; form: FormProxy<T> };
interface FormSchema<T> { __run(model, form): () => void }               // как FormBehavior (createForm({ behavior: schema }))

defineFormSchema<T>(setup: (s: SchemaScope<T>) => void): FormSchema<T>;   // ЕДИНАЯ ambient-функция

// операторы ВАЛИДАЦИИ (новые сиблинги поведенческих, тот же ambient-сток getScope):
rule<V>(sig: PathAwareSignal<V>, ...rules: Rule<V>[]): void;             // реактивная валидация поля (sync+async)
cross(target: PathAwareSignal<unknown>, produce: () => ValidationError | null): void; // cross-field → одна нода
whenActive(cond: () => boolean, body: () => void): void;                 // условный блок: mount/unmount правил + reset/disable

// операторы ПОВЕДЕНИЯ — переиспользуются БЕЗ изменений, тот же сток:
compute / copyFrom / onChange / enableWhen / applyEach;
```

### Инфраструктура контракта («цена»)

```ts
// ═══ ЦЕНА КОНТРАКТА: весь ambient-движок defineFormSchema (единый сток для валидации И поведения) ═══
import { effect, runOutsideEffect, getNodeForSignal } from '@reformer/core';
import type { FormModel, FormProxy, ValidationError } from '@reformer/core';
import type { Signal } from '@preact/signals-core';

export type PathAwareSignal<V> = Signal<V> & { readonly __path?: string };
export type Rule<V> = (value: V) => ValidationError | null | Promise<ValidationError | null>;
export type SchemaScope<T> = { model: FormModel<T>; form: FormProxy<T> };
export interface FormSchema<T> { __run(model: FormModel<T>, form: FormProxy<T>): () => void }

// ── ambient-сток: стек блоков (root + по блоку на каждый активный whenActive) ──
interface Block { cleanups: (() => void)[]; targets: Set<PathAwareSignal<unknown>> }
interface Ctx { model: unknown; form: unknown; stack: Block[] }
let cur: Ctx | null = null;                                    // ← «магия»: неявный текущий scope
const top = (op: string): Block => {
  if (!cur) throw new Error(`[schema] "${op}" вызван вне defineFormSchema(...)`);
  return cur.stack[cur.stack.length - 1];
};
const onDispose = (fn: () => void) => top('onDispose').cleanups.push(fn);

export function defineFormSchema<T>(setup: (s: SchemaScope<T>) => void): FormSchema<T> {
  return {
    __run(model, form) {
      const root: Block = { cleanups: [], targets: new Set() };
      const prev = cur;
      cur = { model, form, stack: [root] };
      try { setup({ model, form }); } finally { cur = prev; } // операторы регаются во время СИНХ. setup
      return () => root.cleanups.forEach((c) => c());
    },
  };
}

// ── error-bus: несколько операторов на ОДНУ ноду КОМПОНУЮТСЯ. Без него независимые effect'ы,
//    каждый зовущий node.setErrors(), затирали бы друг друга (rule#1 vs rule#5 vs cross на одном поле). ──
const node = (sig: PathAwareSignal<unknown>) => getNodeForSignal(sig as Signal<unknown>);
const bus = new WeakMap<object, Map<symbol, ValidationError[]>>();
function slotsOf(sig: PathAwareSignal<unknown>) {
  const n = node(sig); if (!n) return null;
  let m = bus.get(n); if (!m) bus.set(n, (m = new Map()));
  return { n, m };
}
function emit(sig: PathAwareSignal<unknown>, slot: symbol, errs: ValidationError[]) {
  const s = slotsOf(sig); if (!s) return;
  s.m.set(slot, errs);
  s.n.setErrors([...s.m.values()].flat());                    // нода показывает ОБЪЕДИНЕНИЕ слотов
}
function clearSlot(sig: PathAwareSignal<unknown>, slot: symbol) {
  const s = slotsOf(sig); if (!s) return;
  s.m.delete(slot);
  s.n.setErrors([...s.m.values()].flat());
}

// ── операторы ВАЛИДАЦИИ (новое; сиблинги compute/copyFrom, тот же сток `cur`) ──
export function rule<V>(sig: PathAwareSignal<V>, ...rules: Rule<V>[]): void {
  top('rule').targets.add(sig as PathAwareSignal<unknown>);
  const slot = Symbol('rule');
  let run = 0;                                                 // токен свежести для async
  onDispose(effect(() => {
    const value = sig.value;                                   // реактивная подписка на поле
    const token = ++run;
    const out = rules.map((r) => r(value));                    // каждое правило вызывается РОВНО раз
    const sync = out.filter((x): x is ValidationError | null => !(x instanceof Promise));
    const pend = out.filter((x): x is Promise<ValidationError | null> => x instanceof Promise);
    const flush = (extra: (ValidationError | null)[]) =>
      emit(sig as PathAwareSignal<unknown>, slot,
           [...sync, ...extra].filter(Boolean) as ValidationError[]);
    runOutsideEffect(() => flush([]));                         // sync-ошибки сразу
    if (pend.length) Promise.allSettled(pend).then((res) => {
      if (token !== run) return;                               // устаревший ответ отбрасываем (F2)
      flush(res.map((r) => (r.status === 'fulfilled' ? r.value : null))); // reject(сеть) → null → НЕ блокирует
    });
  }));
  onDispose(() => clearSlot(sig as PathAwareSignal<unknown>, slot));
}

export function cross(target: PathAwareSignal<unknown>, produce: () => ValidationError | null): void {
  top('cross').targets.add(target);
  const slot = Symbol('cross');
  onDispose(effect(() => {
    const e = produce();                                       // читает model.* реактивно (auto-tracking)
    runOutsideEffect(() => emit(target, slot, e ? [e] : []));
  }));
  onDispose(() => clearSlot(target, slot));
}

// ── whenActive: монтирует ВНУТРЕННИЕ правила пока условие истинно; при выкл. — dispose (ошибки гаснут
//    через снятие слотов) + reset/disable затронутых полей. Здесь ЖИВЁТ главная ambient-хрупкость:
//    body() выполняется ОТЛОЖЕННО (в effect, после setup), когда `cur` уже null — приходится ЗАХВАТИТЬ
//    ctx при регистрации и ВОССТАНОВИТЬ его вокруг лениво вызываемого body(). ──
export function whenActive(condition: () => boolean, body: () => void): void {
  const ctx = cur!;                                            // захват ambient-ctx для отложенного body()
  let block: Block | null = null;
  const deactivate = () => {
    if (!block) return;
    block.cleanups.forEach((c) => c());                        // dispose внутренних rule → слоты сняты → ошибки гаснут
    block.targets.forEach((sig) => { const n = node(sig) as any; n?.reset?.(); n?.disable?.(); });
    block = null;
  };
  onDispose(effect(() => {
    const on = condition();                                    // реактивно
    runOutsideEffect(() => {
      if (on && !block) {
        block = { cleanups: [], targets: new Set() };
        const prev = cur; cur = ctx; ctx.stack.push(block);    // ← восстановление ambient для ленивого body
        try { body(); } finally { ctx.stack.pop(); cur = prev; }
        block.targets.forEach((sig) => (node(sig) as any)?.enable?.());
      } else if (!on) deactivate();
    });
  }));
  onDispose(deactivate);
}

// ── операторы ПОВЕДЕНИЯ — те же compute/copyFrom/onChange/enableWhen/applyEach из behaviors.ts,
//    ПЕРЕСЕЛЁННЫЕ на единый сток `cur` (было: приватный `current` внутри behaviors.ts). Тела не меняются —
//    меняется только на какой onDispose/getScope они пишут. Это и есть «унификация в одну ambient-функцию». ──
export { compute, copyFrom, onChange, enableWhen, applyEach } from './behavior-ops-rehomed';
```

### Валидация (кейсы 1–5)

```ts
// ═══ КЕЙСЫ 1-5 — операторы валидации. Живут в ТОМ ЖЕ теле defineFormSchema, что и поведение (кейсы 6-8).
//     Показаны отдельным срезом; физически стоят рядом с compute/copyFrom ниже — контракт ЕДИНЫЙ.
export const schema = defineFormSchema<Root>(({ model, form }) => {

  // 1) required + pattern на поле
  rule(model.$.username,
    required({ message: 'Укажите логин' }),
    pattern(/^[a-z0-9_]{3,20}$/i, { message: 'Только a-z, 0-9, _' }));

  // 2) cross-field: loanAmount ≤ propertyValue − initialPayment (обычный код, читает model.* реактивно)
  cross(model.$.loanAmount, () =>
    model.loanAmount > model.propertyValue - model.initialPayment
      ? { code: 'exceedsCollateral', message: 'Больше залога за вычетом взноса' }
      : null);

  // 3) УСЛОВНОЕ поле: propertyValue существует только при mortgage.
  //    whenActive сам делает enable при вкл. / clearErrors+reset+disable при выкл. (снятие ошибок — даром,
  //    т.к. dispose внутренних rule снимает их слоты из error-bus → нода гаснет).
  whenActive(() => model.loanType === 'mortgage', () => {
    rule(model.$.propertyValue, required(), min(1_000_000));
    cross(model.$.loanAmount, () =>                          // доп. правило только в режиме mortgage
      model.initialPayment < model.propertyValue * 0.1
        ? { code: 'downPayment', message: 'Первый взнос ≥ 10%' } : null);
  });

  // 4) per-item валидация массива: coBorrowers[i].email обязателен
  applyEach(model.$.coBorrowers, defineFormSchema<CoBorrower>(({ model: row }) => {
    rule(row.$.email, required({ message: 'E-mail созаёмщика' }), email());
  }));

  // 5) async: занятость username через fetch; сетевой сбой НЕ блокирует (reject → null).
  //    Отдельный rule() на том же поле — компонуется с кейсом 1 через error-bus, а не затирает его.
  rule(model.$.username, async (u) => {
    if (!u) return null;
    try {
      const r = await fetch(`/api/username-taken?u=${encodeURIComponent(u)}`);
      return (await r.json()).taken ? { code: 'taken', message: 'Логин занят' } : null;
    } catch { return null; }                                 // сеть упала → пропускаем, сабмит не блокируем
  });

  // …кейсы 6-8 (compute/copyFrom/onChange) — в этом же теле, см. behaviorCode.
});
```

### Поведение (кейсы 6–8)

```ts
// ═══ КЕЙСЫ 6-8 — операторы поведения. ТО ЖЕ тело defineFormSchema, что и валидация выше (контракт ЕДИНЫЙ):

  // 6) computed с auto-tracking: monthlyPayment = fn(model)
  compute(model.$.monthlyPayment, () =>
    annuity(model.loanAmount, model.rate, model.loanTerm));

  // 7) copyFrom с when: residenceAddress ← registrationAddress когда sameAsRegistration
  copyFrom(model.$.registrationAddress, model.$.residenceAddress,
    { when: () => model.sameAsRegistration === true });

  // 8) onChange side-effect: при age меняем max у loanTerm через updateComponentProps ноды
  onChange(model.$.age, (age) =>
    form.loanTerm.updateComponentProps({ max: age >= 60 ? 120 : 360 }));
```

### JSON-совместимость

JSON-схема несёт ТОЛЬКО layout и функций не сериализует, поэтому defineFormSchema остаётся TS-модулем рядом с json-schema.json и инъектируется в рантайме — ровно как текущий render-behavior. Ключевое: операторы адресуются к model.$.x (сигналы модели) и роутят ошибки через getNodeForSignal(sig).setErrors(), а НЕ через layout-узлы JSON. Значит одна и та же schema-функция цепляется к форме, собранной из JSON, без изменений — при условии, что рантайм при сборке из JSON строит FormModel + заполняет реестр сигнал→нода (это делает createForm/createFormFromModel). Передаётся как createForm({ schema }) (место текущего behavior). Ограничение честное: сериализовать rule/cross/compute нельзя (это функции), так что в чистом data-only JSON-пайплайне валидация/поведение остаются кодом-компаньоном; вариант НЕ даёт декларативной data-формы правил — это цена опоры на ambient-функции и замыкания.

### Компромиссы (автор)

ПЛЮСЫ: максимально терсово — один mental-model, одна функция, ноль церемоний (нет отдельных Collector/Check/раннера, нет ручного роутинга getNodeForSignal — оператор делает всё сам). Валидация неотличима по стилю от поведения → автор не переключает контекст. Типобезопасно через model.$.x (никаких строковых путей) и БЕЗ угадывания формы объектов (роль узла = имя оператора, не {value,validators}). МИНУСЫ (честно, ось stable=2): (1) ambient getScope/`cur` — операторы работают только внутри неявного контекста, чувствительны к порядку/месту, тяжело юнит-тестить изолированно. (2) whenActive добавляет НОВУЮ хрупкость, которой в текущем behavior нет: его body() вызывается лениво (в effect, когда `cur===null`), поэтому приходится захватывать и восстанавливать ambient-ctx вокруг отложенного вызова — самая «магическая» часть. (3) Валидация становится РЕАКТИВНОЙ всегда (effect на каждое изменение), а не on-demand: ошибки владеются эффектами, а не слоем validateFormModel — в доках это помечено как «исключение» (W1/W3), здесь это основной путь; touched/submit-гейтинг «когда показывать ошибку» придётся встраивать в операторы отдельно. (4) Роутинг через setErrors требует error-bus (WeakMap+Symbol-слоты), иначе rule+cross на одном поле затирают друг друга — это реальная цена в sharedInfra, которой у аккумулирующего Collector'а (Contract B) нет бесплатно. Итог: терсовость и единство — по максимуму; предсказуемость/тестируемость/владение ошибками — принесены в жертву ambient-магии.

### Критика (адверсариальная)

**Сильные стороны**

- Genuinely maximal terseness: один mental-model, одна функция, ноль церемоний — нет отдельных Collector/Check/раннера, оператор сам роутит в ноду. laconic=5 заслужено.
- Адресация поля строго типобезопасна через model.$.x (PathAwareSignal<T>), роль узла задаётся ИМЕНЕМ оператора (rule/cross/compute), а не формой объекта {value,validators} — это реально уходит от fragile shape-guessing walk(). Правило Rule<V>=(v:V)=>err|null value-only и типизировано против типа поля.
- error-bus (WeakMap<node,Map<symbol,errors>>) — корректное решение реальной проблемы: несколько операторов на одной ноде (rule#1 + async rule#5 + cross) КОМПОНУЮТСЯ через слоты вместо взаимного затирания setErrors(). Это то, чего у наивного «каждый effect зовёт setErrors» нет бесплатно.
- JSON-совместимость выражена честно и верно: schema остаётся TS-модулем, инъектируется в рантайме, цепляется к форме через идентичность сигнала getNodeForSignal(sig).setErrors(), НЕ через layout-узлы JSON. Одна и та же функция работает и для рукописной, и для JSON-собранной формы — при условии заполненного реестра сигнал→нода.
- async честно неблокирующий: reject/сеть → catch → null (кейс 5 базово тянет), плюс токен свежести run для отбрасывания устаревших ОТВЕТОВ при повторном ре-ране того же rule.

**Риски / failure-modes**

- РЕХОУМ = скрытый форк внутреннего модуля, а не переиспользование. Заявление «compute/copyFrom/onChange/enableWhen/applyEach переиспользуются БЕЗ изменений» ЛОЖНО. Проверено по behaviors.ts: `current` (L65) — приватная module-local; compute/copyFrom/onChange/applyEach резолвятся через module-local onDispose/getScope, замкнутые на `current`. defineFormSchema.__run ставит СВОЮ `cur`, а не `current`. Значит: (а) re-export настоящих ops из @reformer/core → внутри setup они зовут core-onDispose → requireCtx('onDispose') БРОСАЕТ «вызван вне defineFormBehavior», потому что core-`current===null`. Кейсы 6/7/8 в написанном виде не запускаются вовсе. (б) Единственный способ — форкнуть их в ./behavior-ops-rehomed на приватную `cur`, скопировав markDerived/refcount/makeCycleGuard/AbortController-логику. Это дублирование внутренней бухгалтерии, которое дрейфует при каждом изменении behaviors.ts. Это самый глубокий stable-дефект варианта.
- whenActive РЕЗЕТИТ И ДИЗЕЙБЛИТ ВСЕ target'ы внутренних операторов, включая ШАР�еные поля. В кейсе 3 внутри whenActive есть cross(model.$.loanAmount,…) → loanAmount попадает в block.targets. При выключении mortgage deactivate() делает node(loanAmount).reset()+disable() — стирает пользовательский ввод и дизейблит ВСЕГДА-видимое поле loanAmount, которое ещё и валидируется root-level cross (кейс 2). Итог: рассинхрон (root cross продолжает emit'ить ошибки в дизейбленную ноду) + потеря данных. Ментальная модель автора («whenActive сбрасывает только условное поле») неверна — cross-target'ы протекают в reset-набор.
- Устаревший async ВОСКРЕШАЕТ ошибку на снесённом поле. При выключении whenActive block.cleanups → clearSlot снимает слот, но in-flight Promise замкнул slot+sig; на .then он зовёт emit(sig,slot,…), а slotsOf ПЕРЕСОЗДАёт map и ВНОВЬ вставляет слот → ошибка появляется на уже reset/disable-нутом (скрытом) поле. Токен run не инкрементится при dispose (token===run остаётся true), поэтому freshness-guard не спасает, а перечистить некому — effect уже disposed. Конкретная утечка на стыке кейсов 3+5.
- Двойное владение errors. behaviors.ts (L10-14) ЯВНО: валидация — отдельный слой, владелец errors — validateFormModel. Здесь валидация переносится в реактивные effect'ы + setErrors через bus, невидимый для validateFormModel. Если приложение на submit зовёт стандартный validateFormModel (create-form.ts L273-284 wired при {schema}) — он setErrors'ит по СВОЕЙ схеме и клобберит bus-ошибки (или наоборот). Кто пишет последним — тот и виден. Согласовать submit-блокировку с bus нечем: bus не экспонирует ни «validateAll now», ни await pending → на submit нельзя гарантированно дождаться незапущенных/in-flight async-правил (кейс 5 на границе submit не решён).
- Валидация теперь ВСЕГДА реактивна (effect на каждое изменение с mount), а не on-demand. Ошибки принадлежат эффектам, а не validateFormModel. touched/submit-гейтинг «когда ПОКАЗЫВАТЬ ошибку» не встроен → на первом mount все required-поля сразу красные. В доках это помечено как исключение (W1/W3), здесь это основной путь. Плюс sync-flush идёт через runOutsideEffect (микротаск) → на каждый keystroke async-слот на том же поле (username: кейс1 rule + кейс5 async — РАЗНЫЕ слоты) мигает «taken» off→on.
- Ambient-магия усилена относительно текущего behavior: whenActive.body() вызывается ЛЕНИВО в effect, когда cur===null, поэтому приходится захватывать ctx при регистрации и ВОССТАНАВЛИВАТЬ (cur=ctx; stack.push) вокруг отложенного body. Корректность держится на отсутствии ре-энтрантности при этом восстановлении — любой синхронно-флашнутый вложенный effect увидит чужой cur. Операторы бросают вне defineFormSchema → изолированный юнит-тест rule()/cross() невозможен без поднятого ambient.
- Node-side операции whenActive идут через `(node(sig) as any)?.reset?.()/.disable?.()/.enable?.()` — нетипизированный duck-typing по методам ноды: если нода без reset/disable (группа/иной вид) — тихий no-op, ровно тот fragile-паттерн, от которого контракт должен уходить. cross(target: PathAwareSignal<unknown>) теряет привязку типа поля к таргету (unknown).

**Пробелы покрытия**

- Кейс 3 (условное поле) — тянет ХУЖЕ ВСЕГО: whenActive reset+disable протекает на cross-target loanAmount (стирает данные + дизейблит шаренное поле), плюс stale-async воскрешает ошибку на снесённом поле. Именно комбинация «сбросить/снять ошибки при выключении» реализована некорректно.
- Кейсы 6, 7, 8 (compute/copyFrom/onChange) — как написано (re-export настоящих @reformer/core ops) НЕ РАБОТАЮТ: операторы замкнуты на core-`current`, а defineFormSchema ставит `cur` → requireCtx бросает. Работают только через скрытый форк ./behavior-ops-rehomed, т.е. ценой дублирования внутреннего модуля.
- Кейс 5 (async) — базовый неблокирующий путь ок, но на границе submit нет способа дождаться pending/запустить незатронутые правила (bus не экспонирует await), и stale-emit после dispose whenActive воскрешает ошибку; на общем с кейсом-1 поле username слот мигает на каждый keystroke.
- Кейс 4 (per-item массив) — работает лишь если applyEach тоже форкнут на `cur` и FormSchema.__run (возвращает ()=>void) совместим с ожидаемым BehaviorCleanup; та же зависимость от форка, что и 6/7/8.
- Кейс 2 (cross-field root) — сам по себе ок, но тот же cross-паттерн внутри whenActive и есть источник reset-leak; target типизирован как unknown (мелкая потеря типобезопасности).

**Вердикт:** Терсовость и единство контракта — на максимуме (laconic 5), и вариант честно уходит от shape-guessing (роль = имя оператора) и строковых путей (model.$.x). error-bus и JSON-история — реальные сильные стороны. Но заявленная стабильность не подтверждается — и не только по «философской» оси ambient-магии, а КОНКРЕТНЫМИ дефектами: (1) «переиспользование behavior-ops без изменений» фактически ложно — операторы замкнуты на приватную module-local `current`, поэтому единство достигается только скрытым ФОРКОМ внутреннего модуля behaviors.ts, который дрейфует; (2) whenActive reset/disable протекает на cross-target шаренных полей (потеря данных + дизейбл loanAmount); (3) stale-async воскрешает ошибки на снесённых полях; (4) двойное владение errors с validateFormModel и отсутствие submit-time await для async. Это не «tersеность в жертву тестируемости», а несколько correctness-багов. stabilityScore=2 — верхняя граница честного, реально ближе к 1: кейс 3 сломан, кейсы 6/7/8 без форка не запускаются. Рекомендация обратная духу варианта: держать валидацию как императивный value-only Check/Collector на явных хендлах (signal.peek()/model.get()/getNodeForSignal(sig).setErrors()) с накопительным коллектором вместо реактивного bus, а поведение — на слое value-ops (computeFrom/copyFrom/enableWhen, уже возвращающих BehaviorCleanup) с ЯВНЫМ register, а не на общем ambient `cur`. Ambient defineFormSchema уместен как сахар, но не как шов контракта.

---

## D — Плоские данные + интерпретатор

**Схема формы = плоский массив тегированных POJO ({kind}); один интерпретатор run(model, schema) разворачивает и валидацию, и поведение через публичные примитивы.**

Тип: **единый** контракт · JS-примитивы: Массивы тегированных POJO (Schema = Node[]) + чистые функции-правила/read/when/effect как значения-листья. Из ReFormer опирается только на публичные стабильные примитивы: compute/copyFrom/enableWhen/onChange (ambient-ops), getNodeForSignal().setErrors([]), node.updateComponentProps(), signal.peek(), value-proxy root.field. Никакого кастомного DSL-дерева, которое движок читает по «магической» форме — каждый узел несёт явный discriminant kind.

Оценки — самооценка (L/R/S): 4/4/3 · критика (L/R/S): 4/3/2

### Форма контракта

```ts
// Дискриминированный union — ЯВНЫЙ kind, никакого угадывания форм объектов.
type Rule<V=any> = (value: V, root: FormModel<any>) => ValidationError | null | Promise<ValidationError|null>;

interface FieldNode  { kind:'field';  sig: Sig<any>; rules?: Rule[]; activeWhen?: (r)=>boolean; resetOnDisable?: boolean }
interface EachNode   { kind:'each';   arr: Sig<any[]>; build: () => ItemField[] }        // ItemField = { kind:'itemField'; key; rules }
interface ComputeNode{ kind:'compute';sig: Sig<any>; read: ()=>any; when?: ()=>boolean }
interface CopyNode   { kind:'copy';   source: Sig<any>; target: Sig<any>; when?: ()=>boolean }
interface ReactNode  { kind:'react';  source: Sig<any>; effect: (v, ctx:{node})=>void }
type Node = FieldNode | EachNode | ComputeNode | CopyNode | ReactNode;
type Schema = Node[];

// фабрики: обычные фн → тегированный POJO
field(sig, opts) / item(key, rules) / each(arr, build) / derive(sig, read, when?) / copy(src, tgt, when?) / react(src, effect)

// единый интерпретатор над ОДНОЙ схемой:
run<T>(build: (m: FormModel<T>) => Schema): { behavior: FormBehavior<T>; validatorFor(m): { validate(keep?) } }
```

### Инфраструктура контракта («цена»)

```ts
import {
  compute as computeOp, copyFrom, enableWhen, onChange,
  getNodeForSignal, defineFormBehavior,
  type FormModel, type PathAwareSignal, type ValidationError, type FormNode, type FormBehavior,
} from '@reformer/core';

type M = FormModel<any>;
type Sig<V> = PathAwareSignal<V>;
type Rule<V = any> = (value: V, root: M) => ValidationError | null | Promise<ValidationError | null>;
interface ItemField { kind: 'itemField'; key: string; rules: Rule[] }
// ... (Node union из contractShape)

// --- фабрики: обычные фн → тегированный POJO (data, форма сериализуема) ---
const field = (sig: Sig<any>, o: Omit<FieldNode, 'kind' | 'sig'> = {}): FieldNode => ({ kind: 'field', sig, ...o });
const item  = (key: string, rules: Rule[]): ItemField => ({ kind: 'itemField', key, rules });
const each  = (arr: Sig<any[]>, build: () => ItemField[]): EachNode => ({ kind: 'each', arr, build });
const derive= (sig: Sig<any>, read: () => any, when?: () => boolean): ComputeNode => ({ kind: 'compute', sig, read, when });
const copy  = (source: Sig<any>, target: Sig<any>, when?: () => boolean): CopyNode => ({ kind: 'copy', source, target, when });
const react = (source: Sig<any>, effect: ReactNode['effect']): ReactNode => ({ kind: 'react', source, effect });

// --- ЕДИНЫЙ интерпретатор: wire (реактивные поведения) + validatorFor (валидация по требованию) ---
function run<T>(build: (m: FormModel<T>) => Schema) {
  const behavior: FormBehavior<T> = defineFormBehavior<T>(({ model }) => {
    for (const n of build(model)) wire(n, model as M);        // ambient-ops само-регистрируются в scope
  });
  const validatorFor = (model: FormModel<T>) => {
    const nodes = build(model);
    return { validate: (keep?: (n: FieldNode) => boolean) => validate(model as M, nodes, keep) };
  };
  return { behavior, validatorFor };
}

// поведения — публичные операторы; switch по ЯВНОМУ kind (не по форме объекта)
function wire(n: Node, model: M) {
  switch (n.kind) {
    case 'compute': computeOp(n.sig, n.read, n.when ? { when: n.when } : undefined); break;
    case 'copy':    copyFrom(n.source, n.target, n.when ? { when: n.when } : undefined); break;
    case 'react':   onChange(n.source, (v) => n.effect(v, { node: getNodeForSignal })); break;
    case 'field':   if (n.activeWhen) enableWhen(n.sig, () => n.activeWhen!(model), { resetOnDisable: n.resetOnDisable }); break;
    case 'each':    break; // per-item поведения — applyEach(n.arr, ...); ни один из 8 кейсов не требует
  }
}

// валидация по требованию — data-driven, роутит ошибки getNodeForSignal + node.setErrors([])
async function validate(model: M, nodes: Node[], keep?: (n: FieldNode) => boolean): Promise<boolean> {
  const jobs: Promise<void>[] = [];
  let ok = true;
  const runRules = (rules: Rule[] | undefined, value: any, target?: FormNode<any>) => {
    if (!target) return;
    jobs.push((async () => {
      const errs: ValidationError[] = [];
      for (const r of rules ?? []) { const e = await r(value, model); if (e) errs.push(e); }  // await = sync+async
      target.setErrors(errs);                        // [] гасит: посещаем каждое поле → стейл-ошибки снимаются
      if (errs.length) ok = false;
    })());
  };
  for (const n of nodes) {
    if (n.kind === 'field') {
      if (keep && !keep(n)) continue;
      const target = getNodeForSignal(n.sig);
      if (n.activeWhen && !n.activeWhen(model)) { target?.setErrors([]); continue; }  // условное OFF → clear
      runRules(n.rules, n.sig.peek(), target);
    } else if (n.kind === 'each') {
      const rows = (n.arr.peek() as any[]) ?? [];
      const arrNode = getNodeForSignal(n.arr) as any;         // ArrayNode
      rows.forEach((row, i) => {
        const proxy = arrNode?.at(i);                         // FormProxy<Item> — самый непокрытый шов
        for (const f of n.build()) runRules(f.rules, row?.[f.key], proxy?.[f.key]);
      });
    }
  }
  await Promise.all(jobs);
  return ok;
}
```

### Валидация (кейсы 1–5)

```ts
import { required, min, pattern, email } from '@reformer/core/validators';
import type { FormModel } from '@reformer/core';
import type { CreditForm } from './types';
type M = FormModel<CreditForm>;

// (2) cross-field — обычный код, читает root value-proxy: loanAmount ≤ propertyValue − initialPayment
const withinCollateral: Rule<number> = (value, root) =>
  value > (root.propertyValue ?? 0) - (root.initialPayment ?? 0)
    ? { code: 'exceedsCollateral', message: 'Сумма превышает залог за вычетом взноса' } : null;

// (5) async — сетевой сбой НЕ блокирует (rule сам ловит и возвращает null)
const usernameFree: Rule<string> = async (value) => {
  if (!value) return null;
  try {
    const r = await fetch(`/api/username-free?u=${encodeURIComponent(value)}`);
    return (await r.json()).free ? null : { code: 'taken', message: 'Логин уже занят' };
  } catch { return null; }
};

export const validationNodes = (m: M): Schema => [
  // (1) required + pattern (+ async на том же поле)
  field(m.$.username, { rules: [required(), pattern(/^[a-z0-9_]{3,}$/i, { message: 'a-z 0-9 _' }), usernameFree] }),
  // (2) cross-field
  field(m.$.loanAmount, { rules: [required(), min(50_000), withinCollateral] }),
  // (3) УСЛОВНОЕ поле: валидировать/включать/сбрасывать только при mortgage; выключено → setErrors([])
  field(m.$.propertyValue, {
    rules: [required(), min(1_000_000)],
    activeWhen: (r) => r.loanType === 'mortgage',
    resetOnDisable: true,
  }),
  // (4) per-item валидация массива — item(key,rules) относительно строки
  each(m.$.coBorrowers, () => [ item('email', [required(), email()]) ]),
];
```

### Поведение (кейсы 6–8)

```ts
import type { FormModel } from '@reformer/core';
import type { CreditForm } from './types';
type M = FormModel<CreditForm>;

const monthly = (m: M) => (m.loanAmount ?? 0) * 0.01 / (1 - Math.pow(1.01, -(m.loanTerm ?? 1)));
const maxTermForAge = (age: number) => Math.max(1, Math.min(30, 65 - age));

export const behaviorNodes = (m: M): Schema => [
  // (6) computed, auto-tracking (read читает m.* value-proxy → подписка)
  derive(m.$.monthlyPayment, () => monthly(m)),
  // (6b) computed под тем же условием, что enableWhen поля — иначе утечёт в disabled (док-правило)
  derive(m.$.initialPayment, () => (m.propertyValue ?? 0) * 0.2, () => m.loanType === 'mortgage'),
  // (7) copyFrom с when: residenceAddress ← registrationAddress
  copy(m.$.registrationAddress, m.$.residenceAddress, () => m.sameAsRegistration === true),
  // (8) onChange side-effect: age → loanTerm.max через ноду (ctx.node, без замыкания на form)
  react(m.$.age, (age, ctx) => ctx.node(m.$.loanTerm)?.updateComponentProps({ max: maxTermForAge(age) })),
];

// СБОРКА: одна схема — оба консумера
export const creditForm = run<CreditForm>((m) => [ ...validationNodes(m), ...behaviorNodes(m) ]);
// createForm({ model, schema: layout, behavior: creditForm.behavior });
// const { validate } = creditForm.validatorFor(model);
// wizard: validateStep: (s) => validate(inStep(s)), validateAll: () => validate();
```

### JSON-совместимость

Самый близкий к JSON из всех вариантов. СТРУКТУРА схемы (kind + вложенность each/itemField) сериализуема как есть; несериализуемы только ЛИСТЬЯ — sig (но PathAwareSignal несёт __path, т.е. кладётся строкой-путём) и функции (rules/read/when/effect). JSON-вариант: { kind:'field', path:'loanAmount', rules:['required','min:50000','withinCollateral'] } — интерпретатор резолвит имена правил и путь через реестр (тот же механизм name→fn, что renderer-json уже применяет для $component/$dataSource/$fn). Для формы, СОБРАННОЙ из JSON (layout из JSON, функции нельзя сериализовать): TS-схема живёт отдельно и инъектируется в рантайме — creditForm.behavior в createForm, а validatorFor(model).validate в wizard-config через onInit/patchProps, ровно как validation.ts инъектится сегодня. Уникальный бонус: fn-листья можно ИНКРЕМЕНТАЛЬНО поднимать в JSON, заменяя на $fn(name) — путь миграции, которого нет у closure-контрактов (B/behavior).

### Компромиссы (автор)

ПЛЮСЫ: (1) схема — инспектируемые данные: список тегированных записей, один ментальный образ и для валидации, и для поведения; (2) ЯВНЫЙ kind убивает угадывание форм объектов ({value,validators} vs {when,children}) — переименование ключа = ошибка компиляции, а не тихая поломка; (3) call-sites терсовые и однородные; (4) ближе всех к сериализации → реальный путь миграции в JSON. МИНУСЫ (честно): (1) вы теперь ВЛАДЕЕТЕ интерпретатором — ~70 строк движка (run/wire/validate) это цена; switch-по-kind — это тот же «walk», просто типобезопасный: новый kind = правка движка в двух местах; (2) per-item роутинг ошибок массива (arrNode.at(i)[key].setErrors) — самый непокрытый документацией шов, зависит от ArrayNode.at и индексации нод; (3) ambient-магия не убрана, а обёрнута: wire() всё равно зовёт compute/copyFrom/onChange, которые само-регистрируются через getScope() внутри defineFormBehavior — стабильность поведений наследуется от них, не улучшается; (4) валидация pull-based (validate() по требованию), cross-field пересчитывается в момент вызова, не мгновенно (совпадает с golden validateFormModel, но это надо знать); (5) индиректность: глядя на запись схемы, не видишь ЧТО выполнится — надо доверять интерпретатору (readable-как-конфиг, но opaque-как-механизм) — поэтому stable=3, а не 4.

### Критика (адверсариальная)

**Сильные стороны**

- Явный discriminant `kind` действительно убивает угадывание форм объектов в СОБСТВЕННОМ диспетчере: switch по строковому литералу типобезопасен, новый kind — ошибка компиляции exhaustiveness, а не тихая поломка. Это честное улучшение над walk-эвристиками {value,validators}/{when,children}.
- Call-sites однородны и терсовы: все 8 кейсов читаются как одна ментальная модель — список тегированных POJO; и валидация, и поведение выглядят одинаково. Laconic на месте вызова реально высокий.
- Схема — инспектируемые ДАННЫЕ: список записей можно распечатать/пройти/сериализовать структурно, чего closure-контракты (B) не дают. Структура (kind + вложенность each/itemField) действительно сериализуема.
- Поведенческая половина (`wire` → compute/copyFrom/enableWhen/onChange) построена строго на публичных операторах, наследует их cycle-guard (makeCycleGuard) и AbortSignal-контракт onChange — то есть стабильность поведений не хуже golden defineFormBehavior.
- Кейсы 1 (required+pattern) и 6 (computed auto-tracking) работают чисто и без оговорок; async-правило (5) корректно ловит сетевой сбой и возвращает null (не блокирует), await в раннере единый для sync/async.

**Риски / failure-modes**

- ГОЛОВНОЙ: `validate` резолвит массив через getNodeForSignal(n.arr), но сигнал массива в реестр не попадает — единственный registerSignalNode (create-form.ts:260) вызывается только в цикле collectLeafPaths, где `if (Array.isArray(val)) continue` (стр.176). getNodeForSignal(m.$.coBorrowers)===undefined → arrNode?.at(i)→undefined → proxy?.[key]→runRules(...,undefined)→ранний return. Per-item валидация — МОЛЧАЛИВЫЙ no-op против реального движка. Docstring getNodeForSignal прямо предупреждает про этот режим ('элемент массива, строится per-item') — вариант оперся на примитив там, где его же доки гарантируют undefined.
- validate() до createForm (реестр пуст) → все getNodeForSignal=undefined → все runRules рано-return → ok=true вакуумно ('всё валидно' на непостроенной форме). Порядок-зависимость без compile-guard; тихий false-negative валидации.
- Потеря типобезопасности на оси stability: field(sig:Sig<any>,{rules?:Rule[]}) не связывает тип сигнала с типом правил — field(m.$.age,{rules:[email()]}) компилируется. Contract B (<T>(sig,...rules:Rule<T>[])) эту связь держит. Гетерогенный Node[] структурно стирает per-node дженерики (FieldNode<number> и FieldNode<string> в одном массиве ⇒ Node=FieldNode<any>).
- item(key:string,rules) — реинкарнация анти-паттерна 'строковые пути вместо сигналов': row?.[f.key]/proxy?.[f.key] молчат на опечатке ('emial'→undefined), нет типового контроля ни ключа, ни правил против типа элемента.
- Async-гонка: Rule=(value,root) без AbortSignal, validate() без generation-token и без отмены прежних jobs — два быстрых validate() (blur во время step-submit) ⇒ stale setErrors медленного username-запроса затирает свежий результат. onChange такую гонку закрывает AbortSignal'ом, а pull-раннер — нет.
- Индиректность механизма: 'единая схема' — это на деле ДВА непересекающихся интерпретатора над одним списком (wire игнорит rules, validate игнорит compute/copy/react); реально общий только kind:'field'. Владение ~70 строками движка = switch-по-kind это тот же walk, просто типобезопасный; новый kind = правка движка в двух местах.

**Пробелы покрытия**

- Кейс 4 (per-item массив) — ФАКТИЧЕСКИ СЛОМАН: getNodeForSignal(сигнал-массива)=undefined (массивы не в реестре), setErrors на строку не роутится; плюс стрингли-ключ item('email') без типобезопасности. Самый слабый кейс — не 'под-документирован', а не работает.
- Кейс 3 (условное поле) — частично: enableWhen(resetOnDisable) сбрасывает ЗНАЧЕНИЕ реактивно, но ОШИБКУ гасит только следующий pull-validate() (слои ошибок и enable/reset разведены). Окно stale-ошибки на скрытом/disabled propertyValue при переключении loanType без ревалидации. Плюс activeWhen перегружен: гейт валидации И disable+reset ноды неразделимы — нельзя валидировать условно, оставив поле включённым.
- Кейс 5 (async) — работает, но с гонкой: нет отмены устаревших ответов между двумя validate(); последний setErrors побеждает независимо от порядка старта.
- Кейс 2 (cross-field) — только pull-based: withinCollateral пересчитывается в момент validate(), не мгновенно при смене propertyValue/initialPayment (совпадает с golden, но cross-field не 'живой').
- Кейс 7 (copyFrom групп-адресов) — опирается на фрагильный group-copy шов ambient copyFrom (readGroup/writeGroup по Object.keys, isSignal по .peek, __path на групповом узле — не в публичном ModelSignals), а не на чистый скалярный copyFrom.
- Кейс 8 (onChange side-effect) — работает, но react-фабрика не пробрасывает immediate: начальный age не выставит loanTerm.max до первого изменения; react также строго слабее raw onChange (ест AbortSignal ctx, подменяя его на {node}).

**Вердикт:** Заявленную стабильность отклоняю: self-score stable=3 завышен, реально 2. Вариант терсовый и инспектируемый (data-schema — сильная сторона, discriminant kind честно убивает shape-guessing в его собственном диспетчере), НО его флагманская фича — 'единый интерпретатор валидации+поведения, включая per-item массивы' — НЕ РАБОТАЕТ против текущего движка: сигналы массивов не регистрируются в signal→node реестре (create-form.ts:176 пропускает массивы), поэтому getNodeForSignal(сигнал-массива)=undefined и per-item setErrors — молчаливый no-op (кейс 4 сломан, верифицировано в исходниках). Вдобавок вариант РЕИМПОРТИРУЕТ ровно две фрагильности, которые контракт обязан устранять: стрингли-ключи item(key:string) и потерю связки тип-сигнала↔тип-правила (field принимает Sig<any>/Rule<any> — то, что Contract B держит дженериком). Ambient-магия не убрана, а обёрнута (wire всё равно зовёт само-регистрирующиеся compute/copyFrom/onChange). Плюс два тихих false-состояния: validate-до-createForm даёт вакуумный valid, и async-гонка stale-setErrors без generation-guard. Итог: как КОНФИГ читается отлично, как МЕХАНИЗМ непрозрачен и делает конкретное неверное допущение про стабильный примитив (getNodeForSignal+массивы) в режиме, где его доки обещают undefined. Годится только если (а) добить регистрацию/резолв массивов через getFieldByPath или регистрацию сигналов-массивов, (б) сделать field<V>/item<K> дженериками, (в) добавить generation-guard в validate. До этого — менее стабилен, чем императивный Collector-B."

---

## E — Поле-центричный fluent

**Поле-центрично: одна fluent-цепочка на поле несёт И правила, И реактивное поведение — вся правда о поле в одном месте.**

Тип: **единый** контракт · JS-примитивы: Опирается на чистые JS-примитивы, без «магического» DSL-дерева: билдер — обычный class с method-chaining (return this); интенты копятся в plain-объекте FieldSpec и массивах (rules/crosses/copies/changes); правила — обычные функции (реальные value-only фабрики required/min/pattern/email из @reformer/core/validators переиспользуются как есть); cross-field/compute/onChange/selectors — обычные стрелочные замыкания; per-item .each — шаблон-функция, переигрываемая на каждой строке через getByPath(model, sig.__path).forEach + селектор sel(im.$). Движок читает specs обычными циклами for..of и раздаёт их в публичные операторы (compute/copyFrom/enableWhen/onChange) и в getNodeForSignal().setErrors(). Никакой интерпретации формы объекта ({value,validators}/{when,children}) — роль звена задаётся вызванным методом, а не угаданной формой.

Оценки — самооценка (L/R/S): 4/3/3 · критика (L/R/S): 4/3/2

### Форма контракта

```ts
// f(sig) → FieldBuilder<T,R>: одна цепочка = валидация + поведение поля (UNIFIED).
field<T>(sig: PathAwareSignal<T>): FieldBuilder<T,R>

class FieldBuilder<T,R> {
  // ── валидация (звенья реюзают реальные value-only фабрики @reformer/core/validators) ──
  required(msg?) / min(n,msg?) / max(n,msg?) / pattern(re,msg?) / email(msg?)  : this
  rule(...Rule<T>) : this                       // escape hatch для кастомного правила
  asyncRule((v)=>Promise<Err>) : this           // async, сетевой сбой → null (не блокирует)
  assert((v, root:R)=>Err) : this               // cross-field (снапшот Root)
  each((row)=> void) : this                     // per-item массива через селекторы
  // ── поведение ──
  activeWhen((root:R)=>boolean) : this          // гейтит валидацию + даёт enableWhen(reset)
  compute((m:FormModel<R>)=>T, when?) : this
  copyTo(target, when?) : this
  onChange((v, {model,form})=>void) : this      // form инъектируется раннером, НЕ ambient
}

// сборка: одна декларация → и валидатор, и поведение
defineFieldSchema<R>(model, (f, m) => { f(m.$.x).required().compute(...)... })
  => { validate: () => Promise<boolean>; behavior: FormBehavior<R> }
```

### Инфраструктура контракта («цена»)

```ts
// field-schema.ts — ЦЕНА контракта: билдер + FieldSpec + ДВА раннера. ~95 строк «движка».
import {
  getNodeForSignal, type FormModel, type FormProxy,
  type PathAwareSignal, type ValidationError,
} from '@reformer/core';
import {
  defineFormBehavior, compute, copyFrom, onChange, enableWhen, type FormBehavior,
} from '@reformer/core/behaviors';
import { required, min, max, pattern, email } from '@reformer/core/validators';

type Err = ValidationError | null;
type Sig<T> = PathAwareSignal<T>;
type Rule<T> = (v: T, m?: unknown, r?: unknown) => Err | Promise<Err>;
type Cross<T, R> = (v: T, root: R) => Err;
type Scope<R> = { model: FormModel<R>; form: FormProxy<R> };
type RowField = <T>(sel: (row: any) => Sig<T>) => FieldBuilder<T, any>;

// Все интенты поля — читаются ОБОИМИ раннерами (единый источник для валидации и поведения).
interface FieldSpec<T, R> {
  sig: Sig<T>;
  rules: Rule<T>[]; crosses: Cross<T, R>[]; active?: (root: R) => boolean;
  each?: (rf: RowField) => void;
  computeFn?: (m: FormModel<R>) => T; computeWhen?: (m: FormModel<R>) => boolean;
  copies: { to: Sig<T> | object; when?: (m: FormModel<R>) => boolean }[];
  changes: ((v: T, s: Scope<R>) => void)[];
}
const mkSpec = <T, R>(sig: Sig<T>): FieldSpec<T, R> => ({ sig, rules: [], crosses: [], copies: [], changes: [] });

// Билдер: каждый метод пишет интент в spec и возвращает this. Value-фабрики @reformer реюзаются.
// ГРАНИЦА ТИПОБЕЗОПАСНОСТИ: методы НЕ гейтятся по T — .min() компилируется и на string-поле
// (в отличие от value-only Rule<T> коллектора). Гейтинг требовал бы Number/String-под-билдеров.
class FieldBuilder<T, R> {
  constructor(private s: FieldSpec<T, R>) {}
  rule(...r: Rule<T>[]) { this.s.rules.push(...r); return this; }
  required(msg?: string) { return this.rule(required({ message: msg }) as Rule<T>); }
  min(n: number, msg?: string) { return this.rule(min(n, { message: msg }) as Rule<T>); }
  max(n: number, msg?: string) { return this.rule(max(n, { message: msg }) as Rule<T>); }
  pattern(re: RegExp, msg?: string) { return this.rule(pattern(re, { message: msg }) as Rule<T>); }
  email(msg?: string) { return this.rule(email({ message: msg }) as Rule<T>); }
  asyncRule(fn: (v: T) => Promise<Err>) { return this.rule(fn as Rule<T>); }
  assert(fn: Cross<T, R>) { this.s.crosses.push(fn); return this; }
  each(tpl: (rf: RowField) => void) { this.s.each = tpl; return this; }
  activeWhen(pred: (root: R) => boolean) { this.s.active = pred; return this; }
  compute(calc: (m: FormModel<R>) => T, when?: (m: FormModel<R>) => boolean) { this.s.computeFn = calc; this.s.computeWhen = when; return this; }
  copyTo(to: Sig<T> | object, when?: (m: FormModel<R>) => boolean) { this.s.copies.push({ to, when }); return this; }
  onChange(h: (v: T, s: Scope<R>) => void) { this.s.changes.push(h); return this; }
}

function createFieldSchema<R>() {
  const specs: FieldSpec<any, R>[] = [];
  const field = <T>(sig: Sig<T>) => { const sp = mkSpec<T, R>(sig); specs.push(sp); return new FieldBuilder<T, R>(sp); };
  return { field, specs };
}
const getByPath = (root: any, p?: string) => (p ? p.split('.').reduce((o, k) => o?.[k], root) : undefined);
const blocking = (m: Map<Sig<unknown>, ValidationError[]>) => {
  for (const l of m.values()) for (const e of l) if (e.severity !== 'warning') return true;
  return false;
};

// Раннер ВАЛИДАЦИИ: .activeWhen → skip (bucket=[] → погасим), async в pending, .assert cross-field,
// .each → forEach живого массива с под-схемой на каждую строку. owned копит все тронутые сигналы → clear.
function toValidator<R>(specs: FieldSpec<any, R>[], model: FormModel<R>) {
  const owned = new Set<Sig<unknown>>();
  return async (): Promise<boolean> => {
    const errs = new Map<Sig<unknown>, ValidationError[]>(); const pending: Promise<void>[] = [];
    const root = model.get();
    const run = (sp: FieldSpec<any, any>, snap: any) => {
      const bucket: ValidationError[] = []; errs.set(sp.sig, bucket);
      if (sp.active && !sp.active(root)) return;                 // выключено → останется [] → setErrors([])
      const value = sp.sig.peek();
      for (const rule of sp.rules) {
        const res = rule(value, model, model);
        if (res && typeof (res as any).then === 'function') pending.push((res as Promise<Err>).then((e) => { if (e) bucket.push(e); }));
        else if (res) bucket.push(res as ValidationError);
      }
      for (const cx of sp.crosses) { const e = cx(value, snap); if (e) bucket.push(e); }
    };
    for (const sp of specs) {
      if (sp.each) {
        getByPath(model, sp.sig.__path)?.forEach((im: any) => {  // value-proxy строк: im.$.field
          const sub = createFieldSchema<any>();
          sp.each!(((sel) => sub.field(sel(im.$))) as RowField);
          for (const rs of sub.specs) run(rs, im.get ? im.get() : root);
        });
      } else run(sp, root);
    }
    if (pending.length) await Promise.all(pending);
    for (const sig of errs.keys()) owned.add(sig);
    for (const sig of owned) getNodeForSignal(sig)?.setErrors(errs.get(sig) ?? []);
    return !blocking(errs);
  };
}

// Раннер ПОВЕДЕНИЯ: те же specs → публичные операторы внутри defineFormBehavior (ambient только ВНУТРИ
// движка, автор его не видит). form/model приходят из scope и передаются в onChange явным аргументом.
function toBehavior<R>(specs: FieldSpec<any, R>[]): FormBehavior<R> {
  return defineFormBehavior<R>(({ model, form }) => {
    for (const sp of specs) {
      if (sp.computeFn) compute(sp.sig, () => sp.computeFn!(model), sp.computeWhen ? { when: () => sp.computeWhen!(model) } : undefined);
      for (const c of sp.copies) copyFrom(sp.sig, c.to as any, c.when ? { when: () => c.when!(model) } : undefined);
      if (sp.active) enableWhen(sp.sig, () => sp.active!(model.get()), { resetOnDisable: true });
      for (const h of sp.changes) onChange(sp.sig, (v) => h(v, { model, form }));
    }
  });
}

export function defineFieldSchema<R>(
  model: FormModel<R>,
  decl: (field: <T>(s: Sig<T>) => FieldBuilder<T, R>, m: FormModel<R>) => void,
): { validate: () => Promise<boolean>; behavior: FormBehavior<R> } {
  const { field, specs } = createFieldSchema<R>();
  decl(field, model);
  return { validate: toValidator(specs, model), behavior: toBehavior(specs) };
}
```

### Валидация (кейсы 1–5)

```ts
// creditSchema.ts — ЕДИНАЯ декларация поля: тут показаны ЗВЕНЬЯ ВАЛИДАЦИИ (кейсы 1-5).
// Поведенческие звенья ТЕХ ЖЕ полей — в behaviorCode; в реальном файле они сливаются в одну цепочку.
import { defineFieldSchema } from './field-schema';       // движок — см. sharedInfra
import type { FormModel, ValidationError } from '@reformer/core';
type Root = CreditApplicationForm; type M = FormModel<Root>;
type Err = ValidationError | null; type Rule<T> = (v: T) => Err | Promise<Err>;

export const creditForm = (model: M) =>
  defineFieldSchema<Root>(model, (f, m) => {

    // (1) required + pattern — цепочкой на поле
    f(m.$.username)
      .required('Имя пользователя обязательно')
      .pattern(/^[a-zA-Z0-9_]{3,20}$/, 'Латиница, цифры, _ (3-20)')
      .asyncRule(usernameAvailable);                        // ← (5) async, звено той же цепочки

    // (2) cross-field: loanAmount ≤ propertyValue − initialPayment — .assert получает снапшот Root
    f(m.$.loanAmount)
      .required('Сумма кредита обязательна')
      .min(50_000, 'Минимум 50 000 ₽')
      .assert((v, r) =>
        v <= r.propertyValue - r.initialPayment
          ? null
          : { code: 'loanExceedsMax', message: `Не больше ${r.propertyValue - r.initialPayment} ₽` });

    // (3) УСЛОВНОЕ поле: .activeWhen гейтит правила (выкл → погасить ошибки) И в behavior даёт
    //     enableWhen+resetOnDisable. Одно условие управляет всей судьбой поля — это field-centric-выигрыш.
    f(m.$.propertyValue)
      .activeWhen((r) => r.loanType === 'mortgage')
      .required('Стоимость недвижимости обязательна')
      .min(1_000_000, 'Минимум 1 000 000 ₽');

    // (4) per-item массива: шаблон .each применяется к КАЖДОЙ строке; row(sel) выбирает сигнал строки
    f(m.$.coBorrowers).each((row) => {
      row((cb) => cb.email).required('Email созаёмщика обязателен').email();
      row((cb) => cb.monthlyIncome).required('Доход обязателен').min(10_000, 'Минимум 10 000 ₽');
    });
  });

// (5) async-фабрика: сетевой сбой НЕ блокирует submit — catch → null (правило «пройдено»)
const usernameAvailable: Rule<string> = async (value) => {
  if (!value || value.length < 3) return null;
  try {
    const res = await fetch(`/api/v1/auth/check-username?username=${encodeURIComponent(value)}`);
    const json = await res.json();
    return json.available ? null : { code: 'username-taken', message: json.message ?? 'Имя занято' };
  } catch { return null; }
};
```

### Поведение (кейсы 6–8)

```ts
// ПОВЕДЕНЧЕСКИЕ звенья (кейсы 6-8) — методы ТОГО ЖЕ FieldBuilder, что и в validationCode.
// UNIFIED: в реальном файле это НЕ отдельный блок — звенья дописываются в цепочку поля рядом с правилами.
export const creditForm = (model: M) =>
  defineFieldSchema<Root>(model, (f, m) => {

    // (6) computed: monthlyPayment = fn(model), auto-tracking (compute читает model.* внутри effect)
    f(m.$.monthlyPayment).compute((mdl) => calcMonthlyPayment(mdl));
    // условный computed — initialPayment (20% стоимости) только для ипотеки
    f(m.$.initialPayment).compute((mdl) => mdl.propertyValue * 0.2, (mdl) => mdl.loanType === 'mortgage');

    // (7) copyTo с when: registrationAddress → residenceAddress когда sameAsRegistration (группа целиком)
    f(m.$.registrationAddress).copyTo(m.$.residenceAddress, (mdl) => mdl.sameAsRegistration === true);
    f(m.$.email).copyTo(m.$.emailAdditional, (mdl) => mdl.sameEmail === true);

    // (8) onChange side-effect: при age меняем max у loanTerm через updateComponentProps.
    //     { form } — ЯВНЫЙ аргумент хэндлера (раннер инъектирует scope), а не ambient getScope().
    f(m.$.age).onChange((age, { form }) => {
      if (age && age >= 18) form.loanTerm.updateComponentProps({ max: Math.min((70 - age) * 12, 240) });
    });

    // ── UNIFIED вживую: то же условное поле держит правила И поведение одной цепочкой ──
    f(m.$.propertyValue)
      .activeWhen((r) => r.loanType === 'mortgage')   // поведение: enableWhen + resetOnDisable
      .required().min(1_000_000);                     // валидация: гейтится тем же activeWhen
  });

// Подключение (форма из JSON — behavior/validate инъектируются в рантайме, см. jsonCompat):
// const { validate, behavior } = creditForm(model);
// const form = createForm({ model, schema: convertJsonToM1Tree(json, registry, model), behavior });
// onComponentEvent(schema.node('submit'), 'onClick', async () => { if (await validate()) submit(); });

declare function calcMonthlyPayment(m: FormModel<Root>): number;
```

### JSON-совместимость

Функции сериализовать нельзя, поэтому field-schema живёт как TS-код — ровно как у ambient-behavior и pure-function вариантов. JSON несёт ТОЛЬКО layout (JsonFieldNode), а defineFieldSchema(model, decl) отдаёт { validate, behavior }, которые инъектируются в рантайме: behavior → createForm({ model, schema: convertJsonToM1Tree(json, registry, model), behavior }); validate вешается на submit через onComponentEvent(node,'onClick',...). Билдер ничего не ломает для JSON: он адресует m.$.<path> сигналы (существуют независимо от того, собрано ли дерево нод из JSON или TS), а звенья, трогающие ноды (.onChange→form.*, .activeWhen→enableWhen, updateComponentProps), резолвят ноду в рантайме через реестр signal→node (getNodeForSignal / form.getFieldByPath) — он одинаково наполнен для JSON-построенных нод после convertJsonToM1Tree. Единственное требование — наличие model и form в рантайме, что JSON-сборка и так предоставляет. Итог: совместимость идентична функциональным вариантам; билдер добавляет свой движок поверх, но не добавляет ничего несериализуемого сверх того, что уже несериализуемо (сами правила/калбэки).

### Компромиссы (автор)

ЗА: максимальная co-location — вся правда о поле (правила + реактивность) в одной цепочке; условное поле управляется ОДНИМ .activeWhen (гейт валидации + enableWhen + reset + гашение ошибок), очень терсово на call-site; порядок звеньев не важен; никакого ambient на уровне автора (form/model приходят явным аргументом в onChange) и никакого угадывания форм объектов — specs типизированы.

ПРОТИВ (цена билдера, её нельзя прятать):
1) ДВИЖОК большой (~95 строк: FieldBuilder + FieldSpec + два раннера + рекурсия .each). Терсость call-site оплачена инфраструктурой, которую надо поддерживать и которая стоит между автором и публичными примитивами.
2) ТИПОБЕЗОПАСНОСТЬ РЕГРЕССИРУЕТ. f(sig) выводит T, но методы цепочки НЕ гейтятся по T: .min(0) компилируется на string-поле, .email() — на number. Это шаг назад от value-only Rule<T> коллектора, где несовместимое правило подсвечивалось. Гейтинг потребовал бы NumberFieldBuilder/StringFieldBuilder + перегрузки field() — ещё больше инфры.
3) СЕМАНТИЧЕСКОЕ СЖАТИЕ вредит explicit control-flow: .activeWhen делает 4 вещи, но по имени этого не видно — надо знать контракт (в отличие от явного `if (mortgage) v(...)` + enableWhen, где всё на виду).
4) Валидация и поведение ПЕРЕПЛЕТЕНЫ в одной цепочке — плюс для локальности поля, минус для обзора: нельзя прочитать «все правила» или «всё поведение» одним списком.
5) Не всё реально one-liner: async/cross-field/.each всё равно требуют standalone-функций и селекторов (row(cb=>cb.email)).
6) Per-item ПОВЕДЕНИЕ (не показано) потребует моста через applyEach в toBehavior — .each сейчас чисто валидационный.

### Критика (адверсариальная)

**Сильные стороны**

- Настоящая co-location: правила и реактивность одного поля живут в одной цепочке; интенты копятся в plain-data FieldSpec (rules/crosses/copies/changes), поэтому author-facing surface действительно ambient-free и specs можно инспектировать/тестировать как данные.
- Роль звена задаётся ВЫЗВАННЫМ методом, а не угаданной формой объекта ({value,validators}/{when,children}) — на уровне автора нет shape-guessing, который аудит клеймит как фрагильный.
- Переиспользует реальные value-only фабрики (required/min/pattern/email) как есть — не изобретает параллельный валидатор.
- Ambient локализован в один ~95-строчный движок: defineFormBehavior/compute/copyFrom не торчат в пользовательском коде, blast-radius ambient-фрагильности централизован в одном файле, а не размазан по формам.
- compute-when и copy-when получают РЕАКТИВНЫЙ proxy (model), поэтому кейсы 6 и 7 трекаются корректно; направление copyTo→copyFrom(source,target) проверено по докам — верное.
- JSON-совместимость для скалярных полей паритетна функциональным вариантам: адресация через m.$.<path>-сигналы + getNodeForSignal, независимо от того, собрано дерево из JSON или TS.

**Риски / failure-modes**

- КОРНЕВОЙ БАГ УНИФИКАЦИИ: activeWhen((root:R)=>bool) в behavior-раннере вызывается как enableWhen(sig, ()=>sp.active(model.get()), {resetOnDisable}). model.get() — снапшот через peek, БЕЗ подписки; а док enableWhen прямо требует реактивный condition ('читает свои сигналы модели', пример: ()=>model.loanType). Значит предикат не трекает ни один сигнал → enableWhen никогда не переоценивается → условное поле НЕ включается/выключается/сбрасывается при смене loanType. Валидатор (снапшот-семантика) корректен, поведение — мертво. Слияние snapshot- и reactive-семантики за одним предикатом создаёт баг, которого нет ни у Contract B, ни у ambient-behavior по отдельности.
- КОЛЛИЗИЯ ПО СИГНАЛУ: валидатор делает errs.set(sp.sig, bucket); два спека на один сигнал → второй bucket ПЕРЕЗАПИСЫВАЕТ первый в Map → ошибки первого спека молча теряются. Собственный пример варианта триггерит это: propertyValue объявлен цепочкой И в validationCode, И в behaviorCode. В behavior то же → двойная регистрация enableWhen/compute на один сигнал. Нет dedup, нет warn.
- РЕГРЕСС ТИПОБЕЗОПАСНОСТИ ниже value-only коллектора: методы билдера не гейтятся по T — f(m.$.username /*string*/).min(5)/.email() компилируются (внутри каст as Rule<T>). copyTo(to: Sig<T> | object) — ветка |object делает тип таргета непроверяемым: f(m.$.age).copyTo(m.$.email) компилируется. RowField=<T>(sel:(row:any)=>Sig<T>) — селекторы строк any-типизированы (cb.emial → runtime undefined).
- НЕСОГЛАСОВАННОСТЬ compute+enableWhen: док требует, чтобы поле-цель resetOnDisable enableWhen несло тот же when в compute, иначе disabled-поле молча заполняется и утекает в submit. Движок НЕ проваживает active→computeWhen автоматически; co-location провоцирует f(x).activeWhen(cond).compute(calc) без ручного дублирования условия → утечка мусора в payload (усугубляется тем, что enableWhen тут и так мёртв).
- НЕТ AbortSignal/таймаута: asyncRule(v)=>Promise не получает signal; зависший fetch подвешивает await validate() → submit виснет бесконечно (throw ловится, но hung-socket — нет). Общий mutable owned Set в замыкании toValidator + конкурентные validate() → гонка node.setErrors и перезапись свежих ошибок устаревшим async-ответом.
- Движок целиком coupled к AMBIENT-слою: импортирует compute/copyFrom/enableWhen/onChange из @reformer/core/behaviors (self-registering в defineFormBehavior), а НЕ явно-cleanup value-ops из @reformer/core, которые рекомендует аудит. Ambient не устранён — только перенесён в движок; он наследует ВСЕ ambient-ограничения (работает лишь внутри окна defineFormBehavior, чувствителен к материализации нод, per-item ноды могут отсутствовать в реестре).

**Пробелы покрытия**

- Кейс 3 (условное поле) — поведенческая половина СЛОМАНА: enableWhen получает model.get()-снапшот, предикат не реактивен, поле не toggle/reset при смене loanType; гашение ошибок работает только в валидаторе (по вызову validate()), но enable/disable/resetOnDisable мертвы. Это флагманский провал варианта.
- Кейс 4 (per-item массив) — валидация держится на фрагильной строке getByPath(model, sig.__path) + недокументированной форме строки-модели (im.$, im.get()) + предположении о СТАБИЛЬНОЙ идентичности сигнала строки между вызовами (если нестабильна — ошибки строк мисроутятся/не гасятся); owned Set растёт неограниченно при churn массива. per-item ПОВЕДЕНИЕ вообще не поддержано: toBehavior обходит только top-level specs, .each — чисто валидационный, а per-item enableWhen сломался бы (нода не материализована). 'Unified' контракт распадается на массивах.
- Кейс 2 (cross-field) — работает, но .assert нельзя чисто гейтить условием (activeWhen гейтит ВСЁ поле, не отдельный assert); пример loanAmount.assert выполняется и для не-ипотеки (propertyValue=0 → v<=0 → ложная ошибка), условие приходится инлайнить в тело — co-location тут не помогает.
- Кейс 5 (async) — throw-сбой обрабатывается (catch→null, не блокирует), но зависший запрос вешает submit (нет timeout/abort), конкурентные validate() гоняются на общем owned.
- Кейсы 1, 6, 7, 8 — тянутся нормально (7 проверен: направление copyTo верное; 6/8 предикаты реактивны).

**Вердикт:** Терсово и co-located на call-site, и на уровне АВТОРА действительно уходит от угадывания форм объектов — но именно унификация здесь минус, а не фича. Слияние валидации (snapshot-семантика) и поведения (reactive-семантика) за одним предикатом activeWhen(root) рождает конкретный корректностный баг: enableWhen кормят model.get()-снапшотом, он теряет реактивность, и условное поле (кейс 3) не включается/сбрасывается — баг, которого нет ни у Contract B, ни у ambient-behavior по отдельности. Плюс коллизия двух спеков по одному сигналу молча роняет ошибки (в собственном примере варианта на propertyValue), а типобезопасность регрессирует НИЖЕ value-only коллектора (.min на string, copyTo |object, any-селекторы .each). ~95-строчный движок — реальная, ambient-coupled поверхность, которую надо владеть и поддерживать; ambient не устранён, а спрятан со всеми своими ограничениями. Итог: покупает краткость call-site ценой стабильности и типобезопасности — ровно против приоритета задачи. Как СТАБИЛЬНЫЙ контракт не рекомендую. Чтобы вытянуть, нужно: подавать в activeWhen реактивный proxy (не снапшот) и/или разнести гейт-валидации и enableWhen-условие; dedup/merge спеков по идентичности сигнала; T-гейтящие под-билдеры (Number/String) вместо каста as Rule<T>; мост per-item поведения (applyEach) и материализацию per-item нод; AbortSignal+timeout в async. Без этого stable=2."

---

## Приложение: аудит примитивов (на чём строить / чего избегать)

### Стабильные публичные швы — на них опираться

- **PathAwareSignal<T> + .__path (model.$.<path>)** — Публичный тип из @reformer/core (state/types.ts), документирован как «ручка поля»: сигнал знает свой dot-путь, readonly .__path — часть контракта, идентичность используется для testId/devtools/роутинга. Это самый стабильный якорь: несёт тип T (типобезопасность правил), а идентичность сигнала — ключ реестра сигнал→нода. Для листьев и для ModelArray.__path путь документирован явно.
- **signal.peek() / signal.value** — Примитив @preact/signals-core (реэкспорт @reformer/core/signals). peek() — снапшот без подписки (на нём стоит validateModelSync/runTasks и userland-Collector), value — реактивное чтение внутри effect (на нём стоят все value-ops). Ядро обоих слоёв; не меняется.
- **ModelApi: model.get()/set/patch/reset/isDirty/captureInitial/signalAt + model.$ + value-proxy model.<field>** — Публичный интерфейс FormModel (state/types.ts). get() даёт снапшот Root для cross-field без подписки; model.$ — документированный escape-hatch к сигналам; model.<field> — реактивное value-чтение. Именно на get()+$ строится императивный cross-field без DSL.
- **getNodeForSignal(signal) / registerSignalNode(signal, node)** — Экспорт @reformer/core (signal-node-registry.ts). Единственный санкционированный мост модель→нода, WeakMap по ИДЕНТИЧНОСТИ сигнала (не по строке). На нём держится и in-form роутинг ошибок (validateFormModel), и enableWhen. Стабилен, потому что это документированный шов, GC-safe, и он типобезопасен через сигнал.
- **Публичные методы ноды: setErrors([])/clearErrors()/reset(value?)/enable()/disable()/updateComponentProps(props)/touchAll()** — Методы FieldNode/GroupNode (field-node.ts, group-node.ts, form-node.ts), документированы с примерами. Это санкционированная поверхность мутации ноды: setErrors/clearErrors — цель роутинга валидации; updateComponentProps/reset/enable/disable — цель side-effect'ов поведения. Резолвятся через getNodeForSignal(signal).
- **Value-ops (state-слой, возвращают BehaviorCleanup): computeFrom, copyFrom, watchField, transformValue, resetWhen, syncFields, revalidateWhen** — Экспортируются из @reformer/core (behaviors-value.ts). Чистые функции сигнал→сигнал: берут ЯВНЫЕ сигналы, возвращают ЯВНЫЙ cleanup, нод/реестра/ambient не касаются, юнит-тестируемы в изоляции. Самый стабильный и предсказуемый слой авторинга — на нём (а не на ambient) стоит строить контракт.
- **Node-ops: enableWhen(target, cond, {resetOnDisable}) / disableWhen** — Экспорт @reformer/core (behaviors-node.ts), возвращают BehaviorCleanup. Резолвят ноду по сигналу через реестр, cleanup явный. Документирован важный инвариант: если то же поле — цель compute, compute обязан нести тот же when (иначе значение утечёт в submit).
- **Value-only фабрики валидаторов: required()/min()/max()/pattern()/email()/minLength()/maxLength()/phone()/minAge()/… + опции {message,params}** — @reformer/core/validators, чистые фабрики (value)=>ValidationError|null; лишние аргументы игнорируют. Value-only ⇒ типобезопасны против типа поля (email() на number подсветится). Не знают про реестр/схему — переиспользуемы в любом раннере.
- **Контракт ValidationError { code, message, params?, severity? } + hasBlockingErrors** — Стабильная ДАННАЯ форма (contracts.ts). severity:'warning' = показывается, но не блокирует submit — задокументированная семантика, на которой строится valid. Сериализуема, совместима с JSON-вариантом.
- **Сигнатура валидатора (value, scope, root): типы Validator<TForm,TField> и ModelValidator<TValue,TModel,TRoot>** — validation-schema.ts / validate-model-core.ts. Это то, что движок M1 реально вызывает; value-only Rule<T> — подмножество (доп. аргументы игнорируются). Единый контракт для sync и async (async = тот же кортеж, но Promise).
- **runOutsideEffect (defer) + effect (@reformer/core/signals)** — runOutsideEffect экспортируется; отложенная запись вне effect-контекста — задокументированная защита от «Cycle detected» при записи сигналов/нод из реакций. effect — реактивный примитив с cleanup. База для безопасных отложенных мутаций.
- **createForm({ model, schema, behavior }) со связыванием по идентичности сигнала (node.value === model.$.path)** — Точка сборки (create-form.ts): привязывает конфиг поля к ноде по ИДЕНТИЧНОСТИ сигнала, заполняет реестр, запускает behavior после построения нод, cleanup на form.dispose(). Именно identity-binding стабилен; behavior подаётся отдельно от layout — это и даёт JSON-совместимость (layout в JSON, функции инъектируются в рантайме).

### Фрагильные паттерны — их избегать

- **Движок угадывает роль узла по ФОРМЕ объекта: walk() в validate-model-core.ts и harvestFieldConfig() в create-form.ts — {value:Signal,validators}=поле, {when:fn,children:[]}=ветка, {array:{__path},item:fn}=массив, componentProps.itemComponent=секция массива** — Роль выводится из наличия ключей, а не из типа. Переименование validators→rules / children→items / when→cond = ТИХАЯ поломка без ошибки компиляции. Есть только DEV console.warn как фолбэк, нет compile-time гарантии. Контракт валидации/поведения НЕ должен выражаться этим деревом.
- **isArraySection(): дак-тайпинг на componentProps.control.at===function && control.length===number && itemComponent===function** — Обход валидации массива управляется данными, засунутыми в componentProps (UI-концепт). Любой компонент, чьи пропсы случайно совпали по форме, будет мис-интерпретирован как секция массива; изменение UI-пропса может изменить поведение валидации. Хрупкая связка UI-слоя и traversal-семантики валидации.
- **Ambient getScope()/current: RunContext в behaviors.ts — операторы читают модульный singleton let current и сами пушат cleanups** — Операторы (1) бросают в рантайме при вызове вне defineFormBehavior (нет compile-guard); (2) чувствительны к месту/порядку вызова — работают только внутри неявного окна; (3) не тестируются в изоляции (нужен поднятый ambient); (4) кастомный оператор через getScope() наследует всю эту хрупкость. Терсовость есть, но предсказуемость/тестируемость/стабильность теряются. Нижний слой (computeFrom/copyFrom) свободен от этого — берёт явные сигналы, отдаёт явный cleanup.
- **Строковые пути полей: getFieldByPath(path), signalAt(path), getByPath(root, path.split('.')) внутри apply/applyEach/exclusiveFlag/aggregateInto/nodeByPath** — Строка теряет типобезопасность: опечатка/переименование = runtime undefined, а не ошибка компиляции. Группам приходится восстанавливать __path и делать round-trip через ambient form к ноде. Предпочтительна идентичность сигнала (getNodeForSignal(signal)), где путь выводится из типизированного model.$.<path>.
- **Авторинг контракта КАК дерева-схемы, которое интерпретирует walk/collect (в т.ч. {when,children} для гейтинга валидации)** — Привязывает контракт к shape-эвристикам walk, порядку обхода и внутренней бухгалтерии active/clearSignals. Ветка {when,children} смешивает layout/видимость с гейтингом валидации. Userland «Contract B» это уже обходит: гоняет обычный TS и трогает только getNodeForSignal(sig).setErrors() — зависит от шва сигнал→нода, НЕ от walk.
- **Дак-тайпинг isSignal (наличие .peek) + рекурсия readGroup/writeGroup по Object.keys групповых сигналов (behaviors.ts copyFrom групп)** — Различение «сигнал vs под-группа» по присутствию метода .peek и обход по Object.keys: смена формы группы или не-сигнальный лист ломает копирование молча, без типовой проверки. Зависимость от __path на уровне ГРУППЫ вдобавок не входит явно в публичный тип ModelSignals (документирован __path у листа-сигнала и у ModelArray, но не у группового узла $).

### Рекомендации аудита

- Строить контракт как обычные TS-функции с ЯВНЫМИ хендлами (сигнал/модель/нода) и ЯВНЫМ cleanup — зеркалить слой value-ops (computeFrom/copyFrom/watchField/enableWhen уже возвращают BehaviorCleanup), а НЕ ambient-слой defineFormBehavior. Императивный Check/Collector из userland validation.ts — эталон: использует только signal.peek(), model.get(), getNodeForSignal(sig).setErrors(); ноль shape-guessing, ноль ambient, полная типобезопасность.
- Единый якорь поля — ИДЕНТИЧНОСТЬ сигнала (model.$.<path> → PathAwareSignal<T>), никогда строковый путь. getNodeForSignal(signal) — единственный стабильный мост к ноде. Это сохраняет тип T (типобезопасные правила) и переживает переименования: неверный путь через типизированный model.$ — ошибка компиляции, а строка — молчаливый runtime undefined.
- Валидацию держать value-only на уровне правила (Rule<T> = (value:T)=>ValidationError|null), а cross-field/условное/per-item выражать обычным control-flow в теле Check по снапшоту model.get() — как делает Contract B. Это даёт и типобезопасные правила, и неограниченный cross-field без DSL. Блокирующий контракт — severity:'warning' + hasBlockingErrors (стабильная семантика).
- Поведение сделать СИММЕТРИЧНЫМ валидации: (model, register) => void, где каждый оператор вызывается явно с сигналами, а его cleanup собирается в переданный явный коллектор (а не читается из модульного current). Использовать напрямую computeFrom/copyFrom/watchField/enableWhen (они уже отдают cleanup). Ambient defineFormBehavior оставить только как сахар, но НЕ как шов контракта — так снимается ось «ambient-магии» без потери терсовости.
- НЕ гонять контракт через schema-walk. Валидацию и поведение авторить как функции, инъектируемые в рантайме (JSON-путь этого и требует: JSON несёт только layout). Это автоматически даёт JSON-совместимость: layout = сериализуемый JSON, validation+behavior = TS-функции, привязанные через createForm({behavior}) / render-behavior по идентичности сигнала или стабильному node-селектору. Один контракт для рукописных и JSON-собранных форм.
- Side-effect'ы на ноду — только через документированные методы (setErrors/clearErrors/reset/enable/disable/updateComponentProps), резолвя ноду через getNodeForSignal(signal); никогда через форму componentProps или getFieldByPath(строка). Для render/JSON-варианта резолв — стабильный schema.node(selector).patchProps() (рендер-аналог того же identity-шва).
- Async — единый с sync контракт: правило возвращает Promise<ValidationError|null>, раннер его собирает и await'ит (как pending в Contract B). Сетевой сбой не должен блокировать — ловить внутри правила и возвращать null. Опираться на документированный AbortSignal-контракт (value, {signal}) для отмены устаревших ответов.
- Кастомные операторы — обычные функции, комбинирующие публичные value/node-ops и возвращающие cleanup; никогда не зависящие от ambient getScope(). Так они остаются юнит-тестируемыми и независимыми от места вызова.
- Использовать runOutsideEffect/defer для отложенных записей сигналов и нод из реакций — задокументированная защита от «Cycle detected»; закладывать её в раннер поведения, а не полагаться на ручной порядок.

## Рекомендация

Курируемый вывод по итогам аудита + адверсариальной критики. Он расходится с формальной матрицей (там лидируют B и C по 3.3), потому что критика вскрыла у «единых» вариантов **конкретные корректностные баги**, а не только философскую слабость.

### Главный вывод: «единый контракт» не выживает — побеждает симметрия

Все четыре варианта, пытающиеся описать валидацию и поведение **одним** механизмом (A, C, D, E), ломаются на одном и том же — на попытке прогнать через общий предикат две РАЗНЫЕ семантики: валидация работает по **снапшоту** (запускается на submit/шаг), поведение — **реактивно** (живые подписки). Что именно нашла критика:

- **A** — валидационная половина честна, но поведенческая целиком **ambient** (`coreCompute/coreCopy/...` бросают вне `defineFormBehavior`); плюс изобретена хрупкая shape-конвенция «`rule` внутри `when` ⇒ `enableWhen({resetOnDisable})`».
- **C** — «переиспользование behavior-ops без изменений» на деле **форк внутренностей**; устаревший async **воскрешает ошибку** на уже снесённом поле; `whenActive` резетит и **шаренные** поля.
- **D** — флагманская фича (единый интерпретатор с per-item массивами) **не работает**: сигналы массивов не в реестре, а `validate()` до `createForm` даёт вакуумное `valid=true` на непостроенной форме.
- **E** — `enableWhen` кормят снапшотом `model.get()` → теряется реактивность → **условное поле не включается** (кейс 3 сломан); коллизия ключей-сигналов в `Map` затирает bucket'ы.

Ни один из этих багов не случаен — это цена слияния снапшот- и reactive-семантики за одним фасадом.

### Что брать: **B, но исправленный** — симметричные явные близнецы

Философия B верна (два контракта одинаковой ФОРМЫ `(m, collector) => void` — «выучил один, знаешь оба»), но её поведенческий близнец в присланном виде — **косметика поверх ambient** (критика поймала даже ошибку импорта: `compute/onChange` тянулись из `@reformer/core`, где их нет). Правильная версия строит поведение на **публичном value/node-ops слое, который УЖЕ возвращает cleanup** — без ambient `getScope()` вообще:

```ts
// Валидация — это уже отгруженный Contract B (эталон стабильности из аудита):
type Check = (m: M, v: Collector) => void;          // v(sig, ...rules); v.add(sig, err)

// Поведение — СИММЕТРИЧНЫЙ близнец: та же форма, но collector копит cleanup'ы явных ops.
type Wire = (m: M, reg: Register) => void;

interface Register {
  compute<T>(target: PathAwareSignal<T>, deps: ReadonlySignal<unknown>[], fn: () => T, o?: { when?: () => boolean }): void;
  copy<T>(src: ReadonlySignal<T>, dst: Signal<T>, o?: { when?: () => boolean; transform?: (v: T) => T }): void;
  on<T>(src: ReadonlySignal<T>, fn: (v: T) => void, o?: { debounce?: number }): void;
  enable(targets: Signal<unknown>[], cond: () => boolean, o?: { resetOnDisable?: boolean }): void;
}

// Раннер: каждый метод делегирует ПУБЛИЧНОМУ примитиву, который отдаёт cleanup, и складывает его.
// НИКАКОГО ambient current — только явные сигналы + явный сбор teardown.
function makeWire(model: M, wire: Wire) {
  const cleanups: Array<() => void> = [];
  const reg: Register = {
    compute: (t, deps, fn, o) => cleanups.push(computeFrom(t, deps, fn, o)),   // value-op, возвращает cleanup
    copy:    (s, d, o)        => cleanups.push(copyFrom(s, d, o)),              // value-op
    on:      (s, fn, o)       => cleanups.push(watchField(s, fn, o)),          // НЕ ambient onChange — watchField
    enable:  (ts, c, o)       => cleanups.push(enableWhen(ts, c, o)),          // node-op
  };
  wire(model, reg);
  return () => cleanups.forEach((c) => c());   // form.dispose() вызовет это
}
```

Почему именно так (сходится с рекомендациями аудита):
- **Только публичные швы**: `computeFrom/copyFrom/watchField/enableWhen` уже возвращают `BehaviorCleanup`; `getNodeForSignal(sig).setErrors()` для валидации. Ноль зависимости от `walk`-угадывания форм и от `getScope()`.
- **Идентичность сигнала, не строки**: и `v(m.$.x, ...)`, и `reg.compute(m.$.x, ...)` — типобезопасны, переживают переименования.
- **JSON-совместимость даром**: layout остаётся в JSON, а `Check`/`Wire` — TS-функции, инъектируемые в рантайме (валидация — `makeCreditValidationConfig`, поведение — через `createForm({ behavior })` / render-behavior). Ровно то, чего требует JSON-путь.
- **Симметрия без слияния**: две функции одинаковой формы, но каждая в своей семантике (snapshot vs reactive) — то, что сломало A/E, здесь структурно исключено.

`compute` с auto-tracking (как в текущем `defineFormBehavior`) заменяется на `computeFrom` с явным списком зависимостей **или** тонкий `effect`-обёртка; для отложенных записей из реакций заложить `runOutsideEffect`/`defer` в раннер (защита от «Cycle detected»).

### Когда вместо этого брать C

Если приоритет — **максимальная терсовость** (laconic 5) и сохранение уже вложенного `defineFormBehavior` (плюс готовая error-bus и JSON-история), а ценой ambient-тестируемости готовы пренебречь — берите **C**, но только после починки двух подтверждённых багов: (1) устаревший async, воскрешающий ошибку на снесённом поле; (2) `whenActive`, резетящий шаренные поля. Это осознанный размен «терсовость ↔ стабильность».

### Что уже сделано и что осталось

- ✅ Валидационный близнец (`Check`/`Collector`) — **отгружен** (`complex-multy-step-form/schemas/validation.ts`, `registration-form-renderer-json/validation.ts`), это и есть эталон стабильности из аудита.
- ⬜ Поведенческий близнец (`Wire`/`Register`) — прототипировать `makeWire` выше на флагмане (перевести `creditApplicationBehavior` с ambient `defineFormBehavior` на явный `reg.*`), прогнать `dependencies.spec.ts`/`conditional-fields.spec.ts` как регресс.
- ⬜ Если близнецы приживутся — вынести `Collector`+`Register`+раннеры в `@reformer/cdk` (см. вопрос про дублирование ниже), чтобы прикладной код писал только `Check`/`Wire`.

> Полные данные исследования (per-agent) — `subagents/workflows/wf_f98df19c-09a/journal.jsonl`.
