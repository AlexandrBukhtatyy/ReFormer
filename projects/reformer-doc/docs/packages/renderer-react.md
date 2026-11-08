---
id: renderer-react
title: '@reformer/renderer-react'
sidebar_label: 'renderer-react'
---

# @reformer/renderer-react

`@reformer/renderer-react` рисует форму целиком по её [схеме формы](/docs/reference/glossary) — дереву
узлов «какое поле, каким компонентом, в какой секции». Разметку полей писать не нужно: рендерер
обходит дерево и сам связывает каждый компонент с нодой поля — значением, замечаниями и
доступностью.

## Когда нужен

- Форма большая, а вёрстка однотипная: поля, секции, шаги удобнее держать деревом данных, чем JSX.
- Разметкой нужно управлять из поведения формы: прятать секцию по условию (`hideWhen`), ловить
  событие компонента (`onComponentEvent`).
- Нужен мастер: `FormWizard` из `@reformer/ui-kit` рисует шаги по узлам схемы.
- Та же форма описывается JSON-документом: [`@reformer/renderer-json`](./renderer-json.mdx) рисует
  через этот же рендерер.

**Когда достаточно `FormField` руками.** Полей немного, вёрстка своя, каждый блок пишется в JSX.
Схема при этом всё равно задаётся — она говорит, каким компонентом рисовать поле, — а разметку вы
собираете сами: `<FormField control={form.email} />`. Так устроен
[быстрый старт](/docs/getting-started/quick-start). Рендерер можно подключить позже: схема та же.

## Установка

```bash
npm install @reformer/renderer-react @reformer/core
```

Пакет — один вход `@reformer/renderer-react`. Готовые компоненты полей — в `@reformer/ui-kit`.

## Минимальный пример

```tsx
import { createForm, type FormModel } from '@reformer/core';
import { useFormBundle } from '@reformer/core/react';
import { FormRenderer, type RenderNode } from '@reformer/renderer-react';
import { FormField, Input, Section } from '@reformer/ui-kit';

type SignIn = { email: string; password: string };

// Схема: дерево узлов. Поле привязано к сигналу модели model.$.<поле>.
const signInSchema = (model: FormModel<SignIn>): RenderNode<SignIn> => ({
  component: Section,
  componentProps: { title: 'Вход' },
  children: [
    { model: model.$.email, component: Input, componentProps: { label: 'Email' } },
    {
      model: model.$.password,
      component: Input,
      componentProps: { label: 'Пароль', type: 'password' },
    },
  ],
});

export function SignInPage() {
  // Модель, ноды и скомпилированная схема — одной сборкой. useFormBundle зовёт фабрику один раз.
  const signIn = useFormBundle(() =>
    createForm<SignIn>({ initial: { email: '', password: '' }, schema: signInSchema })
  );

  // Рендерер получает сборку целиком; FormField — обёртка поля: подпись и замечания.
  return <FormRenderer form={signIn} settings={{ fieldWrapper: FormField }} />;
}
```

Что здесь происходит:

1. Схема — функция `(model) => узел`. [Сборка формы](/docs/reference/glossary) (`createForm`) вызывает
   её один раз и компилирует дерево.
2. `FormRenderer` получает всю сборку пропом `form` и рисует скомпилированное дерево.
3. `settings.fieldWrapper` оборачивает каждое поле. Без обёртки компонент рисуется голым — без
   подписи и текста замечания.

Правила проверки в узлы не пишутся: у узла нет поля `validators`. Правила — отдельная схема над
моделью, она уходит в сборку полем `validation`. См. [Обзор валидации](/docs/validation/overview).

## Что делает рендерер

- Рисует узел по его виду: поле, массив под-форм, подформа, контейнер, текст. Виды узлов описаны
  на странице [Схема формы](/docs/core-concepts/schemas/form-schema).
- Связывает поле с нодой. Компонент получает `value`, `onChange(value)`, `onBlur` и `disabled`;
  обёртка поля получает саму ноду (`control`).
- Исполняет правила узлов из поведения формы: `hideWhen`, `onComponentEvent`, `renderEffect`,
  `onMount` и другие.
- Ставит контекст сборки: из него `FormWizard` берёт форму, поток шагов и отправку. Свой компонент
  читает его хуком `useFormBundleContext()` из `@reformer/core/react`.

## Разделы

| Страница                                                        | О чём                                                                            |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| [Поля: обёртка и адаптеры](./renderer-react/fields.md)          | что получает компонент поля, своя обёртка, компоненты сторонних библиотек        |
| [Вёрстка: контейнеры, HTML и текст](./renderer-react/layout.md) | контейнеры, HTML-теги в схеме, живой текст из сигналов                           |
| [Массивы и подформы](./renderer-react/arrays-and-parts.md)      | узел массива, `FieldArray`, свой компонент списка, повторяемые части схемы       |
| [Управление узлами](./renderer-react/node-control.md)           | правила узлов, управление снаружи, свои контейнеры и компоненты с детьми-данными |

## Главное в пакете

| Экспорт                                                   | Зачем                                                                    |
| --------------------------------------------------------- | ------------------------------------------------------------------------ |
| `FormRenderer`                                            | рисует сборку формы: пропы `form` и `settings`                           |
| `RenderNode`, `ContainerRenderNode`, `ArrayRenderNode`, … | типы узлов схемы с React-компонентами                                    |
| `RendererSettings`, `FieldWrapperProps`, `FieldAdapter`   | настройки рендерера, пропы обёртки поля, адаптер компонента              |
| `ArrayComponentProps`, `ArrayItemSlot`                    | пропы компонента, который рисует массив                                  |
| `RenderNodeFn`, `ContainerComponentProps`                 | пропы своих контейнеров                                                  |
| `RenderNodeComponent`, `useRenderContext`                 | отрисовка отдельного узла и настройки рендерера внутри своего компонента |

Полный список — в README пакета и в справке MCP (`get_symbol_docs`).

## Подводные камни

- **`children` контейнера — на самом узле**, а не в `componentProps`. В `componentProps.children`
  вложенные узлы не отрисуются.
- **`FormRenderer: в бандле нет дерева`** — у сборки не задана `schema`. Без схемы поля рисуют
  руками: `<FormField control={form.email} />`.
- **Поле отрисовано как пустое место**, а в консоли `No form node for signal` — дерево рисуется не
  той сборкой или поле привязано к сигналу другой модели. Берите `model.$.<поле>` из аргумента
  функции-схемы.
- **Сборку создавайте через `useFormBundle`, а не `useMemo`.** React вправе сбросить кэш `useMemo`,
  и форма пересоберётся вместе с потерей введённого.
- **Не передавайте сразу `form` и `render`.** Проп `render` — низкоуровневый путь без сборки; если
  он задан, сборка игнорируется целиком вместе с правилами узлов.

## См. также

- [Схема формы](/docs/core-concepts/schemas/form-schema) — виды узлов и `selector`.
- [@reformer/renderer-json](./renderer-json.mdx) — та же форма из JSON-документа.
- [Поведение формы](/docs/behaviors/overview) — где пишутся правила узлов.
- [Свои компоненты полей](/docs/react/custom-fields) — как подключить свой контрол.
