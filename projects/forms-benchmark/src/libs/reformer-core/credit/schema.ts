/**
 * Схема полей кредитной заявки для JSX-варианта: каждое поле — узел `{ model, component,
 * componentProps }` (02-quick-start.md), строки массивов — `{ model, item }` (10-arrays.md).
 * Компонент и пропсы поля берутся из общих метаданных `CREDIT_FIELDS` (подпись, контрол, маска,
 * опции); раскладку шагов рисует JSX (`CreditForm.tsx`), он пишет только `<Field control={…} />`.
 * Путь DOM-контракта поле берёт из своего живого пути в модели (`../../reformer-kit/Field.tsx`).
 *
 * Справочники (регионы, типы имущества — в том числе у строк, добавленных позже) — сигналом в
 * `componentProps`: нода поля отдаёт его значением и реактивно (32-async-options-loading.md,
 * «Справочник для полей строк массива — загрузка один раз»).
 */
import type { ComponentType } from 'react';
import type { FormModel, FormSchemaNode, SchemaValueHandle } from '@reformer/core';
import {
  Checkbox,
  DateInput,
  MaskedInput,
  NumberInput,
  RadioGroup,
  ReadonlyValue,
  Select,
  TextInput,
  Textarea,
} from '../../../shared/ui/controls';
import {
  COMPUTED_LABELS,
  CREDIT_FIELDS,
  type ControlKind,
  type CreditComputed,
  type CreditValues,
  type FieldMeta,
} from '../../../shared/domain/credit';
import type { CreditDictionaries } from '../../reformer-kit/credit/form';

const CONTROLS: Record<ControlKind, ComponentType<never>> = {
  text: TextInput,
  email: TextInput,
  textarea: Textarea,
  number: NumberInput,
  date: DateInput,
  masked: MaskedInput,
  select: Select,
  radio: RadioGroup,
  checkbox: Checkbox,
};

const FIELDS = CREDIT_FIELDS as Record<string, FieldMeta>;
const PATTERNS = Object.keys(FIELDS);
const COMPUTED = Object.keys(COMPUTED_LABELS) as (keyof CreditComputed)[];

export const creditSchema = (dictionaries: CreditDictionaries) => {
  /** Узел поля по пути-шаблону `pattern`; `name` нужен радиогруппе, `type` — email. */
  const field = (model: FormModel<object>, relative: string, pattern: string): FormSchemaNode => {
    const { label, control, placeholder, mask, options, optionsFrom } = FIELDS[pattern];
    const dictionary =
      optionsFrom === 'regions' || optionsFrom === 'propertyTypes'
        ? dictionaries[optionsFrom]
        : undefined;
    return {
      model: model.signalAt(relative) as SchemaValueHandle,
      component: CONTROLS[control],
      componentProps: {
        label,
        placeholder,
        mask,
        options: dictionary ?? options ?? (control === 'select' ? [] : undefined),
        ...(control === 'email' ? { type: 'email' } : {}),
        ...(control === 'radio' ? { name: relative } : {}),
      },
    };
  };

  /** Поля строки массива `array`: пути относительны строке. */
  const row = (array: string) => (item: FormModel<object>) => ({
    children: PATTERNS.filter((p) => p.startsWith(`${array}[].`)).map((p) =>
      field(item, p.slice(array.length + 3), p)
    ),
  });

  return (model: FormModel<CreditValues>): FormSchemaNode => {
    const root = model as unknown as FormModel<object>;
    return {
      children: [
        ...PATTERNS.filter((p) => !p.includes('[]')).map((p) => field(root, p, p)),
        { model: model.$.properties, item: row('properties') },
        { model: model.$.existingLoans, item: row('existingLoans') },
        { model: model.$.coBorrowers, item: row('coBorrowers') },
        ...COMPUTED.map((key) => ({
          model: model.$[key] as SchemaValueHandle,
          component: ReadonlyValue,
          componentProps: { label: COMPUTED_LABELS[key] },
        })),
      ],
    };
  };
};
