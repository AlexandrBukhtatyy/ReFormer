import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ComponentType } from 'react';

import { CalendarField } from '@/components/calendar';
import { CheckboxField } from '@/components/checkbox';
import {
  ComboboxField,
  ComboboxMultiField,
  ComboboxTreeField,
  ComboboxTreeMultiField,
} from '@/components/combobox';
import { DatePickerField } from '@/components/date-picker';
import {
  FileUploadField,
  FileUploadAvatarField,
  FileUploadDropzoneField,
  FileUploadInputField,
} from '@/components/file-upload';
import { InputField } from '@/components/input';
import { InputMaskField } from '@/components/input-mask';
import { InputOTPField } from '@/components/input-otp';
import { InputPasswordField } from '@/components/input-password';
import { NativeSelectField, NativeSelectMultiField } from '@/components/native-select';
import { RadioGroupField } from '@/components/radio-group';
import { SelectField, SelectMultiField } from '@/components/select';
import { SliderField } from '@/components/slider';
import { SwitchField } from '@/components/switch';
import { TextareaField } from '@/components/textarea';
import { ToggleField } from '@/components/toggle';
import { ToggleGroupField, ToggleGroupMultiField } from '@/components/toggle-group';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Страж охвата: КАЖДОЕ поле кита обязано уметь проп `tooltip`. Он объявлен в общей схеме
 * (`field-common.props.ts`), поэтому поле без поддержки молча принимало бы проп и ничего не рисовало.
 * Список сверяется с каталогом: новое поле без строки здесь роняет тест.
 */

const OPTIONS = [
  { value: 'a', label: 'Альфа' },
  { value: 'b', label: 'Бета' },
];
const TREE = [{ id: 'a', label: 'Альфа' }];

type Row = [name: string, Field: ComponentType<any>, props: Record<string, unknown>];

/** Ключ — регистр-имя из каталога (`x-registryName`). */
const FIELDS: Row[] = [
  ['Calendar', CalendarField, {}],
  ['Checkbox', CheckboxField, { label: 'Согласен' }],
  ['Combobox', ComboboxField, { options: OPTIONS }],
  ['ComboboxMulti', ComboboxMultiField, { options: OPTIONS }],
  ['ComboboxTree', ComboboxTreeField, { nodes: TREE }],
  ['ComboboxTreeMulti', ComboboxTreeMultiField, { nodes: TREE }],
  ['DatePicker', DatePickerField, {}],
  ['FileUpload', FileUploadField, {}],
  ['FileUploadAvatar', FileUploadAvatarField, {}],
  ['Input', InputField, {}],
  ['InputMask', InputMaskField, { mask: '99-99' }],
  ['InputOTP', InputOTPField, {}],
  ['InputPassword', InputPasswordField, {}],
  ['NativeSelect', NativeSelectField, { options: OPTIONS }],
  ['NativeSelectMulti', NativeSelectMultiField, { options: OPTIONS }],
  ['RadioGroup', RadioGroupField, { options: OPTIONS }],
  ['Select', SelectField, { options: OPTIONS }],
  ['SelectMulti', SelectMultiField, { options: OPTIONS }],
  ['Slider', SliderField, {}],
  ['Switch', SwitchField, { label: 'Включить' }],
  ['Textarea', TextareaField, {}],
  ['Toggle', ToggleField, { children: 'B' }],
  ['ToggleGroup', ToggleGroupField, { options: OPTIONS }],
  ['ToggleGroupMulti', ToggleGroupMultiField, { options: OPTIONS }],
];

/** Варианты вне каталожных имён: у них своя разметка и своя поддержка подсказки. */
const VARIANTS: Row[] = [
  ['Input type=number', InputField, { type: 'number' }],
  ['FileUpload dropzone', FileUploadDropzoneField, {}],
  ['FileUpload input', FileUploadInputField, {}],
];

const TEXT = 'Текст подсказки поля';

const catalog = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../component-catalog.json', import.meta.url)), 'utf8')
) as
  | { components?: Array<{ name: string; role?: string }> }
  | Array<{ name: string; role?: string }>;
const records = Array.isArray(catalog) ? catalog : (catalog.components ?? []);
const catalogFields = records
  .filter((r) => r.role === 'field')
  .map((r) => r.name)
  .sort();

describe('tooltip — охват всех полей кита', () => {
  it('список полей теста совпадает с каталогом', () => {
    expect(FIELDS.map(([name]) => name).sort()).toEqual(catalogFields);
  });

  describe.each([...FIELDS, ...VARIANTS])('%s', (_name, Field, props) => {
    const common = { id: 'control-x', 'data-testid': 'input-x', value: null, ...props };

    it('с tooltip: одна иконка, скрытый текст, его id в aria-describedby контрола', () => {
      const html = renderToStaticMarkup(<Field {...common} tooltip={TEXT} />);
      expect(html.match(/data-slot="info-hint"/g)).toHaveLength(1);
      expect(html).toContain('data-testid="input-x-tooltip"');

      const hintId = html.match(/<span id="([^"]*)" hidden="">Текст подсказки поля<\/span>/)?.[1];
      expect(hintId).toBeTruthy();
      const describedBy = [...html.matchAll(/aria-describedby="([^"]*)"/g)].flatMap((m) =>
        m[1].split(' ')
      );
      expect(describedBy).toContain(hintId);
    });

    it('проп не течёт в DOM, labelTooltip срезается', () => {
      const html = renderToStaticMarkup(
        <Field {...common} tooltip={TEXT} labelTooltip="Подсказка у подписи" />
      );
      expect(html).not.toMatch(/\stooltip="/);
      expect(html.toLowerCase()).not.toContain('labeltooltip');
      expect(html).not.toContain('Подсказка у подписи');
    });

    it('без tooltip и с пустой строкой иконки нет', () => {
      expect(renderToStaticMarkup(<Field {...common} />)).not.toContain('info-hint');
      expect(renderToStaticMarkup(<Field {...common} tooltip="" />)).not.toContain('info-hint');
    });
  });
});
