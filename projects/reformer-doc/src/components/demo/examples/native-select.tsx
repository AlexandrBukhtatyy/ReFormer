import {
  NativeSelect,
  NativeSelectOption,
  NativeSelectWithOptions,
  nativeSelectBasePropsSchema,
  NativeSelectMulti,
} from '@reformer/ui-kit';
import { mergeFieldPropsSchema } from '@reformer/ui-kit/meta';
import { required } from '@reformer/core/validators';
import { controlsFromPropsSchema } from '../controls-from-schema';
import { fieldSnippet, fieldVariant, raw } from '../field-snippet';
import type { ComponentDocConfig } from '../types';

const LOAN = [
  { value: 'consumer', label: 'Потребительский' },
  { value: 'mortgage', label: 'Ипотека' },
  { value: 'auto', label: 'Авто' },
];

const GROUPED = [
  { value: 'msk', label: 'Москва', group: 'Россия' },
  { value: 'spb', label: 'Санкт-Петербург', group: 'Россия' },
  { value: 'minsk', label: 'Минск', group: 'Беларусь' },
];

const PURPOSES = [
  { value: 'repair', label: 'Ремонт' },
  { value: 'car', label: 'Автомобиль' },
  { value: 'education', label: 'Образование' },
  { value: 'travel', label: 'Путешествие' },
  { value: 'other', label: 'Другое' },
];

/** Вне формы: части NativeSelect собираются, как обычные select и option. */
function SizeSelect() {
  return (
    <NativeSelect defaultValue="md" aria-label="Размер">
      <NativeSelectOption value="sm">Малый</NativeSelectOption>
      <NativeSelectOption value="md">Средний</NativeSelectOption>
      <NativeSelectOption value="lg">Большой</NativeSelectOption>
    </NativeSelect>
  );
}

const SIZE_SELECT_CODE = `import { NativeSelect, NativeSelectOption } from '@reformer/ui-kit';

<NativeSelect defaultValue="md" aria-label="Размер">
  <NativeSelectOption value="sm">Малый</NativeSelectOption>
  <NativeSelectOption value="md">Средний</NativeSelectOption>
  <NativeSelectOption value="lg">Большой</NativeSelectOption>
</NativeSelect>`;

// Пропсы панели API — из props-схемы варианта. label и options задаются baseComponentProps.
const API_CONTROLS = controlsFromPropsSchema(mergeFieldPropsSchema(nativeSelectBasePropsSchema), {
  omit: ['label', 'options'],
});

export const nativeSelectDocConfig: ComponentDocConfig = {
  name: 'NativeSelect',
  importFrom: '@reformer/ui-kit',
  description:
    'Системный выпадающий список браузера (<select>) в оформлении кита. В форму — NativeSelectWithOptions (одно значение) и NativeSelectMulti (несколько).',
  variants: [
    fieldVariant({
      id: 'single',
      title: 'Одно значение',
      description:
        'NativeSelectWithOptions строит пункты из options. Значение — string | null; пункт-подсказка placeholder даёт null.',
      field: 'loanType',
      component: NativeSelectWithOptions,
      componentName: 'NativeSelectWithOptions',
      initial: null,
      props: { label: 'Тип кредита', placeholder: 'Выберите тип', options: LOAN },
    }),
    fieldVariant({
      id: 'grouped',
      title: 'Группы пунктов',
      description: 'Пункты с одинаковым group собираются в <optgroup> с заголовком.',
      field: 'city',
      component: NativeSelectWithOptions,
      componentName: 'NativeSelectWithOptions',
      initial: null,
      props: { label: 'Город', placeholder: 'Выберите город', options: GROUPED },
    }),
    fieldVariant({
      id: 'multi',
      title: 'Несколько значений',
      description:
        'NativeSelectMulti — <select multiple>. Значение — string[] | null. Выбор нескольких — Ctrl/Cmd+клик или Shift+стрелки.',
      field: 'purposes',
      component: NativeSelectMulti,
      componentName: 'NativeSelectMulti',
      initial: null,
      props: { label: 'Цели кредита', options: PURPOSES, rows: 5 },
    }),
    {
      id: 'manual',
      title: 'Ручная сборка',
      description:
        'Вне формы NativeSelect и NativeSelectOption — обычные <select> и <option> с оформлением кита.',
      render: SizeSelect,
      code: SIZE_SELECT_CODE,
    },
  ],
  examples: [
    fieldVariant({
      id: 'validation',
      title: 'Обязательный выбор',
      description:
        'Правило required — в схеме валидации. Поле уже тронуто, поэтому замечание видно сразу.',
      field: 'loanType',
      component: NativeSelectWithOptions,
      componentName: 'NativeSelectWithOptions',
      initial: null,
      props: { label: 'Тип кредита', placeholder: 'Выберите тип', options: LOAN, required: true },
      validators: [required({ code: 'loanType.required' })],
      rules: "required({ code: 'loanType.required' })",
      messages: { 'loanType.required': 'Выберите тип кредита' },
      touched: true,
    }),
    fieldVariant({
      id: 'max-items',
      title: 'Не больше двух целей',
      description:
        'maxItems выключает остальные пункты, когда выбрано два. Это подсказка интерфейса; ограничение для формы — правило maxLength(2).',
      field: 'purposes',
      component: NativeSelectMulti,
      componentName: 'NativeSelectMulti',
      initial: ['repair', 'car'],
      showInitial: true,
      props: { label: 'Цели кредита', options: PURPOSES, rows: 5, maxItems: 2 },
    }),
  ],
  api: {
    component: NativeSelectWithOptions,
    initialValue: null,
    baseComponentProps: { label: 'Тип кредита', options: LOAN },
    validators: [required({ code: 'field.required' })],
    messages: { 'field.required': 'Выберите тип' },
    valuePresets: [
      { label: 'Потребительский', value: 'consumer' },
      { label: 'Ипотека', value: 'mortgage' },
      { label: 'Очистить (null)', value: null },
    ],
    controls: API_CONTROLS,
    code: (v) =>
      fieldSnippet({
        field: 'loanType',
        component: 'NativeSelectWithOptions',
        props: { label: 'Тип кредита', options: raw('LOAN_TYPES') },
        controls: API_CONTROLS,
        values: v,
        rules: 'required()',
      }),
  },
};
