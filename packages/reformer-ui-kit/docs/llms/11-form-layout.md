# Form layout — отступы, сетка и группировка полей

Правила раскладки формы: чем задавать вертикальный ритм, как собирать поля в строки и
группы, где граница между «расположением» и «внешним видом». Короткое правило — **руками
пишем только раскладку и отступы, вид берём компонентом кита**. Для полей это кодифицировано
в `class-catalog.ts` (`FIELD_CLASS_GROUPS`); документ распространяет то же правило на всю
форму.

## Key Concepts

- **Разрешённые группы классов** — `layout`, `flex`, `grid`, `spacing`, `responsive`,
  `sizing` из словаря `@reformer/ui-kit/catalog`. Больше руками не пишем ничего.
- **Запрещено руками** — `bg-*`, `text-<цвет>-<оттенок>`, `border-<цвет>`, `shadow-*`,
  `rounded-*`. Фон, рамка, тень и радиус приходят из компонента и токенов темы; ручная
  палитра ломает тёмную тему (`.dark` в `theme.css`).
- **Исключение для заголовков** — ровно две комбинации, без цвета: `text-xl font-bold`
  (заголовок шага, `h2`) и `text-lg font-semibold` (заголовок группы, `h3`).
- **Полю — только `spacing`.** `FormField` и контролы принимают `gap-*` / `m*-*` / `p*-*`;
  сетку и вид задаёт контейнер вокруг поля, а не само поле.
- **Три уровня вертикального ритма** — `space-y-6` (шаг) → `space-y-4` (группа) →
  `space-y-3` (элемент массива). Четвёртого уровня нет.
- **Внутри поля отступы не пишем** — `Field` уже даёт `gap-3` между подписью и контролом,
  `FieldContent` — `gap-1.5` между контролом, описанием и ошибкой.
- **Вид — компонентом**: карточка → `Card`, плашка → `Alert`, разделитель → `Separator`,
  секция с заголовком → `Section`.
- **Один макет — три записи.** TSX, `RenderSchema` и JSON используют одни и те же строки
  классов; меняется только синтаксис узла.

## Spacing scale

| Уровень                            | Класс       | Где                                       |
| ---------------------------------- | ----------- | ----------------------------------------- |
| Шаг визарда / корень страницы      | `space-y-6` | обёртка вокруг заголовка и групп          |
| Логическая группа полей            | `space-y-4` | секция с заголовком `h3` и полями         |
| Элемент массива (`FormArray` item) | `space-y-3` | карточка одной записи                     |
| Внутри поля                        | —           | ничего не пишем, отступы даёт `FormField` |

```tsx
<div className="space-y-6">
  <h2 className="text-xl font-bold">Персональные данные</h2>

  <section className="space-y-4">
    <h3 className="text-lg font-semibold">Паспорт</h3>
    {/* поля группы */}
  </section>
</div>
```

Отступ под заголовком даёт сам `space-y-*` — `mb-*` не нужен. Условную группу не подпирайте
`mt-6`: заверните в собственную секцию, и родительский `space-y-*` расставит отступы сам.

## Field grid

- Пара связанных полей — `grid grid-cols-1 md:grid-cols-2 gap-4`.
- Тройка (ФИО; серия / номер / дата) — `grid grid-cols-1 md:grid-cols-3 gap-4`.
- Поле на всю ширину — **вне** сетки, прямо в `space-y-*`. `col-span-*` не используем:
  ширину определяет строка-обёртка, а не поле.
- Gap сетки полей — `gap-4`; внутри элемента массива допустим `gap-3`.
- Брейкпоинты — только `sm:`, `md:`, `lg:`. `xl:` и `2xl:` в словаре отсутствуют намеренно:
  к таким ширинам форма уже не перестраивается, её ограничивает контейнер.
- Ширину формы задаёт шелл (`container mx-auto`); нужна своя — `max-w-2xl` /
  `max-w-screen-md`. `max-w-4xl` в словаре отсутствует и в билдере не соберётся.

```tsx
<section className="space-y-4">
  <h3 className="text-lg font-semibold">Паспорт</h3>
  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
    <FormField control={form.passport.series} testId="series" />
    <FormField control={form.passport.number} testId="number" />
    <FormField control={form.passport.issueDate} testId="issueDate" />
  </div>
  <FormField control={form.passport.issuedBy} testId="issuedBy" />
</section>
```

## Grouping and sections

`Section` — секция с заголовком. Своих классов не несёт, поэтому `className` и
`titleClassName` задаются явно: `titleAs` отвечает за семантику (уровень заголовка),
`titleClassName` — за вес.

```tsx
<Section
  title="Паспорт"
  titleAs="h3"
  titleClassName="text-lg font-semibold"
  className="space-y-4"
>
  {/* поля */}
</Section>
```

Карточка — компонент `Card`, а не набор классов: рамка, фон, скругление и тень приходят из
токенов темы, `CardContent` даёт горизонтальные отступы. Внутрь добавляем только ритм.

```tsx
<Card>
  <CardHeader>
    <CardTitle>Параметры кредита</CardTitle>
  </CardHeader>
  <CardContent className="space-y-4">{/* поля */}</CardContent>
</Card>
```

Пояснение или предупреждение — `Alert`, а не цветная плашка руками:

```tsx
<Alert>
  <AlertTitle>Что будет дальше</AlertTitle>
  <AlertDescription>Заявку рассмотрят в течение двух рабочих дней.</AlertDescription>
</Alert>
```

Заголовок группы с действием справа — `flex items-center justify-between`:

```tsx
<div className="flex items-center justify-between">
  <h3 className="text-lg font-semibold">Адрес проживания</h3>
  <Button variant="outline" size="sm" onClick={copyFromRegistration}>
    Скопировать
  </Button>
</div>
```

Повторяющиеся записи — `FormArraySection`: у него уже есть дефолты `space-y-3 mt-2` для
списка и карточка для элемента, переопределять их не нужно.

## Layout across targets

Строки классов между вариантами **не меняются** — меняется только синтаксис узла.

| TSX                           | RenderSchema                                                                            | JSON                                                                                |
| ----------------------------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `<div className="space-y-6">` | `{ component: Box, componentProps: { className: 'space-y-6' } }`                        | `{ "component": "$component(Box)", "componentProps": { "className": "space-y-6" } }` |
| `<h3>` + группа               | `{ component: Section, componentProps: { title, titleAs, titleClassName, className } }` | `$component(Section)` + те же `componentProps`                                      |
| `<div className="grid …">`    | `Box` + тот же `className`                                                              | `$component(Box)` + тот же `className`                                              |
| `<Card>`                      | `component: Card`                                                                        | `$component(Card)`                                                                  |

В JSON компонент обязан быть в реестре: `Box`, `Section`, `FormArray` регистрируют обычно
сразу, `Card` и `Alert` — нет.

```typescript
reg.component('Card', Card);
reg.component('CardContent', CardContent);
```

## Common Patterns

Сквозной пример шага: карточка, две группы, сетка и поле на всю ширину.

```tsx
import { Card, CardContent, CardHeader, CardTitle, FormField, Section } from '@reformer/ui-kit';

<Card>
  <CardHeader>
    <CardTitle>Шаг 2. Персональные данные</CardTitle>
  </CardHeader>
  <CardContent className="space-y-6">
    <Section title="ФИО" titleAs="h3" titleClassName="text-lg font-semibold" className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <FormField control={form.lastName} testId="lastName" />
        <FormField control={form.firstName} testId="firstName" />
        <FormField control={form.middleName} testId="middleName" />
      </div>
    </Section>

    <Section title="Паспорт" titleAs="h3" titleClassName="text-lg font-semibold" className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField control={form.passport.series} testId="series" />
        <FormField control={form.passport.number} testId="number" />
      </div>
      <FormField control={form.passport.issuedBy} testId="issuedBy" />
    </Section>
  </CardContent>
</Card>;
```

## Anti-patterns

```tsx
// ❌ Карточка собрана классами — ломает тёмную тему и расходится с китом.
<section className="space-y-4 bg-white border rounded-xl shadow-sm p-6">
// ✅ Тот же вид даёт компонент.
<Card><CardContent className="space-y-4">{/* … */}</CardContent></Card>
```

```tsx
// ❌ Цвет в заголовке.
<h2 className="text-xl font-bold text-gray-900">Шаг 1</h2>
// ✅ Только вес; цвет приходит из темы.
<h2 className="text-xl font-bold">Шаг 1</h2>
```

```tsx
// ❌ Сетка навешена на само поле.
<FormField control={form.city} className="col-span-2" />
// ✅ Ширину задаёт строка-обёртка; full-width поле выносится из сетки.
<FormField control={form.city} />
```

```tsx
// ❌ Отступы внутри поля — дублируют gap-3 / gap-1.5 из Field.
<FormField control={form.email} className="mt-2 mb-4" />
// ✅ Ритм задаёт контейнер.
<div className="space-y-4"><FormField control={form.email} /></div>
```

```tsx
// ❌ Жёсткая сетка без брейкпоинта — на телефоне колонки схлопываются.
<div className="grid grid-cols-2 gap-4">
// ✅ Одна колонка на мобильном, две на десктопе.
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
```

```tsx
// ❌ max-w-4xl и xl:/2xl: нет в словаре кита — в билдере не соберутся.
<div className="max-w-4xl mx-auto">
// ✅ Ширина из словаря либо из контейнера приложения.
<div className="max-w-2xl mx-auto">
```

## See also

- [04-layout-and-buttons.md](04-layout-and-buttons.md) — `Button`, `AsyncBoundary`, `cn`.
- [05-form-field-integration.md](05-form-field-integration.md) — что `FormField` рисует сам.
- [07-form-wizard.md](07-form-wizard.md) — хром многошаговой формы.
- [08-form-array-section.md](08-form-array-section.md) — секция повторяющихся записей.
- [renderer-react](../../../reformer-renderer-react/docs/llms/) — layout в `RenderSchema`.
- [renderer-json](../../../reformer-renderer-json/docs/llms/) — layout в JSON.
