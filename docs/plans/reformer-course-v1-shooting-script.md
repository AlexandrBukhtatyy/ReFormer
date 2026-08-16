# Видео 1 — сценарий съёмки

Рабочий документ записи. Карта курса и обоснования — в [parallel-tinkering-tarjan.md](parallel-tinkering-tarjan.md).

**Домен:** `trip-quote` — расчёт стоимости страховки путешествия.
**Хронометраж:** 94 минуты по блокам ниже. Клапан до 90: сжать блок 4 до двух минут и убрать
аттракцион 2 из блока 2.
**Аудитория:** тимлиды и архитекторы. Не объясняем, что такое React-хук; объясняем, почему граница
проходит здесь, а не там.

## Как читать

- **[ЭКРАН]** — что видно, какая сцена OBS
- **[ДЕЙСТВИЕ]** — что делаешь руками
- **[РЕПЛИКА]** — формулировка, которая должна прозвучать близко к тексту (остальное — своими словами)
- **[ЯКОРЬ]** — кадр, ради которого блок существует; если он не получился, блок переснимается
- **[РИСК]** — где вероятен дубль

---

## Перед записью

**Сцены OBS**

| Сцена | Источники |
| --- | --- |
| `EDITOR` | VS Code на весь экран |
| `SPLIT` | VS Code слева 60% + браузер справа 40% |
| `TERM` | терминал крупно (для `git diff`, `npm test`, `npm run size`) |
| `BROWSER` | браузер на весь экран (для Profiler) |
| `SLIDE` | статичная картинка (карта пакетов, таблица бюджетов) |

**Настройки, которые правятся один раз и больше не трогаются**

- Разрешение записи **1440p**, шрифт в VS Code **18–20 px**, в терминале **16–18 px**. Проверить
  читаемость, уменьшив окно предпросмотра до размера телефона.
- Скрыть: миникарту, breadcrumbs, панель Git, все уведомления. `Zen Mode` не использовать — нужна
  видимая структура файлов.
- Тема — светлая. Тёмная на YouTube после сжатия даёт больше артефактов на тонком шрифте.
- Отключить Copilot/автодополнение ИИ. Всплывающая подсказка, дописывающая строку за тебя, ломает
  тезис «смотрите, сколько кода на самом деле нужно».

**Заготовки до старта записи**

1. Репо-компаньон склонирован, все теги на месте, `npm ci` прогрет (не ждать установку в кадре).
2. Вкладки браузера открыты заранее: `localhost:5173`, React DevTools установлен и проверен.
3. Финальная форма из тега `v1-11` открыта в отдельной вкладке — нужна для интро.
4. Файл `docs/steps.json` открыт в редакторе — из него зачитываются тайм-коды в описание ролика.

---

## Блок 0 · Интро и карта (0:00 – 4:00)

**Цель:** дать карту до того, как зритель увидит первый `npm install`.

**[ЭКРАН]** `BROWSER` → форма из тега `v1-11`, заполненная.

**[ДЕЙСТВИЕ]** Заполнить пару полей, показать пересчёт итога, переключить тип поездки → поле страны
появляется. 30 секунд, без объяснений.

**[РЕПЛИКА]** «Это мы соберём за ближайший час. Но интересна не форма — интересно, что бизнес-правила
этой формы не знают, что они внутри React. Их можно протестировать без браузера и отрендерить тремя
разными способами, не тронув ни строки».

**[ЭКРАН]** `SLIDE` → карта пакетов.

Карта проговаривается снизу вверх, ровно в таком порядке:

| Слой | Пакет | Роль | Обязателен |
| --- | --- | --- | --- |
| Ядро | `@reformer/core` | модель, валидация, поведение | да |
| Headless | `@reformer/cdk` | `FormArray`, `FormWizard`, `AsyncBoundary` | нет |
| Внешний вид | `@reformer/ui-kit` | 72 компонента на shadcn + Tailwind v4 | нет |
| Слой рендера | `@reformer/renderer-react` | layout как TS-дерево | нет |
| Слой рендера | `@reformer/renderer-json` | layout как JSON | нет |

**[РЕПЛИКА]** «Обязателен ровно один пакет. Всё остальное — сменное, и сегодня мы это докажем не
словами, а командой `git diff`».

**[ЯКОРЬ]** Слайд карты. Он вернётся в блоке 11 — там же, но с цифрами размера.

**[РИСК]** Соблазн начать объяснять сигналы. Не здесь — это блок 3.

---

## Блок 1 · Vite + React + TS (4:00 – 7:00)

**Тег:** `v1-01-vite-scaffold`

**[ЭКРАН]** `TERM`

**[ДЕЙСТВИЕ]**

```bash
npm create vite@latest reformer-course -- --template react-ts
cd reformer-course && npm i
```

**[РЕПЛИКА]** «Ни одной своей строки. Это ровно то, что даёт Vite — чтобы дальше было видно, что
именно добавляет ReFormer».

**[ДЕЙСТВИЕ]** Показать `git tag -n9` — весь план курса печатается одной командой.

**[РЕПЛИКА]** «Каждый шаг — тег. Встать можно в любую точку: `git checkout`, `npm ci`, `npm run dev`».

**[ЯКОРЬ]** Вывод `git tag -n9` целиком в кадре.

---

## Блок 2 · Установка и настройка (7:00 – 16:00)

**Тег:** `v1-02-install-reformer`

Скучное — читается из тега. Три ошибки — печатаются вживую.

### 2.1 Diff установки (7:00 – 10:00)

**[ЭКРАН]** `TERM` → `SPLIT`

**[ДЕЙСТВИЕ]** `git checkout v1-02-install-reformer && git diff --stat v1-01-vite-scaffold`

Проговорить три файла, остальное пролистать:

`package.json` — что ставим и почему именно так:

```
@reformer/core @reformer/cdk @reformer/ui-kit
@reformer/renderer-react @reformer/renderer-json
tailwindcss @tailwindcss/vite
vitest jsdom @testing-library/react   (dev)
```

**[РЕПЛИКА]** «Версии пиним точно, через `--save-exact`. Это курс — через полгода тег обязан собраться
тем же кодом».

`vite.config.ts` — три строки:

```ts
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({ plugins: [react(), tailwindcss()] });
```

`src/index.css` — целиком:

```css
@import 'tailwindcss';
@import '@reformer/ui-kit/styles';
@source '../node_modules/@reformer/ui-kit/dist';
```

**[РЕПЛИКА]** «Три строки CSS и три строки конфига. Всё. Никакого `postcss.config`, никакого
`tailwind.config` — это Tailwind v4».

### 2.2 Аттракцион 1 — `moduleResolution` (10:00 – 11:00)

**[ЭКРАН]** `SPLIT`

**[ДЕЙСТВИЕ]** В `tsconfig.app.json` поставить `"moduleResolution": "node10"`. Открыть файл с импортом:

```ts
import { required } from '@reformer/core/validators/required';
```

Показать TS2307 в редакторе. Затем **переключиться на браузер — приложение работает**.

**[РЕПЛИКА]** «Обратите внимание: рантайм молчит, ломается только типизация. Это худший класс ошибок —
он не падает, он тихо гниёт. Пакеты ESM-only и раздают subpath-exports, поэтому резолвер обязан быть
`bundler` или `node16`».

**[ДЕЙСТВИЕ]** Вернуть `bundler`, ошибка исчезает.

### 2.3 Аттракцион 2 — `layer(theme)` (11:00 – 11:40)

**[ДЕЙСТВИЕ]** Заменить импорт на `@import '@reformer/ui-kit/styles' layer(theme);` → показать
сломанную тёмную тему. Вернуть голый импорт.

**[РЕПЛИКА]** «Импорт стилей кита обязан быть голым. В слое `theme` перестаёт работать
`@custom-variant`, и тёмная тема отваливается — а ошибок при этом ноль».

### 2.4 Аттракцион 3 — забытый `@source` (11:40 – 13:00)

**[ДЕЙСТВИЕ]** Удалить строку `@source`, перезапустить dev-сервер → компоненты без стилей.

**[РЕПЛИКА]** «Это самая частая поломка установки. Tailwind v4 сканирует ваши исходники, а классы
кита лежат в `node_modules`, куда он по умолчанию не смотрит. Одна строка — и вёрстка на месте».

**[ЯКОРЬ]** Кадр «до/после» `@source` — сломанная и живая форма.

### 2.5 Что мы НЕ ставим (13:00 – 16:00)

**[ЭКРАН]** `EDITOR` → открыть `vite.config.ts` монорепо ReFormer рядом.

**[РЕПЛИКА]** «Если вы полезете смотреть, как устроен плейграунд самой библиотеки, вы увидите там
`resolve.dedupe` на пол-экрана. Вам это не нужно: дедупликация нужна при workspace-линке, а вы ставите
из npm — копия одна».

Перечислить голосом, что не нужно: `dedupe`, `@radix-ui/*` и `@preact/signals-core` в прямых
зависимостях, msw/express/swagger, alias `@`, `tw-animate-css`.

**[РЕПЛИКА]** «`effect` мы будем брать не из `@preact/signals-core`, а из `@reformer/core/signals`.
Этот subpath существует ровно затем, чтобы копия `Signal` в проекте была одна и `instanceof` работал
через границы пакетов».

---

## Блок 3 · Первая модель (16:00 – 25:00)

**Тег:** `v1-03-model`
**Цель:** показать, что модель — самостоятельный реактивный граф, а не «стейт формы».

### 3.1 Типы (16:00 – 18:00)

**[ЭКРАН]** `EDITOR`

**[ПЕЧАТАЕМ]** `src/forms/trip-quote/types.ts`:

```ts
export type TripType = 'domestic' | 'international';

export interface Traveler {
  lastName: string;
  birthDate: string;   // ISO
  age: number;         // вычисляемое
}

export interface TripQuote {
  tripType: TripType;
  country: string;
  startDate: string;
  endDate: string;
  days: number;          // вычисляемое
  travelers: Traveler[];
  coverage: number;
  riskySport: boolean;
  sportKind: string;
  pricePerDay: number;   // вычисляемое
  total: number;         // вычисляемое
  email: string;
  agree: boolean;
}
```

**[РЕПЛИКА]** «Обратите внимание: вычисляемые поля живут в том же типе, что и вводимые. Это не
случайность — для модели нет разницы, откуда взялось значение, а для потребителя данных её тем более
быть не должно».

### 3.2 Модель (18:00 – 19:30)

**[ПЕЧАТАЕМ]** `model.ts`:

```ts
import { createModel, type FormModel } from '@reformer/core';
import type { TripQuote, Traveler } from './types';

export const createEmptyTraveler = (): Traveler => ({ lastName: '', birthDate: '', age: 0 });

export const createInitialTripQuote = (): TripQuote => ({
  tripType: 'domestic', country: '', startDate: '', endDate: '', days: 0,
  travelers: [], coverage: 30_000, riskySport: false, sportKind: '',
  pricePerDay: 0, total: 0, email: '', agree: false,
});

export const createTripQuoteModel = (): FormModel<TripQuote> =>
  createModel<TripQuote>(createInitialTripQuote());
```

**[РЕПЛИКА]** «Фабрика, а не синглтон. Модель — это владение состоянием; на каждый экземпляр формы
свой экземпляр модели».

### 3.3 Демонстрация API — страница без единого поля ввода (19:30 – 25:00)

**[ЭКРАН]** `SPLIT` → страница `/model` с `ModelInspector` (JSON модели) и рядом кнопки.

Порядок демонстрации строго такой:

1. **Прямая запись.** `model.tripType = 'international'` → JSON в инспекторе обновился.
   **[РЕПЛИКА]** «Присваивание. Не `setState`, не `dispatch` — присваивание в value-прокси».
2. **Пакетные операции.** `model.get()`, `model.patch({ coverage: 50_000 })`, `model.set({...})`.
3. **Грязь и сброс.** `model.isDirty()` до и после, `model.reset()`.
4. **Вложенность и массивы.**
   ```ts
   model.travelers.push(createEmptyTraveler());
   model.travelers.at(0).lastName = 'Иванов';
   model.travelers.length;   // реактивно
   ```
5. **Сигналы.**
   ```ts
   import { effect } from '@reformer/core/signals';
   effect(() => console.log('days →', model.$.days.value));
   ```
   Показать в консоли, что `model.$.days === model.signalAt('days')`.

**[РЕПЛИКА — главная в блоке]** «Модель — это не стейт формы. Это отдельный реактивный граф, который
переживёт любой рендерер. Через сорок минут мы поменяем способ отрисовки трижды, и этот файл не
изменится ни разу».

**[ЯКОРЬ]** Страница с JSON и кнопками, **без единого `<input>`**. Зритель должен заметить это сам —
если не заметил, сказать вслух.

**[РИСК]** Соблазн показать все методы модели. Пять пунктов выше — достаточно, остальное в доках.

---

## Блок 4 · Тесты модели (25:00 – 29:00)

**Тег:** `v1-04-model-tests`

**[ЭКРАН]** `SPLIT` → тест слева, вывод vitest справа.

**[ПЕЧАТАЕМ]** `__tests__/model.test.ts` — шесть кейсов, каждый в одну-три строки:

```ts
it('стартует со снимка initial', …);
it('set / get / patch', …);
it('isDirty → true после правки, false после reset', …);
it('массив: push / at(i).field / removeAt / реактивная length', …);
it('$-сигнал стабилен и совпадает с signalAt(path)', …);
it('effect не срабатывает на запись того же значения', …);
```

**[РЕПЛИКА]** про последний кейс: «Запись того же значения не будит подписчиков. Это не оптимизация,
это контракт — на нём держится отсутствие лишних ре-рендеров, к которым мы придём в конце».

**[ДЕЙСТВИЕ]** `npm test` — показать время прогона в кадре.

**[РЕПЛИКА]** «`environment: node`. Ни jsdom, ни браузера здесь нет и не появится».

---

## Блок 5 · Форма без React (29:00 – 41:00) ⭐

**Тег:** `v1-05-headless-form`
**Это ключевой блок курса.** Если время поджимает — режется что угодно, кроме него.

### 5.1 Поведение (29:00 – 34:00)

**[ПЕЧАТАЕМ]** `form.behavior.ts`:

```ts
import { defineFormBehavior, compute, enableWhen, applyEach, onChange } from '@reformer/core/behaviors';

const travelerBehavior = defineFormBehavior<Traveler>(({ model: t }) => {
  compute(t.$.age, () => yearsSince(t.birthDate));
});

export const tripQuoteBehavior = defineFormBehavior<TripQuote>(({ model, form }) => {
  compute(model.$.days,        () => daysBetween(model.startDate, model.endDate));
  compute(model.$.pricePerDay, () => basePrice(model.tripType, model.coverage, model.riskySport));
  compute(model.$.total,       () => model.pricePerDay * model.days * model.travelers.length);

  applyEach(model.travelers, travelerBehavior);

  enableWhen(model.$.country,   () => model.tripType === 'international', { resetOnDisable: true });
  enableWhen(model.$.sportKind, () => model.riskySport,                   { resetOnDisable: true });

  onChange(model.$.tripType, (t) =>
    form.coverage.updateComponentProps({ min: t === 'international' ? 50_000 : 30_000 })
  );
});
```

**[РЕПЛИКА]** про `compute`: «Зависимости не перечислены. Их не надо перечислять — они выводятся из
того, что функция реально прочитала. Это autotracking, и он же даст нам точечные ре-рендеры в конце».

**[РЕПЛИКА]** про `resetOnDisable`: «По умолчанию `false`. Выключить поле и обнулить поле — разные
намерения, и библиотека отказывается угадывать, какое ваше».

**[ДЕЙСТВИЕ — 20 секунд, сильный кадр для архитектора]** Прогнать граф через MCP `check_behaviors`:
`days ← startDate, endDate`; `pricePerDay ← tripType, coverage, riskySport`;
`total ← pricePerDay, days, travelers`. Показать «циклов нет».

**[РЕПЛИКА]** «Циклическая зависимость в реактивном графе — классическая ошибка, и ловить её в
рантайме больно. Здесь она ловится статически, до запуска».

### 5.2 Валидация (34:00 – 39:00)

**[РЕПЛИКА — до того, как печатать]** «Сейчас важный момент. Валидация — **отдельный слой над той же
моделью**. Она не внутри схемы, не в компонентах и не в пропсах полей».

**[ПЕЧАТАЕМ]** `validation.ts`:

```ts
import { defineValidationSchema, validate, validateAsync, validateWhen, cross, each }
  from '@reformer/core/validation';
import { required, email, min, minLength, pastDate, futureDate } from '@reformer/core/validators';

export const tripQuoteValidation = defineValidationSchema<TripQuote>(({ model }) => {
  validate(model.$.tripType,  [required()]);
  validate(model.$.startDate, [required(), futureDate()]);
  validate(model.$.endDate,   [required()]);
  validate(model.$.coverage,  [required(), min(30_000)]);
  validate(model.$.email,     [required(), email()]);

  validateWhen(() => model.tripType === 'international', () => {
    validate(model.$.country,  [required()]);
    validate(model.$.coverage, [min(50_000, { message: 'Для Шенгена минимум 50 000 €' })]);
  });

  validateWhen(() => model.riskySport, () => validate(model.$.sportKind, [required()]));

  cross(model.$.endDate, (f) =>
    f.endDate <= f.startDate ? { code: 'range', message: 'Дата возврата раньше выезда' } : null);
  cross(model.$.days, (f) =>
    f.days > 90 ? { code: 'tooLong', message: 'Один полис — максимум 90 дней' } : null);

  each(model.travelers, (t) => {
    validate(t.$.lastName,  [required(), minLength(2)]);
    validate(t.$.birthDate, [required(), pastDate()]);
  });

  validateAsync(model.$.email, [checkEmailNotBlacklisted]);
});
```

Проговорить три вещи:

- `validateWhen` — целая ветка правил включается условием, а не `if` внутри каждого валидатора.
- `cross` — правило видит **снимок всей формы**, а вешается на конкретное поле: ошибка приедет туда,
  где пользователь может её исправить.
- `each` — правила на строку массива объявляются один раз.

**[РЕПЛИКА]** «Двадцать пять строк — вся валидация формы. И ни одна из них не знает про UI».

### 5.3 Сборка без схемы (39:00 – 41:00) ⭐⭐

**[ПЕЧАТАЕМ]** `headless.ts`:

```ts
import { createCoreForm, type CoreForm } from '@reformer/core';

export const createTripQuoteHeadless = (): CoreForm<TripQuote> =>
  createCoreForm<TripQuote>({
    model: createTripQuoteModel(),
    behavior: tripQuoteBehavior,
    validation: tripQuoteValidation,
    // schema — НЕТ. Компонентов НЕТ. React НЕТ.
  });
```

**[РЕПЛИКА]** «Схему я не передаю вообще. Она опциональна: узел признаётся полем по тому, что в нём
лежит сигнал, а не по тому, что в нём указан компонент. Это не хак — так написаны собственные тесты
библиотеки».

**[ДЕЙСТВИЕ — ЯКОРЬ БЛОКА]** В терминале:

```bash
grep -rn "react\|ui-kit\|renderer" src/forms/trip-quote/*.ts
```

Пусто.

**[РЕПЛИКА]** «Полностью рабочая форма. Три вычисляемых поля, условная доступность, синхронная и
асинхронная валидация, правила на строки массива. Ноль импортов React».

**[РИСК]** Не соврать: сказать вслух, что `@reformer/core` держит React в peer-зависимостях, и в
корневом barrel живут хуки. Честная формулировка: «пакет умеет в React, но эти файлы — нет».

**[ОТСТУПЛЕНИЕ, 20 секунд]** «Если нужна материализация top-level массива в ноду формы — минимальный
узел схемы без `component` тип разрешает. Но в headless-файл мы это не тащим».

---

## Блок 6 · Тесты формы без UI (41:00 – 49:00)

**Тег:** `v1-06-headless-tests`

**[ЭКРАН]** `SPLIT`

### `behavior.test.ts`

```ts
const { model } = createTripQuoteHeadless();
model.startDate = '2026-06-01';
model.endDate   = '2026-06-15';
expect(model.days).toBe(14);

model.travelers.push(createEmptyTraveler());
expect(model.total).toBe(model.pricePerDay * 14);
```

Плюс: `enableWhen` + `resetOnDisable` (переключить `tripType` туда-обратно, проверить что `country`
обнулилась), `applyEach` (возраст в строке), `onChange` (обновлённый `min`).

### `validation.test.ts`

```ts
const { model, validation } = createTripQuoteHeadless();
expect(await validation!.validateAll()).toBe(false);

model.set(VALID_DOMESTIC);
expect(await validation!.validateAll()).toBe(true);

model.tripType = 'international';        // 30 000 перестало хватать
expect(await validation!.validateAll()).toBe(false);
```

**[РЕПЛИКА]** «Три строки описывают бизнес-правило, ради проверки которого в обычном проекте
поднимают jsdom, рендерят форму, ищут селект, кликают опцию и ждут перерисовки».

Плюс: адресация ошибки в конкретную ноду — `form.email.errors.value.map(e => e.code)`.

### `headless.test.ts`

Живая стратегия: `validation.controller.start()`, правка модели, `await Promise.resolve()` дважды,
проверка ошибок, `stop()`.

**[РЕПЛИКА]** «По умолчанию стратегия — `submit`: форма реактивно молчит, пока её не отправили. Живую
валидацию надо включить осознанно, и вот её контроллер».

**[ДЕЙСТВИЕ — ЯКОРЬ]** `npm test -- --project core`, время прогона крупно в кадре.

**[РЕПЛИКА — главная для тимлида]** «Это не unit-тесты моделек. Это тесты бизнес-правил формы — тех
самых, ради которых обычно поднимают jsdom, testing-library и ждут минуту на CI. Тот же охват идёт в
node за доли секунды, потому что правила не живут внутри компонентов».

---

## Блок 7 · Рендер на ui-kit (49:00 – 61:00)

**Тег:** `v1-07-ui-kit`

**Устройство блока.** Здесь три слоя, и их нельзя схлопывать: схема настраивает **ноды**, фабрика
собирает **бандл**, JSX рисует **дерево**. В следующем блоке второй и третий слой сольются в один —
и если сейчас не показать их по отдельности, миграция в блоке 8 будет выглядеть как замена одного
непонятного на другое.

### 7.1 Схема (49:00 – 53:00)

**[ПЕЧАТАЕМ]** `targets/core-ui-kit/form.schema.ts`:

```ts
import { Box, InputField, SelectField, CheckboxField, DatePickerField } from '@reformer/ui-kit';

export const tripQuoteSchema = (model: FormModel<TripQuote>): FormSchemaNode => ({
  component: Box,
  children: [
    { value: model.$.tripType, component: SelectField,
      componentProps: { label: 'Тип поездки', options: TRIP_TYPES } },
    { value: model.$.country, component: SelectField,
      componentProps: { label: 'Страна', options: COUNTRIES } },
    { value: model.$.startDate, component: DatePickerField, componentProps: { label: 'Выезд' } },
    { value: model.$.days, component: InputField,
      componentProps: { label: 'Дней', readOnly: true } },
    { array: model.travelers, initialValue: createEmptyTraveler,
      item: (t) => ({ children: [
        { value: t.$.lastName,  component: InputField,      componentProps: { label: 'Фамилия' } },
        { value: t.$.birthDate, component: DatePickerField, componentProps: { label: 'Дата рождения' } },
        { value: t.$.age,       component: InputField,      componentProps: { label: 'Возраст', readOnly: true } },
      ] }) },
    // …coverage / riskySport / sportKind / total / email / agree
  ],
});
```

**[РЕПЛИКА — ключевая]** «Смотрите, чего в этом файле нет. Нет валидаторов. Нет условий видимости. Нет
формул. Здесь только `value`, `component` и пропсы. Схема отвечает на вопрос "как это выглядит", и
больше ни на какой».

**[РЕПЛИКА]** про `*Field`: «Компонент указываем в form-версии — `InputField`, не `Input`. Обёртка сама
резолвит `value`, `onChange`, `onBlur` и ошибки из ноды. В `componentProps` их писать не надо и не
нужно».

### 7.2 Подключение схемы: фабрика формы (53:00 – 55:30)

**[РЕПЛИКА — до кода]** «Схема сама по себе ничего не делает. Это конфигурация. Соединяет всё
фабрика — и вот она целиком».

**[ПЕЧАТАЕМ]** `targets/core-ui-kit/create-form.ts`:

```ts
import { createCoreForm, type CoreForm, type FormValidationBundle } from '@reformer/core';
import { createTripQuoteModel } from '../../model';
import { tripQuoteBehavior } from '../../form.behavior';
import { tripQuoteValidation } from '../../validation';
import { tripQuoteSchema } from './form.schema';

export interface TripQuoteForm extends CoreForm<TripQuote> {
  validation: FormValidationBundle<TripQuote>;
}

export const createTripQuoteCoreForm = (): TripQuoteForm => {
  const bundle = createCoreForm<TripQuote>({
    model:      createTripQuoteModel(),
    schema:     tripQuoteSchema,
    behavior:   tripQuoteBehavior,      // ← файл из блока 5, не тронут
    validation: tripQuoteValidation,    // ← файл из блока 5, не тронут
  });
  return { ...bundle, validation: bundle.validation! };
};
```

**[РЕПЛИКА — ключевая]** «Четыре аргумента, четыре независимых файла. Три из них — модель, поведение,
валидация — написаны в блоке 5, когда React в проекте ещё не участвовал. Появился ровно один новый:
`schema`. Вот цена подключения интерфейса к готовой логике».

**[РЕПЛИКА]** про последнюю строку: «Сужение типа. `validation` в бандле опционально — потому что
форму можно собрать и без правил. Мы правила передали, значит они есть, и мы это фиксируем в типе,
чтобы дальше не ставить восклицательный знак на каждом вызове».

**[РЕПЛИКА]** «Обратите внимание, чего фабрика **не** возвращает: разметки. Она отдаёт `model`, `form`
и `validation`. Дерево компонентов мы сейчас напишем руками».

### 7.3 Вёрстка формы (55:30 – 59:00) ⭐

**[РЕПЛИКА — постановка]** «Вот момент, ради которого блок разбит на три части. В этом варианте
вёрстка пишется руками. Схема сказала, каким компонентом рисовать поле, но где это поле стоит на
экране, в каком порядке и рядом с чем — решает JSX».

**[ПЕЧАТАЕМ]** `targets/core-ui-kit/index.tsx`, сначала простая часть:

```tsx
import { useFormBundle, useFormControlValue } from '@reformer/core';
import { FormField } from '@reformer/ui-kit';

export function TripQuotePage() {
  const { form, model, validation } = useFormBundle(createTripQuoteCoreForm);

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <h2 className="text-xl font-bold">Страховка путешествия</h2>

      <FormField control={form.tripType}  testId="tripType" />
      <FormField control={form.startDate} testId="startDate" />
      <FormField control={form.endDate}   testId="endDate" />
      <FormField control={form.days}      testId="days" />
      …
    </form>
  );
}
```

**[РЕПЛИКА]** «`FormField` — универсальная обёртка. Ей передаётся нода, и она сама достаёт из неё всё:
какой компонент рисовать, какие пропсы, текущее значение, ошибки, состояние «выключено». Ни `value`,
ни `onChange`, ни `error` мы не прокидываем — их и негде взять, они в ноде».

**[РЕПЛИКА]** «`useFormBundle`, а не `useMemo`. React вправе выбросить кэш `useMemo` когда захочет — и
вместе с ним введённые пользователем данные. Внутри — ленивый `useState`, и он же армит контроллер
валидации».

**[ПЕЧАТАЕМ]** теперь условная часть — **это самое важное для блока 8**:

```tsx
const tripType   = useFormControlValue(form.tripType);
const riskySport = useFormControlValue(form.riskySport);

{tripType === 'international' && (
  <FormField control={form.country} testId="country" />
)}

{riskySport && (
  <FormField control={form.sportKind} testId="sportKind" />
)}
```

**[РЕПЛИКА — произнести медленно]** «Условная видимость здесь — обычный React. Читаем значение хуком,
пишем `&&`, поле появляется и исчезает. Никакого участия библиотеки. **Запомните эти шесть строк** —
через десять минут они исчезнут целиком, и это будет главным содержанием следующего блока».

**[ПЕЧАТАЕМ]** массив:

```tsx
<FormArraySection control={form.travelers} title="Путешественники" addLabel="Добавить" />
```

**[РЕПЛИКА]** «Строки массива рисуются по узлу `item` из схемы. Добавление, удаление и порядок —
внутри компонента».

**[ЯКОРЬ]** Кадр, где рядом видны: схема слева (`component: SelectField`) и JSX справа
(`<FormField control={form.country} />`). Два файла, две разные ответственности.

### 7.4 Отправка и проверка (59:00 – 61:00)

```tsx
const onSubmit = async (e: FormEvent) => {
  e.preventDefault();
  form.markAsTouched();
  if (await validation.validateAll()) console.log(model.get());
};
```

**[РЕПЛИКА]** «`markAsTouched` — чтобы ошибки показались на полях, которых пользователь не касался.
`model.get()` — чистый объект типа `TripQuote`, тот самый, что мы описали в блоке 3».

**[ДЕЙСТВИЕ]** В браузере: заполнить, переключить тип поездки → страна появилась, итог пересчитался,
отправить с ошибками → сообщения на местах, в консоли — объект модели.

**[ЯКОРЬ]** `ModelInspector` на той же странице показывает тот же JSON, что в блоке 3. Модель не
изменилась — вокруг неё появился интерфейс.

---

## Блок 8 · Миграция на renderer-react (61:00 – 69:00)

**Тег:** `v1-08-renderer-react`

**[РЕПЛИКА — до кода]** «Задача: поменять способ отрисовки и не тронуть бизнес-логику. Проверять будем
не на слово».

**[РЕПЛИКА — связка с предыдущим блоком]** «Только что мы написали три файла: схему, фабрику и JSX.
Сейчас JSX исчезнет. Не сократится — исчезнет: дерево компонентов будет описано данными, а не
разметкой. Смотрите, куда переедет каждая его часть».

**[ПЕЧАТАЕМ]** `renderer.schema.tsx` — то же дерево, но с html-тегами прямо в схеме:

```tsx
{ component: 'h2', children: ['Страховка путешествия'] },
{ value: model.$.tripType, component: SelectField, componentProps: { … } },
```

**[ПЕЧАТАЕМ]** `renderer.behavior.ts`:

```ts
hideWhen(schema.node('country'),   () => model.tripType !== 'international');
hideWhen(schema.node('sportKind'), () => !model.riskySport);
```

**[ДЕЙСТВИЕ — обязательно в кадре]** Открыть рядом два файла: `targets/core-ui-kit/index.tsx` из
прошлого блока и этот. Показать пальцем соответствие:

| Было (JSX, блок 7) | Стало (renderer, блок 8) |
| --- | --- |
| `useFormControlValue(form.tripType)` | не нужен — условие читает модель напрямую |
| `{tripType === 'international' && <FormField …/>}` | `hideWhen(schema.node('country'), …)` |
| порядок полей = порядок в JSX | порядок полей = порядок в схеме |
| `<h2>` в разметке | `{ component: 'h2', children: [...] }` в схеме |

**[РЕПЛИКА]** «Те самые шесть строк, которые я просил запомнить, стали двумя. Но выигрыш не в
количестве строк — он в том, что условие видимости теперь **данные**. Его можно сериализовать,
отправить по сети и, как мы увидим через десять минут, вынести в JSON».

**[РЕПЛИКА — важное различие]** «`hideWhen` и `enableWhen` — разные вещи, и это не синонимы.
`hideWhen` — поведение **рендера**: нода исчезает из дерева. `enableWhen` — поведение **модели**: поле
выключается, значение может сброситься, валидация перестаёт применяться. Первое живёт в слайсе
рендера, второе — в ядре. Скройте поле, забыв выключить, — и получите невидимое поле, блокирующее
отправку».

**[ПЕЧАТАЕМ]** Сборка:

```tsx
const bundle = useReactForm(() => createReactForm<TripQuote>({
  model: createTripQuoteModel(),
  schema: tripQuoteRenderSchema,
  behavior: tripQuoteBehavior,       // ← тот же файл, что в блоке 5
  validation: tripQuoteValidation,   // ← тот же файл
  renderBehavior: tripQuoteRenderBehavior,
}));
return <FormRenderer form={bundle} settings={{ fieldWrapper: FormField }} />;
```

### Кадр, ради которого блок существует (66:00 – 69:00)

**[ЭКРАН]** `TERM`

```bash
git diff --stat v1-07-ui-kit v1-08-renderer-react
```

**[ЯКОРЬ]** В выводе — только `targets/renderer-react/*` и одна строка роута. `model.ts`,
`form.behavior.ts`, `validation.ts`, `types.ts` **не фигурируют**.

**[ДЕЙСТВИЕ]** Тут же `npm test` — тесты из блока 6 проходят без единой правки.

**[РЕПЛИКА]** «Слой рендера заменён целиком. Бизнес-логика — ноль строк изменений, и тесты это
подтверждают, а не я».

---

## Блок 9 · Миграция на renderer-json (69:00 – 78:00)

**Тег:** `v1-09-renderer-json`

### 9.1 Схема как данные (69:00 – 73:00)

**[ПЕЧАТАЕМ]** `renderer.schema.json`:

```json
{
  "version": "1.0",
  "root": {
    "component": "$component(Box)",
    "children": [
      { "value": "$model(tripType)", "component": "$component(Select)",
        "componentProps": { "label": "Тип поездки", "options": "$dataSource(TRIP_TYPES)" } }
    ]
  }
}
```

**[РЕПЛИКА]** «Операторы — обычные строки. `$model` — путь в модели, `$component` — имя из реестра,
`$dataSource` — справочник. Ничего не сериализуется в функции: JSON остаётся JSON».

**[ПЕЧАТАЕМ]** `registry.ts` через `defineRegistry` — здесь имена связываются с реальными компонентами.

**[РЕПЛИКА — снять путаницу]** «Это реестр **компонентов**. Есть ещё пакет `@reformer/form-registry` —
это реестр **форм** для микрофронтов, совсем другая история, ей будет отдельное видео. Имена похожие,
задачи разные».

### 9.2 Схема по сети (73:00 – 76:00)

**[ДЕЙСТВИЕ]** Положить схему в `public/trip-quote.json`, загрузить `fetch`-ем, собрать форму из
пришедшей строки.

**[РЕПЛИКА]** «Форма приехала с сервера как данные и легла на ту же самую валидацию из блока 5. Вот
зачем это нужно: layout меняется без релиза приложения, а бизнес-правила остаются в коде, под тестами
и код-ревью».

### 9.3 Валидация схемы (76:00 – 78:00)

**[ДЕЙСТВИЕ]** Сделать намеренную опечатку `$component(Selct)` при включённом
`validateSchema={import.meta.env.DEV}` → показать ошибку.

**[РЕПЛИКА]** «Проверка структуры схемы включена только в dev. Ajv изолирован в отдельном subpath и в
прод-бандл не попадает — это проверяется в CI самой библиотеки».

**[ДЕЙСТВИЕ]** `git diff --stat v1-08-renderer-react v1-09-renderer-json` — снова ядро не тронуто.

---

## Блок 10 · Точечность обновлений (78:00 – 86:00)

**Тег:** `v1-10-profiler`

### 10.1 Механизм — до демо (78:00 – 80:00)

**[ЭКРАН]** `EDITOR` — открыть три места в исходниках библиотеки:

- `useSignalSubscription` — подписка через `useSyncExternalStore` на сигналы **конкретной ноды**;
- `useFormControl` — снимок из сигналов ноды, ошибки сравниваются поэлементно;
- `FormField` обёрнут в `React.memo` по ссылке `control`.

**[РЕПЛИКА]** «Страница не подписана на форму. Подписан каждый контрол — на свою ноду».

### 10.2 Прогоны (80:00 – 85:00)

**[ЭКРАН]** `BROWSER` → `/profiler?rows=50` (150 полей в массиве + 12 верхнеуровневых).

**Прогон A.** DevTools → Profiler → «Highlight updates when components render» = ON. Печатать в
`travelers[7].lastName` → мигает **одна рамка**.

**Прогон B — главный.** Печатать в `startDate` → мигают ровно четыре поля: `startDate`, `days`,
`pricePerDay`, `total`.

**[РЕПЛИКА]** «Набор ре-рендеров равен транзитивному замыканию графа вычислений. Я не написал ни
одного `useMemo` и ни одного `React.memo` — набор перерисовок совпал с набором зависимостей, потому
что зависимости объявлены в модели, а не выведены компилятором».

**Прогон C — контрольная группа.** `/profiler-usestate`: те же 150 инпутов в одном `useState` →
коммитятся все.

**[РЕПЛИКА — обязательная оговорка]** «Это сравнение механизмов, а не бенчмарк против React Hook Form.
RHF решает ту же задачу через uncontrolled inputs и соседей тоже не перерисовывает. Разница в том,
что здесь это свойство бесплатно распространяется на **вычисляемые** поля и на условную доступность —
туда, где в RHF появляются `watch()` и ручные подписки».

### 10.3 Проверяемое свойство (85:00 – 86:00)

**[ЭКРАН]** `TERM` → `render-count.test.tsx`:

```ts
await user.type(screen.getByTestId('travelers.7.lastName'), 'A');
expect(renderCounts['travelers.3.lastName']).toBe(1);   // не перерисовалось
```

**[РЕПЛИКА]** «Точечность обновлений у нас не эффект на видео, а тест в CI».

**[РИСК]** Мигание рамок плохо переживает сжатие. Обязательно продублировать `RenderCounter`-ом,
который печатает числа прямо на странице.

---

## Блок 11 · Архитектура и цена (86:00 – 94:00)

**Тег:** `v1-11-architecture`

### 11.1 Две гвардии (86:00 – 89:00)

**[ДЕЙСТВИЕ]** `reuse.test.ts` — ни один файл в `targets/**` не содержит `createModel(`,
`defineFormBehavior(`, `defineValidationSchema(`.

**[РЕПЛИКА]** «Переиспользование — не обещание в README, а падающий тест».

**[ДЕЙСТВИЕ]** `parity.test.ts` — три фабрики форм, один набор ожиданий, один прогон.

**[ЯКОРЬ]** Зелёный вывод `parity.test.ts` с тремя таргетами.

### 11.2 Цена архитектуры (89:00 – 92:00)

**[ЭКРАН]** `TERM` → `npm run size` на собственных точках входа курса.

**[ЭКРАН]** `SLIDE` → бюджеты библиотеки (gzip):

| Что | Бюджет |
| --- | --- |
| Ядро целиком | 21 kB |
| — только состояние | 2 kB |
| — 27 валидаторов | 5 kB |
| — 12 операторов поведения | 5 kB |
| Слой рендера (любой из двух) | 10 kB |
| Headless-компоненты | 10 kB |

**[РЕПЛИКА]** «Это бюджеты в CI, а не мои замеры. Ядро бизнес-логики формы стоит 21 килобайт и не
зависит от того, чем вы рисуете. Одиннадцать тяжёлых библиотек — таблицы, графики, календари —
вынесены за barrel: вы платите за них ровно тогда, когда импортируете конкретный subpath».

### 11.3 Финал (92:00 – 94:00)

**[ЭКРАН]** `SLIDE` → карта пакетов из блока 0, теперь с цифрами.

**[РЕПЛИКА]** «Мы прошли путь снизу вверх: модель → правила → рендер. Границы, которые мы провели, —
это не стиль, это то, что позволило три раза поменять отрисовку и ни разу не тронуть логику».

Анонсы: следующее видео — сложная форма со всеми паттернами; отдельно выйдут ролики про UI-Builder,
про формы в микрофронтах и про MCP-сервер.

---

## Приложение A · Сверенные сигнатуры

Проверено по исходникам монорепо на момент написания. **Пересверить перед записью**, если версии
пакетов обновились.

```ts
// @reformer/core/behaviors
compute<R>(target: Signal<R>, read: () => R, options?: { when?: () => boolean }): void
computeFrom<R>(sources: ReadonlySignal<unknown>[], target: Signal<R>, fn, options?): void
copyFrom<T>(source, target, options?: { when?, transform? }): void
onChange<T>(source: ReadonlySignal<T>, cb: (v: T, ctx: { signal: AbortSignal }) => void,
            options?: { immediate?: boolean; debounce?: number }): void
enableWhen(target: EnableTarget | EnableTarget[], condition: () => boolean,
           options?: { resetOnDisable?: boolean }): void      // resetOnDisable по умолчанию false
applyEach<TItem>(array: object, itemSchema: FormBehavior<TItem>): void
apply<TField>(targets: object | object[], subSchema: FormBehavior<TField>): void

// @reformer/core/validation
validate<TField>(sig: PathAwareSignal<TField>, rules: Rule<TField>[]): void
validateAsync<TField>(sig, rules: AsyncRule<TField>[]): void
validateWhen(cond: () => boolean, cb: () => void): void
cross<TSnapshot>(sig, fn: (formSnapshot: TSnapshot) => ValidationError | null): void
each<U>(arr: ModelArray<U>, itemFn: (item: FormModel<U>) => void): void
apply<T>(...schemas: ValidationSchema<T>[]): void             // ВАРИАДИЧЕСКИЙ

// @reformer/core
createCoreForm<T>(config): CoreForm<T>                        // { model, form, validation? }
useFormBundle<B>(factory: () => B): B                         // useState(factory) + армит controller

// @reformer/renderer-react
createReactForm<T>(config): ReactForm<T>
FormRenderer<T>({ render, form, settings })                   // render ЛИБО form
hideWhen(node: RenderNodeControl, conditionFn: () => boolean): void

// @reformer/renderer-json
createJsonForm<T>(config): JsonForm<T>
useJsonForm = useFormBundle
defineRegistry(fn: (reg: RegistryBuilder) => void): ComponentRegistry
```

## Приложение B · Ловушки, на которых легко сбиться в кадре

1. **`apply` — это две разные функции.** В `behaviors` — `apply(targets, subSchema)`, применяет
   под-схему поведения к группам. В `validation` — `apply(...schemas)`, вариадический, склеивает
   схемы валидации. Имя одно, семантика разная.
2. **`aggregateInto(array, derive)` не «сворачивает массив в поле».** Его `derive` возвращает
   `Array<{ index, patch }>` — то есть он **патчит строки**. Для суммы по массиву нужен обычный
   `compute`. В V1 не используется; в V2 не перепутать.
3. **Стратегия валидации по умолчанию — `submit`.** Форма реактивно молчит до отправки. Если в кадре
   ожидается живая подсветка ошибок — стратегию надо задать явно.
4. **`onInit` из renderer-react вызывает колбэк немедленно**, а не после монтирования. Для
   post-mount есть отдельный хук.
5. **`validation` в бандле опционально** (`validation?: FormValidationBundle<T>`) — в коде будет
   `validation!.validateAll()`. Не удивляться восклицательному знаку в кадре и не «чинить» его.
6. **Не создавать две формы над одной моделью.** Реестр «сигнал → нода» глобальный: вторая
   регистрация затирает первую, и `enableWhen` с роутингом ошибок начнут работать только у последней
   формы. Страница сравнения — на трёх независимых экземплярах модели.

## Приложение C · Чего не говорить

- Не называть числа производительности в сравнении с RHF/Formik — их нет.
- Не называть renderer-варианты «более коротким кодом»: слой рендера в них **не меньше**, он плоский
  и декларативный. Короче становится точка входа, а не схема.
- Не обещать, что UI-Builder работает в любом браузере — только Chromium.

---

## Статус

Сценарий V1 готов к записи после сборки репо-компаньона до тега `v1-11`.
Сценарии V2 и трёх спутников — по этому же шаблону, разворачиваются по запросу.
