import { ExampleCard, Button, Input } from '@reformer/ui-kit';
import { useState } from 'react';
import type { ComponentDocConfig } from '../types';

/**
 * ExampleCard — не поле формы: карточка для демо-страниц и песочниц — заголовок, описание,
 * живой пример и переключатель «пример ↔ код» с копированием. Variants — базовая карточка и свой
 * фон, Examples — живой контрол со своим состоянием.
 */

const InputDemo = () => {
  const [v, setV] = useState('');
  return <Input value={v} onChange={(e) => setV(e.target.value)} placeholder="Email" />;
};

const CounterDemo = () => {
  const [n, setN] = useState(0);
  return (
    <ExampleCard
      title="Кнопка"
      description="Нажмите — состояние живёт в примере"
      code={`<Button onClick={() => setN((n) => n + 1)}>Кликов: {n}</Button>`}
    >
      <Button onClick={() => setN((n) => n + 1)}>Кликов: {n}</Button>
    </ExampleCard>
  );
};

export const exampleCardDocConfig: ComponentDocConfig = {
  name: 'ExampleCard',
  importFrom: '@reformer/ui-kit',
  description:
    'Карточка для демо-страниц: заголовок, описание, живой пример и переключатель на код с копированием.',
  variants: [
    {
      id: 'basic',
      title: 'Базовая карточка',
      description:
        'title, description и children — живой пример. Кнопка в шапке переключает карточку на код.',
      render: () => (
        <ExampleCard
          title="Input — базовый"
          description="Однострочное поле с placeholder"
          code={`<Input value={v} onChange={(e) => setV(e.target.value)} placeholder="Email" />`}
        >
          <InputDemo />
        </ExampleCard>
      ),
      code: `const [v, setV] = useState('');

<ExampleCard
  title="Input — базовый"
  description="Однострочное поле с placeholder"
  code={\`<Input value={v} onChange={(e) => setV(e.target.value)} placeholder="Email" />\`}
>
  <Input value={v} onChange={(e) => setV(e.target.value)} placeholder="Email" />
</ExampleCard>`,
    },
    {
      id: 'bg-color',
      title: 'Свой фон (bgColor)',
      description:
        'bgColor — класс фона карточки вместо bg-card. Берите цвета темы (bg-muted, bg-accent): они верны и в тёмной теме.',
      render: () => (
        <ExampleCard
          title="Destructive button"
          description="Кнопка опасного действия"
          bgColor="bg-muted"
          code={`<Button variant="destructive">Delete</Button>`}
        >
          <Button variant="destructive">Delete</Button>
        </ExampleCard>
      ),
      code: `<ExampleCard
  title="Destructive button"
  description="Кнопка опасного действия"
  bgColor="bg-muted"
  code={\`<Button variant="destructive">Delete</Button>\`}
>
  <Button variant="destructive">Delete</Button>
</ExampleCard>`,
    },
  ],
  examples: [
    {
      id: 'wrap-control',
      title: 'Живой контрол со своим состоянием',
      description:
        'children — работающий пример, code — строка, которую покажет и скопирует карточка. Карточка код не выполняет и не сверяет с children.',
      render: () => <CounterDemo />,
      code: `function Demo() {
  const [n, setN] = useState(0);
  return (
    <ExampleCard
      title="Кнопка"
      description="Нажмите — состояние живёт в примере"
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
      description: 'Заголовок карточки, обязателен. Рисуется тегом <h3>.',
    },
    {
      name: 'description',
      type: 'string',
      description: 'Описание под заголовком.',
    },
    {
      name: 'children',
      type: 'ReactNode',
      description: 'Живой пример — виден, пока карточка не переключена на код.',
    },
    {
      name: 'code',
      type: 'string',
      description: 'Текст кода: его показывает режим «код» и копирует кнопка копирования.',
    },
    {
      name: 'bgColor',
      type: 'string',
      default: "'bg-card'",
      description: 'Класс фона карточки. bg-card следует теме.',
    },
    {
      name: 'className',
      type: 'string',
      description: 'Дополнительные классы корня. При конфликте Tailwind-классов побеждает ваш.',
    },
  ],
};
