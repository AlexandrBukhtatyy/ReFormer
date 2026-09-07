import { describe, expect, it } from 'vitest';
import { sampleSchema } from '../form-model/__fixtures__/sample-schema';
import { plainSchema } from '../codegen/__fixtures__/kit';
import {
  buildInitialValues,
  classifyDataSources,
  defaultForField,
  fieldKindOf,
  LIST_PROP_KEYS,
  synthMock,
} from './index';
import type { JsonFieldNode } from '@reformer/renderer-json';

const field = (component: string, props: Record<string, unknown> = {}): JsonFieldNode =>
  ({ value: '$model(x)', component, componentProps: props }) as unknown as JsonFieldNode;

describe('синтез мока', () => {
  it('значения ПУСТЫЕ: заполненная форма скрыла бы работу required', () => {
    const mock = synthMock(plainSchema());
    expect(mock.model).toEqual({ fullName: '', agreed: false });
  });

  it('мультивыбор и файлы получают null, а не массив', () => {
    expect(fieldKindOf(field('$component(SelectMulti)'))).toBe('multi');
    expect(fieldKindOf(field('$component(FileUpload)'))).toBe('file');
  });

  it('детерминирован: два вызова дают побайтово одно и то же', () => {
    expect(JSON.stringify(synthMock(sampleSchema()))).toBe(
      JSON.stringify(synthMock(sampleSchema()))
    );
  });

  it('источники разложены по способу использования, а не по имени', () => {
    const classes = classifyDataSources(sampleSchema());
    // `itemLabel` массива требует функцию, поэтому имя уходит в functionLike и НЕ остаётся
    // в optionLike, даже если тем же именем адресован список.
    expect([...classes.functionLike]).toEqual(['PROP_LABEL']);
    expect([...classes.optionLike]).toEqual(['LOAN_TYPES']);
  });

  it('списку синтезируются опции: Select без опций читался бы как поломка', () => {
    const mock = synthMock(sampleSchema());
    expect(mock.dataSources.LOAN_TYPES).toEqual([
      { value: 'option1', label: 'Loan types 1' },
      { value: 'option2', label: 'Loan types 2' },
      { value: 'option3', label: 'Loan types 3' },
    ]);
  });
});

describe('вид поля определяется по компоненту, затем по свойствам', () => {
  it('компонент важнее свойств: у ползунка тип числовой, даже если свойств нет', () => {
    expect(fieldKindOf(field('$component(Slider)'))).toBe('number');
  });

  it('без компонента вид берётся из типа поля ввода', () => {
    expect(fieldKindOf(field('$component(Input)', { type: 'number' }))).toBe('number');
  });

  it('наличие списка опций делает поле выбором', () => {
    // Проверяется КАЖДЫЙ ключ списка: пропущенный означал бы, что `Select` с опциями
    // под этим именем синтезирует пустую строку и в превью выглядит сломанным.
    for (const key of LIST_PROP_KEYS) {
      expect(fieldKindOf(field('$component(Select)', { [key]: [] }))).toBe('select');
    }
  });

  it('всё непознанное — строка', () => {
    expect(fieldKindOf(field('$component(Whatever)'))).toBe('string');
    expect(fieldKindOf(field('$component(Input)'))).toBe('string');
  });
});

describe('начальное значение поля', () => {
  it('у флажка — ложь, а не пустая строка', () => {
    expect(defaultForField(field('$component(Checkbox)'))).toBe(false);
  });

  it('у множественного выбора и файла — null, а не пустой массив', () => {
    // Массив в начальном значении модель превратила бы в форму-массив, и у поля
    // не оказалось бы сигнала вовсе.
    expect(defaultForField(field('$component(SelectMulti)'))).toBeNull();
    expect(defaultForField(field('$component(FileUpload)'))).toBeNull();
  });

  it('у числа с нижней границей — сама граница, иначе null', () => {
    // Ноль вместо границы был бы значением ВНЕ допустимого диапазона: форма открывалась бы
    // сразу невалидной, и человек видел бы ошибку, которой не делал.
    expect(defaultForField(field('$component(Input)', { type: 'number', min: 18 }))).toBe(18);
    expect(defaultForField(field('$component(Input)', { type: 'number' }))).toBeNull();
  });

  it('нижняя граница ноль берётся, а не считается отсутствующей', () => {
    expect(defaultForField(field('$component(Slider)', { min: 0 }))).toBe(0);
  });

  it('у строки — пустая строка', () => {
    expect(defaultForField(field('$component(Input)'))).toBe('');
  });
});

describe('сборка начальных значений', () => {
  it('раскладывает по путям модели', () => {
    expect(
      buildInitialValues([
        { path: 'name', value: '' },
        { path: 'age', value: 18 },
      ] as never)
    ).toEqual({ name: '', age: 18 });
  });

  it('пустой список даёт пустой объект, а не отказ', () => {
    expect(buildInitialValues([])).toEqual({});
  });
});
