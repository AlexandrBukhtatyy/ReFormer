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

Минималистичный switch на три состояния: `loading` / `error` / `ready`.
Используется для оборачивания экранов, зависящих от внешних данных
(profile, dictionaries).

### API

```typescript
type AsyncStatus = 'loading' | 'error' | 'ready';

interface AsyncBoundaryProps {
  status: AsyncStatus;
  LoadingComponent?: React.ComponentType;
  ErrorComponent?: React.ComponentType;
  children?: React.ReactNode;
}
```

| Prop               | Тип             | Описание                                                                               |
| ------------------ | --------------- | -------------------------------------------------------------------------------------- |
| `status`           | `AsyncStatus`   | Текущее состояние. Управляется снаружи.                                                |
| `LoadingComponent` | `ComponentType` | Рендерится при `status === 'loading'`. Без props. Если не передан — рендерится `null`. |
| `ErrorComponent`   | `ComponentType` | Рендерится при `status === 'error'`. Без props. Если не передан — `null`.              |
| `children`         | `ReactNode`     | Рендерится при `status === 'ready'`.                                                   |

Оба слота — `ComponentType`, не `ReactNode`. Для передачи props (текста ошибки,
`retry`-callback) — оберни в тонкий компонент:

```tsx
const Loading = () => <div className="py-12 text-center">Загрузка...</div>;
const ErrorView = () => (
  <div className="py-12 text-center text-destructive">
    Не удалось загрузить данные. <button onClick={retry}>Повторить</button>
  </div>
);

<AsyncBoundary status={status} LoadingComponent={Loading} ErrorComponent={ErrorView}>
  <Profile data={data} />
</AsyncBoundary>;
```

### Common Patterns

С хуком загрузки:

```tsx
import { useEffect, useState } from 'react';
import { AsyncBoundary, type AsyncStatus } from '@reformer/ui-kit';

function CountriesPage() {
  const [status, setStatus] = useState<AsyncStatus>('loading');
  const [countries, setCountries] = useState<string[]>([]);

  useEffect(() => {
    fetch('/api/countries')
      .then((r) => r.json())
      .then((data) => {
        setCountries(data);
        setStatus('ready');
      })
      .catch(() => setStatus('error'));
  }, []);

  return (
    <AsyncBoundary
      status={status}
      LoadingComponent={() => <p>Загружаем страны...</p>}
      ErrorComponent={() => <p>Ошибка загрузки</p>}
    >
      <ul>
        {countries.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
    </AsyncBoundary>
  );
}
```

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
