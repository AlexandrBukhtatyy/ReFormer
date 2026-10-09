/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo } from 'react';
import { createModel, createFormFromModel, type FormModel } from '@reformer/core';
import { FieldArray, useFieldArray } from '@reformer/cdk/field-array';
import { FieldArraySection } from '@reformer/ui-kit/field-array';
import { FormField, Input, InputMask, Button } from '@reformer/ui-kit';
import type { ComponentDocConfig } from '../types';

type Phone = { kind: string; number: string };

const CARD: React.CSSProperties = {
  border: '1px solid var(--ifm-toc-border-color)',
  borderRadius: 8,
  padding: 12,
  marginBottom: 10,
};

/** Поднимает M1-форму с массивом телефонов (schema-нода `{ array, item }`). */
function usePhoneForm(initial: Phone[] = [{ kind: 'Мобильный', number: '' }]) {
  return useMemo(() => {
    const model = createModel<{ phones: Phone[] }>({ phones: initial });
    const phoneItem = (item: FormModel<Phone>) => ({
      kind: {
        value: item.$.kind,
        component: Input,
        componentProps: { label: 'Тип', placeholder: 'Мобильный / Рабочий' },
      },
      number: {
        value: item.$.number,
        component: InputMask,
        componentProps: { label: 'Номер', mask: '+7 (999) 999-99-99' },
      },
    });
    const schema = { phones: { array: model.phones, item: phoneItem } } as any;
    const form = createFormFromModel<{ phones: Phone[] }>({ model, schema });
    return { model, form: form as any };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

function FieldArrayBasic() {
  const { form } = usePhoneForm();
  return (
    <div style={{ maxWidth: 480, width: '100%' }}>
      <FieldArray.Root control={form.phones}>
        <FieldArray.Empty>
          <p style={{ color: 'var(--ifm-color-emphasis-600)' }}>Телефоны не добавлены</p>
        </FieldArray.Empty>
        <FieldArray.List>
          {({ control, index, remove }: any) => (
            <div style={CARD}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 8,
                }}
              >
                <strong>Телефон #{index + 1}</strong>
                <Button variant="ghost" size="sm" onClick={remove}>
                  Удалить
                </Button>
              </div>
              <div style={{ display: 'grid', gap: 8 }}>
                <FormField control={control.kind} />
                <FormField control={control.number} />
              </div>
            </div>
          )}
        </FieldArray.List>
        <FieldArray.AddButton initialValue={{ kind: '', number: '' }}>
          + Добавить телефон
        </FieldArray.AddButton>
      </FieldArray.Root>
    </div>
  );
}

const PhoneItem = ({ control }: { control: any }) => (
  <div style={{ display: 'grid', gap: 8 }}>
    <FormField control={control.kind} />
    <FormField control={control.number} />
  </div>
);

function FieldArraySectionDemo() {
  const { form } = usePhoneForm();
  return (
    <div style={{ maxWidth: 480, width: '100%' }}>
      <FieldArraySection
        control={form.phones}
        itemComponent={PhoneItem}
        title="Телефоны"
        initialValue={{ kind: '', number: '' }}
      />
    </div>
  );
}

function FieldArrayReorder() {
  const { form } = usePhoneForm([
    { kind: 'Мобильный', number: '' },
    { kind: 'Рабочий', number: '' },
  ]);
  return (
    <div style={{ maxWidth: 480, width: '100%' }}>
      <FieldArray.Root control={form.phones}>
        <FieldArray.List>
          {({ control, index, remove, moveUp, moveDown, canMoveUp, canMoveDown }: any) => (
            <div style={{ ...CARD, display: 'flex', alignItems: 'flex-end', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <FormField control={control.number} />
              </div>
              <Button variant="ghost" size="sm" onClick={moveUp} disabled={!canMoveUp}>
                ↑
              </Button>
              <Button variant="ghost" size="sm" onClick={moveDown} disabled={!canMoveDown}>
                ↓
              </Button>
              <Button variant="ghost" size="sm" onClick={remove}>
                ×
              </Button>
              <span
                style={{
                  alignSelf: 'center',
                  fontSize: 12,
                  color: 'var(--ifm-color-emphasis-600)',
                }}
              >
                #{index + 1}
              </span>
            </div>
          )}
        </FieldArray.List>
        <FieldArray.AddButton initialValue={{ kind: '', number: '' }}>
          + Добавить
        </FieldArray.AddButton>
      </FieldArray.Root>
    </div>
  );
}

function UseFieldArrayDemo() {
  const { form } = usePhoneForm();
  const { items, add, length } = useFieldArray(form.phones);
  return (
    <div style={{ maxWidth: 480, width: '100%' }}>
      <p style={{ fontSize: 13, color: 'var(--ifm-color-emphasis-700)' }}>
        Всего элементов: {length}
      </p>
      {items.map(({ control, id, remove }: any) => (
        <div key={id} style={{ ...CARD, display: 'flex', alignItems: 'flex-end', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <FormField control={control.number} />
          </div>
          <Button variant="ghost" size="sm" onClick={remove}>
            ×
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={() => add({ kind: '', number: '' })}>
        + Добавить
      </Button>
    </div>
  );
}

export const fieldArrayDocConfig: ComponentDocConfig = {
  name: 'FieldArray',
  importFrom: '@reformer/cdk/field-array',
  description:
    'Headless compound-компонент для динамических массивов: add / remove / reorder через render-props.',
  variants: [
    {
      id: 'headless',
      title: 'Headless (add / remove)',
      description: 'Root + List + AddButton. Разметку и стили пишете сами.',
      render: FieldArrayBasic,
      code: `<FieldArray.Root control={form.phones}>
  <FieldArray.Empty><p>Телефоны не добавлены</p></FieldArray.Empty>
  <FieldArray.List>
    {({ control, index, remove }) => (
      <div>
        <strong>Телефон #{index + 1}</strong>
        <FormField control={control.kind} />
        <FormField control={control.number} />
        <button onClick={remove}>Удалить</button>
      </div>
    )}
  </FieldArray.List>
  <FieldArray.AddButton initialValue={{ kind: '', number: '' }}>
    + Добавить телефон
  </FieldArray.AddButton>
</FieldArray.Root>`,
    },
    {
      id: 'styled',
      title: 'Стилизованный (ui-kit)',
      description:
        'FieldArraySection из @reformer/ui-kit — готовый вид поверх cdk, itemComponent типизирован.',
      render: FieldArraySectionDemo,
      code: `import { FieldArraySection } from '@reformer/ui-kit/field-array';

const PhoneItem: FC<{ control: FormProxy<Phone> }> = ({ control }) => (
  <>
    <FormField control={control.kind} />
    <FormField control={control.number} />
  </>
);

<FieldArraySection
  control={form.phones}
  itemComponent={PhoneItem}
  title="Телефоны"
  initialValue={{ kind: '', number: '' }}
/>`,
    },
  ],
  examples: [
    {
      id: 'reorder',
      title: 'Переупорядочивание',
      description: 'moveUp / moveDown / canMoveUp / canMoveDown сохраняют состояние элементов.',
      render: FieldArrayReorder,
      code: `<FieldArray.List>
  {({ control, remove, moveUp, moveDown, canMoveUp, canMoveDown }) => (
    <div>
      <FormField control={control.number} />
      <button onClick={moveUp} disabled={!canMoveUp}>↑</button>
      <button onClick={moveDown} disabled={!canMoveDown}>↓</button>
      <button onClick={remove}>×</button>
    </div>
  )}
</FieldArray.List>`,
    },
    {
      id: 'hook',
      title: 'Хук useFieldArray',
      description: 'Полная свобода layout без compound-компонентов. T выводится из control.',
      render: UseFieldArrayDemo,
      code: `import { useFieldArray } from '@reformer/cdk/field-array';

const { items, add, length } = useFieldArray(form.phones);

<>
  <p>Всего: {length}</p>
  {items.map(({ control, id, remove }) => (
    <div key={id}>
      <FormField control={control.number} />
      <button onClick={remove}>×</button>
    </div>
  ))}
  <button onClick={() => add({ kind: '', number: '' })}>+ Добавить</button>
</>`,
    },
  ],
  props: [
    {
      name: 'FieldArray.Root',
      type: 'control: ArrayNode<T>',
      description: 'Провайдер контекста массива. Оборачивает остальные части.',
    },
    {
      name: 'FieldArray.List',
      type: 'children: (item) => ReactNode',
      description:
        'Итерация по элементам (render-props: control, index, remove, moveUp/moveDown, canMoveUp/canMoveDown).',
    },
    {
      name: 'FieldArray.AddButton',
      type: 'initialValue?: Partial<T>',
      description: 'Добавляет новый элемент в конец.',
    },
    {
      name: 'FieldArray.RemoveButton',
      type: '—',
      description: 'Удаляет текущий элемент (внутри List).',
    },
    {
      name: 'FieldArray.Empty',
      type: 'children: ReactNode',
      description: 'Показывается, когда массив пуст.',
    },
    {
      name: 'FieldArray.Count',
      type: 'render?: (count) => ReactNode',
      description: 'Отображает число элементов.',
    },
    {
      name: 'useFieldArray(control)',
      type: '→ { items, add, clear, insert, move, swap, length, isEmpty }',
      description: 'Хук для полностью кастомной раскладки; T выводится из control.',
    },
  ],
};
