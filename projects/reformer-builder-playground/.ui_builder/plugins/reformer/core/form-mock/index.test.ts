import { describe, expect, it } from 'vitest';
import { createForm } from '@reformer/core';
import { defineRegistry, FIELD_WRAPPER } from '@reformer/renderer-json';
import { sampleSchema } from '../form-model/__fixtures__/sample-schema';
import { collectOperatorNames } from '../form-model/query';
import { partsSchema, plainSchema } from '../codegen/__fixtures__/kit';
import {
  buildInitialValues,
  classifyDataSources,
  collectFieldDefaults,
  defaultForField,
  fieldKindOf,
  LIST_PROP_KEYS,
  synthMock,
} from './index';
import type { JsonFieldNode, JsonFormSchema } from '@reformer/renderer-json';

const field = (component: string, props: Record<string, unknown> = {}): JsonFieldNode =>
  ({ model: '$model(x)', component, componentProps: props }) as unknown as JsonFieldNode;

describe('синтез мока', () => {
  it('значения ПУСТЫЕ: заполненная форма скрыла бы работу required', () => {
    const mock = synthMock(plainSchema());
    expect(mock.model).toEqual({ fullName: '', agreed: false });
  });

  it('мультивыбор и файлы получают null, а не массив', () => {
    expect(fieldKindOf(field('$component(SelectMulti)'))).toBe('multi');
    expect(fieldKindOf(field('$component(FileUpload)'))).toBe('file');
    // Варианты FileUpload — отдельные записи каталога, значение у всех — список файлов.
    expect(fieldKindOf(field('$component(FileUploadDropzone)'))).toBe('file');
    expect(fieldKindOf(field('$component(FileUploadInput)'))).toBe('file');
  });

  it('InputNumber — число без пропа type; старый Input + type:number читается так же', () => {
    expect(fieldKindOf(field('$component(InputNumber)'))).toBe('number');
    expect(fieldKindOf(field('$component(Input)', { type: 'number' }))).toBe('number');
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

  it('выбор даты — дата, а не строка', () => {
    // Контрол кладёт в модель `Date`: объявленное строкой, поле расходилось бы со своим значением.
    expect(fieldKindOf(field('$component(DatePicker)'))).toBe('date');
    expect(fieldKindOf(field('$component(Calendar)'))).toBe('date');
    // Поле ввода с типом `date` — по-прежнему строка: значение у него строковое.
    expect(fieldKindOf(field('$component(Input)', { type: 'date' }))).toBe('string');
  });

  it('несколько дат — список дат, период — кортеж дат', () => {
    // Не `multi`: тот объявляет `string[]`, а контрол кладёт в модель даты.
    expect(fieldKindOf(field('$component(DatePickerMulti)'))).toBe('dates');
    expect(fieldKindOf(field('$component(DatePickerRange)'))).toBe('dateRange');
  });

  it('семья комбобоксов: одиночный — список по опциям, мультивыбор — набор, с опциями и без', () => {
    // Вид обязан совпасть с тем, что контрол кладёт в модель: `Combobox` — строку (`value`
    // опции), `ComboboxMulti` и `ComboboxTreeMulti` — массив строк, пустой выбор — `null`.
    expect(fieldKindOf(field('$component(Combobox)', { options: '$dataSource(X)' }))).toBe(
      'select'
    );
    expect(fieldKindOf(field('$component(ComboboxMulti)'))).toBe('multi');
    expect(fieldKindOf(field('$component(ComboboxMulti)', { options: [] }))).toBe('multi');
    expect(fieldKindOf(field('$component(ComboboxTreeMulti)'))).toBe('multi');
    // Одиночный выбор узла иерархии — строка: списка опций у него нет, узлы приходят деревом.
    expect(fieldKindOf(field('$component(ComboboxTree)'))).toBe('string');
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
    expect(defaultForField(field('$component(ComboboxMulti)'))).toBeNull();
    expect(defaultForField(field('$component(ComboboxTreeMulti)'))).toBeNull();
    expect(defaultForField(field('$component(FileUpload)'))).toBeNull();
  });

  it('у числа с нижней границей — сама граница, иначе null', () => {
    // Ноль вместо границы был бы значением ВНЕ допустимого диапазона: форма открывалась бы
    // сразу невалидной, и человек видел бы ошибку, которой не делал.
    expect(defaultForField(field('$component(InputNumber)', { min: 18 }))).toBe(18);
    expect(defaultForField(field('$component(InputNumber)'))).toBeNull();
  });

  it('нижняя граница ноль берётся, а не считается отсутствующей', () => {
    expect(defaultForField(field('$component(Slider)', { min: 0 }))).toBe(0);
  });

  it('у выбора даты — null: «дата не выбрана», а не пустая строка', () => {
    expect(defaultForField(field('$component(DatePicker)'))).toBeNull();
  });

  it('у нескольких дат и периода — null, как у мультивыбора', () => {
    expect(defaultForField(field('$component(DatePickerMulti)'))).toBeNull();
    expect(defaultForField(field('$component(DatePickerRange)'))).toBeNull();
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

describe('именованные части документа', () => {
  const address = { region: '', city: '', noApartment: false, apartment: '' };

  it('подформа даёт группу модели с полями части — под каждым подключением своя', () => {
    expect(synthMock(partsSchema()).model).toEqual({
      sameAddress: false,
      home: address,
      work: address,
      // Массив стартует пустым: строку из части строит рендерер, как и из вписанного шаблона.
      guests: [],
    });
  });

  it('пути полей части получают префикс группы', () => {
    const paths = collectFieldDefaults(partsSchema()).map((entry) => entry.path);
    expect(paths).toContain('home.city');
    expect(paths).toContain('work.apartment');
    expect(paths).not.toContain('city');
    // Часть-шаблон строки в верхнеуровневые пути не входит.
    expect(paths.some((path) => path.startsWith('guests.'))).toBe(false);
  });

  it('у части без полей объявляется сама группа: без неё рендерер на узле бросает', () => {
    const schema = {
      format: 2,
      parts: { note: { component: '$html(p)', children: ['Текст'] } },
      root: { component: '$html(div)', children: [{ model: '$model(info)', part: '$part(note)' }] },
    } as unknown as JsonFormSchema;
    expect(synthMock(schema).model).toEqual({ info: {} });
    // Ссылка на часть, которой нет: группа всё равно объявлена — о части скажет проверка схемы.
    const missing = {
      format: 2,
      root: { component: '$html(div)', children: [{ model: '$model(info)', part: '$part(nope)' }] },
    } as unknown as JsonFormSchema;
    expect(synthMock(missing).model).toEqual({ info: {} });
  });

  it('часть, подключающая саму себя, второй раз не разворачивается', () => {
    const schema = {
      format: 2,
      parts: {
        thread: {
          component: '$html(div)',
          children: [
            { model: '$model(text)', component: '$component(Input)' },
            { model: '$model(reply)', part: '$part(thread)' },
          ],
        },
      },
      root: {
        component: '$html(div)',
        children: [{ model: '$model(first)', part: '$part(thread)' }],
      },
    } as unknown as JsonFormSchema;
    expect(synthMock(schema).model).toEqual({ first: { text: '', reply: {} } });
  });

  it('источник данных из разметки части классифицируется по использованию, как в корне', () => {
    const classes = classifyDataSources(partsSchema());
    // `REGIONS` стоит только в части `address`: без обхода частей он сошёл бы за скаляр.
    expect([...classes.optionLike]).toEqual(['REGIONS']);
    expect([...classes.scalarLike]).toEqual([]);
    expect(synthMock(partsSchema()).dataSources.REGIONS).toHaveLength(3);
  });
});

describe('синтезированная модель годится единой сборке', () => {
  /** Собрать форму настоящей сборкой: компоненты — заглушки, источники — из мока. */
  function build(schema: JsonFormSchema, without?: string) {
    const mock = synthMock(schema);
    const stub = (): null => null;
    const registry = defineRegistry((reg) => {
      reg.component(FIELD_WRAPPER, stub as never);
      for (const name of collectOperatorNames(schema).components)
        reg.component(name, stub as never);
      for (const [name, value] of Object.entries(mock.dataSources)) reg.dataSource(name, value);
    });
    const initial = { ...mock.model };
    if (without !== undefined) delete initial[without];
    return createForm({ initial, schema: schema as never, registry: registry as never });
  }

  it('документ с частями собирается: каждая подформа находит свою группу модели', () => {
    const bundle = build(partsSchema());
    const model = bundle.model as unknown as Record<string, Record<string, unknown>>;
    expect(model.home.city).toBe('');
    expect(model.work.noApartment).toBe(false);
  });

  it('без группы подформы сборка отказывает — поэтому мок обязан её объявлять', () => {
    // Ровно это и получалось, пока разметка частей не обходилась: модуль собирался компилятором
    // и падал при создании формы.
    expect(() => build(partsSchema(), 'home')).toThrow(/not a group of the model/);
  });
});
