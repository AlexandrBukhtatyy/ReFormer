/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo } from 'react';
import { createModel, createForm, useFormControlValue, type FormModel } from '@reformer/core';
import { FormArraySection } from '@reformer/ui-kit/form-array';
import { FormField, InputField, InputMaskField, CheckboxField } from '@reformer/ui-kit';
import type { ComponentDocConfig } from '../types';

type Phone = { kind: string; number: string };

/** M1-форма с массивом телефонов + флаг «есть телефоны» (schema-нода `{ array, item }`). */
function usePhonesForm(initial: Phone[] = [{ kind: 'Мобильный', number: '' }]) {
  return useMemo(() => {
    const model = createModel<{ hasPhones: boolean; phones: Phone[] }>({
      hasPhones: true,
      phones: initial,
    });
    const phoneItem = (item: FormModel<Phone>) => ({
      kind: {
        value: item.$.kind,
        component: InputField,
        componentProps: { label: 'Тип', placeholder: 'Мобильный / Рабочий' },
      },
      number: {
        value: item.$.number,
        component: InputMaskField,
        componentProps: { label: 'Номер', mask: '+7 (999) 999-99-99' },
      },
    });
    const schema = {
      hasPhones: {
        value: model.$.hasPhones,
        component: CheckboxField,
        componentProps: { label: 'У меня есть телефоны' },
      },
      phones: { array: model.phones, item: phoneItem },
    } as any;
    const form = createForm<{ hasPhones: boolean; phones: Phone[] }>({ model, schema });
    return { model, form: form as any };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

const PhoneItem = ({ control }: { control: any }) => (
  <div style={{ display: 'grid', gap: 8 }}>
    <FormField control={control.kind} />
    <FormField control={control.number} />
  </div>
);

function SectionTitled() {
  const { form } = usePhonesForm();
  return (
    <div style={{ maxWidth: 480, width: '100%' }}>
      <FormArraySection
        control={form.phones}
        itemComponent={PhoneItem}
        title="Телефоны"
        itemLabel="Телефон"
        addButtonLabel="+ Добавить телефон"
        emptyMessage="Телефоны не добавлены"
        emptyMessageHint="Нажмите «Добавить телефон»"
        initialValue={{ kind: '', number: '' }}
      />
    </div>
  );
}

function SectionFooter() {
  const { form } = usePhonesForm([]);
  return (
    <div style={{ maxWidth: 480, width: '100%' }}>
      <FormArraySection
        control={form.phones}
        itemComponent={PhoneItem}
        itemLabel="Телефон"
        addButtonLabel="+ Ещё телефон"
        emptyMessage="Список пуст"
        showRemoveOnSingle
        initialValue={{ kind: '', number: '' }}
      />
    </div>
  );
}

function SectionHasItems() {
  const { form } = usePhonesForm();
  const hasPhones = useFormControlValue(form.hasPhones) as boolean;
  return (
    <div style={{ maxWidth: 480, width: '100%', display: 'grid', gap: 12 }}>
      <FormField control={form.hasPhones} />
      <FormArraySection
        control={form.phones}
        itemComponent={PhoneItem}
        title="Телефоны"
        hasItems={hasPhones}
        initialValue={{ kind: '', number: '' }}
      />
    </div>
  );
}

function SectionReorderMax() {
  const { form } = usePhonesForm([
    { kind: 'Мобильный', number: '' },
    { kind: 'Рабочий', number: '' },
  ]);
  return (
    <div style={{ maxWidth: 480, width: '100%' }}>
      <FormArraySection
        control={form.phones}
        itemComponent={PhoneItem}
        title="Телефоны (макс. 3)"
        reorderable
        maxItems={3}
        initialValue={{ kind: '', number: '' }}
      />
    </div>
  );
}

export const uiKitFormArrayDocConfig: ComponentDocConfig = {
  name: 'FormArraySection',
  importFrom: '@reformer/ui-kit/form-array',
  description:
    'Готовая UI-секция динамического массива форм — стилизованная обёртка поверх headless @reformer/cdk/form-array: заголовок, кнопка «Добавить», карточки с меткой, удаление/перестановка и пустое состояние из коробки. itemComponent — единственный контракт рендера элемента: ComponentType<{ control: FormProxy<T> }>.',
  variants: [
    {
      id: 'titled',
      title: 'Секция с заголовком',
      description:
        'title + itemLabel + addButtonLabel: кнопка добавления в шапке, карточка на каждый элемент, empty-state с подсказкой.',
      render: SectionTitled,
      code: `import { FormArraySection } from '@reformer/ui-kit/form-array';

const PhoneItem: FC<{ control: FormProxy<Phone> }> = ({ control }) => (
  <>
    <FormField control={control.kind} />
    <FormField control={control.number} />
  </>
);

<FormArraySection
  control={form.phones}
  itemComponent={PhoneItem}
  title="Телефоны"
  itemLabel="Телефон"
  addButtonLabel="+ Добавить телефон"
  emptyMessage="Телефоны не добавлены"
  emptyMessageHint="Нажмите «Добавить телефон»"
  initialValue={{ kind: '', number: '' }}
/>`,
    },
    {
      id: 'footer',
      title: 'Без заголовка (кнопка-футер)',
      description:
        'Без title кнопка добавления рендерится футером-ссылкой под списком. showRemoveOnSingle показывает «Удалить» даже у единственного элемента.',
      render: SectionFooter,
      code: `<FormArraySection
  control={form.phones}
  itemComponent={PhoneItem}
  itemLabel="Телефон"
  addButtonLabel="+ Ещё телефон"
  emptyMessage="Список пуст"
  showRemoveOnSingle
  initialValue={{ kind: '', number: '' }}
/>`,
    },
  ],
  examples: [
    {
      id: 'has-items',
      title: 'Переключатель hasItems',
      description:
        'Типовой сценарий «У меня есть …»: чекбокс управляет видимостью секции целиком (hasItems={false} — секция скрыта).',
      render: SectionHasItems,
      code: `const hasPhones = useFormControlValue(form.hasPhones) as boolean;

<FormField control={form.hasPhones} />
<FormArraySection
  control={form.phones}
  itemComponent={PhoneItem}
  title="Телефоны"
  hasItems={hasPhones}
  initialValue={{ kind: '', number: '' }}
/>`,
    },
    {
      id: 'reorder-max',
      title: 'Перестановка и лимит',
      description:
        'reorderable добавляет кнопки ↑/↓ каждому элементу; maxItems отключает «Добавить» при достижении лимита.',
      render: SectionReorderMax,
      code: `<FormArraySection
  control={form.phones}
  itemComponent={PhoneItem}
  title="Телефоны (макс. 3)"
  reorderable
  maxItems={3}
  initialValue={{ kind: '', number: '' }}
/>`,
    },
  ],
  props: [
    {
      name: 'control',
      type: 'FormArrayProxy<T> | ArrayNode<T>',
      description: 'Массив формы (form.<array>). Обязателен.',
    },
    {
      name: 'itemComponent',
      type: 'ComponentType<{ control: FormProxy<T> }>',
      description: 'Рендер одного элемента — получает под-форму элемента.',
    },
    {
      name: 'title / itemLabel',
      type: 'string | ((control, index) => string)',
      description: 'Заголовок секции (h3) и метка карточки элемента («Телефон #1»).',
    },
    {
      name: 'addButtonLabel / removeButtonLabel',
      type: 'string',
      default: "'+ Добавить' / 'Удалить'",
      description: 'Тексты кнопок добавления и удаления.',
    },
    {
      name: 'emptyMessage / emptyMessageHint',
      type: 'string',
      description: 'Сообщение и подсказка пустого состояния.',
    },
    {
      name: 'hasItems',
      type: 'boolean',
      description: 'false — секция полностью скрыта (сценарий toggle-чекбокса).',
    },
    {
      name: 'initialValue',
      type: 'Partial<T>',
      description: 'Plain-значения нового элемента (НЕ FieldConfig).',
    },
    {
      name: 'reorderable / maxItems / showRemoveOnSingle',
      type: 'boolean / number / boolean',
      default: 'false / — / false',
      description: 'Кнопки ↑/↓, лимит элементов, «Удалить» у единственного элемента.',
    },
    {
      name: 'className / cardClassName',
      type: 'string',
      description: 'Классы секции и card-обёртки элемента.',
    },
  ],
};
