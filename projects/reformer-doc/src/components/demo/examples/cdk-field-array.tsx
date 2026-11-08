import type { FC } from 'react';
import {
  arrayOf,
  createForm,
  type FormGroup,
  type FormModel,
  type FormSchemaNode,
} from '@reformer/core';
import { useFormBundle } from '@reformer/core/react';
import { defineValidation, validate } from '@reformer/core/validation';
import { defineIssueMessages } from '@reformer/core/i18n';
import { minLength } from '@reformer/core/validators';
import { ValidationMessagesProvider } from '@reformer/cdk';
import { FieldArray, useFieldArray } from '@reformer/cdk/field-array';
import { FieldArraySection } from '@reformer/ui-kit/field-array';
import { FormField, Input, InputMask, Button } from '@reformer/ui-kit';
import type { ComponentDocConfig } from '../types';

type Phone = { kind: string; number: string };
type PhonesForm = { phones: Phone[] };

/** Предел строк в демо «Предел числа строк» и у FieldArraySection. */
const MAX_PHONES = 3;

const CARD: React.CSSProperties = {
  border: '1px solid var(--ifm-toc-border-color)',
  borderRadius: 8,
  padding: 12,
  marginBottom: 10,
};

const HEADER: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 8,
};

const MUTED: React.CSSProperties = { color: 'var(--ifm-color-emphasis-600)', fontSize: 13 };
const WRAP: React.CSSProperties = { maxWidth: 480, width: '100%' };

/** Шаблон новой строки — в модели: кнопке «Добавить» значение передавать не нужно. */
const blankPhone = (): Phone => ({ kind: '', number: '' });

/** Схема: узел массива `{ model, item }`, разметку строки строит `item` из под-модели строки. */
const phonesSchema = (model: FormModel<PhonesForm>): FormSchemaNode => ({
  children: [
    {
      model: model.$.phones,
      item: (row: FormModel<Phone>) => ({
        children: [
          {
            model: row.$.kind,
            component: Input,
            componentProps: { label: 'Тип', placeholder: 'Мобильный / Рабочий' },
          },
          {
            model: row.$.number,
            component: InputMask,
            componentProps: { label: 'Номер', mask: '+7 (999) 999-99-99' },
          },
        ],
      }),
    },
  ],
});

/** Правило уровня массива: хотя бы одна строка. Код замечания → текст из словаря формы. */
const phonesRules = defineValidation<PhonesForm>(({ model }) => {
  validate(model.$.phones, [minLength(1, { code: 'phones.required' })]);
});

const PHONES_MESSAGES = defineIssueMessages({
  'phones.required': 'Добавьте хотя бы один телефон',
});

function usePhones(initial: Phone[] = [{ kind: 'Мобильный', number: '' }]) {
  return useFormBundle(() =>
    createForm<PhonesForm>({
      initial: { phones: arrayOf(blankPhone, initial) },
      schema: phonesSchema,
      // Живая проверка: замечание массива появляется, как только строк не осталось.
      validation: { rules: phonesRules, strategy: 'change' },
    })
  );
}

function HeadlessDemo() {
  const { form } = usePhones();
  return (
    <div style={WRAP}>
      <FieldArray.Root control={form.phones}>
        <p style={MUTED}>
          Телефонов: <FieldArray.Count />
        </p>
        <FieldArray.Empty>
          <p style={MUTED}>Телефоны не добавлены</p>
        </FieldArray.Empty>
        <FieldArray.List<Phone>>
          {({ control }) => (
            <div style={CARD}>
              <div style={HEADER}>
                <strong>
                  Телефон #<FieldArray.ItemIndex />
                </strong>
                <FieldArray.RemoveButton asChild>
                  <Button variant="ghost" size="sm">
                    Удалить
                  </Button>
                </FieldArray.RemoveButton>
              </div>
              <div style={{ display: 'grid', gap: 8 }}>
                <FormField control={control.kind} />
                <FormField control={control.number} />
              </div>
            </div>
          )}
        </FieldArray.List>
        <FieldArray.AddButton asChild>
          <Button variant="outline" size="sm">
            + Добавить телефон
          </Button>
        </FieldArray.AddButton>
      </FieldArray.Root>
    </div>
  );
}

const PhoneItem: FC<{ control: FormGroup<Phone> }> = ({ control }) => (
  <div style={{ display: 'grid', gap: 8 }}>
    <FormField control={control.kind} />
    <FormField control={control.number} />
  </div>
);

function SectionDemo() {
  const { form } = usePhones();
  return (
    <div style={WRAP}>
      <FieldArraySection
        control={form.phones}
        itemComponent={PhoneItem}
        title="Телефоны"
        maxItems={MAX_PHONES}
      />
    </div>
  );
}

function MaxItemsDemo() {
  const { form } = usePhones();
  return (
    <div style={WRAP}>
      <FieldArray.Root control={form.phones}>
        {({ items, length }) => (
          <>
            {items.map(({ control, id, remove }) => (
              <div key={id} style={{ ...CARD, display: 'flex', alignItems: 'flex-end', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <FormField control={control.number} />
                </div>
                <Button variant="ghost" size="sm" onClick={remove}>
                  ×
                </Button>
              </div>
            ))}
            {length < MAX_PHONES ? (
              <FieldArray.AddButton asChild>
                <Button variant="outline" size="sm">
                  + Добавить
                </Button>
              </FieldArray.AddButton>
            ) : (
              <p style={MUTED}>Не больше {MAX_PHONES} телефонов</p>
            )}
          </>
        )}
      </FieldArray.Root>
    </div>
  );
}

function ArrayErrorDemo() {
  const { form } = usePhones();
  return (
    <ValidationMessagesProvider messages={PHONES_MESSAGES}>
      <div style={WRAP}>
        <FieldArray.Root control={form.phones}>
          <FieldArray.List<Phone>>
            {({ control, remove }) => (
              <div style={{ ...CARD, display: 'flex', alignItems: 'flex-end', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <FormField control={control.number} />
                </div>
                <Button variant="ghost" size="sm" onClick={remove}>
                  ×
                </Button>
              </div>
            )}
          </FieldArray.List>
          <FieldArray.Error
            style={{ color: 'var(--ifm-color-danger)', fontSize: 13, margin: '0 0 8px' }}
          />
          <FieldArray.AddButton asChild>
            <Button variant="outline" size="sm">
              + Добавить
            </Button>
          </FieldArray.AddButton>
        </FieldArray.Root>
      </div>
    </ValidationMessagesProvider>
  );
}

function ReorderDemo() {
  const { form } = usePhones([
    { kind: 'Мобильный', number: '+7 (900) 000-00-01' },
    { kind: 'Рабочий', number: '+7 (900) 000-00-02' },
  ]);
  return (
    <div style={WRAP}>
      <FieldArray.Root control={form.phones}>
        <FieldArray.List<Phone>>
          {({ control, index, remove, moveUp, moveDown, canMoveUp, canMoveDown }) => (
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
              <span style={{ ...MUTED, alignSelf: 'center' }}>#{index + 1}</span>
            </div>
          )}
        </FieldArray.List>
      </FieldArray.Root>
    </div>
  );
}

function HookDemo() {
  const { form } = usePhones();
  const { items, add, length } = useFieldArray(form.phones);
  return (
    <div style={WRAP}>
      <p style={MUTED}>Всего элементов: {length}</p>
      {items.map(({ control, id, remove }) => (
        <div key={id} style={{ ...CARD, display: 'flex', alignItems: 'flex-end', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <FormField control={control.number} />
          </div>
          <Button variant="ghost" size="sm" onClick={remove}>
            ×
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={() => add()}>
        + Добавить
      </Button>
    </div>
  );
}

export const fieldArrayDocConfig: ComponentDocConfig = {
  name: 'FieldArray',
  importFrom: '@reformer/cdk/field-array',
  description:
    'Headless compound-компонент для массива строк формы: добавление, удаление и перестановка через render-props. Разметку и стили пишете вы.',
  variants: [
    {
      id: 'headless',
      title: 'Headless: части компонента',
      description:
        'Root, Count, Empty, List, ItemIndex, RemoveButton и AddButton. Новая строка берётся из шаблона массива в модели — arrayOf(blankPhone).',
      render: HeadlessDemo,
      code: `const blankPhone = (): Phone => ({ kind: '', number: '' });
// initial: { phones: arrayOf(blankPhone, [{ kind: 'Мобильный', number: '' }]) }

<FieldArray.Root control={form.phones}>
  <p>Телефонов: <FieldArray.Count /></p>
  <FieldArray.Empty>
    <p>Телефоны не добавлены</p>
  </FieldArray.Empty>
  <FieldArray.List<Phone>>
    {({ control }) => (
      <div>
        <strong>Телефон #<FieldArray.ItemIndex /></strong>
        <FieldArray.RemoveButton>Удалить</FieldArray.RemoveButton>
        <FormField control={control.kind} />
        <FormField control={control.number} />
      </div>
    )}
  </FieldArray.List>
  <FieldArray.AddButton>+ Добавить телефон</FieldArray.AddButton>
</FieldArray.Root>`,
    },
    {
      id: 'styled',
      title: 'Готовый вид: FieldArraySection из ui-kit',
      description:
        'Секция массива поверх cdk. С maxItems={3} кнопка «Добавить» скрывается, когда строк три.',
      render: SectionDemo,
      code: `import { FieldArraySection } from '@reformer/ui-kit/field-array';

const PhoneItem: FC<{ control: FormGroup<Phone> }> = ({ control }) => (
  <>
    <FormField control={control.kind} />
    <FormField control={control.number} />
  </>
);

<FieldArraySection
  control={form.phones}
  itemComponent={PhoneItem}
  title="Телефоны"
  maxItems={3}
/>`,
    },
  ],
  examples: [
    {
      id: 'max-items',
      title: 'Предел числа строк',
      description:
        'У cdk-компонента нет пропа maxItems: предел в разметке задаёте вы. Функция-ребёнок Root получает length — на пределе вместо кнопки выводится подсказка. Сами данные ограничивает правило maxLength(n) на массиве.',
      render: MaxItemsDemo,
      code: `const MAX_PHONES = 3;

<FieldArray.Root control={form.phones}>
  {({ items, length }) => (
    <>
      {items.map(({ control, id, remove }) => (
        <div key={id}>
          <FormField control={control.number} />
          <button onClick={remove}>×</button>
        </div>
      ))}
      {length < MAX_PHONES ? (
        <FieldArray.AddButton>+ Добавить</FieldArray.AddButton>
      ) : (
        <p>Не больше {MAX_PHONES} телефонов</p>
      )}
    </>
  )}
</FieldArray.Root>`,
    },
    {
      id: 'array-error',
      title: 'Замечание массива',
      description:
        'FieldArray.Error показывает только замечания самого массива (minLength, maxLength), без замечаний полей строк. Удалите все строки — появится текст из словаря формы.',
      render: ArrayErrorDemo,
      code: `const phonesRules = defineValidation<PhonesForm>(({ model }) => {
  validate(model.$.phones, [minLength(1, { code: 'phones.required' })]);
});
const messages = defineIssueMessages({ 'phones.required': 'Добавьте хотя бы один телефон' });

// createForm({ …, validation: { rules: phonesRules, strategy: 'change' } })

<ValidationMessagesProvider messages={messages}>
  <FieldArray.Root control={form.phones}>
    <FieldArray.List<Phone>>
      {({ control, remove }) => (
        <div>
          <FormField control={control.number} />
          <button onClick={remove}>×</button>
        </div>
      )}
    </FieldArray.List>
    <FieldArray.Error />
    <FieldArray.AddButton>+ Добавить</FieldArray.AddButton>
  </FieldArray.Root>
</ValidationMessagesProvider>`,
    },
    {
      id: 'reorder',
      title: 'Перестановка строк',
      description:
        'moveUp / moveDown переставляют строки, не пересоздавая их ноды: значения, касание и замечания едут вместе со строкой.',
      render: ReorderDemo,
      code: `<FieldArray.List<Phone>>
  {({ control, index, remove, moveUp, moveDown, canMoveUp, canMoveDown }) => (
    <div>
      <FormField control={control.number} />
      <button onClick={moveUp} disabled={!canMoveUp}>↑</button>
      <button onClick={moveDown} disabled={!canMoveDown}>↓</button>
      <button onClick={remove}>×</button>
      <span>#{index + 1}</span>
    </div>
  )}
</FieldArray.List>`,
    },
    {
      id: 'hook',
      title: 'Хук useFieldArray',
      description:
        'Та же логика без compound-компонентов. Тип строки выводится из control, ключ строки — id.',
      render: HookDemo,
      code: `import { useFieldArray } from '@reformer/cdk/field-array';

const { items, add, length } = useFieldArray(form.phones);

<>
  <p>Всего элементов: {length}</p>
  {items.map(({ control, id, remove }) => (
    <div key={id}>
      <FormField control={control.number} />
      <button onClick={remove}>×</button>
    </div>
  ))}
  <button onClick={() => add()}>+ Добавить</button>
</>`,
    },
  ],
  props: [
    {
      name: 'FieldArray.Root',
      type: 'control: FormArray<T>; children: ReactNode | (state) => ReactNode; ref?: FieldArrayHandle<T>',
      description:
        'Провайдер контекста массива. Функция-ребёнок получает состояние массива (items, length, add, ownIssues…) со строками FormGroup<T> — тип выводится из control. ref — add, insert, removeAt, move, swap, clear, at для кнопок снаружи.',
    },
    {
      name: 'FieldArray.List',
      type: 'children: (item) => ReactNode; className?; as?',
      description:
        'Перебирает строки. item: control, index, id (ключ строки), remove, moveUp, moveDown, canMoveUp, canMoveDown. Без className обёртки нет. Тип строки — явным аргументом: FieldArray.List<Phone>.',
    },
    {
      name: 'FieldArray.AddButton',
      type: 'initialValue?: Partial<T>; asChild?; disabled?',
      description:
        'Кнопка type="button": добавляет строку в конец. Значение — из шаблона arrayOf(blank) модели; initialValue накладывается поверх шаблона. Отключается, когда массив отключён. Предела числа строк у неё нет.',
    },
    {
      name: 'FieldArray.RemoveButton',
      type: 'asChild?; disabled?',
      description: 'Удаляет текущую строку. Только внутри List.',
    },
    {
      name: 'FieldArray.Empty',
      type: 'children: ReactNode',
      description: 'Показывается, когда строк нет.',
    },
    {
      name: 'FieldArray.Count / ItemIndex',
      type: 'render?: (n) => ReactNode',
      description: 'Число строк; номер текущей строки с единицы (ItemIndex — только внутри List).',
    },
    {
      name: 'FieldArray.Error',
      type: 'multi?; render?; children?; asChild?',
      description:
        'Замечания уровня массива (ownIssues, например minLength), без замечаний строк. Элемент с role="alert"; по умолчанию — первая ошибка, без ошибок — первое предупреждение.',
    },
    {
      name: 'useFieldArray(control)',
      type: '→ { items, length, isEmpty, add, insert, removeAt, move, swap, clear, at, issues, ownIssues, valid, invalid }',
      description: 'Вся логика без разметки; T выводится из control.',
    },
  ],
};
