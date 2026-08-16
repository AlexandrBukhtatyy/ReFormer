# Видео 2 — сценарий съёмки

Сложная форма со всеми паттернами. Карта курса — в [parallel-tinkering-tarjan.md](parallel-tinkering-tarjan.md),
формат и легенда — как в [сценарии V1](reformer-course-v1-shooting-script.md).

**Домен:** `auto-loan` — заявка на автокредит, 3 шага.
**Хронометраж:** 88 минут.
**Предпосылка:** зритель посмотрел V1 либо готов принять на веру, что модель, валидация и поведение —
разные слои. Заново это не объясняем.

## Принцип отбора материала

Флагманская форма в монорепо — 3612 строк, потому что каждый паттерн повторён по 3–8 раз. Здесь
**каждый класс фич показывается ровно один раз**, повторы проговариваются словами. Ожидаемый объём —
900–1000 строк.

| Класс фич | В оригинале | В курсе | Блок |
| --- | --- | --- | --- |
| Шаги визарда | 6 | 3 | v2-01 |
| Динамические массивы | 3 | 1 | v2-06 |
| `compute` | 8 | 7 (5 из них — одной пачкой) | v2-03, v2-06 |
| `copyFrom` группы | ✓ | 1 | v2-05 |
| `enableWhen` + `resetOnDisable` | 5 блоков | 2 | v2-05 |
| Async-загрузка опций | 1 | 1 | v2-04 |
| Динамический `max` через `onChange` | 2 | 1 | v2-04 |
| Async-валидация | 1 | 1 | v2-07 |
| `cross` + `severity: 'warning'` | 5 | 1 | v2-07 |
| `each` per-row | ✓ | 1 | v2-06 |
| `AsyncBoundary` префилл | ✓ | 1 | v2-08 |
| FileUpload | ✓ | 1 | v2-08 |
| Свои операторы | 2 | 2 | v2-04, v2-06 |

**V2 работает только на одном таргете — core + ui-kit.** История про три рендерера рассказана в V1,
повтор убьёт темп.

---

## Блок 0 · Интро (0:00 – 3:00)

**[ЭКРАН]** `BROWSER` → готовая форма из тега `v2-09`, пройти три шага за 40 секунд.

**[РЕПЛИКА]** «Заявка на автокредит. Каскадный справочник, семь вычисляемых полей, копирование адреса,
динамический массив созаёмщиков, асинхронная проверка кода из СМС, предупреждение, которое не
блокирует отправку. Всё, что встречается в реальных формах — в одной».

**[ЭКРАН]** `EDITOR` → открыть флагман монорепо, показать `wc -l`: 3612 строк.

**[РЕПЛИКА]** «Вот эта же форма в полном объёме — три с половиной тысячи строк. Мы напишем тысячу.
Разница не в упрощении механик, а в том, что там каждая механика повторена пять раз, а здесь — один.
Где я срезаю повтор, я буду говорить об этом вслух».

**[ЯКОРЬ]** Кадр с `3612` рядом с готовой формой — задаёт масштаб честно.

---

## Блок 1 · Каркас: модель раньше полей (3:00 – 11:00)

**Тег:** `v2-01-scaffold`

### 1.1 Тип (3:00 – 6:00)

**[РЕПЛИКА — до кода]** «Начинаем не с формы. Начинаем с типа данных, которые уедут на сервер. Это
не стилистика: если начать с полей, тип получится отпечатком верстки, а не предметной области».

**[ПЕЧАТАЕМ]** `types.ts` — весь тип целиком, с комментариями-маркерами:

```ts
export interface Address { region: string; city: string; street: string; house: string; }

export interface CoBorrower {
  lastName: string; firstName: string;
  monthlyIncome: number | null;
  relation: 'spouse' | 'parent' | 'other';
}

export interface AutoLoanForm {
  // Шаг 1 · Автомобиль и кредит
  carBrand: string;
  carModel: string;              // ← async-опции по carBrand
  carYear: number | null;
  carPrice: number | null;
  initialPayment: number | null;
  loanTerm: number;              // ← динамический max от возраста
  loanAmount: number;            // ← compute
  interestRate: number;          // ← compute
  monthlyPayment: number;        // ← compute

  // Шаг 2 · Заявитель
  personal: { lastName: string; firstName: string; birthDate: string };
  fullName: string;              // ← compute
  age: number;                   // ← compute
  registrationAddress: Address;
  sameAsRegistration: boolean;
  residenceAddress: Address;     // ← copyFrom ГРУППЫ
  employmentStatus: 'employed' | 'selfEmployed' | 'unemployed';
  companyName: string;           // ← enableWhen + resetOnDisable
  companyInn: string;
  monthlyIncome: number | null;
  coBorrowers: CoBorrower[];     // ← единственный массив
  coBorrowersIncome: number;     // ← compute по массиву
  totalIncome: number;           // ← compute
  documents: File[];

  // Шаг 3 · Подтверждение
  paymentToIncomeRatio: number;  // ← compute → warning
  phone: string;
  smsCode: string;               // ← validateAsync
  agree: boolean;
}
```

**[РЕПЛИКА]** «Комментарии-стрелки я оставлю в файле специально. Это карта: к концу видео каждая
стрелка станет строкой в `form.behavior.ts` или в `validation.ts`».

### 1.2 Модель и пустой визард (6:00 – 11:00)

**[ПЕЧАТАЕМ]** `model.ts` — фабрика начального состояния + фабрика пустого созаёмщика.

**[ПЕЧАТАЕМ]** `create-form.ts` — `createCoreForm({ model, schema, behavior, validation })`, где пока
всё, кроме модели, пустое.

**[ПЕЧАТАЕМ]** `index.tsx` — `FormWizard` на три пустых шага. Берём готовый из ui-kit, он принимает
шаги списком:

```tsx
import { FormWizard, type FormWizardStep } from '@reformer/ui-kit/form-wizard';
import type { FormWizardHandle } from '@reformer/cdk/form-wizard';

export const STEPS: FormWizardStep<AutoLoanForm>[] = [
  { number: 1, title: 'Автомобиль', icon: '🚗', body: CarStep },
  { number: 2, title: 'Заявитель',  icon: '👤', body: ApplicantStep },
  { number: 3, title: 'Подтверждение', icon: '✓', body: ConfirmStep },
];

const navRef = useRef<FormWizardHandle<AutoLoanForm>>(null);
const { form, validation } = useFormBundle(createAutoLoanForm);

<FormWizard ref={navRef} form={form} config={validation} steps={STEPS} onSubmit={submit} />
```

**[РЕПЛИКА]** «`config` — это собранная валидация из `defineSteps`. Визард не знает правил, он знает,
у какого шага их спросить: перед переходом дальше вызывает валидацию текущего шага и не пускает, пока
она не пройдёт».

**[РЕПЛИКА]** «Тело шага — обычный React-компонент, ему приезжает `control`. То есть каждый шаг можно
разрабатывать и ревьюить отдельно, а в headless-варианте из `@reformer/cdk` разметку визарда можно
написать целиком свою».

**[ДЕЙСТВИЕ]** Показать в браузере: три пустых шага, навигация работает.

**[РЕПЛИКА]** «Форма пустая, но уже живая. Дальше мы наполняем её слоями, и каждый слой — отдельный
файл, который можно ревьюить отдельно».

**[РИСК]** Не увязнуть в вёрстке шагов. Разметка шагов — из тега, в кадре только структура.

---

## Блок 2 · Шаг 1: поля и правила шага (11:00 – 19:00)

**Тег:** `v2-02-step1-fields`

### 2.1 Схема шага (11:00 – 15:00)

**[ПЕЧАТАЕМ]** блок «Автомобиль и кредит» в `form.schema.ts` — марка, модель, год, цена, первый взнос,
срок; три вычисляемых поля с `readOnly: true`.

**[РЕПЛИКА]** «Вычисляемые поля в схеме — обычные поля с `readOnly`. Не «выведенное значение», не
особый тип узла. Для схемы они неотличимы от вводимых, и это правильно: она не должна знать, откуда
взялось число».

### 2.2 Валидация по шагам (15:00 – 19:00)

**[ПЕЧАТАЕМ]** `validation.ts` с `defineSteps`:

```ts
export const autoLoanValidation = defineSteps(model, {
  steps: {
    car:     stepCar,
    applicant: stepApplicant,
    confirm: stepConfirm,
  },
  extras: crossRules,
  strategy: 'afterFirstSubmit',
  debounce: 400,
});
```

**[РЕПЛИКА — ключевая для архитектора]** «Ключ — селектор шага, не индекс. Вставите шаг в середину —
ничего не разъедется. И `null` для шага без правил пишется явно: опечатка в имени ключа иначе
выглядела бы как «у шага просто нет правил», а это самая тихая ошибка из возможных».

**[РЕПЛИКА]** про `extras`: «Cross-field правила живут отдельно от шагов. Они проверяются только при
полной отправке — потому что на втором шаге ещё нечего сравнивать с пятым».

**[РЕПЛИКА]** про стратегию: «`afterFirstSubmit` — молчим, пока пользователь не нажал «Далее» первый
раз, потом подсвечиваем живьём с задержкой 400 мс. Валидация, которая кричит на пустое поле, в
которое ещё не начали печатать, — это не помощь».

**[ДЕЙСТВИЕ]** В браузере: нажать «Далее» с пустыми полями → ошибки; начать печатать → гаснут.

---

## Блок 3 · Вычисляемые поля (19:00 – 29:00)

**Тег:** `v2-03-computed`

### 3.1 Проверка графа до кода (19:00 – 21:00)

**[ЭКРАН]** `TERM` / панель MCP

**[ДЕЙСТВИЕ]** Прогнать через `check_behaviors`:

```
loanAmount     ← carPrice, initialPayment
interestRate   ← carPrice, loanTerm, carYear
monthlyPayment ← loanAmount, interestRate, loanTerm
```

**[РЕПЛИКА]** «Сначала граф, потом код. Циклическая зависимость в реактивной системе — ошибка, которую
больно ловить в рантайме: она проявляется как «форма зависла» или «значение скачет». Здесь она
ловится статически, за секунду, до первой строки».

### 3.2 Behaviors (21:00 – 26:00)

**[ПЕЧАТАЕМ]** `form.behavior.ts`:

```ts
export const autoLoanBehavior = defineFormBehavior<AutoLoanForm>(({ model, form }) => {
  compute(model.$.loanAmount,     () => (model.carPrice ?? 0) - (model.initialPayment ?? 0));
  compute(model.$.interestRate,   () => rateFor(model.carYear, model.loanTerm));
  compute(model.$.monthlyPayment, () => annuity(model.loanAmount, model.interestRate, model.loanTerm));
});
```

**[РЕПЛИКА]** «Три строки. Ни одного списка зависимостей — они выводятся из того, что функция
прочитала».

**[РЕПЛИКА — важная оговорка]** «В настоящей заявке таких `compute` восемь. Механика ровно та же, и
поэтому остальные пять я напишу одной пачкой без комментариев — смотреть на них по отдельности
незачем».

**[ДЕЙСТВИЕ]** Дописать `fullName`, `age`, `totalIncome`, `paymentToIncomeRatio` пачкой.

### 3.3 Тесты поведения (26:00 – 29:00)

**[ПЕЧАТАЕМ]** `__tests__/behavior.test.ts` — вычисления проверяются на модели, без рендера:

```ts
const { model } = createAutoLoanForm();
model.carPrice = 2_000_000;
model.initialPayment = 500_000;
expect(model.loanAmount).toBe(1_500_000);
```

**[РЕПЛИКА]** «Формула аннуитета — это то, из-за чего в проде бывают судебные иски. Она обязана быть
покрыта тестом, и она покрывается тестом без единого клика».

---

## Блок 4 · Свои операторы и асинхронные справочники (29:00 – 39:00)

**Тег:** `v2-04-async-options`

### 4.1 Проблема (29:00 – 31:00)

**[РЕПЛИКА]** «Марка → модель. Классический каскад: выбрали марку, подгрузили модели, старую модель
сбросили. Встроенного оператора для этого нет — и не должно быть, потому что вариантов поведения тут
десяток. Зато контракт открыт».

### 4.2 Свой оператор (31:00 – 35:00)

**[ПЕЧАТАЕМ]** `operators.ts`:

```ts
export function loadOptionsOn<TValue, TOption>(
  source: ReadonlySignal<TValue>,
  target: OptionsTarget,
  fetcher: (value: TValue) => Promise<{ data: TOption[] }>,
  options: { debounce?: number; resetTarget?: boolean } = {}
): void {
  const { debounce = 300, resetTarget = false } = options;
  onChange(source, async (value, { signal }) => {
    if (resetTarget) target.reset();
    const { data } = await fetcher(value);
    if (signal.aborted) return;              // ответ устарел — выбрасываем
    target.updateComponentProps({ options: data });
  }, { debounce });
}
```

**[РЕПЛИКА — главная в блоке]** «Смотрите, из чего он сделан: один `onChange` и `updateComponentProps`.
Это не плагин и не расширение — это обычная функция, которая вызывается внутри `defineFormBehavior`.
На месте использования её не отличить от встроенной».

**[РЕПЛИКА про `signal.aborted`]** «Вот это — не украшение. Пользователь быстро переключил марку три
раза: три запроса ушли, вернуться могут в любом порядке. Без проверки в поле окажутся модели от
второй марки, а выбрана третья. `onChange` отменяет предыдущий вызов сам, наше дело — проверить флаг
перед записью».

### 4.3 Динамический предел (35:00 – 39:00)

**[ПЕЧАТАЕМ]**

```ts
loadOptionsOn(model.$.carBrand, form.carModel, fetchCarModels, { resetTarget: true });

onChange(model.$.age, (age) =>
  form.loanTerm.updateComponentProps({ max: Math.min(Math.max(70 - age, 1) * 12, 84) })
);
```

**[РЕПЛИКА]** «Кредит должен быть погашен до семидесяти лет. Это не валидация — это ограничение
ввода: правильнее не дать выбрать невозможный срок, чем дать и потом отругать».

**[ДЕЙСТВИЕ]** В браузере: сменить марку → модели подгрузились, поле сбросилось; изменить дату
рождения → максимум срока поехал.

---

## Блок 5 · Группы: копирование и условная доступность (39:00 – 49:00)

**Тег:** `v2-05-groups`

### 5.1 Вложенные группы (39:00 – 42:00)

**[ПЕЧАТАЕМ]** блоки `personal`, `registrationAddress`, `residenceAddress` в схеме.

**[РЕПЛИКА]** «Группа в модели — обычный вложенный объект. Никакой регистрации, никакого
`useFieldArray`».

### 5.2 Копирование группы целиком (42:00 – 45:00)

**[ПЕЧАТАЕМ]**

```ts
copyFrom(model.registrationAddress, model.residenceAddress, {
  when: () => model.sameAsRegistration,
});
enableWhen(model.residenceAddress, () => !model.sameAsRegistration);
```

**[РЕПЛИКА]** «`copyFrom` принимает не поле, а группу — копируются все четыре поля адреса разом. И
обратите внимание на связку: копируем **и** выключаем. Выключаем без `resetOnDisable`, потому что
значение там осмысленное — оно скопировано».

### 5.3 Разница, которую все путают (45:00 – 49:00)

**[ПЕЧАТАЕМ]**

```ts
enableWhen([model.$.companyName, model.$.companyInn],
  () => model.employmentStatus === 'employed',
  { resetOnDisable: true }
);
```

**[РЕПЛИКА — ключевая в блоке]** «Два `enableWhen` подряд, и они ведут себя по-разному. Адрес
проживания выключается **без** сброса — значение скопировано и должно уехать на сервер. Работодатель
выключается **со** сбросом — если человек перешёл в статус «безработный», старое название компании в
заявке недопустимо. По умолчанию `resetOnDisable` — `false`, то есть библиотека отказывается угадывать
за вас. Это тот случай, когда умолчание должно быть неудобным».

**[ДЕЙСТВИЕ]** В браузере показать оба: галочка «адрес совпадает» → поля заполнились и погасли;
статус «безработный» → поля компании погасли и очистились.

**[РЕПЛИКА]** «Таких блоков `enableWhen` в настоящей заявке пять — по одному на каждый тип занятости
и тип кредита. Механика та же, повторять не буду».

**[ЯКОРЬ]** Кадр, где на экране одновременно видны оба поведения — с сбросом и без.

---

## Блок 6 · Массив созаёмщиков (49:00 – 61:00)

**Тег:** `v2-06-array`

### 6.1 Массив в схеме (49:00 – 53:00)

**[ПЕЧАТАЕМ]** узел массива в `form.schema.ts` + `FormArraySection` в разметке шага.

**[РЕПЛИКА]** «`initialValue` — фабрика, а не объект. Общий объект-литерал дал бы всем строкам одну
ссылку, и правка одной правила бы все».

### 6.2 Поведение и агрегация (53:00 – 57:00)

**[ПЕЧАТАЕМ]**

```ts
compute(model.$.coBorrowersIncome,
  () => model.coBorrowers.map(c => c.monthlyIncome ?? 0).reduce((a, b) => a + b, 0));

compute(model.$.totalIncome, () => (model.monthlyIncome ?? 0) + model.coBorrowersIncome);

clearWhenOff(model.$.hasCoBorrowers, form.coBorrowers);
```

**[РЕПЛИКА — предупреждение]** «Сумма по массиву — это обычный `compute`. В библиотеке есть оператор
`aggregateInto`, и по названию кажется, что он для этого. Нет: он **патчит строки массива**, его
колбэк возвращает список `{ index, patch }`. Для свёртки массива в одно поле нужен `compute`».

### 6.3 Правила на строку (57:00 – 61:00)

**[ПЕЧАТАЕМ]**

```ts
each(model.coBorrowers, (c) => {
  validate(c.$.lastName,      [required(), minLength(2)]);
  validate(c.$.monthlyIncome, [required(), min(1)]);
});
```

**[РЕПЛИКА]** «Правила объявлены один раз, применяются к каждой строке, ошибки приезжают в свою
строку. Добавили созаёмщика — правила уже там».

**[ДЕЙСТВИЕ]** В браузере: добавить две строки, оставить одну пустой → ошибка ровно в ней; заполнить →
общий доход пересчитался; снять галочку → массив очистился.

**[РЕПЛИКА]** «В настоящей заявке таких массивов три — имущество, действующие кредиты, созаёмщики.
Все три устроены одинаково».

---

## Блок 7 · Асинхронная валидация и предупреждения (61:00 – 71:00)

**Тег:** `v2-07-async-validation`

### 7.1 Код из СМС (61:00 – 66:00)

**[ПЕЧАТАЕМ]**

```ts
const smsCodeValid: AsyncRule<string> = async (code, _model, { signal }) => {
  if (!code || code.length < 4) return null;          // нечего проверять
  const ok = await verifySmsCode(code, { signal });
  return ok ? null : { code: 'sms', message: 'Неверный код' };
};

validateAsync(model.$.smsCode, [smsCodeValid]);
```

**[РЕПЛИКА]** «Три вещи, без которых асинхронный валидатор в проде разваливается. Первая — ранний
выход: не дёргаем сервер, пока введено два символа из четырёх. Вторая — `signal`: пользователь стёр
и ввёл заново, старый ответ обязан быть выброшен, иначе он перезапишет свежий. Третья — задержка,
она задана стратегией на уровне схемы, а не внутри правила».

**[ДЕЙСТВИЕ]** В браузере: ввести неверный код → ошибка; быстро исправить → показать в Network, что
устаревший ответ не влияет на поле.

### 7.2 Предупреждение, которое не блокирует (66:00 – 71:00)

**[ПЕЧАТАЕМ]** в `extras`:

```ts
cross(model.$.paymentToIncomeRatio, (f) =>
  f.paymentToIncomeRatio > 0.5
    ? { code: 'highLoad', severity: 'warning',
        message: 'Платёж превышает половину дохода — заявку могут отклонить' }
    : null
);
```

**[РЕПЛИКА — сильный аргумент]** «`severity: 'warning'`. Поле подсвечено, текст показан, но
`validateAll` вернёт `true` и форма отправится. Это ровно то, чего обычно добиваются костылями:
отдельным стейтом «предупреждения», который живёт мимо валидации и рассинхронизируется с ней.
Здесь предупреждение — та же ошибка, просто не блокирующая».

**[ДЕЙСТВИЕ]** Показать: жёлтая подсветка, форма отправляется.

**[РЕПЛИКА]** «Такие правила лежат в `extras`, а не в шаге: соотношение платежа к доходу нельзя
посчитать, пока не пройдены оба шага».

---

## Блок 8 · Файлы и предзаполнение (71:00 – 81:00)

**Тег:** `v2-08-files-prefill`

### 8.1 Загрузка документов (71:00 – 75:00)

**[ПЕЧАТАЕМ]** поле `documents` с `FileUploadField` + валидаторы файлов:

```ts
validate(model.$.documents, [maxFiles(5), maxFileSize(10 * 1024 * 1024), fileType(['application/pdf', 'image/*'])]);
```

**[РЕПЛИКА]** «Файловые валидаторы — такие же правила, как `required`. Файл в модели — обычное поле
типа `File[]`».

### 8.2 Режим редактирования (75:00 – 81:00)

**[РЕПЛИКА — постановка]** «Заявку можно открыть на редактирование. Значит форма должна уметь
существовать в трёх состояниях: грузится, загрузилась, упала. И это состояние — не про форму, а про
экран вокруг неё».

**[ПЕЧАТАЕМ]** `AsyncBoundary` из ui-kit — self-managed режим:

```tsx
<AsyncBoundary<AutoLoanBundle>
  load={(signal) => loadApplication(applicationId!, signal)}
  loadKey={applicationId}
  enabled={applicationId !== null}
  onSuccess={(bundle) => applyApplication(form, bundle)}
>
  <FormWizard ref={navRef} form={form} config={validation} steps={STEPS} onSubmit={submit} />
</AsyncBoundary>
```

**[РЕПЛИКА]** «Снаружи остаются только два вопроса: как загрузить и что сделать с ответом. Состояния,
отмена устаревшего запроса при смене `loadKey`, кнопка «Повторить» и ARIA-атрибуты — внутри
компонента».

**[РЕПЛИКА]** про `signal`: «Пользователь открыл заявку, передумал, открыл другую. Первый запрос
отменяется — иначе он вернётся позже и затрёт вторую форму данными первой».

**[РЕПЛИКА — вилка]** «Это готовый компонент из ui-kit. Если нужна своя разметка состояний, в
`@reformer/cdk` лежит headless-версия того же самого — `AsyncBoundary.Loading`, `.Content`, `.Error`,
`.Retry` — и вы пишете вёрстку сами».

**[ДЕЙСТВИЕ]** Открыть `?id=1` → скелетон → заполненная форма. Сломать эндпоинт → панель ошибки,
нажать «Повторить».

**[ПЕЧАТАЕМ]** Submit:

```tsx
if (await validation.validateAll()) await saveApplication(model.get());
```

**[РЕПЛИКА]** «`model.get()` — чистый объект нужного типа. Не `formState.values`, не сериализация
контролов. Тип, который мы написали в первом блоке, — то же самое, что уходит на сервер».

---

## Блок 9 · Итог (81:00 – 88:00)

**Тег:** `v2-09-wrapup`

### 9.1 Тесты правил (81:00 – 84:00)

**[ДЕЙСТВИЕ]** `npm test` — полный `validation.test.ts`: невалидная заявка, валидная, граничные случаи
по возрасту и сроку, предупреждение не блокирует.

**[РЕПЛИКА]** «Вся эта сложность проверена без единого клика».

### 9.2 Карта файлов (84:00 – 86:00)

**[ЭКРАН]** `EDITOR` → дерево модуля.

| Файл | Отвечает за | Строк |
| --- | --- | --- |
| `types.ts` | контракт данных | ~60 |
| `model.ts` | начальное состояние | ~50 |
| `form.behavior.ts` | вычисления и реакции | ~90 |
| `validation.ts` | правила | ~220 |
| `operators.ts` | свои операторы | ~40 |
| `form.schema.ts` | вёрстка полей | ~400 |
| `data-sources.ts` / `api.ts` | справочники и сеть | ~80 |

**[РЕПЛИКА]** «Самый большой файл — схема, то есть вёрстка. Логика — это `behavior` плюс `validation`,
триста строк на форму такой сложности. И ревьюить их можно отдельно от вёрстки, потому что они в
отдельных файлах не по соглашению, а по устройству библиотеки».

### 9.3 Чеклист и анонс (86:00 – 88:00)

Проговорить как чеклист для своих форм:

1. Тип данных — раньше полей.
2. Граф вычислений — через `check_behaviors`, до кода.
3. Правила — по селекторам шагов, cross-field в `extras`.
4. `resetOnDisable` — осознанное решение на каждом `enableWhen`.
5. Асинхронный валидатор — ранний выход, `signal`, задержка в стратегии.
6. Некритичное — `severity: 'warning'`, а не отдельный стейт.
7. Повторяющаяся механика — свой оператор в `operators.ts`.

**[РЕПЛИКА]** «Этот `form.behavior.ts` и этот `validation.ts` уедут в renderer-react или в JSON без
единой правки — ровно как в первом видео, теги `v1-08` и `v1-09»`.

Анонсы спутников: UI-Builder, формы в микрофронтах, MCP-сервер.

---

## Приложение · Сверенные контракты V2

```ts
// @reformer/cdk
defineSteps<Sel, T>(model, config: {
  steps: Record<Sel, ValidationSchema<T> | null>;   // null — «шаг без правил» ЯВНО
  extras?: ValidationSchema<T>;
  strategy?: ValidationStrategyKind;                // по умолчанию 'submit'
  debounce?: number;
  liveAfterSubmit?: 'change' | 'blur';
}): WizardStepsConfig<Sel>

// headless-слой (@reformer/cdk/form-wizard)
FormWizardProps<T>  = { form, config, children?, onStepChange?, scrollToTop? }
FormWizardHandle<T> = { form, currentStep, completedSteps,
                        validateCurrentStep(), goToNextStep(), submit(), … }

// готовый визард (@reformer/ui-kit/form-wizard) — его и берём в V2
<FormWizard ref form={form} config={validation} steps={STEPS} onSubmit={…} />
FormWizardStep<T>   = { number, title, icon?, body: ComponentType<{ control }> }

// AsyncBoundary существует в ДВУХ видах:
//   @reformer/ui-kit — self-managed: { load(signal), loadKey, enabled, onSuccess }
//   @reformer/cdk    — headless compound: .Root .Idle .Loading .Content .Error .Retry .Empty

// Кастомные операторы — НЕ из библиотеки, пишутся в operators.ts
loadOptionsOn(source, target, fetcher, { debounce = 300, resetTarget = false })
clearWhenOff(flag, array)     // → array.clear()

// severity
// ValidationError.severity === 'warning' не влияет на валидность:
// проверяется как `e.severity !== 'warning'` в field-node и в validateModel
```

### Ловушки блока

1. **`aggregateInto` — не свёртка.** Патчит строки массива (`{ index, patch }[]`). Сумма по массиву —
   обычный `compute`. Проговаривается вслух в блоке 6.
2. **`apply` в behaviors и в validation — разные функции.** `apply(targets, subSchema)` против
   вариадического `apply(...schemas)`; `defineSteps` использует второй.
3. **Стратегия по умолчанию `'submit'`.** Для живой подсветки в кадре нужен `afterFirstSubmit`.
4. **`initialValue` массива — фабрика.** Литерал даст всем строкам общую ссылку.
5. **Ключи `steps` — селекторы, не индексы.** `null` пишется явно.

---

## Статус

Готов к записи после сборки репо-компаньона до тега `v2-09`.
Сценарии спутников — в [reformer-course-satellites-shooting-scripts.md](reformer-course-satellites-shooting-scripts.md).
