---
sidebar_position: 1
---

# Обзор

`@reformer/ui-kit` — набор готовых оформленных компонентов для форм ReFormer: поля ввода и выбора,
обёртка поля с подписью и замечанием, массив под-форм, мастер шагов, а также кнопки, диалоги,
таблица и другие компоненты интерфейса. Внешний вид — [shadcn/ui](https://ui.shadcn.com/) (стиль
new-york, палитра neutral) на Tailwind CSS v4 и Radix UI.

Поле кита кладётся в [схему формы](../reference/glossary.md#форма-и-данные) как есть, без
обёрток, а на экран его выводит один `<FormField control={form.email} />`. Если оформление не
подходит, берите компоненты без стилей из [`@reformer/cdk`](../cdk/overview.md) и рисуйте свои.

## Что внутри

| Раздел                | Компоненты                                                                                                                                                                                                                                                                                                                                                                                  |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Текстовые поля        | [Input](./input.mdx), [Textarea](./textarea.mdx), [InputOTP](./input-otp.mdx), [InputGroup](./input-group.mdx), [InputMask](./input-mask.mdx), [InputPassword](./input-password.mdx)                                                                                                                                                                                                        |
| Выбор                 | [Select](./select.mdx), [NativeSelect](./native-select.mdx), [Checkbox](./checkbox.mdx), [RadioGroup](./radio-group.mdx), [Switch](./switch.mdx), [Toggle](./toggle.mdx), [ToggleGroup](./toggle-group.mdx), [Slider](./slider.mdx), [Calendar](./calendar.mdx), [Combobox](./combobox.mdx), [DatePicker](./date-picker.mdx), [FileUpload](./file-upload.mdx)                               |
| Поле и форма целиком  | [FormField](./form-field.mdx), [Field](./field.mdx), [Label](./label.mdx), [FieldArraySection](./field-array.mdx), [FormWizard](./form-navigation.mdx)                                                                                                                                                                                                                                      |
| Действия              | [Button](./button.mdx), [ButtonGroup](./button-group.mdx)                                                                                                                                                                                                                                                                                                                                   |
| Отображение           | [Badge](./badge.mdx), [Card](./card.mdx), [Alert](./alert.mdx), [Avatar](./avatar.mdx), [Icon](./icon.mdx), [Progress](./progress.mdx), [Skeleton](./skeleton.mdx), [Table](./table.mdx), [Chart](./chart.mdx), [Carousel](./carousel.mdx), [Typography](./typography.mdx), [ExampleCard](./example-card.mdx)                                                                               |
| Оверлеи               | [Dialog](./dialog.mdx), [AlertDialog](./alert-dialog.mdx), [Sheet](./sheet.mdx), [Drawer](./drawer.mdx), [Popover](./popover.mdx), [HoverCard](./hover-card.mdx), [Tooltip](./tooltip.mdx), [InfoHint](./info-hint.mdx), [DropdownMenu](./dropdown-menu.mdx), [ContextMenu](./context-menu.mdx), [Command](./command.mdx), [Sonner](./sonner.mdx)                                           |
| Навигация и раскрытие | [Accordion](./accordion.mdx), [Tabs](./tabs.mdx), [Menubar](./menubar.mdx), [NavigationMenu](./navigation-menu.mdx), [Breadcrumb](./breadcrumb.mdx), [Pagination](./pagination.mdx), [Sidebar](./sidebar.mdx), [Tree](./tree.mdx)                                                                                                                                                           |
| Раскладка и служебные | [Box](./box.mdx), [Section](./section.mdx), [Separator](./separator.mdx), [List](./list.mdx), [Item](./item.mdx), [Collapsible](./collapsible.mdx), [ScrollArea](./scroll-area.mdx), [AspectRatio](./aspect-ratio.mdx), [Resizable](./resizable.mdx), [AsyncBoundary](./async-boundary.mdx), [Empty](./empty.mdx), [Spinner](./spinner.mdx), [Kbd](./kbd.mdx), [Direction](./direction.mdx) |
| ИИ-чат                | [Message](./message.mdx), [Bubble](./bubble.mdx), [Attachment](./attachment.mdx), [Marker](./marker.mdx), [MessageScroller](./message-scroller.mdx)                                                                                                                                                                                                                                         |

Полный список — в меню слева. На странице каждого компонента есть живые варианты, примеры и
вкладка API.

## Установка

```bash
npm install @reformer/ui-kit @reformer/core @reformer/cdk
```

Обязательные peer-зависимости: `@reformer/core`, `@reformer/cdk`, `react`, `react-dom`.
`@reformer/renderer-react` киту не нужен — ставьте его, только если рисуете форму по схеме через
`FormRenderer`.

Двенадцать компонентов построены на внешних библиотеках. Эти библиотеки — необязательные
peer-зависимости: ставьте ту, чей компонент используете. Такие компоненты не входят в главный
вход пакета и импортируются только из своего подпути.

| Вход пакета                                 | Что поставить                  |
| ------------------------------------------- | ------------------------------ |
| `@reformer/ui-kit/table`                    | `@tanstack/react-table`        |
| `@reformer/ui-kit/command`, `/combobox`     | `cmdk`                         |
| `@reformer/ui-kit/chart`                    | `recharts`                     |
| `@reformer/ui-kit/calendar`, `/date-picker` | `react-day-picker`, `date-fns` |
| `@reformer/ui-kit/carousel`                 | `embla-carousel-react`         |
| `@reformer/ui-kit/drawer`                   | `vaul`                         |
| `@reformer/ui-kit/input-otp`                | `input-otp`                    |
| `@reformer/ui-kit/resizable`                | `react-resizable-panels`       |
| `@reformer/ui-kit/sonner`                   | `sonner`                       |
| `@reformer/ui-kit/message-scroller`         | `@shadcn/react`                |

`@reformer/ui-kit/sidebar` тоже доступен только из подпути, но внешних зависимостей не требует.

## Подключение стилей

Компоненты оформлены классами Tailwind CSS v4, поэтому Tailwind должен быть настроен в приложении.
Тему — цвета, тёмный вариант, анимации — пакет отдаёт готовой во входе `@reformer/ui-kit/styles`:

```css
/* ваш входной CSS для Tailwind v4 */
@import 'tailwindcss';
@import '@reformer/ui-kit/styles';

/* Tailwind должен увидеть классы пакета */
@source '../node_modules/@reformer/ui-kit/dist';
```

- Тему подключайте голым `@import`: обёртка `layer(theme)` ломает её `@custom-variant`.
- `@import 'tailwindcss'` и `@source` пишете вы — тема их не подключает.
- Свой `@custom-variant dark` не объявляйте: в теме он уже есть и срабатывает и на `.dark`, и на
  `[data-theme='dark']`.
- Сверх набора shadcn тема объявляет цвет `--warning` — им рисуется предупреждение под полем. Если
  у вас своя тема, задайте его, иначе предупреждение будет цвета ошибки.

## Как поле кита попадает в форму

В `component` [узла поля](../reference/glossary.md#форма-и-данные) кладётся сам компонент кита.
Значение, `onChange`, `onBlur` и блокировку ему подставляет обёртка поля: `FormField` кита или
рендерер схемы.

```tsx
import { createForm } from '@reformer/core';
import { useFormBundle } from '@reformer/core/react';
import { FormField, Input } from '@reformer/ui-kit';

function EmailForm() {
  const { form } = useFormBundle(() =>
    createForm<{ email: string }>({
      initial: { email: '' },
      schema: (model) => ({
        children: [
          {
            model: model.$.email,
            component: Input,
            componentProps: { label: 'Email', type: 'email' },
          },
        ],
      }),
    })
  );

  return <FormField control={form.email} />;
}
```

Компоненты говорят на разных языках: `Input` отдаёт DOM-событие, `CheckboxWithLabel` —
`onCheckedChange(checked)`, `Slider` — массив чисел. Форме нужно одно: значение. Как перевести одно
в другое, компонент объявляет сам — [адаптером поля](../reference/glossary.md#рендеринг), который
вешается на него функцией `defineFieldControl` из `@reformer/ui-kit/fields`. Обёртка поля читает
адаптер и подключает компонент к форме.

У составных компонентов (Radix-`Select`, `RadioGroup` с пунктами `RadioGroupItem`) значения нет,
пока их не собрали из частей. Для формы у них есть готовые варианты, которые рисуют пункты из
`options`:

| Вёрстка руками | В форму                   | Вёрстка руками | В форму              |
| -------------- | ------------------------- | -------------- | -------------------- |
| `Select`       | `SelectAsync`             | `Checkbox`     | `CheckboxWithLabel`  |
| `NativeSelect` | `NativeSelectWithOptions` | `Switch`       | `SwitchWithLabel`    |
| `RadioGroup`   | `RadioGroupOptions`       | `ToggleGroup`  | `ToggleGroupOptions` |
| `InputOTP`     | `InputOTPDefault`         | `Calendar`     | `CalendarSingle`     |

Множественный выбор — отдельные компоненты: `SelectMulti`, `NativeSelectMulti`, `ComboboxMulti`,
`ToggleGroupMulti`, `DatePickerMulti`. Число — `InputNumber`, а не `Input` с `type: 'number'`.

Свой компонент подключается тем же способом:

```tsx
import { defineFieldControl, checkedAdapter } from '@reformer/ui-kit/fields';

export const MyCheckbox = defineFieldControl(ThirdPartyCheckbox, { adapter: checkedAdapter });
// узел схемы: { model: model.$.agree, component: MyCheckbox }
```

Подробнее — в разделе [Свои компоненты полей](../react/custom-fields.md).

## Локализация

Часть строк кит рисует сам: кнопки мастера и массива, плейсхолдеры списков, статусы загрузки,
подписи для скринридера. Без настроек они английские. Язык задаёт `I18nProvider` из
`@reformer/core/react` с загрузчиком локали кита:

```tsx
import { createLocaleLoader } from '@reformer/core/i18n';
import { I18nProvider } from '@reformer/core/react';
import { loadKitLocale } from '@reformer/ui-kit/locale';

// Константа модуля: загрузчик кэширует загруженные языки.
const loadLocale = createLocaleLoader([loadKitLocale]);

export function App() {
  return (
    <I18nProvider lang="ru" load={loadLocale}>
      <Form />
    </I18nProvider>
  );
}
```

- Встроены `en` и `ru`. Локаль кита накопительная: в неё уже входят словари ядра (тексты
  замечаний) и cdk, отдельно их подключать не нужно.
- Смена `lang` переводит подписи на месте: значения полей, текущий шаг и открытые списки
  сохраняются.
- Строка в компоненте берётся в таком порядке: явный проп → словарь активного языка → встроенный
  английский.
- Заменить строку в одном месте — пропом компонента (`placeholder`, `addButtonLabel`,
  `nextLabel`…). Во всём приложении — своим словарём вторым источником загрузчика:

  ```ts
  const loadLocale = createLocaleLoader([
    loadKitLocale,
    () => ({ 'kit.formWizard.submit': 'Оформить заявку' }),
  ]);
  ```

| Вид локали        | Импорт                                       | Для чего                                        |
| ----------------- | -------------------------------------------- | ----------------------------------------------- |
| загрузчик         | `loadKitLocale` из `@reformer/ui-kit/locale` | основной путь: язык подгружается по запросу     |
| синхронный модуль | `ru` из `@reformer/ui-kit/locale/ru`         | SSR и тесты: `<I18nProvider locale={ru}>`       |
| JSON-файл         | `@reformer/ui-kit/locale/ru.json`            | образец для своего языка, правка без пересборки |

Ключи словаря кита — `kit.<компонент>.<имя>`. Какие строки рисует конкретный компонент и какими
пропсами их заменить, сказано в разделе «Локализация» на его странице. Общая картина — словари
ядра, cdk и приложения, тексты замечаний, переключение языка — в руководстве
[Локализация](../guides/localization.mdx).

## Импорты

```tsx
// Главный вход: лёгкие компоненты
import { Button, FormField, Input, SelectAsync } from '@reformer/ui-kit';

// Вход отдельного компонента
import { InputNumber } from '@reformer/ui-kit/input';

// Компоненты с внешними зависимостями — только из своего подпути
import { DatePicker } from '@reformer/ui-kit/date-picker';
import { Combobox } from '@reformer/ui-kit/combobox';

// Описания пропсов без React — для MCP и форм из JSON
import { defaultPropSchemas } from '@reformer/ui-kit/meta';
```

## См. также

- [FormField](./form-field.mdx) — как поле выводится на экран и какие общие пропсы понимает.
- [@reformer/cdk](../cdk/overview.md) — те же поле, массив и мастер без оформления.
- [Свои компоненты полей](../react/custom-fields.md) — подключение стороннего контрола.
- [Локализация](../guides/localization.mdx) — язык формы и словари.
