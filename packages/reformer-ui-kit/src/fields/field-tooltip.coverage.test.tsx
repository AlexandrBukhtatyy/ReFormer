import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ComponentType } from 'react';

import { CalendarSingle } from '@/components/calendar';
import { CheckboxWithLabel } from '@/components/checkbox';
import { Combobox, ComboboxMulti, ComboboxTree, ComboboxTreeMulti } from '@/components/combobox';
import { DatePicker } from '@/components/date-picker';
import {
  FileUploadBase,
  FileUploadAvatar,
  FileUploadDropzone,
  FileUploadInput,
} from '@/components/file-upload';
import { Input, InputNumber, InputSuggest } from '@/components/input';
import { InputMask } from '@/components/input-mask';
import { InputOTPDefault } from '@/components/input-otp';
import { InputPassword } from '@/components/input-password';
import { NativeSelectWithOptions, NativeSelectMulti } from '@/components/native-select';
import { RadioGroupOptions } from '@/components/radio-group';
import { SelectAsync, SelectMulti } from '@/components/select';
import { Slider } from '@/components/slider';
import { SwitchWithLabel } from '@/components/switch';
import { Textarea } from '@/components/textarea';
import { Toggle } from '@/components/toggle';
import { ToggleGroupOptions, ToggleGroupMulti } from '@/components/toggle-group';
import { Bound } from '@/test-utils/bound';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Страж охвата: КАЖДОЕ поле кита обязано уметь проп `tooltip`. Он объявлен в общей схеме
 * (`field-common.props.ts`), поэтому поле без поддержки молча принимало бы проп и ничего не рисовало.
 * Список сверяется с каталогом: новое поле без строки здесь роняет тест.
 *
 * Контрол рендерится так, как его связывает обёртка поля ({@link Bound}: адаптер из статики + seam).
 */

const OPTIONS = [
  { value: 'a', label: 'Альфа' },
  { value: 'b', label: 'Бета' },
];
const TREE = [{ id: 'a', label: 'Альфа' }];

type Row = [name: string, Field: ComponentType<any>, props: Record<string, unknown>];

/** Ключ — регистр-имя из каталога (`x-registryName`). */
const FIELDS: Row[] = [
  ['Calendar', CalendarSingle, {}],
  ['Checkbox', CheckboxWithLabel, { label: 'Согласен' }],
  ['Combobox', Combobox, { options: OPTIONS }],
  ['ComboboxMulti', ComboboxMulti, { options: OPTIONS }],
  ['ComboboxTree', ComboboxTree, { nodes: TREE }],
  ['ComboboxTreeMulti', ComboboxTreeMulti, { nodes: TREE }],
  ['DatePicker', DatePicker, {}],
  ['FileUpload', FileUploadBase, {}],
  ['FileUploadAvatar', FileUploadAvatar, {}],
  ['FileUploadDropzone', FileUploadDropzone, {}],
  ['FileUploadInput', FileUploadInput, {}],
  ['Input', Input, {}],
  ['InputNumber', InputNumber, {}],
  ['InputSuggest', InputSuggest, { suggestions: ['альфа'] }],
  ['InputMask', InputMask, { mask: '99-99' }],
  ['InputOTP', InputOTPDefault, {}],
  ['InputPassword', InputPassword, {}],
  ['NativeSelect', NativeSelectWithOptions, { options: OPTIONS }],
  ['NativeSelectMulti', NativeSelectMulti, { options: OPTIONS }],
  ['RadioGroup', RadioGroupOptions, { options: OPTIONS }],
  ['Select', SelectAsync, { options: OPTIONS }],
  ['SelectMulti', SelectMulti, { options: OPTIONS }],
  ['Slider', Slider, {}],
  ['Switch', SwitchWithLabel, { label: 'Включить' }],
  ['Textarea', Textarea, {}],
  ['Toggle', Toggle, { children: 'B' }],
  ['ToggleGroup', ToggleGroupOptions, { options: OPTIONS }],
  ['ToggleGroupMulti', ToggleGroupMulti, { options: OPTIONS }],
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

  describe.each(FIELDS)('%s', (_name, Field, props) => {
    const common = { id: 'control-x', 'data-testid': 'input-x', value: null, ...props };

    it('с tooltip: одна иконка, скрытый текст, его id в aria-describedby контрола', () => {
      const html = renderToStaticMarkup(<Bound component={Field} {...common} tooltip={TEXT} />);
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
        <Bound component={Field} {...common} tooltip={TEXT} labelTooltip="Подсказка у подписи" />
      );
      expect(html).not.toMatch(/\stooltip="/);
      expect(html.toLowerCase()).not.toContain('labeltooltip');
      expect(html).not.toContain('Подсказка у подписи');
    });

    it('без tooltip и с пустой строкой иконки нет', () => {
      expect(renderToStaticMarkup(<Bound component={Field} {...common} />)).not.toContain(
        'info-hint'
      );
      expect(
        renderToStaticMarkup(<Bound component={Field} {...common} tooltip="" />)
      ).not.toContain('info-hint');
    });
  });
});
