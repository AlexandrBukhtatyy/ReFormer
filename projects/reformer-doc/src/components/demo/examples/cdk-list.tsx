import {
  arrayOf,
  createForm,
  type FormGroup,
  type FormModel,
  type FormSchemaNode,
} from '@reformer/core';
import { useFormBundle, useFormControlValue } from '@reformer/core/react';
import { List, useList } from '@reformer/cdk/list';
import { Button } from '@reformer/ui-kit';
import type { ComponentDocConfig } from '../types';

type Notice = { level: 'info' | 'warning'; text: string };
type NoticesForm = { notices: Notice[] };

const blankNotice = (): Notice => ({ level: 'info', text: '' });

/** Узел массива с `item`: строки получают свои ноды. Компоненты не нужны — список только выводит. */
const noticesSchema = (model: FormModel<NoticesForm>): FormSchemaNode => ({
  children: [
    {
      model: model.$.notices,
      item: (row: FormModel<Notice>) => ({
        children: [{ model: row.$.level }, { model: row.$.text }],
      }),
    },
  ],
});

const SAMPLES: Notice[] = [
  { level: 'warning', text: 'Сумма выше лимита без подтверждения дохода' },
  { level: 'info', text: 'Решение придёт по СМС в течение часа' },
  { level: 'info', text: 'Документы можно загрузить позже' },
];

function useNotices(initial: Notice[] = SAMPLES.slice(0, 2)) {
  return useFormBundle(() =>
    createForm<NoticesForm>({
      initial: { notices: arrayOf(blankNotice, initial) },
      schema: noticesSchema,
    })
  );
}

const MUTED: React.CSSProperties = { color: 'var(--ifm-color-emphasis-600)', fontSize: 13 };
const TOOLBAR: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
  marginBottom: 12,
};

/** Строка списка читает значения своих полей — и перерисовывается только при их смене. */
function NoticeRow({ control }: { control: FormGroup<Notice> }) {
  const level = useFormControlValue(control.level);
  const text = useFormControlValue(control.text);
  return (
    <div
      role="note"
      style={{
        padding: '8px 12px',
        marginBottom: 8,
        borderRadius: 6,
        fontSize: 14,
        borderLeft: `4px solid var(${level === 'warning' ? '--ifm-color-warning' : '--ifm-color-info'})`,
        background: 'var(--ifm-color-emphasis-100)',
      }}
    >
      {text}
    </div>
  );
}

/** Кнопки меняют массив модели — так же, как это делало бы поведение формы. */
function NoticesToolbar({ form }: { form: FormGroup<NoticesForm> }) {
  return (
    <div style={TOOLBAR}>
      <Button
        size="sm"
        variant="outline"
        onClick={() => form.notices.push(SAMPLES[form.notices.length % SAMPLES.length])}
      >
        Добавить уведомление
      </Button>
      <Button size="sm" variant="ghost" onClick={() => form.notices.clear()}>
        Очистить
      </Button>
    </div>
  );
}

function CompoundDemo() {
  const { form } = useNotices();
  return (
    <div style={{ maxWidth: 480, width: '100%' }}>
      <NoticesToolbar form={form} />
      <List.Root control={form.notices}>
        <List.Empty>
          <p style={MUTED}>Уведомлений нет</p>
        </List.Empty>
        <List.Items<Notice>>{({ control }) => <NoticeRow control={control} />}</List.Items>
      </List.Root>
    </div>
  );
}

function HookDemo() {
  const { form } = useNotices();
  const { items, length, isEmpty } = useList(form.notices);
  return (
    <div style={{ maxWidth: 480, width: '100%' }}>
      <NoticesToolbar form={form} />
      <p style={MUTED}>Уведомлений: {length}</p>
      {isEmpty ? null : (
        <div>
          {items.map(({ control, id }) => (
            <NoticeRow key={id} control={control} />
          ))}
        </div>
      )}
    </div>
  );
}

export const cdkListDocConfig: ComponentDocConfig = {
  name: 'List',
  importFrom: '@reformer/cdk/list',
  description:
    'Headless-обход массива модели только для вывода: строки появляются и исчезают по изменениям массива, кнопок добавления и удаления нет.',
  variants: [
    {
      id: 'compound',
      title: 'Root, Items и Empty',
      description:
        'Список уведомлений. Кнопки меняют массив модели, как это делало бы поведение формы; List только показывает строки.',
      render: CompoundDemo,
      code: `import { List } from '@reformer/cdk/list';

function NoticeRow({ control }: { control: FormGroup<Notice> }) {
  const text = useFormControlValue(control.text);
  return <div role="note">{text}</div>;
}

<List.Root control={form.notices}>
  <List.Empty>
    <p>Уведомлений нет</p>
  </List.Empty>
  <List.Items<Notice>>{({ control }) => <NoticeRow control={control} />}</List.Items>
</List.Root>`,
    },
  ],
  examples: [
    {
      id: 'hook',
      title: 'Хук useList',
      description:
        'Те же строки без compound-компонентов. Ключ строки — id: он держится за элемент и не меняется при перестановке.',
      render: HookDemo,
      code: `import { useList } from '@reformer/cdk/list';

const { items, length, isEmpty } = useList(form.notices);

<>
  <p>Уведомлений: {length}</p>
  {isEmpty ? null : items.map(({ control, id }) => <NoticeRow key={id} control={control} />)}
</>`,
    },
  ],
  props: [
    {
      name: 'List.Root',
      type: 'control: FormArray<T>; children: ReactNode',
      description: 'Провайдер контекста списка. Подписан на длину и значение массива.',
    },
    {
      name: 'List.Items',
      type: 'children: (item: { control, index, id }) => ReactNode; className?; as?',
      default: "as: 'div'",
      description:
        'Перебирает строки. Без className обёртки нет — строки идут подряд; с className — контейнер as. Тип строки — явным аргументом: List.Items<Notice>.',
    },
    {
      name: 'List.Empty',
      type: 'children: ReactNode',
      description: 'Показывается, когда строк нет.',
    },
    {
      name: 'useList(control)',
      type: '→ { items, length, isEmpty }',
      description: 'Строки массива без разметки; T выводится из control.',
    },
    {
      name: 'useListContext() / useListItemContext()',
      type: '→ { items, length, isEmpty } / { control, index, id }',
      description: 'Состояние списка и текущей строки для потомков List.Root и List.Items.',
    },
  ],
};
