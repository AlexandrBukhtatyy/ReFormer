import { ExampleCard, Button, InputField } from '@reformer/ui-kit';
import { useState } from 'react';
import type { ComponentDocConfig } from '../types';

/**
 * ExampleCard — не form-control: ReFormer-специфичная playground-обёртка примера. Показывает
 * заголовок, описание и область с живым примером; по кнопке в шапке переключается на режим
 * «код» (переданный текст `code`) с copy-to-clipboard. Утилита для документации/playground,
 * не для продакшена. Variants — базовая карточка и вариант с кастомным фоном; Examples —
 * типовое обёртывание живого контрола.
 */

const InputDemo = () => {
  const [v, setV] = useState<string | null>(null);
  return <InputField value={v} onChange={setV} placeholder="Email" />;
};

export const exampleCardDocConfig: ComponentDocConfig = {
  name: 'ExampleCard',
  importFrom: '@reformer/ui-kit',
  description:
    'Playground-обёртка примера: заголовок, описание, область с живым примером и переключение на исходный код (проп code) с copy-to-clipboard. Утилита для документации, не для продакшена.',
  variants: [
    {
      id: 'basic',
      title: 'Базовая карточка',
      description:
        'title + описание + children (живой пример). Кнопка в шапке переключает на режим «код».',
      render: () => (
        <ExampleCard
          title="Input — базовый"
          description="Однострочное поле с placeholder"
          code={`<Input value={v} onChange={setV} placeholder="Email" />`}
        >
          <InputDemo />
        </ExampleCard>
      ),
      code: `const [v, setV] = useState<string | null>(null);

<ExampleCard
  title="Input — базовый"
  description="Однострочное поле с placeholder"
  code={\`<Input value={v} onChange={setV} placeholder="Email" />\`}
>
  <Input value={v} onChange={setV} placeholder="Email" />
</ExampleCard>`,
    },
    {
      id: 'bg-color',
      title: 'Кастомный фон',
      description:
        'bgColor задаёт Tailwind-класс фона карточки — удобно подсветить группу примеров (напр. опасное действие).',
      render: () => (
        <ExampleCard
          title="Destructive button"
          description="Кнопка опасного действия"
          bgColor="bg-red-50"
          code={`<Button variant="destructive">Delete</Button>`}
        >
          <Button variant="destructive">Delete</Button>
        </ExampleCard>
      ),
      code: `<ExampleCard
  title="Destructive button"
  description="Кнопка опасного действия"
  bgColor="bg-red-50"
  code={\`<Button variant="destructive">Delete</Button>\`}
>
  <Button variant="destructive">Delete</Button>
</ExampleCard>`,
    },
  ],
  examples: [
    {
      id: 'wrap-control',
      title: 'Обёртка живого контрола',
      description:
        'Типовое применение — показать интерактивный компонент рядом с его исходником: children рендерят живой пример, code хранит копируемый сниппет.',
      render: () => (
        <ExampleCard
          title="Кнопка"
          description="Нажми — состояние живёт в примере"
          code={`<Button onClick={() => setN((n) => n + 1)}>Кликов: {n}</Button>`}
        >
          <Button>Кнопка</Button>
        </ExampleCard>
      ),
      code: `function Demo() {
  const [n, setN] = useState(0);
  return (
    <ExampleCard
      title="Кнопка"
      description="Нажми — состояние живёт в примере"
      code={\`<Button onClick={() => setN((n) => n + 1)}>Кликов: {n}</Button>\`}
    >
      <Button onClick={() => setN((n) => n + 1)}>Кликов: {n}</Button>
    </ExampleCard>
  );
}`,
    },
  ],
  props: [
    {
      name: 'title',
      type: 'string',
      description: 'Заголовок карточки (обязателен).',
    },
    {
      name: 'description',
      type: 'string',
      description: 'Описание под заголовком.',
    },
    {
      name: 'children',
      type: 'ReactNode',
      description: 'Контент примера, отображаемый в режиме «пример».',
    },
    {
      name: 'code',
      type: 'string',
      description: 'Текст исходного кода, показываемый в режиме «код» и копируемый в clipboard.',
    },
    {
      name: 'bgColor',
      type: 'string',
      default: "'bg-white'",
      description: 'Tailwind-класс фона карточки.',
    },
    {
      name: 'className',
      type: 'string',
      description: 'Дополнительный CSS-класс контейнера (мёржится через tailwind-merge).',
    },
  ],
};
