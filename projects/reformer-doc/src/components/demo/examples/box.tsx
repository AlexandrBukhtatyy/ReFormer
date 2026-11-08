import { createForm, type FormModel, type FormSchemaNode } from '@reformer/core';
import { useFormBundle } from '@reformer/core/react';
import { FormRenderer } from '@reformer/renderer-react';
import { Box, Button, FormField, Input } from '@reformer/ui-kit';
import type { ComponentDocConfig } from '../types';

/**
 * Box — не поле формы, а контейнер раскладки: `<div>` с классом. Variants — типовые раскладки
 * в JSX, Examples — Box как узел схемы формы, API — таблица props.
 * Обёртка `<div style>` в render — рамка демо, в `code` её нет.
 */

type Person = { firstName: string; lastName: string };

// Контейнер схемы: Box задаёт сетку, поля перечислены в children узла.
const personSchema = (model: FormModel<Person>): FormSchemaNode => ({
  component: Box,
  componentProps: { className: 'grid grid-cols-1 md:grid-cols-2 gap-4' },
  children: [
    { model: model.$.firstName, component: Input, componentProps: { label: 'Имя' } },
    { model: model.$.lastName, component: Input, componentProps: { label: 'Фамилия' } },
  ],
});

function PersonFormExample() {
  const bundle = useFormBundle(() =>
    createForm<Person>({
      initial: { firstName: '', lastName: '' },
      schema: personSchema,
    })
  );
  return (
    <div style={{ width: '100%', maxWidth: 520 }}>
      <FormRenderer form={bundle} settings={{ fieldWrapper: FormField }} />
    </div>
  );
}

export const boxDocConfig: ComponentDocConfig = {
  name: 'Box',
  importFrom: '@reformer/ui-kit',
  description:
    'Контейнер раскладки: <div> с классом. В схеме формы группирует узлы, раскладку задаёт className.',
  variants: [
    {
      id: 'stack',
      title: 'Колонка',
      description: 'flex flex-col gap-4 — элементы друг под другом с равным отступом.',
      render: () => (
        <div style={{ width: '100%', maxWidth: 420 }}>
          <Box className="flex flex-col gap-4">
            <Input placeholder="Email" aria-label="Email" />
            <Input placeholder="Пароль" type="password" aria-label="Пароль" />
          </Box>
        </div>
      ),
      code: `<Box className="flex flex-col gap-4">
  <Input placeholder="Email" aria-label="Email" />
  <Input placeholder="Пароль" type="password" aria-label="Пароль" />
</Box>`,
    },
    {
      id: 'grid',
      title: 'Сетка из двух колонок',
      description:
        'grid grid-cols-1 md:grid-cols-2 gap-4 — на узком экране одна колонка, на широком две.',
      render: () => (
        <div style={{ width: '100%', maxWidth: 420 }}>
          <Box className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input placeholder="Имя" aria-label="Имя" />
            <Input placeholder="Фамилия" aria-label="Фамилия" />
          </Box>
        </div>
      ),
      code: `<Box className="grid grid-cols-1 md:grid-cols-2 gap-4">
  <Input placeholder="Имя" aria-label="Имя" />
  <Input placeholder="Фамилия" aria-label="Фамилия" />
</Box>`,
    },
    {
      id: 'row',
      title: 'Строка',
      description: 'flex items-center gap-2 — поле и кнопка в одну строку.',
      render: () => (
        <div style={{ width: '100%', maxWidth: 420 }}>
          <Box className="flex items-center gap-2">
            <Input placeholder="Промокод" aria-label="Промокод" />
            <Button variant="outline">Применить</Button>
          </Box>
        </div>
      ),
      code: `<Box className="flex items-center gap-2">
  <Input placeholder="Промокод" aria-label="Промокод" />
  <Button variant="outline">Применить</Button>
</Box>`,
    },
  ],
  examples: [
    {
      id: 'schema-container',
      title: 'Контейнер в схеме формы',
      description:
        'Узел { component: Box, componentProps: { className }, children }: Box задаёт сетку, поля перечислены в children узла.',
      render: PersonFormExample,
      code: `import { createForm, type FormModel, type FormSchemaNode } from '@reformer/core';
import { useFormBundle } from '@reformer/core/react';
import { FormRenderer } from '@reformer/renderer-react';
import { Box, FormField, Input } from '@reformer/ui-kit';

type Person = { firstName: string; lastName: string };

const personSchema = (model: FormModel<Person>): FormSchemaNode => ({
  component: Box,
  componentProps: { className: 'grid grid-cols-1 md:grid-cols-2 gap-4' },
  children: [
    { model: model.$.firstName, component: Input, componentProps: { label: 'Имя' } },
    { model: model.$.lastName, component: Input, componentProps: { label: 'Фамилия' } },
  ],
});

function PersonForm() {
  const bundle = useFormBundle(() =>
    createForm<Person>({
      initial: { firstName: '', lastName: '' },
      schema: personSchema,
    })
  );
  return <FormRenderer form={bundle} settings={{ fieldWrapper: FormField }} />;
}`,
    },
  ],
  props: [
    {
      name: 'className',
      type: 'string',
      description:
        'Классы раскладки: flex, grid, gap-*, space-y-*. Единственный проп, который Box передаёт в разметку.',
    },
    {
      name: 'children',
      type: 'ReactNode',
      description: 'Содержимое. В схеме формы — узлы из children узла, а не из componentProps.',
    },
  ],
};
