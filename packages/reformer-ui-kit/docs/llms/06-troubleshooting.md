# Troubleshooting / FAQ

Частые ошибки при использовании `@reformer/ui-kit` и пути их решения.

## 1. `Input type="number"` возвращает строку, а не число (или `null`)

**Симптом.** В schema поле `age: number`, но в `getValue()` приходит `'42'` или
никогда не приходит `null` для пустого ввода.

**Причина.** Скорее всего, ты обходишь контракт `Input` и подписываешься на
`event` вручную: `<input onChange={(e) => setAge(e.target.value)}>`. Нативный
`<input>` всегда отдаёт строку, даже при `type="number"`.

**Решение.** Использовать ui-kit-`Input` через `value`/`onChange`-контракт:

```tsx
<Input type="number" value={age} onChange={setAge} min={0} />
// onChange приходит number | null. Пустой ввод → null. NaN не прокидывается.
```

В schema поле должно быть `number | null`, а не `number`:

```typescript
interface Form {
  age: number | null;
}
```

## 2. `Select` не показывает options (пустой дропдаун)

**Симптом.** Триггер открывается, но в нём `'No options available'`.

**Причины и решения:**

- **Передан `resource`, но не передан `options`** — `resource.load({})`
  упал с ошибкой и поймался `.catch(() => setResourceOptions([]))`. Открой
  DevTools Network и посмотри статус. Скорее всего бек вернул не тот формат
  (`items: [...]` обязательно, `id` обязательно у каждого item).

- **Передан `options`, но `value` не строка** — внутри `Select` все `value`
  приводятся к строке (`String(opt.value)`). Если ты передаёшь
  `value: 42` (число), а `options[i].value: '42'` (строка) — Radix не
  подсветит выбранный вариант, но options будут.

- **Сразу и `options`, и `resource`** — `options` приоритетнее, но
  `resource.load` всё равно вызовется. Если сеть упала, `loading` может
  остаться `true`, и UI блокируется. Используй один источник.

## 3. `InputMask` пропускает символы или не вставляет литералы

**Симптом.** Пользователь вводит цифры, но скобки/тире из маски не
появляются автоматически.

**Причина.** `InputMask` в текущей реализации **не** трансформирует ввод — он
лишь служит подсказкой `placeholder`-ом, равной маске. Литералы из `mask`
рендерятся в placeholder, но не вставляются в `value`.

**Решение.** Использовать поверх ui-kit отдельный mask-инструмент, либо
форматировать значение в `behavior` `transformValue` и хранить в форме либо
форматированное, либо «голое» значение:

```typescript
// behaviors на форме:
transformValue(form.phone, (raw) => raw?.replace(/\D/g, '') ?? null);
```

Если для UX критичен реальный mask (с автоматической вставкой скобок), на
данный момент компонент не покрывает эту задачу — оборачивай сторонний пакет
(`react-imask`, `imask`) и подключай через [`05-form-field-integration.md`](05-form-field-integration.md)
сценарий 3 (`<FormField><MaskedInput /></FormField>`).

## 4. `forwardRef` + Radix `Slot` конфликты

**Симптом.** При `<Button asChild><Link to="/">Go</Link></Button>` падает с
`Slot: only one child or React.cloneElement is not a function`.

**Причины.**

- В `children` несколько элементов или текст рядом с элементом:
  `<Button asChild>Hello <span>!</span></Button>` — Slot допускает ровно
  один React-элемент.
- Дочерний компонент не пробрасывает `ref` (через `React.forwardRef` или
  React 19 ref-as-prop). Slot пытается прокинуть `ref`, и если получатель —
  обычная функция, ничего не произойдёт; если внутри Slot вычисляется
  `ref`-композиция, бросает ошибку.

**Решение.** Проверь, что:

```tsx
<Button asChild>
  <Link to="/">Go</Link> {/* один элемент, без текста рядом */}
</Button>
```

Для собственных контейнеров используй `React.forwardRef`:

```tsx
const MyLink = React.forwardRef<HTMLAnchorElement, { href: string; children: ReactNode }>(
  ({ href, children, ...props }, ref) => (
    <a ref={ref} href={href} {...props}>
      {children}
    </a>
  )
);
<Button asChild>
  <MyLink href="/x">Go</MyLink>
</Button>;
```

## 5. `Checkbox` value не сохраняется (всегда `false`)

**Симптом.** Пользователь чекает, в форме пишется `true`, но при следующем
рендере чекбокс снова пуст.

**Причины.**

- Передан `checked` вместо `value` (`<Checkbox checked={...}>`) — пропа
  `checked` нет, нужно `value`.
- В модели поле имеет тип `boolean`, но начальное значение `undefined` —
  компонент отрендерится как `false`, и при `setValue(true)` без вмешательства
  React re-render не произойдёт. Указывай `accept: false` явно в initial-значениях
  модели.

```typescript
const model = createModel<{ accept: boolean }>({ accept: false }); // false, не undefined!
const schema = {
  children: [{ value: model.$.accept, component: Checkbox }],
};
const form = createForm<{ accept: boolean }>({ model, schema });
```

## 6. `FormField` не подцепляет ошибки (`<error>` не появляется)

**Симптом.** Поле невалидно, `form.email.error` есть, но в DOM ошибка не
рендерится.

**Причины.**

- Используется headless-`FormField` из `@reformer/cdk` без подключения
  `<FormField.Error>`. ui-kit-`FormField` всегда вставляет `Error`, поэтому
  чаще всего проблема — путаница импортов.
- Поле не помечено как `touched`. По умолчанию `error` вычисляется только
  после `blur` или `markAsTouched`. Если submit-кнопка не вызывает
  `form.markAsTouched()` — пользователь вообще не увидит ошибку.

**Решение.** На submit обязательно помечаем touched и валидируем модель по схеме
(M1: `validateFormModel(model, schema)` — именно он прогоняет `validators` листьев
и роутит ошибки в ноды):

```tsx
import { validateFormModel } from '@reformer/core';

const onSubmit = async () => {
  form.markAsTouched();
  const res = await validateFormModel(model, schema);
  if (!res.valid) return;
  // ... отправка (значения — из model.get())
};
```

И импорт:

```tsx
import { FormField } from '@reformer/ui-kit'; // готовый wrapper
// а не
import { FormField } from '@reformer/cdk/form-field'; // headless, без Error
```

## 7. `onBlur` не срабатывает на `Select` / `RadioGroup`

**Симптом.** `touched`-флаг не появляется при выборе значения, поле «вечно»
без подсветки ошибки.

**Причины.**

- `Select` (Radix) — `onBlur` пробрасывается через `onOpenChange(false)`, то
  есть срабатывает при закрытии дропдауна. Если пользователь кликает мимо без
  открытия — `onBlur` не сработает.
- `RadioGroup` — `onBlur` приходит на каждый `<input>` радио. Если фокус
  перемещается между radio внутри группы, `blur`/`focus` чередуются. Это
  нормально для нативного поведения.

**Решение.** Для гарантированного `touched` используй `onChange` как trigger
(ведь выбор — это явное взаимодействие):

```tsx
<Select
  value={form.city.value}
  onChange={(v) => {
    form.city.setValue(v);
    form.city.blur(); // принудительно помечаем touched
  }}
  options={CITIES}
/>
```

`FormField` делает это автоматически (читает `componentProps` из `FieldNode`).
Проблема обычно возникает, если Select используется руками без `FormField`.

## 8. `cn` стирает мои классы или, наоборот, оставляет лишние

**Симптом.** Передал `className="px-2 py-1"` в компонент, ожидая, что
overrideнет дефолт `px-3`, но получил оба.

**Причина.** В компоненте `className` подставлен **до** дефолтов. Внутри
`Input`/`Button`/`Textarea` всё построено правильно: дефолты идут первыми,
твой `className` — последним, и `tailwind-merge` оставляет последний
конфликтующий класс.

Если это не работает — проверь, что пользовательский `className` действительно
доходит до `cn(...)`. Например, в `ExampleCard` `className` идёт сразу после
дефолтов; в кастомных обёртках убедись:

```tsx
<div className={cn('rounded-lg border p-4', className)} />
//                                    ↑ user override побеждает
```

## 9. `AsyncBoundary` не переключает состояние

**Симптом.** Пропал `loading`, но `children` не появились.

**Причины.**

- В `status` всё ещё `'loading'` или `'error'` — `AsyncBoundary` рендерит
  `children` только при `'ready'`. Проверь setState внутри `then(...)`.
- Передан `LoadingComponent={<Spinner />}` (ReactNode) вместо
  `LoadingComponent={() => <Spinner />}` (`ComponentType`). При первом
  варианте TS не ругается, но рантайм может выдать «warning: invalid type».

**Решение:**

```tsx
<AsyncBoundary
  status={status}
  LoadingComponent={() => <Spinner />}
  ErrorComponent={() => <ErrorBanner />}
>
  <Content />
</AsyncBoundary>
```

## 10. `InputPassword`: иконка-«глаз» не появляется

**Симптом.** Прокинул `showToggle={true}` (или оставил дефолт), но в правом
углу ничего нет.

**Причина.** Иконка появляется **только** если `value` непустой:

```tsx
const hasValue = Boolean(value);
{
  showToggle && hasValue && <button>…</button>;
}
```

**Решение.** Это работает as-designed: для пустого пароля смысла переключать
видимость нет. Если нужно показывать иконку всегда — тонкая обёртка:

```tsx
<div className="relative">
  <InputPassword value={pwd} onChange={setPwd} showToggle={false} />
  <button onClick={...} className="absolute right-2 top-1/2">👁</button>
</div>
```

## 11. JSON-renderer: `Select`-`options` хранятся в реестре, но в дропдауне пусто

**Симптом.** Регистрируется dataSource `LOAN_TYPES` через `reg.dataSource('LOAN_TYPES', list)`,
в JSON-схеме `componentProps: { options: '$LOAN_TYPES' }`, но опции пустые.

**Причина.** `Select` ждёт `options: Array<{value, label, group?}>`, а из
реестра приходит уже обработанная строкой ссылка `'$LOAN_TYPES'`. Нужен
правильный синтаксис dataSource-ссылки в реестре.

**Решение.** Проверь convention для dataSource-ссылок в
[`renderer-json/03-registry.md`](../../../reformer-renderer-json/docs/llms/03-registry.md).
Внутри `Select` дальнейших магий нет — он просто читает `directOptions`
один в один.

## See also

- [01-overview.md](01-overview.md) — список компонентов и их назначения.
- [02-text-fields.md](02-text-fields.md), [03-choice-fields.md](03-choice-fields.md), [04-layout-and-buttons.md](04-layout-and-buttons.md) — детали по каждому компоненту.
- [05-form-field-integration.md](05-form-field-integration.md) — `FormField` standalone и как `fieldWrapper`.
