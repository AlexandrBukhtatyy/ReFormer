---
sidebar_position: 1
---

# Обзор

`@reformer/cdk` — компоненты без оформления поверх `@reformer/core`. Они берут на себя состояние,
поведение и доступность, а разметку и стили вы пишете сами. Части компонента связаны через
React Context, поведение отдаётся через render-props (`children` как функция) и хуки.

## Когда брать cdk, а когда ui-kit

- **[@reformer/ui-kit](../ui-kit/overview)** — готовые стилизованные компоненты. Он построен на
  cdk. Берите его, если вид кита вам подходит.
- **cdk** — когда нужна своя вёрстка: дизайн-система компании, нестандартная раскладка поля,
  свой вид массива строк или мастера. Логику, `aria-*` и клавиатуру при этом писать не надо.

Оба пакета можно смешивать: большинство полей — `FormField` из ui-kit, одно нестандартное — из cdk.

## Установка

```bash
npm install @reformer/cdk @reformer/core
```

Peer-зависимости: `@reformer/core`, `react`, `react-dom` — npm 7+ установит их автоматически.
Собственных стилей у пакета нет, подключать CSS не требуется.

## Компоненты

**Поле и форма**

- [**FormField**](./form-field.mdx) — анатомия поля: подпись, контрол, описание, подсказка и
  ошибка со связанными `id` и `aria-*`. Части: `FormField.Root`, `Label`, `Control`, `Error`,
  `Description`, `Hint`; хук `useFormField`.
- [**FormWizard**](./form-wizard.mdx) — многошаговая форма поверх потока шагов сборки
  (`createForm({ flow })`): «Далее» проверяет правила текущего шага. Части: `FormWizard.Step`,
  `Indicator`, `Actions` (`Prev` / `Next` / `Submit`), `Progress`; хук `useFormWizard`.
- [**Тексты замечаний**](./validation-messages.mdx) — `ValidationMessagesProvider` (словарь формы
  `messages` поверх локали либо полный `resolver`) и `useIssueMessageResolver`.

**Массивы**

- [**FieldArray**](./field-array.mdx) — массив строк с добавлением, удалением и перестановкой.
  Части: `FieldArray.Root`, `List`, `AddButton`, `RemoveButton`, `Empty`, `Count`, `ItemIndex`,
  `Error`; хук `useFieldArray`.
- [**List**](./list.mdx) — только вывод: обход массива модели без добавления и удаления строк.
  Части: `List.Root`, `Items`, `Empty`; хук `useList`.

**Ввод и выбор**

- [**Autocomplete**](./autocomplete.mdx) — текстовое поле с подсказками из статического списка
  или асинхронного источника. Части: `Autocomplete.Root`, `Input`, `Listbox`, `Option`, `Loading`;
  хук `useAutocomplete`.
- [**Источники опций**](./option-source.mdx) — `useResourceOptions` грузит варианты для выбора
  (`Select`, `Autocomplete`) по описанию источника `ResourceConfig`.
- [**FileUpload**](./file-upload.mdx) — выбор и загрузка файлов. Части: `FileUpload.Root`,
  `Trigger`, `Dropzone`, `ItemGroup`, `Item*` (превью, имя, размер, прогресс, удаление, повтор),
  `ClearTrigger`; хук `useFileUpload`.

**Данные вокруг формы**

- [**AsyncBoundary**](./async-boundary.mdx) — состояния загрузки данных (`idle` / `loading` /
  `ready` / `error`): загрузка с отменой и повтором или статус, который ведёт ваш код.

**Локализация**

- [**Строки cdk**](./locale.md) — `loadCdkLocale` для `I18nProvider`: статусы для скринридера,
  подписи кнопок без текста, текст ошибки загрузки.

### Импорт

```typescript
// Всё сразу
import { FieldArray, FormField, FormWizard, ValidationMessagesProvider } from '@reformer/cdk';

// Отдельные входы пакета (рекомендуется — в сборку попадает только нужное)
import { FieldArray, useFieldArray } from '@reformer/cdk/field-array';
import { FormField, useFormField } from '@reformer/cdk/form-field';
import { FormWizard, useFormWizard } from '@reformer/cdk/form-wizard';
import { AsyncBoundary } from '@reformer/cdk/async-boundary';
import { FileUpload } from '@reformer/cdk/file-upload';
import { Autocomplete, useAutocomplete } from '@reformer/cdk/autocomplete';
import { List, useList } from '@reformer/cdk/list';
import { useResourceOptions } from '@reformer/cdk/option-source';
import { loadCdkLocale } from '@reformer/cdk/locale'; // строки cdk для I18nProvider
```

`ValidationMessagesProvider` и `useIssueMessageResolver` отдельного входа не имеют — их импортируют
из `@reformer/cdk`.

## Быстрый пример

[Сборка формы](../reference/glossary.md#форма-и-данные) создаётся в `@reformer/core`
(`createForm`), а cdk отвечает только за поведение и анатомию:

```tsx
import { arrayOf, createForm } from '@reformer/core';
import { useFormBundle } from '@reformer/core/react';
import { FieldArray } from '@reformer/cdk/field-array';

type Item = { name: string };

function ItemsEditor() {
  const { form } = useFormBundle(() =>
    createForm<{ items: Item[] }>({
      // arrayOf — шаблон новой строки: кнопке «Добавить» значение передавать не нужно
      initial: { items: arrayOf(() => ({ name: '' }), [{ name: '' }]) },
      // массив объектов становится FormArray по узлу с `item`
      schema: (model) => ({
        children: [{ model: model.$.items, item: (row) => ({ model: row.$.name }) }],
      }),
    })
  );

  return (
    <FieldArray.Root control={form.items}>
      <FieldArray.Empty>
        <p>Пока нет элементов</p>
      </FieldArray.Empty>

      <FieldArray.List<Item>>
        {({ control, index, remove }) => (
          <div>
            <span>Элемент #{index + 1}</span>
            <ItemForm control={control} />
            <button onClick={remove}>Удалить</button>
          </div>
        )}
      </FieldArray.List>

      <FieldArray.AddButton>Добавить</FieldArray.AddButton>
    </FieldArray.Root>
  );
}
```

Каждый элемент разметки — ваш: cdk не навязывает ни тегов, ни классов, только прокидывает
состояние и обработчики через render-props.

## Дальше

- [@reformer/ui-kit](../ui-kit/overview) — стилизованные версии поверх cdk
- [Глоссарий](../reference/glossary.md) — термины документации
- [Core API Reference](../api)
