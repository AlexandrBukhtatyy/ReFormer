# Layout and buttons

Компоненты, не привязанные к `FieldNode`: `Button`, `AsyncBoundary`,
`ExampleCard`, утилита `cn`. Используются как для основных действий формы
(submit, prev/next в wizard), так и для playground-демонстраций.

## Button

Кнопка на shadcn/Radix `Slot`. Поддерживает 6 вариантов внешнего вида, 6
размеров и режим `asChild` для замены DOM-узла (типичный кейс — превратить
кнопку в `<a>` или `<Link>` без потери стилей).

### API

```typescript
interface ButtonProps extends React.ComponentProps<'button'> {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon' | 'icon-sm' | 'icon-lg';
  asChild?: boolean;
}
```

| Variant       | Use case                                                            |
| ------------- | ------------------------------------------------------------------- |
| `default`     | Основное действие (`Submit`, `Save`). Заполненный фон `bg-primary`. |
| `destructive` | Опасное действие (`Delete`, `Remove`).                              |
| `outline`     | Вторичное действие (`Cancel`, `Edit`). Прозрачный фон + бордер.     |
| `secondary`   | Между `default` и `outline`. Серый фон.                             |
| `ghost`       | Меню, иконки в toolbar. Без фона до hover.                          |
| `link`        | Текстовая ссылка с подчёркиванием на hover.                         |

| Size      | Высота    | Использование                          |
| --------- | --------- | -------------------------------------- |
| `default` | `h-9`     | Дефолтный размер для большинства форм. |
| `sm`      | `h-8`     | Компактные toolbar-ы, фильтры.         |
| `lg`      | `h-10`    | Финальный CTA, оплата.                 |
| `icon`    | `size-9`  | Только иконка, default-размер.         |
| `icon-sm` | `size-8`  | Иконка в toolbar.                      |
| `icon-lg` | `size-10` | Иконка hero.                           |

| Prop      | Тип       | Default     | Описание                                                                                                                         |
| --------- | --------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `variant` | union     | `'default'` | Внешний вид (см. таблицу).                                                                                                       |
| `size`    | union     | `'default'` | Размер (см. таблицу).                                                                                                            |
| `asChild` | `boolean` | `false`     | Заменить корневой `<button>` на дочерний элемент через `@radix-ui/react-slot`. Требует ровно одного React-элемента в `children`. |

Все остальные пропсы (`onClick`, `disabled`, `type`, `aria-*`, `data-*`)
прокидываются как у нативного `<button>`.

### Common Patterns

Submit формы:

```tsx
import { Button } from '@reformer/ui-kit';

<Button type="submit" disabled={isSubmitting}>
  {isSubmitting ? 'Отправка...' : 'Отправить'}
</Button>;
```

Variants matrix (для design-system документации):

```tsx
{
  (['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'] as const).map((variant) => (
    <Button key={variant} variant={variant}>
      {variant}
    </Button>
  ));
}
```

`asChild` + react-router:

```tsx
import { Link } from 'react-router-dom';
import { Button } from '@reformer/ui-kit';

<Button asChild variant="outline">
  <Link to="/dashboard">Открыть дашборд</Link>
</Button>;
```

`asChild` + `<a download>`:

```tsx
<Button asChild>
  <a href="/report.pdf" download>
    Скачать отчёт
  </a>
</Button>
```

Иконка в кнопке (Lucide):

```tsx
import { PlusIcon } from 'lucide-react';

<Button size="sm">
  <PlusIcon /> Добавить
</Button>;
```

Только иконка:

```tsx
<Button size="icon" variant="ghost" aria-label="Закрыть">
  <XIcon />
</Button>
```

### Anti-patterns

- `asChild` с несколькими элементами в `children` — Radix Slot падает; нужен
  ровно один React-элемент.
- `<Button as="a">` — у `Button` нет prop'а `as`, используй `asChild`.
- Передавать `className` для смены `variant`-цветов вместо одной из
  вариант-опций — теряется консистентность темы.
- `size="icon"` без иконки — будет квадрат `h-9 w-9` без видимого контента.

## AsyncBoundary

Контейнер состояний загрузки данных: `idle` / `loading` / `ready` / `error`.
Стилизованная обёртка над headless `AsyncBoundary` из `@reformer/cdk/async-boundary`.
Используется для экранов, зависящих от внешних данных (profile, dictionaries, заявка).

Блоки загрузки и ошибки **встроены** — отдельные слот-компоненты создавать не нужно.
Регион несёт `aria-busy`, блок загрузки — `role="status"` + `aria-live="polite"`,
блок ошибки — `role="alert"` + `aria-live="assertive"`.

### API

Два режима: **self-managed** (передан `load` — компонент грузит данные сам, отменяет
устаревшие запросы и даёт повтор) и **controlled** (`load` не передан — состояние
приходит через `status`). В self-managed режиме `status` / `error` / `refreshing` /
`onRetry` игнорируются.

```typescript
type AsyncStatus = 'idle' | 'loading' | 'ready' | 'error';

interface AsyncBoundaryProps<T = unknown> {
  // self-managed
  load?: (signal: AbortSignal) => Promise<T>;
  loadKey?: unknown;
  enabled?: boolean;
  onSuccess?: (data: T) => void;
  onError?: (error: React.ReactNode) => void;
  toError?: (e: unknown) => React.ReactNode;
  // controlled
  status?: AsyncStatus;
  error?: React.ReactNode | null;
  onRetry?: () => void;
  refreshing?: boolean;
  delayMs?: number;
  loadingTitle?: React.ReactNode;
  loadingSubtitle?: React.ReactNode;
  errorTitle?: React.ReactNode;
  retryLabel?: React.ReactNode;
  loadingSlot?: React.ReactNode;
  errorSlot?: React.ReactNode | ((p: { error; retry; canRetry }) => React.ReactNode);
  children?: React.ReactNode;
  className?: string;
}
```

| Prop          | Тип                     | Описание                                                                                       |
| ------------- | ----------------------- | ---------------------------------------------------------------------------------------------- |
| `load`        | `(signal) => Promise<T>` | Загрузчик. Включает self-managed режим. Прокиньте `signal` в `fetch` — иначе отменённый запрос висит. |
| `loadKey`     | `unknown`               | Ключ перезапуска (обычно id записи). Сравнение по `Object.is` — передавайте примитив.            |
| `enabled`     | `boolean`               | `false` → `idle`, загрузка не стартует. Режим создания записи.                                   |
| `onSuccess`   | `(data: T) => void`     | Побочный эффект после успеха — например `form.patchValue(data)`.                                 |
| `status`      | `AsyncStatus`           | Состояние в controlled-режиме. `idle` — загрузка не запускалась, показываются children.          |
| `error`       | `ReactNode \| null`     | Текст ошибки. Идёт во встроенный блок и в render-функцию `errorSlot`.                           |
| `onRetry`     | `() => void`            | Повтор загрузки. Без него кнопка «Повторить» не рендерится.                                     |
| `refreshing`  | `boolean`               | Фоновое обновление: контент остаётся на экране, регион помечается `aria-busy`.                  |
| `delayMs`     | `number`                | Не показывать блок загрузки первые N мс — гасит вспышку спиннера. По умолчанию `0`.             |
| `loadingSlot` | `ReactNode`             | Полная замена блока загрузки (например скелетон).                                               |
| `errorSlot`   | `ReactNode \| функция`  | Полная замена блока ошибки; функция получает `error` / `retry` / `canRetry`.                    |
| `children`    | `ReactNode`             | Рендерится при `status === 'ready'` и `'idle'`.                                                 |

Слоты принимают `ReactNode` (или render-функцию для ошибки), а не `ComponentType` —
оборачивать блок в отдельный компонент ради текста ошибки больше не нужно.

### Common Patterns

Self-managed — состояние ведёт сам компонент (рекомендуемый способ):

```tsx
import { AsyncBoundary } from '@reformer/ui-kit';

function ApplicationPage({ applicationId, form }: Props) {
  return (
    <AsyncBoundary
      load={(signal) => loadApplication(applicationId, signal)}
      loadKey={applicationId}
      enabled={applicationId !== null}
      onSuccess={(data) => form.patchValue(data)}
      delayMs={200}
    >
      <CreditForm form={form} />
    </AsyncBoundary>
  );
}
```

Ни `useState`, ни `useEffect` не нужны: статус, отмена запроса при смене
`applicationId`, кнопка «Повторить» и `idle` для режима создания — внутри компонента.

Перезагрузка снаружи — через `ref`:

```tsx
import { useRef } from 'react';
import type { AsyncBoundaryHandle } from '@reformer/cdk/async-boundary';

const boundaryRef = useRef<AsyncBoundaryHandle<Application>>(null);

<button onClick={() => boundaryRef.current?.reload()}>Обновить</button>
<AsyncBoundary ref={boundaryRef} load={loadApplication}>…</AsyncBoundary>;
```

Controlled — когда загрузкой владеет кто-то другой (behavior рендерера, внешний стор):

```tsx
<AsyncBoundary status={status} error={error} onRetry={reload}>
  <CountriesList countries={countries} />
</AsyncBoundary>
```

Скелетон вместо спиннера:

```tsx
<AsyncBoundary
  status={status}
  loadingSlot={
    <div className="space-y-2">
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-9 w-full" />
      ))}
    </div>
  }
>
  <DataTable rows={rows} />
</AsyncBoundary>
```

### Anti-patterns

- **Не** схлопывать «нечего грузить» в `ready`: для формы создания (`id === null`)
  используйте `idle`, иначе пустая форма неотличима от успешно загруженной.
- **Не** сообщать пустой результат через `status: 'error'` — ноль записей это успех.
  Пустоту рисует `AsyncBoundaryEmpty` внутри `ready`.
- **Не** рисовать кнопку повтора без рабочего `onRetry`: неработающий контрол ловит
  фокус и читается скринридером. Компонент скрывает её сам, когда `onRetry` не задан.
- Нужен полный контроль над составом состояний — берите headless-версию из
  `@reformer/cdk/async-boundary`, а не копируйте стилизованную.

### Anti-patterns

- Передавать в `LoadingComponent` готовый `<div>` (ReactNode) вместо
  компонента — будет ошибка типов; нужно `() => <div>...</div>`.
- Использовать `AsyncBoundary` вместо `Suspense` для React-Suspense-данных —
  это разные механизмы. `AsyncBoundary` — простая state-машина, не
  перехватывает throw.

## ExampleCard

Карточка-демонстрация для playground: заголовок, описание, область с примером
и переключатель `пример ↔ исходник` с кнопкой копирования.

### API

```typescript
interface ExampleCardProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  code: string;
  className?: string;
  bgColor?: string;
}
```

| Prop          | Тип      | Default      | Описание                                 |
| ------------- | -------- | ------------ | ---------------------------------------- |
| `title`       | `string` | —            | Заголовок карточки.                      |
| `description` | `string` | —            | Описание под заголовком.                 |
| `code`        | `string` | —            | Текст исходника, копируется в clipboard. |
| `bgColor`     | `string` | `'bg-white'` | Tailwind-класс фона карточки.            |

### Common Patterns

```tsx
import { ExampleCard, Input } from '@reformer/ui-kit';

<ExampleCard
  title="Input — базовый"
  description="Однострочное поле с placeholder"
  code={`<Input value={v} onChange={setV} placeholder="Email" />`}
>
  <Input value={v} onChange={setV} placeholder="Email" />
</ExampleCard>;
```

### Anti-patterns

- Использовать в продакшене — это playground-utility, не component-library
  primitive. Кнопка переключения «глаз/код» не настраивается.

## cn

Утилита для конкатенации Tailwind-классов через `clsx` и `tailwind-merge`.
Разрешает конфликты (последний выигрывает) — критично для условного оверрайда
classN'ов.

### Common Patterns

Условные классы:

```typescript
import { cn } from '@reformer/ui-kit';

cn('px-2 py-1', isActive && 'bg-blue-500', 'px-4');
// → 'py-1 bg-blue-500 px-4'  (px-2 затёрт px-4)
```

В forwardRef-компоненте:

```tsx
import { cn } from '@reformer/ui-kit';

const Card = React.forwardRef<HTMLDivElement, { className?: string }>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('rounded-lg border p-4', className)} {...props} />
  )
);
```

### Anti-patterns

- Использовать `cn` вместо строки в случае без условий — `cn('a b c')` работает,
  но избыточен. Достаточно `'a b c'`.
- Передавать массивы/объекты, рассчитывая на shadcn-стиль `cn({active: true})`:
  `clsx`-синтаксис поддерживается, но удобнее писать через `&&`.

## See also

- [05-form-field-integration.md](05-form-field-integration.md) — как `Button` используется в `FormWizard.Actions`.
- [06-troubleshooting.md](06-troubleshooting.md) — «forwardRef + Slot конфликты», «AsyncBoundary не переключает состояние».
