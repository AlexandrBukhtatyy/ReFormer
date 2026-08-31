# Layout and buttons

Компоненты, не привязанные к `FieldNode`: `Button`, `AsyncBoundary`, `Tree`,
`ExampleCard`, утилита `cn`. Используются как для основных действий формы
(submit, prev/next в wizard), для показа данных рядом с ней и для
playground-демонстраций.

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

## Tree

Плотное дерево с уровнями — файловый навигатор редактора, а не раскрывающийся список. Показывает
иерархию: дерево проекта, разделы каталога, оргструктуру. Живёт в главном barrel
(`@reformer/ui-kit`) и в своём subpath (`@reformer/ui-kit/tree`); тяжёлых зависимостей не тянет.

**`Tree` — не поле формы.** У него нет ни `value`, ни `onChange`, и `TreeField` не существует:
раскрытие, выделение и отмеченный набор он держит сам, а наружу отдаёт события. Когда от иерархии
нужно именно значение поля, берут построенные поверх него `ComboboxTreeField` /
`ComboboxTreeMultiField` — см. [03-choice-fields.md](03-choice-fields.md).

### Key Concepts

- **Два источника узлов.** `nodes` — дерево объявлено целиком; `loadChildren(node)` — уровень
  читается при первом раскрытии ветки (`null` — верхний уровень). Вместе их не передают.
- **Прочитанный уровень не забывается.** Свернуть и раскрыть обратно — частое движение, и
  повторного запроса оно не стоит. Перечитать уровень можно только явно — `refresh(id)` у handle.
- **«Уровень не прочитан» ≠ «детей нет».** У ветки `children: undefined` означает первое, поэтому
  `kind` объявляют явно: пустой каталог иначе неотличим от файла и теряет треугольник.
- **Выделение и отмеченный набор — разное.** `selectedId` это «где я сейчас» (одна строка, туда же
  уходит фокус), `checkedIds` — «что я выбрал» (сколько угодно строк, и строка с фокусом может в
  набор не входить). Свести их в один список нельзя: тогда клавиатура теряет точку отсчёта для
  диапазона.
- **Две идиомы набора, а не россыпь флагов.** `checkOn='modifier'` (умолчание) — навигатор файлов:
  щелчок заменяет набор, Ctrl/Cmd пополняет, Shift берёт диапазон, `Escape` снимает набор.
  `checkOn='click'` — выбор из списка: щелчок и пробел переключают членство, `Escape` уходит
  наверх (в поповере его ждёт закрытие). Обе действуют при `selectionMode='multiple'`.
- **`selectable`** — `'all'` (умолчание) или `'leaf'`. При `'leaf'` щелчок по ветке раскрывает её,
  а не выбирает: иначе до файлов внутри было бы не добраться мышью.
- **Виртуальный скролл включён по умолчанию.** Строки фиксированной высоты (24 px), в разметке
  живёт только видимое окно: раскрытый каталог реального проекта — тысячи строк, и у каждой свои
  обработчики. `virtualized={false}` — там, где разметка нужна целиком (серверная отрисовка
  страницы документации).
- **`maxRows` задаёт высоту по содержимому** — то, что нужно списку в поповере: короткое дерево не
  оставляет пустоты, длинное не растёт бесконечно. Без него высоту задаёт вызывающий через
  `className` (например `h-full` в панели), и прокрутка появляется от неё.
- **Поиск фильтрует само дерево**, достраивая путь до совпадения: ветки на пути раскрываются на
  время поиска и возвращаются в прежнее состояние, когда запрос убран. Видит только прочитанные
  уровни; непрочитанная ветка остаётся в выдаче — судить её содержимое ещё не по чему.
- **`node.id` — адрес, уникальный в пределах всего дерева.** По нему идут раскрытие, выбор, фокус
  и `data-testid` строки. Для файлов это полный путь, а не имя.
- **Клавиатура принадлежит дереву** и глушится: стрелки (влево — свернуть либо уйти к родителю,
  вправо — раскрыть либо шагнуть вниз), `Home`/`End`, `Enter` (запуск), пробел (предпросмотр, а в
  идиоме `'click'` — переключение членства), `Escape`. Сочетания с модификатором уходят наверх
  целиком: перехватив `mod+c`, дерево отняло бы у команды копирования её единственную дверь.

### API

```typescript
interface TreeNode {
  id: string; // адрес, уникальный в пределах дерева; для файлов — полный путь
  label: string; // подпись; по ней же идёт поиск
  kind?: 'branch' | 'leaf'; // умолчание выводится из наличия поля children
  children?: readonly TreeNode[];
  badge?: string;
  badgeTone?: 'default' | 'secondary' | 'destructive' | 'outline';
  title?: string; // подсказка при наведении; по умолчанию label
  disabled?: boolean; // выбрать нельзя; раскрыть по-прежнему можно
  loading?: boolean; // уровень читается — вместо треугольника спиннер
  failed?: boolean; // уровень не прочитался: нет прав, каталог исчез
}
```

| Prop                                                        | Тип                                               | Default           | Описание                                                                          |
| ----------------------------------------------------------- | ------------------------------------------------- | ----------------- | --------------------------------------------------------------------------------- |
| `nodes`                                                     | `readonly TreeNode[]`                             | —                 | Узлы верхнего уровня объявленного дерева.                                         |
| `loadChildren`                                              | `(node: TreeNode \| null) => Promise<TreeNode[]>` | —                 | Ленивое чтение уровня; `null` — верхний уровень.                                  |
| `expandedIds` / `defaultExpandedIds`                        | `readonly string[]`                               | —                 | Раскрытые ветки: управляемо / на старте.                                          |
| `selectedId` / `defaultSelectedId`                          | `string \| null`                                  | —                 | Выделенная строка: управляемо / на старте.                                        |
| `checkedIds` / `defaultCheckedIds`                          | `readonly string[]`                               | —                 | Отмеченный набор: управляемо / на старте.                                         |
| `onExpandedChange` / `onSelectedChange` / `onCheckedChange` | функция                                           | —                 | Изменение соответствующего состояния.                                             |
| `selectionMode`                                             | `'single' \| 'multiple'`                          | `'single'`        | Есть ли отмеченный набор помимо выделения.                                        |
| `checkOn`                                                   | `'modifier' \| 'click'`                           | `'modifier'`      | Как строка попадает в набор.                                                      |
| `selectable`                                                | `'all' \| 'leaf'`                                 | `'all'`           | Что можно выбрать.                                                                |
| `isNodeDisabled`                                            | `(node) => boolean`                               | —                 | Динамический запрет выбора поверх `node.disabled`.                                |
| `onActivate`                                                | `(node, { preview }) => void`                     | —                 | Запуск строки. `preview: true` — щелчок/пробел, `false` — двойной щелчок/`Enter`. |
| `onRowClick` / `onRowDoubleClick`                           | `(node, event) => void`                           | —                 | ДО правил дерева; `preventDefault()` забирает строку себе.                        |
| `onContextMenu` / `getRowProps`                             | функция                                           | —                 | Правый щелчок по дереву; свои атрибуты строки.                                    |
| `search`                                                    | `string`                                          | —                 | Поисковый запрос (подстрока в `label`, регистр не важен).                         |
| `emptyText`                                                 | `string`                                          | `'Пусто'`         | Текст пустого дерева.                                                             |
| `rowHeight` / `indent` / `indentBase`                       | `number`                                          | `24` / `12` / `8` | Высота строки и отступы уровней, px.                                              |
| `maxRows`                                                   | `number`                                          | —                 | Сколько строк показать до появления прокрутки.                                    |
| `virtualized`                                               | `boolean`                                         | `true`            | Виртуальный скролл.                                                               |
| `renderIcon` / `renderLabel` / `renderActions`              | функция                                           | —                 | Значок, подпись, правый край строки.                                              |
| `onLoadError`                                               | `(error, node) => void`                           | консоль           | Отказ чтения уровня.                                                              |
| `id` / `data-testid` / `aria-*`                             | `string`                                          | —                 | Связывание с подписью снаружи и адресация в тестах.                               |

Императивный handle (`TreeHandle`: `expand` / `collapse` / `toggle` / `refresh` / `focusNode` /
`getRows` / `getActionTargets` поверх baseline `FieldHandle`) — в
[10-imperative-handles.md](10-imperative-handles.md).

Рядом с компонентом пакет отдаёт и его модель: `flattenTree`, `filterTree`, `rangeIds`,
`actionTargets`, `isBranch`, `useVirtualRows` / `rowRange`, константы `TREE_ROW_HEIGHT` и
`TREE_ROW_ATTRIBUTE` (`data-tree-id` на строке — по нему обработчик, нарисованный вне дерева,
находит свою строку).

### Common Patterns

Ленивый файловый источник: уровень читается при первом раскрытии.

```tsx
import { Tree } from '@reformer/ui-kit';

<Tree
  loadChildren={(node) => fs.list(node?.id ?? '/')}
  selectedId={path}
  onSelectedChange={setPath}
  selectable="leaf"
  onActivate={(node, { preview }) => (preview ? openPreview(node.id) : openPinned(node.id))}
  className="h-full"
  data-testid="files"
/>;
```

Панель проекта с набором строк, к которому применяется действие:

```tsx
import { useRef } from 'react';
import { Tree, type TreeHandle } from '@reformer/ui-kit';

const treeRef = useRef<TreeHandle>(null);

<Tree
  ref={treeRef}
  nodes={project}
  selectionMode="multiple" // Ctrl/Cmd — по одной, Shift — диапазон, Escape — снять набор
  onContextMenu={openMenu}
  renderActions={(node) => (node.failed ? <AlertIcon /> : null)}
/>;

// Что удалять: набор, если выделение внутри него, иначе одна выделенная строка.
const targets = treeRef.current?.getActionTargets() ?? [];
```

Поиск над деревом — своё поле ввода, дерево фильтрует себя само:

```tsx
const [query, setQuery] = useState('');

<div className="space-y-2">
  <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск по файлам" />
  <Tree nodes={project} search={query} maxRows={12} emptyText="Ничего не найдено" />
</div>;
```

### Anti-patterns

- Собирать `id` из имени узла — два `index.ts` в разных каталогах схлопнутся в один адрес, и две
  строки начнут раскрываться и выделяться вместе. Адрес обязан быть уникальным в пределах дерева.
- Обновлять содержимое ветки заменой `nodes`, когда уровень уже прочитан лениво: прочитанный
  уровень перекрывает объявленный, и новые данные до строки не дойдут. Перечитывание —
  `refresh(id)` у handle.
- Держать `selectedId` и «что выбрано» одним списком — выделение отвечает на «где я», набор на
  «к чему применится действие»; слитые вместе, они ломают Shift-диапазон и клавиатуру.
- Оставлять виртуализацию включённой при серверной отрисовке — без метрик вьюпорта в разметку
  попадает только окно из девяти строк. Для страниц документации `virtualized={false}`.
- Ставить дерево в форму как поле (`component: Tree`) — value-seam ему нечем принять: ни `value`,
  ни `onChange` у него нет. Значение из иерархии даёт `ComboboxTreeField`.
- Обвешивать строки собственными классами фона и рамки: вид строки — часть компонента, а темой
  управляют токены. Своё содержимое добавляют слотами `renderIcon` / `renderLabel` /
  `renderActions`.

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
import { ExampleCard, InputField } from '@reformer/ui-kit';

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

- [03-choice-fields.md](03-choice-fields.md) — `ComboboxTreeField` / `ComboboxTreeMultiField`: значение из иерархии.
- [05-form-field-integration.md](05-form-field-integration.md) — как `Button` используется в `FormWizard.Actions`.
- [10-imperative-handles.md](10-imperative-handles.md) — `TreeHandle`: раскрытие уровней, `refresh`, цели действия.
- [06-troubleshooting.md](06-troubleshooting.md) — «forwardRef + Slot конфликты», «AsyncBoundary не переключает состояние», ловушки дерева.
