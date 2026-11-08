import { createForm, type FormModel, type FormSchemaNode } from '@reformer/core';
import { useFormBundle } from '@reformer/core/react';
import { FormRenderer } from '@reformer/renderer-react';
import { Button, Item, ItemContent, ItemTitle, List } from '@reformer/ui-kit';
import type { ComponentDocConfig } from '../types';

/**
 * List — не поле формы: обёртка без кнопок для массива, который только показывают. Элементы
 * приходят готовыми в пропе `items` (обычно их передаёт рендерер). Variants — сам компонент на
 * готовых элементах, Examples — узел массива в схеме формы, API — таблица props.
 * Обёртка `<div style>` в render — рамка демо, в `code` её нет.
 */

type Notice = { text: string };
type NoticeForm = { notices: Notice[] };

// Узел массива с component: List — строки рисует рендерер, List только оформляет их.
const noticeSchema = (model: FormModel<NoticeForm>): FormSchemaNode => ({
  children: [
    {
      model: model.$.notices,
      component: List,
      componentProps: { testId: 'notices' },
      item: (row: FormModel<Notice>) => ({
        component: Item,
        componentProps: { variant: 'outline', size: 'sm', role: 'listitem' },
        children: [row.$.text],
      }),
    },
  ],
});

function NoticeListExample() {
  const bundle = useFormBundle(() =>
    createForm<NoticeForm>({
      initial: { notices: [{ text: 'Заявка принята' }] },
      schema: noticeSchema,
    })
  );
  const { notices } = bundle.model;
  return (
    <div style={{ width: '100%', maxWidth: 420 }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <Button size="sm" onClick={() => notices.push({ text: 'Документы проверены' })}>
          Добавить
        </Button>
        <Button size="sm" variant="outline" onClick={() => notices.clear()}>
          Очистить
        </Button>
      </div>
      <FormRenderer form={bundle} />
    </div>
  );
}

export const listDocConfig: ComponentDocConfig = {
  name: 'List',
  importFrom: '@reformer/ui-kit',
  description:
    'Список без кнопок для массива, который только показывают. Элементы приходят готовыми в пропе items.',
  variants: [
    {
      id: 'base',
      title: 'Готовые элементы',
      description:
        'items — массив { key, index, children }. List кладёт их в контейнер role="list" с отступом space-y-2.',
      render: () => (
        <div style={{ width: '100%', maxWidth: 420 }}>
          <List
            items={[
              {
                key: 'a',
                index: 0,
                children: (
                  <Item variant="outline" size="sm" role="listitem">
                    <ItemContent>
                      <ItemTitle>Паспорт загружен</ItemTitle>
                    </ItemContent>
                  </Item>
                ),
              },
              {
                key: 'b',
                index: 1,
                children: (
                  <Item variant="outline" size="sm" role="listitem">
                    <ItemContent>
                      <ItemTitle>Справка о доходах на проверке</ItemTitle>
                    </ItemContent>
                  </Item>
                ),
              },
            ]}
          />
        </div>
      ),
      code: `<List
  items={[
    {
      key: 'a',
      index: 0,
      children: (
        <Item variant="outline" size="sm" role="listitem">
          <ItemContent>
            <ItemTitle>Паспорт загружен</ItemTitle>
          </ItemContent>
        </Item>
      ),
    },
    {
      key: 'b',
      index: 1,
      children: (
        <Item variant="outline" size="sm" role="listitem">
          <ItemContent>
            <ItemTitle>Справка о доходах на проверке</ItemTitle>
          </ItemContent>
        </Item>
      ),
    },
  ]}
/>`,
    },
    {
      id: 'as-ul',
      title: 'Маркированный список (as="ul")',
      description:
        'as меняет тег контейнера. С as="ul" элементы — обычные <li>, className добавляет маркеры.',
      render: () => (
        <div style={{ width: '100%', maxWidth: 420 }}>
          <List
            as="ul"
            className="list-disc pl-5 text-sm"
            items={[
              { key: 'passport', index: 0, children: <li>Паспорт</li> },
              { key: 'income', index: 1, children: <li>Справка о доходах</li> },
              { key: 'snils', index: 2, children: <li>СНИЛС</li> },
            ]}
          />
        </div>
      ),
      code: `<List
  as="ul"
  className="list-disc pl-5 text-sm"
  items={[
    { key: 'passport', index: 0, children: <li>Паспорт</li> },
    { key: 'income', index: 1, children: <li>Справка о доходах</li> },
    { key: 'snils', index: 2, children: <li>СНИЛС</li> },
  ]}
/>`,
    },
  ],
  examples: [
    {
      id: 'schema-array',
      title: 'Массив модели в схеме формы',
      description:
        'Узел { model: model.$.notices, item, component: List }: строки строит рендерер, List их оформляет. Кнопки меняют массив модели — список перерисовывается сам.',
      render: NoticeListExample,
      code: `import { createForm, type FormModel, type FormSchemaNode } from '@reformer/core';
import { useFormBundle } from '@reformer/core/react';
import { FormRenderer } from '@reformer/renderer-react';
import { Button, Item, List } from '@reformer/ui-kit';

type Notice = { text: string };
type NoticeForm = { notices: Notice[] };

const noticeSchema = (model: FormModel<NoticeForm>): FormSchemaNode => ({
  children: [
    {
      model: model.$.notices,
      component: List,
      componentProps: { testId: 'notices' },
      item: (row: FormModel<Notice>) => ({
        component: Item,
        componentProps: { variant: 'outline', size: 'sm', role: 'listitem' },
        children: [row.$.text],
      }),
    },
  ],
});

function NoticeList() {
  const bundle = useFormBundle(() =>
    createForm<NoticeForm>({
      initial: { notices: [{ text: 'Заявка принята' }] },
      schema: noticeSchema,
    })
  );
  const { notices } = bundle.model;
  return (
    <>
      <Button size="sm" onClick={() => notices.push({ text: 'Документы проверены' })}>
        Добавить
      </Button>
      <Button size="sm" variant="outline" onClick={() => notices.clear()}>
        Очистить
      </Button>
      <FormRenderer form={bundle} />
    </>
  );
}`,
    },
  ],
  props: [
    {
      name: 'items',
      type: 'ArrayItemSlot[]',
      default: '[]',
      description:
        'Готовые элементы: { key, index, model?, children }. В схеме формы их передаёт рендерер, руками — только при использовании вне схемы.',
    },
    {
      name: 'className',
      type: 'string',
      description: 'Классы контейнера. Сливаются с встроенным space-y-2 через tailwind-merge.',
    },
    {
      name: 'as',
      type: 'ElementType',
      default: "'div'",
      description:
        'Тег или компонент контейнера, например "ul" или "ol". role="list" остаётся при любом теге.',
    },
    {
      name: 'testId',
      type: 'string',
      description: 'Значение data-testid контейнера.',
    },
  ],
};
