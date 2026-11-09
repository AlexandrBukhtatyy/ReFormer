/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from 'react';
import {
  arrayOf,
  createForm,
  createFormFromModel,
  createModel,
  type FormModel,
  type FormSchemaNode,
} from '@reformer/core';
import { useFormBundle, useFormControlValue } from '@reformer/core/react';
import { FormRenderer } from '@reformer/renderer-react';
import { FieldArray, FieldArraySection } from '@reformer/ui-kit/field-array';
import { Box, CheckboxWithLabel, FormField, Input, InputMask } from '@reformer/ui-kit';
import type { ComponentDocConfig } from '../types';

type Phone = { kind: string; number: string };
type PhonesForm = { hasPhones: boolean; phones: Phone[] };

/** Шаблон новой строки: кнопка «Добавить» берёт значение отсюда. */
const blankPhone = (): Phone => ({ kind: '', number: '' });

/** Разметка одной строки массива — узел схемы над под-моделью строки. */
const phoneRow = (row: FormModel<Phone>): FormSchemaNode => ({
  component: Box,
  componentProps: { className: 'grid gap-2' },
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
});

/**
 * Форма с массивом телефонов и флагом «есть телефоны». Узел массива `{ model, item }` строит
 * формы строк; рисует массив здесь FieldArraySection, поэтому `component` у узла не нужен.
 */
function usePhonesForm(initial: Phone[]) {
  const [state] = useState(() => {
    const model = createModel<PhonesForm>({
      hasPhones: true,
      phones: arrayOf(blankPhone, initial),
    });
    const schema: FormSchemaNode = {
      children: [
        {
          model: model.$.hasPhones,
          component: CheckboxWithLabel,
          componentProps: { label: 'У меня есть телефоны' },
        },
        { model: model.$.phones, item: phoneRow },
      ],
    };
    return createFormFromModel<PhonesForm>({ model, schema }) as any;
  });
  return state;
}

/** Строка массива для FieldArraySection: получает форму строки. */
const PhoneItem = ({ control }: { control: any }) => (
  <div className="grid gap-2">
    <FormField control={control.kind} />
    <FormField control={control.number} />
  </div>
);

const PHONE_ITEM_CODE = `const PhoneItem = ({ control }: { control: FormGroup<Phone> }) => (
  <div className="grid gap-2">
    <FormField control={control.kind} />
    <FormField control={control.number} />
  </div>
);`;

const MODEL_CODE = `const blankPhone = (): Phone => ({ kind: '', number: '' });
const model = createModel<PhonesForm>({
  hasPhones: true,
  phones: arrayOf(blankPhone, [{ kind: 'Мобильный', number: '' }]),
});`;

function SectionTitled() {
  const form = usePhonesForm([{ kind: 'Мобильный', number: '' }]);
  return (
    <div style={{ maxWidth: 480, width: '100%' }}>
      <FieldArraySection
        control={form.phones}
        itemComponent={PhoneItem}
        title="Телефоны"
        itemLabel="Телефон"
        addButtonLabel="+ Добавить телефон"
        emptyMessage="Телефоны не добавлены"
        emptyMessageHint="Нажмите «Добавить телефон»"
      />
    </div>
  );
}

/** Тот же массив в схеме формы: узел с component: FieldArray, строки отдаёт рендерер. */
function SchemaFieldArray() {
  const bundle = useFormBundle(() =>
    createForm<{ phones: Phone[] }>({
      model: createModel<{ phones: Phone[] }>({
        phones: arrayOf(blankPhone, [{ kind: 'Мобильный', number: '' }]),
      }),
      schema: (model) => ({
        children: [
          {
            model: model.$.phones,
            component: FieldArray,
            componentProps: {
              title: 'Телефоны',
              itemLabel: 'Телефон',
              addButtonLabel: '+ Добавить телефон',
            },
            item: phoneRow,
          },
        ],
      }),
    })
  );
  return (
    <div style={{ maxWidth: 480, width: '100%' }}>
      <FormRenderer form={bundle} settings={{ fieldWrapper: FormField }} />
    </div>
  );
}

function SectionFooter() {
  const form = usePhonesForm([]);
  return (
    <div style={{ maxWidth: 480, width: '100%' }}>
      <FieldArraySection
        control={form.phones}
        itemComponent={PhoneItem}
        itemLabel="Телефон"
        addButtonLabel="+ Ещё телефон"
        emptyMessage="Список пуст"
        showRemoveOnSingle
      />
    </div>
  );
}

function SectionHasItems() {
  const form = usePhonesForm([{ kind: 'Мобильный', number: '' }]);
  const hasPhones = useFormControlValue(form.hasPhones) as boolean;
  return (
    <div style={{ maxWidth: 480, width: '100%', display: 'grid', gap: 12 }}>
      <FormField control={form.hasPhones} />
      <FieldArraySection
        control={form.phones}
        itemComponent={PhoneItem}
        title="Телефоны"
        hasItems={hasPhones}
      />
    </div>
  );
}

function SectionReorderMax() {
  const form = usePhonesForm([
    { kind: 'Мобильный', number: '' },
    { kind: 'Рабочий', number: '' },
  ]);
  return (
    <div style={{ maxWidth: 480, width: '100%' }}>
      <FieldArraySection
        control={form.phones}
        itemComponent={PhoneItem}
        title="Телефоны (не больше 3)"
        reorderable
        maxItems={3}
      />
    </div>
  );
}

export const uiKitFieldArrayDocConfig: ComponentDocConfig = {
  name: 'FieldArraySection',
  importFrom: '@reformer/ui-kit/field-array',
  description:
    'Оформленная секция массива под-форм: заголовок, кнопка «Добавить», карточка на строку, удаление, перестановка и пустое состояние.',
  variants: [
    {
      id: 'titled',
      title: 'Секция в разметке',
      description:
        'FieldArraySection с title и itemLabel: кнопка «Добавить» в шапке, карточка с меткой на каждую строку. Новая строка берётся из шаблона arrayOf(blankPhone).',
      render: SectionTitled,
      code: `import { arrayOf, createModel } from '@reformer/core';
import { FormField } from '@reformer/ui-kit';
import { FieldArraySection } from '@reformer/ui-kit/field-array';

${MODEL_CODE}
// в схеме сборки: { model: model.$.phones, item: phoneRow }

${PHONE_ITEM_CODE}

<FieldArraySection
  control={form.phones}
  itemComponent={PhoneItem}
  title="Телефоны"
  itemLabel="Телефон"
  addButtonLabel="+ Добавить телефон"
  emptyMessage="Телефоны не добавлены"
  emptyMessageHint="Нажмите «Добавить телефон»"
/>`,
    },
    {
      id: 'schema',
      title: 'Массив в схеме формы',
      description:
        'Узел { model, component: FieldArray, item }: разметку строки строит item, строки и кнопки подключает рендерер.',
      render: SchemaFieldArray,
      code: `import { arrayOf, createForm, createModel, type FormModel } from '@reformer/core';
import { useFormBundle } from '@reformer/core/react';
import { FormRenderer } from '@reformer/renderer-react';
import { Box, FormField, Input, InputMask } from '@reformer/ui-kit';
import { FieldArray } from '@reformer/ui-kit/field-array';

const blankPhone = (): Phone => ({ kind: '', number: '' });

const phoneRow = (row: FormModel<Phone>) => ({
  component: Box,
  componentProps: { className: 'grid gap-2' },
  children: [
    { model: row.$.kind, component: Input, componentProps: { label: 'Тип', placeholder: 'Мобильный / Рабочий' } },
    { model: row.$.number, component: InputMask, componentProps: { label: 'Номер', mask: '+7 (999) 999-99-99' } },
  ],
});

const bundle = useFormBundle(() =>
  createForm<{ phones: Phone[] }>({
    model: createModel({ phones: arrayOf(blankPhone, [{ kind: 'Мобильный', number: '' }]) }),
    schema: (model) => ({
      children: [
        {
          model: model.$.phones,
          component: FieldArray,
          componentProps: { title: 'Телефоны', itemLabel: 'Телефон', addButtonLabel: '+ Добавить телефон' },
          item: phoneRow,
        },
      ],
    }),
  })
);

<FormRenderer form={bundle} settings={{ fieldWrapper: FormField }} />`,
    },
  ],
  examples: [
    {
      id: 'footer',
      title: 'Без заголовка',
      description:
        'Без title кнопка «Добавить» стоит ссылкой под списком. itemLabel даёт карточкам метку в шапке рядом с кнопкой «Удалить»; showRemoveOnSingle показывает её и у единственной строки.',
      render: SectionFooter,
      code: `<FieldArraySection
  control={form.phones}
  itemComponent={PhoneItem}
  itemLabel="Телефон"
  addButtonLabel="+ Ещё телефон"
  emptyMessage="Список пуст"
  showRemoveOnSingle
/>`,
    },
    {
      id: 'has-items',
      title: 'Секция по флажку',
      description:
        'Сценарий «У меня есть …»: флажок управляет видимостью секции. hasItems={false} скрывает её целиком, строки в модели при этом остаются.',
      render: SectionHasItems,
      code: `const hasPhones = useFormControlValue(form.hasPhones);

<FormField control={form.hasPhones} />
<FieldArraySection
  control={form.phones}
  itemComponent={PhoneItem}
  title="Телефоны"
  hasItems={hasPhones}
/>`,
    },
    {
      id: 'reorder-max',
      title: 'Перестановка и предел',
      description:
        'reorderable добавляет кнопки ↑/↓. maxItems={3}: добавьте третью строку — кнопка «Добавить» исчезнет, удалите строку — вернётся. Число строк для данных проверяет правило maxLength(3) на массив.',
      render: SectionReorderMax,
      code: `<FieldArraySection
  control={form.phones}
  itemComponent={PhoneItem}
  title="Телефоны (не больше 3)"
  reorderable
  maxItems={3}
/>

// предел для данных — правило на массив в схеме валидации:
validate(model.$.phones, [maxLength(3)]);`,
    },
  ],
  props: [
    {
      name: 'control',
      type: 'FormArray<T>',
      description: 'Нода массива (form.phones). Обязателен. Только у FieldArraySection.',
    },
    {
      name: 'itemComponent',
      type: 'ComponentType<{ control: FormGroup<T> }>',
      description:
        'Компонент одной строки, получает форму строки. Обязателен. Только у FieldArraySection; у FieldArray строку строит item узла схемы.',
    },
    {
      name: 'title',
      type: 'string',
      description:
        'Заголовок секции (h3). С ним кнопка «Добавить» стоит в шапке, без него — под списком.',
    },
    {
      name: 'itemLabel',
      type: 'string | ((control, index) => string)',
      description:
        'Метка карточки: строка-префикс («Телефон #1») или функция. Входит в имя кнопок строки: «Удалить: Телефон #2». Без title и itemLabel в шапке нет метки, но кнопки удаления и перестановки остаются.',
    },
    {
      name: 'addButtonLabel',
      type: 'string',
      default: 'kit.fieldArray.add',
      description: 'Текст кнопки «Добавить». По умолчанию — из словаря кита.',
    },
    {
      name: 'removeButtonLabel',
      type: 'string',
      default: 'kit.fieldArray.remove',
      description:
        'Текст кнопки «Удалить». По умолчанию — из словаря кита. Имя для скринридера — этот текст и метка строки: «Удалить: Телефон #2».',
    },
    {
      name: 'emptyMessage',
      type: 'string',
      description: 'Текст пустого состояния. Не задан — пустой массив ничего не показывает.',
    },
    {
      name: 'emptyMessageHint',
      type: 'string',
      description: 'Вторая строка пустого состояния, мельче.',
    },
    {
      name: 'maxItems',
      type: 'number',
      description:
        'Предел строк: на пределе кнопка «Добавить» скрыта. Данные не проверяет — для этого правило maxLength(n) на массив.',
    },
    {
      name: 'reorderable',
      type: 'boolean',
      default: 'false',
      description: 'Кнопки ↑/↓ в шапке карточки.',
    },
    {
      name: 'showRemoveOnSingle',
      type: 'boolean',
      default: 'false',
      description: 'Показывать «Удалить» и у единственной строки.',
    },
    {
      name: 'hasItems',
      type: 'boolean',
      description: 'false — секция скрыта целиком. Только у FieldArraySection.',
    },
    {
      name: 'initialValue',
      type: 'Partial<T>',
      description:
        'Запасной шаблон новой строки — простые значения по форме строки. Нужен, только если у массива в модели нет шаблона arrayOf(blank). Только у FieldArraySection.',
    },
    {
      name: 'className',
      type: 'string',
      default: "'space-y-3 mt-2'",
      description: 'Класс секции.',
    },
    {
      name: 'cardClassName',
      type: 'string',
      default: "'mb-4 p-4 bg-card text-card-foreground rounded border'",
      description: 'Класс карточки строки. Заменяет классы по умолчанию целиком.',
    },
  ],
};
