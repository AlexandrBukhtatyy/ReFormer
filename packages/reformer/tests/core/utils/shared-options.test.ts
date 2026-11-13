/**
 * Справочник, загруженный один раз, — опциями полей всех строк массива (ReFormer-zh9r).
 *
 * Сигнал справочника лежит в `componentProps` шаблона строки: каждая строка, в том числе
 * добавленная позже, читает тот же сигнал, а загрузка доходит до всех строк сразу — без поведения,
 * которое раздаёт опции каждой строке через `updateComponentProps`.
 */
import { describe, expect, it } from 'vitest';
import { signal } from '@preact/signals-core';
import { arrayOf } from '../../../src/model/index';
import type { FormModel } from '../../../src/model/types';
import { createForm } from '../../../src/form/form-bundle';
import { InputStub } from '../../test-utils/stubs';

interface Property {
  type: string;
}
interface Application {
  properties: Property[];
}

interface Option {
  value: string;
  label: string;
}

function setup() {
  const propertyTypes = signal<Option[]>([]);
  const bundle = createForm<Application>({
    initial: { properties: arrayOf(() => ({ type: '' }), [{ type: '' }]) },
    schema: (model) => ({
      children: [
        {
          model: model.$.properties,
          item: (row: FormModel<Property>) => ({
            children: [
              {
                model: row.$.type,
                component: InputStub,
                componentProps: { label: 'Тип', options: propertyTypes },
              },
            ],
          }),
        },
      ],
    }),
  });
  return { ...bundle, propertyTypes };
}

describe('опции строк массива из одного справочника', () => {
  it('загрузка справочника доходит до всех строк, в том числе добавленных позже', () => {
    const { form, propertyTypes } = setup();
    const first = form.properties.at(0)!.type;
    expect(first.componentProps.value).toEqual({ label: 'Тип', options: [] });

    propertyTypes.value = [{ value: 'house', label: 'Дом' }];
    form.properties.push();

    const added = form.properties.at(1)!.type;
    expect(first.componentProps.value.options).toEqual([{ value: 'house', label: 'Дом' }]);
    expect(added.componentProps.value.options).toEqual([{ value: 'house', label: 'Дом' }]);
  });

  it('правка пропсов строки поверх справочника — только у этой строки', () => {
    const { form, propertyTypes } = setup();
    form.properties.push();
    propertyTypes.value = [{ value: 'house', label: 'Дом' }];

    form.properties.at(0)!.type.updateComponentProps({ options: [] });

    expect(form.properties.at(0)!.type.componentProps.value.options).toEqual([]);
    expect(form.properties.at(1)!.type.componentProps.value.options).toHaveLength(1);
  });
});
