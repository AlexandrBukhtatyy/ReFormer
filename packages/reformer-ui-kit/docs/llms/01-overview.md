# Overview

`@reformer/ui-kit` — это набор готовых стилизованных React-компонентов для форм на
[`@reformer/core`](../../../reformer/) и [`@reformer/cdk`](../../../reformer-cdk/).
Под капотом — Tailwind CSS и Radix UI; каждый form-контрол объявляет, как свести к
своим пропам контракт `value` / `onChange` / `onBlur` `FormControl<T>` (статика
`reformerAdapter`), поэтому подключение к форме сводится к
`<FormField control={form.email} />` или к узлу схемы `{ model: model.$.email, component: Input }`,
который рисует рендерер, — сам компонент, без обёрток.

В отличие от headless-уровня `@reformer/cdk` (компоненты `FieldArray`,
`FormWizard`, `FormField` без стилей), `ui-kit` уже имеет:

- стили (Tailwind utility-классы + темизация через CSS-переменные),
- разумные defaults для accessibility (`aria-invalid`, `aria-label`),
- готовый `FormField`-обёртку с label/error/pending,
- `Button` с вариантами (`default`/`outline`/`ghost`/`link`/`destructive`/`secondary`),
- утилиты для playground (`ExampleCard`, `AsyncBoundary`).

Если стили не подходят — можно использовать только headless `@reformer/cdk` и
писать собственный UI; этот пакет — разумная отправная точка.

## Installation

```bash
npm install @reformer/ui-kit @reformer/cdk @reformer/core
```

Peer-зависимости (должны быть в проекте):

```json
{
  "@reformer/cdk": "*",
  "@reformer/core": "*",
  "react": "^18.0.0 || ^19.0.0",
  "react-dom": "^18.0.0 || ^19.0.0"
}
```

`@reformer/renderer-react` киту не нужен: компоненты от рендерера не зависят (визард получает
отрисовку узла пропом). Ставьте рендерер, только если рисуете форму по схеме (`FormRenderer`).

`radix-ui`, `lucide-react`, `clsx`, `tailwind-merge` и `class-variance-authority` —
обычные зависимости пакета, ставить их отдельно не нужно.

### Опциональные peer-зависимости

Двенадцать компонентов построены на внешних библиотеках. Чтобы приложению, которому
нужен один `Input`, не прилетали recharts и react-table, эти библиотеки объявлены
**опциональными** peer-зависимостями: npm их не поставит и не поругается, но без них
соответствующий subpath не зарезолвится (`ERR_MODULE_NOT_FOUND`). Ставьте ту, чей
компонент используете:

| subpath                      | поставить                      |
| ---------------------------- | ------------------------------ |
| `./table` (DataGrid-вариант) | `@tanstack/react-table` (>=8)  |
| `./command`, `./combobox`    | `cmdk` (>=1)                   |
| `./chart`                    | `recharts` (>=3)               |
| `./calendar`                 | `react-day-picker` (>=10)      |
| `./date-picker`              | `date-fns` (>=4)               |
| `./carousel`                 | `embla-carousel-react` (>=8)   |
| `./drawer`                   | `vaul` (>=1)                   |
| `./input-otp`                | `input-otp` (>=1.4)            |
| `./resizable`                | `react-resizable-panels` (>=4) |
| `./sonner`                   | `sonner` (>=2)                 |
| `./message-scroller`         | `@shadcn/react` (^0.2.1)       |

Корневой barrel (`import { … } from '@reformer/ui-kit'`) эти компоненты не
реэкспортирует, поэтому без единой опциональной зависимости пакет полностью
работоспособен — они нужны только при deep-import конкретного компонента.

Tailwind должен быть подключён в проекте: `@reformer/ui-kit` использует
utility-классы (`h-9`, `rounded-md`, `border-input`, `text-destructive`, ...).
Для тем (variables `--primary`, `--destructive`, `--ring`, ...) используйте
конфигурацию shadcn/ui или собственную аналогичную. Сверх набора shadcn тема кита
(`@reformer/ui-kit/styles`) объявляет `--warning` / `--color-warning` — цвет предупреждения под
полем (`text-warning`). В своей теме задайте и его: без него предупреждение останется цвета
ошибки.

## Import Patterns

```typescript
// Все компоненты из корня (рекомендованный способ для приложений)
import {
  Input,
  InputMask,
  InputPassword,
  Textarea,
  Checkbox,
  RadioGroup,
  Select,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
  Button,
  FormField,
  AsyncBoundary,
  ExampleCard,
  Box,
  Section,
  Collapsible,
  Tree,
  cn,
} from '@reformer/ui-kit';
```

Для tree-shaking и оптимизации бандла доступен импорт из подмодулей:

```typescript
// Tree-shaking (для библиотек / тонких бандлов)
import { Input, InputNumber } from '@reformer/ui-kit/input';
import { SelectAsync } from '@reformer/ui-kit/select';
import { FormField } from '@reformer/ui-kit/form-field';
import { Button } from '@reformer/ui-kit/button';
```

Реэкспорт внутри одного модуля (`@reformer/ui-kit/select` отдаёт `Select` и все
8 sub-компонентов) также работает.

## Quick Start

Минимальная форма из двух полей с валидацией и отправкой. Сборка — один вызов `createForm`:
модель из `initial`, схема `(model) => узел`, где узел поля — `{ model: model.$.x, component,
componentProps }`, и правила `defineValidation` отдельным слоем. Проверку и отправку делает
`bundle.submission.submit(handler)`. `FormField` сам подцепляет значение, замечания (`issues`) и
`pending` через `@reformer/cdk`:

```tsx
import { createForm } from '@reformer/core';
import { useFormBundle } from '@reformer/core/react';
import { defineIssueMessages } from '@reformer/core/i18n';
import { defineValidation, validate } from '@reformer/core/validation';
import { required, email, minLength } from '@reformer/core/validators';
import { ValidationMessagesProvider } from '@reformer/cdk';
import { Button, FormField, Input, InputPassword } from '@reformer/ui-kit';

type RegistrationForm = {
  email: string;
  password: string;
};

// Правила — отдельный слой (@reformer/core/validation), НЕ в схеме. Правило несёт код, не текст.
const registrationRules = defineValidation<RegistrationForm>(({ model }) => {
  validate(model.$.email, [required({ code: 'email.required' }), email()]);
  validate(model.$.password, [required({ code: 'password.required' }), minLength(8)]);
});

// Тексты замечаний — словарь формы по кодам (стабильная константа модуля).
const registrationMessages = defineIssueMessages({
  'email.required': 'Укажите email',
  'password.required': 'Придумайте пароль',
  minLength: 'Не меньше {minLength} символов',
});

const createRegistrationForm = () =>
  createForm<RegistrationForm>({
    initial: { email: '', password: '' },
    schema: (model) => ({
      children: [
        {
          model: model.$.email,
          component: Input,
          componentProps: { label: 'Email', type: 'email', testId: 'email' },
        },
        {
          model: model.$.password,
          component: InputPassword,
          componentProps: { label: 'Пароль', testId: 'password' },
        },
      ],
    }),
    validation: registrationRules,
  });

function RegistrationPage() {
  // useFormBundle зовёт фабрику ровно один раз и держит сборку стабильной между рендерами.
  const registration = useFormBundle(createRegistrationForm);
  const { form } = registration;

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    // Один прогон всех правил: при замечаниях обработчик не зовётся, поля помечены `touched`.
    const outcome = await registration.submission.submit((values) => api.register(values));
    if (outcome.status === 'submitted') console.log('ok', outcome.result);
  };

  return (
    <ValidationMessagesProvider messages={registrationMessages}>
      <form onSubmit={onSubmit} className="space-y-4 max-w-md">
        <FormField control={form.email} />
        <FormField control={form.password} />
        <Button type="submit">Зарегистрироваться</Button>
      </form>
    </ValidationMessagesProvider>
  );
}
```

Порядок текста замечания: словарь формы (`ValidationMessagesProvider messages`) → словарь локали
→ встроенный английский → сам `code`.

## Контрол в форме: сам компонент

**В `component` поля кладётся сам компонент кита — отдельных «field-версий» нет.** Контролы
говорят на разных диалектах (`Input` эмитит DOM-событие, `CheckboxWithLabel` — `checked` +
`onCheckedChange`, `RadioGroupOptions` — `onValueChange`), а форма — на value-based seam
(`value` + `onChange(value)` + `onBlur`). Мост между ними строит **обёртка поля** —
`FormField.Control` из `@reformer/cdk` (его использует `<FormField>` кита) или рендерер
`@reformer/renderer-react`. Диалект компонент объявляет статикой `reformerAdapter`
(`defineFieldControl` из `@reformer/ui-kit/fields`), обёртка читает её и приводит seam к нужным
пропам. Нет статики — seam проходит как есть (value-based контрол, например `InputNumber`).

Для составных примитивов (Radix-корень `Select`, `RadioGroup` + `RadioGroupItem`, `ToggleGroup`,
`NativeSelect` + `NativeSelectOption`, …) в форму берётся **готовый form-компонент**, который
сам рисует пункты из `options`:

| Примитив (вёрстка) | В форму                                | Примитив (вёрстка) | В форму              |
| ------------------ | -------------------------------------- | ------------------ | -------------------- |
| `Input`            | `Input`, `InputNumber`, `InputSuggest` | `Checkbox`         | `CheckboxWithLabel`  |
| `InputMask`        | `InputMask`                            | `Switch`           | `SwitchWithLabel`    |
| `InputPassword`    | `InputPassword`                        | `RadioGroup`       | `RadioGroupOptions`  |
| `InputOTP`         | `InputOTPDefault`                      | `Slider`           | `Slider`             |
| `Textarea`         | `Textarea`                             | `Calendar`         | `CalendarSingle`     |
| `Select`           | `SelectAsync`                          | `DatePicker`       | `DatePicker`         |
| `NativeSelect`     | `NativeSelectWithOptions`              | `Combobox`         | `Combobox`           |
| `Toggle`           | `Toggle`                               | `ToggleGroup`      | `ToggleGroupOptions` |

Множественный выбор — отдельные компоненты: `SelectMulti`, `NativeSelectMulti`,
`ComboboxMulti`, `ComboboxTreeMulti`, `ToggleGroupMulti`. Выбор из иерархии — `ComboboxTree`;
сам `Tree` не поле формы. Файлы — `FileUploadBase` / `FileUploadDropzone` / `FileUploadInput` /
`FileUploadAvatar`. Числовое поле — `InputNumber` (не `Input` с `type: 'number'`: `Input` отдаёт
строку).

Что происходит, если поставить в форму составной примитив: Radix-`Select` не отреагирует на
`onChange` (ему нужен `onValueChange`), `RadioGroup` отрисуется пустым (пункты — дочерние
`RadioGroupItem`). Ошибка **не видна ни TypeScript, ни `validate_form`**: поле выглядит
нормально, подпись и `data-testid` на месте — расходится только содержимое модели.

Свой или сторонний контрол подключается так же — объявите ему диалект:

```tsx
import { defineFieldControl, checkedAdapter } from '@reformer/ui-kit/fields';

export const MyCheckbox = defineFieldControl(ThirdPartyCheckbox, { adapter: checkedAdapter });
// схема: { model: model.$.agree, component: MyCheckbox }
```

Компонент, на который статику не повесить (чужая библиотека целиком), — через
`RendererSettings.resolveFieldAdapter` рендерера.

## Components

Ниже — компоненты полей; составные примитивы и их form-компоненты — в таблице выше.

| Name                                               | Purpose                                                                     | Where documented                                              |
| -------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `Input` / `InputNumber` / `InputSuggest`           | Текстовое поле (`text`/`email`/`tel`/`url`), число, строка с подсказками.   | [02-text-fields.md](02-text-fields.md)                        |
| `InputMask`                                        | Поле ввода со строковой маской (телефон, дата, ИНН).                        | [09-input-mask.md](09-input-mask.md)                          |
| `InputPassword`                                    | Поле пароля с переключателем видимости.                                     | [02-text-fields.md](02-text-fields.md)                        |
| `Textarea`                                         | Многострочное поле.                                                         | [02-text-fields.md](02-text-fields.md)                        |
| `Checkbox` / `CheckboxWithLabel`                   | Чекбокс; `WithLabel` — с label рядом с контролом.                           | [03-choice-fields.md](03-choice-fields.md)                    |
| `RadioGroup` / `RadioGroupOptions`                 | Группа радио-кнопок из массива `options`.                                   | [03-choice-fields.md](03-choice-fields.md)                    |
| `Select` (+ 8 sub-компонентов) / `SelectAsync`     | Выпадающий список с inline `options` или async `resource`.                  | [03-choice-fields.md](03-choice-fields.md)                    |
| `Combobox` (+ `Multi`, `Tree`, `TreeMulti`)        | Поле с поиском; варианты `Tree*` выбирают узел иерархии (файл).             | [03-choice-fields.md](03-choice-fields.md)                    |
| `Tree`                                             | Дерево с ленивым чтением уровней и виртуализацией. **Не поле формы.**       | [04-layout-and-buttons.md](04-layout-and-buttons.md)          |
| `Button`                                           | Кнопка с вариантами (`variant`, `size`, `asChild`).                         | [04-layout-and-buttons.md](04-layout-and-buttons.md)          |
| `AsyncBoundary` (+ `*Loading`, `*Error`, `*Empty`) | Состояния загрузки `idle`/`loading`/`ready`/`error` со встроенными блоками. | [04-layout-and-buttons.md](04-layout-and-buttons.md)          |
| `ExampleCard`                                      | Карточка-обёртка для демо в playground.                                     | [04-layout-and-buttons.md](04-layout-and-buttons.md)          |
| `cn`                                               | Утилита для конкатенации Tailwind-классов.                                  | [04-layout-and-buttons.md](04-layout-and-buttons.md)          |
| `FormField`                                        | Wrapper «label + control + error + pending» поверх CDK.                     | [05-form-field-integration.md](05-form-field-integration.md)  |
| `FormWizard`                                       | Многошаговая форма — адаптер потока шагов сборки `createForm({ flow })`.   | [07-form-wizard.md](07-form-wizard.md)                        |
| `FieldArray` / `FieldArraySection`                | Массив под-форм: узел схемы / секция в JSX.                                 | [08-field-array-section.md](08-field-array-section.md)        |
| `Box`, `Section`                                   | Контейнеры раскладки: ритм, сетка полей, группы.                            | [11-form-layout.md](11-form-layout.md)                        |
| `Card`, `Alert`, `Separator`                       | Карточка, плашка, разделитель — вид без ручных классов.                     | [11-form-layout.md](11-form-layout.md)                        |
| `Collapsible`                                      | Сворачиваемый контейнер для `RenderSchema`.                                 | [renderer-react](../../../reformer-renderer-react/docs/llms/) |

Полный troubleshooting (number-input возвращает строку, Select не показывает
options, mask пропускает символы, forwardRef + Slot конфликты, и т.п.) —
[06-troubleshooting.md](06-troubleshooting.md).

## Localization

Подписи, которые кит рисует сам (кнопки мастера, плейсхолдеры, статусы загрузки, aria-подписи),
идут через локаль `I18nProvider` из `@reformer/core/react`. Приоритет в каждом компоненте:
**явный проп → словарь активной локали → встроенный английский**.

```tsx
import { createLocaleLoader } from '@reformer/core/i18n';
import { I18nProvider } from '@reformer/core/react';
import { loadKitLocale } from '@reformer/ui-kit/locale';

// Константа модуля: загрузчик хранит кэш языков.
const loadLocale = createLocaleLoader([loadKitLocale]);

function App() {
  const [lang, setLang] = useState('ru');
  return (
    <I18nProvider lang={lang} load={loadLocale}>
      <Form />
    </I18nProvider>
  );
}
```

- **Без провайдера кит говорит по-английски** («Next →», «Select an option...», «Loading data...»).
- **Смена `lang` переводит подписи на месте**: дерево не перемонтируется, значения полей, шаг
  мастера и открытые списки сохраняются.
- **Свою формулировку для одного экземпляра** даёт проп (`nextLabel`, `placeholder`,
  `addButtonLabel`, …), **для всего приложения** — ключ словаря вторым источником загрузчика:
  `createLocaleLoader([loadKitLocale, () => ({ 'kit.formWizard.submit': 'Оформить' })])`.
- **Локаль кита накопительная** — словари ядра (ошибки валидации, размер файла) и cdk плюс
  подписи кита, поэтому `loadCoreLocale` и `loadCdkLocale` рядом не нужны.

| Вид               | Импорт                                       | Для чего                                                                  |
| ----------------- | -------------------------------------------- | ------------------------------------------------------------------------- |
| загрузчик         | `loadKitLocale` из `@reformer/ui-kit/locale` | основной путь: чанк языка по запросу                                      |
| JSON-файл         | `@reformer/ui-kit/locale/ru.json`            | выложить на свой сервер, править без пересборки; образец для нового языка |
| синхронный модуль | `ru` из `@reformer/ui-kit/locale/ru`         | SSR и тесты: `<I18nProvider locale={ru}>`                                 |

Встроенные языки — `en` и `ru`. Ключи словаря — `kit.<компонент>.<имя>`:

| Компонент                       | Ключи                                                                                                                                                    |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `FormWizard`                    | `kit.formWizard.prev`, `next`, `submit`, `validating`, `submitting`, `progress`, `stepsNav`, `stepLabel`                                                 |
| `FieldArray`, `FieldArraySection` | `kit.fieldArray.add`, `remove`, `item`, `moveUp`, `moveDown`                                                                                              |
| `FormField`                     | `kit.formField.hintLabel`, `validating`                                                                                                                  |
| `FileUpload*`                   | `kit.fileUpload.choose`, `dropzone`, `inputPlaceholder`, `clear`, `avatarLabel`, `error`                                                                 |
| `AsyncBoundary*`                | `kit.asyncBoundary.loadingTitle`, `loadingSubtitle`, `errorTitle`, `retry`, `emptyTitle`                                                                 |
| `Select`, `SelectMulti`         | `kit.select.placeholder`, `placeholderMulti`, `search`, `searchLabel`, `loading`, `loadingMore`, `loadError`, `retry`, `empty`, `selected`, `clear`      |
| `Combobox*`                     | `kit.combobox.placeholder`, `placeholderMulti`, `search`, `empty`, `create`, `selected`, `clear`, `treePlaceholder`, `treePlaceholderMulti`, `treeEmpty` |

Сообщения — строки ICU: `"kit.select.selected": "Selected: {count}"`. В каталоге компонентов у
текстового пропа рядом с английским `default` стоит `x-messageKey` — ключ, по которому это
умолчание переводится.

Остальные компоненты кита (`Table`, `Tree`, `Pagination`, `Dialog`, `DatePicker`, `Calendar`
и др.) на словарь ещё не переведены: их подписи пока зашиты и задаются пропсами.

## See also

- [02-text-fields.md](02-text-fields.md) — `Input`, `InputMask`, `InputPassword`, `Textarea`.
- [03-choice-fields.md](03-choice-fields.md) — `Checkbox`, `RadioGroup`, `Select`, мультивыборы, варианты дерева у `Combobox`.
- [04-layout-and-buttons.md](04-layout-and-buttons.md) — `Button`, `AsyncBoundary`, `Tree`, `ExampleCard`, `cn`.
- [05-form-field-integration.md](05-form-field-integration.md) — `FormField` standalone и как `fieldWrapper`.
- [06-troubleshooting.md](06-troubleshooting.md) — типичные проблемы и решения.
- [07-form-wizard.md](07-form-wizard.md) — `FormWizard` и поток шагов.
- [08-field-array-section.md](08-field-array-section.md) — `FieldArray` и `FieldArraySection`.
- [09-input-mask.md](09-input-mask.md) — `InputMask`.
- [10-imperative-handles.md](10-imperative-handles.md) — императивные handle полей по селектору.
- [11-form-layout.md](11-form-layout.md) — отступы, сетка полей, группировка и секции.
