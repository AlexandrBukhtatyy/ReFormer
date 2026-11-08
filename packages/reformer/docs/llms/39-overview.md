# Overview — карта @reformer/core

Обзор пакета для первого знакомства: из чего состоит форма, какой вход пакета за что отвечает и
какой рецепт читать дальше. Точные сигнатуры — `01-api-reference.md` и `03-api-signatures.md`,
полный набор импортов — `07-complete-import.md`.

## Package map

`@reformer/core` — состояние формы на сигналах. Корень пакета от React не зависит и работает на
сервере и в тестах; привязка к React — отдельный вход `@reformer/core/react`.

Форма собирается из четырёх частей, и все они привязываются к ручкам модели (`model.$.<поле>`),
а не к строковым путям:

| Часть     | Что это                                                     | Чем объявляется                                  |
| --------- | ----------------------------------------------------------- | ------------------------------------------------ |
| модель    | значения формы — источник истины                            | `initial` в `createForm` или `createModel(initial)` |
| схема     | дерево узлов: поле, массив под-форм, подформа, контейнер    | билдер `(model) => FormSchemaNode`               |
| правила   | валидация над моделью, отдельно от схемы                    | `defineValidation` из `@reformer/core/validation` |
| поведение | вычисления, связи полей, условная доступность               | `defineFormBehavior` из `@reformer/core/behaviors` |

`createForm({ initial, schema, validation, behavior, flow })` собирает всё одним вызовом и отдаёт
сборку формы: `model`, `form` (ноды полей), `render` (часть для рендерера), `validate()`,
`validateStep(id)`, `submission.submit(handler)`, `flow` (поток шагов) и `dispose()`. В React
сборку создают один раз — `useFormBundle(фабрика)`.

## Installation

```bash
npm install @reformer/core
```

`react` и `react-dom` — необязательные peer-зависимости: нужны только входу `@reformer/core/react`.

## Package entries

| Вход                                               | Что внутри                                                                                                          |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `@reformer/core`                                   | `createForm`, `createModel`, `arrayOf`, `compileSchema`, `createFormFlow`, `createSubmission`; типы `FormModel`, `FormGroup`, `FormControl`, `FormArray`, `FormSchemaNode`, `ValidationIssue` |
| `@reformer/core/react`                             | `useFormBundle`, `useFormControl`, `useFormControlValue`, `useArrayLength`, `useFormFlow`, `useFormValidation`, `FormBundleContext`, `I18nProvider`, `useIssueMessage`, `bindFieldProps` |
| `@reformer/core/validation`                        | `defineValidation`, `validate`, `validateAsync`, `validateWhen`, `apply`, `applyEach`, `validateModel`, `createFormValidation` |
| `@reformer/core/validators`                        | фабрики правил: `required`, `min`, `max`, `minLength`, `maxLength`, `email`, `pattern`, `url`, `phone`, числа, даты, файлы |
| `@reformer/core/validators/<имя>`                  | одно правило на вход: `required`, `email`, `min-length`, `is-date`, `min-age` и другие (правил для файлов здесь нет — только в `validators`) |
| `@reformer/core/behaviors`                         | `defineFormBehavior`, `compute`, `computeFrom`, `copyFrom`, `onChange`, `enableWhen`, `disableWhen`, `resetWhen`, `syncFields`, `transformValue`, `revalidateWhen`, `applyEach`, `apply`, `hideWhen`, `onComponentEvent` |
| `@reformer/core/model`                             | низкоуровневая модель без форм: `createModel`, `arrayOf`, `modelOf`, value-операции, `deepEqual`                    |
| `@reformer/core/signals`                           | `signal`, `computed`, `effect`, `batch`, `untracked`, `isSignal` — единственная копия реактивного рантайма        |
| `@reformer/core/i18n`                              | локализация без React: `defineIssueMessages`, `createLocaleLoader`, `createI18n`, `extendLocale`, `msg`             |
| `@reformer/core/locale`                            | `loadCoreLocale` — загрузчик встроенных локалей (`en`, `ru`) по чанку на язык                                       |
| `@reformer/core/locale/en`, `/locale/ru`           | синхронные модули локали — для SSR и тестов                                                                         |
| `@reformer/core/locale/en.json`, `/locale/ru.json` | словари JSON — выложить на свой сервер                                                                              |

Импорт правил: весь набор — `@reformer/core/validators`; точечный вход
(`@reformer/core/validators/required`) нужен, только если сборщик приложения не вычищает
неиспользуемый код.

## Minimal form

Форма без UI-кита: поле рисует свой компонент на `useFormControl`.

```tsx
import { createForm, type FormControl, type FormModel, type FormSchemaNode } from '@reformer/core';
import { useFormBundle, useFormControl } from '@reformer/core/react';
import { defineValidation, validate } from '@reformer/core/validation';
import { required, email } from '@reformer/core/validators';

type Contact = { email: string };

const schema = (model: FormModel<Contact>): FormSchemaNode => ({
  children: [{ model: model.$.email }],
});

const rules = defineValidation<Contact>(({ model }) => {
  validate(model.$.email, [required(), email()]);
});

const createContact = () => createForm<Contact>({ initial: { email: '' }, schema, validation: rules });

function EmailInput({ control }: { control: FormControl<string> }) {
  const { value, shouldShowError, issues } = useFormControl(control);
  return (
    <label>
      Email
      <input
        value={value}
        onChange={(e) => control.setValue(e.target.value)}
        onBlur={() => control.markAsTouched()}
      />
      {shouldShowError && <span role="alert">{issues[0]?.code}</span>}
    </label>
  );
}

export function ContactForm() {
  const bundle = useFormBundle(createContact);
  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    await bundle.submission.submit((values) => console.log(values));
  };
  return (
    <form onSubmit={send}>
      <EmailInput control={bundle.form.email} />
      <button type="submit">Отправить</button>
    </form>
  );
}
```

Замечание правила несёт код (`required`, `email`), а не текст. Текст по коду даёт локаль
(`I18nProvider`) и словарь формы (`defineIssueMessages`, хук `useIssueMessage`) — рецепт
`issue-messages`. Готовые поля с подписью и ошибкой — `FormField` из `@reformer/ui-kit`, рецепт
`quick-start`.

## Where to read next

| Задача                                         | Рецепт (`find_recipe`)                  |
| ---------------------------------------------- | --------------------------------------- |
| Первая форма с UI-китом                        | `quick-start`                           |
| Схема: поле, контейнер, подформа               | `formschema`, `unified-contract`        |
| Массив под-форм                                | `arrays`, `array-operations`            |
| Правила, условные и межполевые                 | `api-signatures`, `common-patterns`, `conditional-fields` |
| Асинхронная проверка                           | `async-validator-debounce`              |
| Когда показывать ошибки                        | `validation-strategy`                   |
| Тексты замечаний и язык                        | `issue-messages`, `i18n`                |
| Вычисляемые и связанные поля                   | `compute-vs-watch`, `copy-from`, `sync-fields`, `reset-when` |
| Отправка, сброс, загрузка начальных значений   | `submit-and-reset`, `async-preload`     |
| Многошаговая форма                             | `form-flow`, `multi-step`               |
| Частые ошибки                                  | `common-mistakes`, `troubleshooting`    |
