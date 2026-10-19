import { describe, expect, it } from 'vitest';
import { sampleSchema } from '../form-model/__fixtures__/sample-schema';
import { foreignKit, partsSchema, partsWizardSchema, plainSchema } from './__fixtures__/kit';
import { collect, valueTypesOf } from './collect';
import { prepare } from './context';
import { synthMock } from '../form-mock';
import { builtinEntries } from '../catalog/__fixtures__/builtin-catalog';
import type { CatalogEntry } from '../catalog/types';
import type { JsonFormSchema } from '@reformer/renderer-json';

function collectOf(schema = plainSchema()) {
  return collect(schema, synthMock(schema));
}

describe('collect', () => {
  it('строит дерево типов по видам контролов', () => {
    const c = collectOf();
    expect(c.root.fields.fullName).toEqual({ t: 'leaf', ts: 'string' });
    expect(c.root.fields.agreed).toEqual({ t: 'leaf', ts: 'boolean' });
  });

  it('собирает required только с верхнего уровня', () => {
    expect(collectOf().requiredPaths).toEqual(['fullName']);
  });

  it('вложенные пути становятся вложенными объектами', () => {
    const schema = plainSchema();
    (schema.root as { children: unknown[] }).children.push({
      model: '$model(contacts.phone)',
      component: '$component(Input)',
      componentProps: { label: 'Телефон' },
    });
    const contacts = collectOf(schema).root.fields.contacts;
    expect(contacts.t).toBe('obj');
    expect(contacts.t === 'obj' && contacts.fields.phone).toEqual({ t: 'leaf', ts: 'string' });
  });

  it('массив даёт тип элемента из item.$template, а сам путь — верхнеуровневый', () => {
    const schema = sampleSchema();
    const c = collect(schema, synthMock(schema));
    expect(c.arrayPaths).toEqual(['properties']);
    const properties = c.root.fields.properties;
    expect(properties.t).toBe('arr');
    expect(properties.t === 'arr' && properties.elem.t).toBe('obj');
  });

  it('select с известными опциями получает union строковых литералов и пустой выбор', () => {
    const schema = sampleSchema();
    const mock = synthMock(schema);
    const c = collect(schema, mock);
    // Опции синтезированы моком по `$dataSource(LOAN_TYPES)`.
    expect(c.root.fields.loanType).toEqual({
      t: 'leaf',
      // `''` — стартовое значение списка без выбора: без него model.ts не проходит tsc.
      ts: "'' | 'option1' | 'option2' | 'option3'",
    });
  });

  it('поле type=number объявляется числом, допускающим «не введено»', () => {
    const schema = sampleSchema();
    const mock = synthMock(schema);
    const c = collect(schema, mock);
    // `null` — стартовое значение числа без `min`: без него начальные значения не проходят tsc
    // (`{ loanAmount: null } as Форма` при `loanAmount: number` — ошибка TS2352).
    expect(mock.model.loanAmount).toBeNull();
    expect(c.root.fields.loanAmount).toEqual({ t: 'leaf', ts: 'number | null' });
  });

  /** Схема из одного поля — чтобы тип листа читался без чужих полей. */
  function leafOf(component: string, props: Record<string, unknown> = {}) {
    const schema = {
      format: 2,
      version: '1.0',
      root: {
        component: '$component(Box)',
        children: [
          { model: '$model(x)', component: `$component(${component})`, componentProps: props },
        ],
      },
    } as unknown as JsonFormSchema;
    const mock = synthMock(schema);
    return { leaf: collect(schema, mock).root.fields.x, initial: mock.model.x };
  }

  it('загрузка файлов объявляется списком файлов, а не списком неизвестного', () => {
    // `unknown[]` в типе формы — мусор: по нему нельзя ни прочитать имя файла, ни собрать
    // запрос. Стартует поле с `null` — «ничего не выбрано».
    const { leaf, initial } = leafOf('FileUploadDropzone', { multiple: true });
    expect(leaf).toEqual({ t: 'leaf', ts: 'File[] | null' });
    expect(initial).toBeNull();
  });

  it('выбор даты объявляется датой — тем, что контрол кладёт в модель', () => {
    // Строкой поле расходилось бы со своим значением: `birthDate: string` при `Date` в модели.
    const { leaf, initial } = leafOf('DatePicker');
    expect(leaf).toEqual({ t: 'leaf', ts: 'Date | null' });
    expect(initial).toBeNull();
  });

  it('несколько дат — список дат, период — кортеж; оба стартуют с null', () => {
    const multi = leafOf('DatePickerMulti');
    expect(multi.leaf).toEqual({ t: 'leaf', ts: 'Date[] | null' });
    expect(multi.initial).toBeNull();
    const range = leafOf('DatePickerRange');
    expect(range.leaf).toEqual({ t: 'leaf', ts: '[Date, Date] | null' });
    expect(range.initial).toBeNull();
  });

  it('список с крестиком очистки допускает null — в него очистка и сбрасывает', () => {
    const options = [{ value: 'a', label: 'А' }];
    expect(leafOf('Select', { options, clearable: true }).leaf).toEqual({
      t: 'leaf',
      ts: "'' | 'a' | null",
    });
    // Без крестика очистки `null` взяться неоткуда — тип остаётся прежним.
    expect(leafOf('Select', { options }).leaf).toEqual({ t: 'leaf', ts: "'' | 'a'" });
  });

  it('комбобокс: список с опциями, а мультикомбобокс — набор опций, пустой как null', () => {
    const options = [
      { value: 'a', label: 'А' },
      { value: 'b', label: 'Б' },
    ];
    // Одиночный комбобокс ведёт себя как список: стартует с `''`, крестик очистки даёт `null`.
    const single = leafOf('Combobox', { options, clearable: true });
    expect(single.leaf).toEqual({ t: 'leaf', ts: "'' | 'a' | 'b' | null" });
    expect(single.initial).toBe('');
    // Мультивыбор: контрол отдаёт пустой выбор как `null`, с него же поле и стартует.
    const multi = leafOf('ComboboxMulti', { options });
    expect(multi.leaf).toEqual({ t: 'leaf', ts: "Array<'a' | 'b'> | null" });
    expect(multi.initial).toBeNull();
  });

  it('крестик очистки даёт null и без списка опций в схеме', () => {
    // Выбор узла иерархии: опций у контрола нет (узлы приходят деревом), а очистка сбрасывает
    // значение в `null` так же, как у списка. Тип `string` это значение отвергал бы.
    expect(leafOf('ComboboxTree', { clearable: true }).leaf).toEqual({
      t: 'leaf',
      ts: 'string | null',
    });
    expect(leafOf('ComboboxTree').leaf).toEqual({ t: 'leaf', ts: 'string' });
    // Набор узлов иерархии — мультивыбор: массив строк, пустой выбор — `null`.
    const treeMulti = leafOf('ComboboxTreeMulti');
    expect(treeMulti.leaf).toEqual({ t: 'leaf', ts: 'string[] | null' });
    expect(treeMulti.initial).toBeNull();
  });
});

describe('лист, стартующий в моке с null, объявляется nullable', () => {
  /** Плоская форма из полей `[путь, компонент, пропсы]` с авторским моком модели. */
  function typesOf(
    fields: readonly (readonly [string, string, Record<string, unknown>?])[],
    model: Record<string, unknown>,
    dataSources: Record<string, unknown> = {}
  ) {
    const schema = {
      format: 2,
      version: '1.0',
      root: {
        component: '$component(Box)',
        children: fields.map(([path, component, props]) => ({
          model: `$model(${path})`,
          component: `$component(${component})`,
          componentProps: props ?? {},
        })),
      },
    } as unknown as JsonFormSchema;
    return collect(schema, { model, dataSources }).root.fields;
  }

  it('список без крестика очистки, но с null в моке, получает `| null`', () => {
    // Отказ, который это удерживает (форма contact образца приложения): мок
    // `{ city: null }`, а тип печатался `city: string`. Начальные значения приводятся к типу
    // формы (`as <Тип>`), поэтому компилятор расхождения не видел — тип просто врал.
    const fields = typesOf(
      [
        ['name', 'Input'],
        ['city', 'Select', { options: '$dataSource(CITIES)' }],
        ['agree', 'Checkbox'],
      ],
      { name: '', city: null, agree: false }
    );
    expect(fields.city).toEqual({ t: 'leaf', ts: 'string | null' });
    // Поля, стартующие не с `null`, остаются как были.
    expect(fields.name).toEqual({ t: 'leaf', ts: 'string' });
    expect(fields.agree).toEqual({ t: 'leaf', ts: 'boolean' });
  });

  it('null дописывается к союзу опций, а не заменяет его', () => {
    const fields = typesOf(
      [['city', 'Select', { options: '$dataSource(CITIES)' }]],
      { city: null },
      { CITIES: [{ value: 'msk', label: 'Москва' }] }
    );
    expect(fields.city).toEqual({ t: 'leaf', ts: "'' | 'msk' | null" });
  });

  it('тип, уже допускающий null по своей причине, второго null не получает', () => {
    const fields = typesOf(
      [
        ['city', 'Select', { options: [{ value: 'a', label: 'А' }], clearable: true }],
        ['amount', 'InputNumber'],
        ['birthDate', 'DatePicker'],
        ['documents', 'FileUploadDropzone'],
        ['skills', 'ComboboxMulti'],
      ],
      { city: null, amount: null, birthDate: null, documents: null, skills: null }
    );
    expect(fields.city).toEqual({ t: 'leaf', ts: "'' | 'a' | null" });
    expect(fields.amount).toEqual({ t: 'leaf', ts: 'number | null' });
    expect(fields.birthDate).toEqual({ t: 'leaf', ts: 'Date | null' });
    expect(fields.documents).toEqual({ t: 'leaf', ts: 'File[] | null' });
    expect(fields.skills).toEqual({ t: 'leaf', ts: 'string[] | null' });
  });

  it('строка и флажок с null в моке — тоже nullable: тип следует моку, а не контролу', () => {
    const fields = typesOf(
      [
        ['comment', 'Input'],
        ['agree', 'Checkbox'],
        ['contacts.phone', 'Input'],
      ],
      { comment: null, agree: null, contacts: { phone: null } }
    );
    expect(fields.comment).toEqual({ t: 'leaf', ts: 'string | null' });
    expect(fields.agree).toEqual({ t: 'leaf', ts: 'boolean | null' });
    const contacts = fields.contacts;
    expect(contacts.t === 'obj' && contacts.fields.phone).toEqual({
      t: 'leaf',
      ts: 'string | null',
    });
  });

  it('мок, молчащий о поле, тип не меняет', () => {
    const fields = typesOf(
      [
        ['city', 'Select', { options: '$dataSource(CITIES)' }],
        ['contacts.phone', 'Input'],
      ],
      // Ни `city`, ни `contacts` в моке нет; `undefined` — не `null`.
      { other: null }
    );
    expect(fields.city).toEqual({ t: 'leaf', ts: 'string' });
    const contacts = fields.contacts;
    expect(contacts.t === 'obj' && contacts.fields.phone).toEqual({ t: 'leaf', ts: 'string' });
  });

  it('поле строки массива — nullable, если null лежит хотя бы в одной строке мока', () => {
    const schema = {
      format: 2,
      version: '1.0',
      root: {
        component: '$component(Box)',
        children: [
          {
            model: '$model(references)',
            component: '$component(FieldArray)',
            item: {
              $template: {
                component: '$component(Box)',
                children: [
                  { model: '$model(name)', component: '$component(Input)' },
                  { model: '$model(phone)', component: '$component(Input)' },
                ],
              },
            },
          },
        ],
      },
    } as unknown as JsonFormSchema;
    const rowOf = (model: Record<string, unknown>) => {
      const references = collect(schema, { model, dataSources: {} }).root.fields.references;
      return references.t === 'arr' && references.elem.t === 'obj' ? references.elem.fields : {};
    };

    const withNull = rowOf({
      references: [
        { name: 'Пётр', phone: '+7' },
        { name: 'Анна', phone: null },
      ],
    });
    expect(withNull.phone).toEqual({ t: 'leaf', ts: 'string | null' });
    expect(withNull.name).toEqual({ t: 'leaf', ts: 'string' });
    // Синтезированный мок строк не несёт — типы строки остаются по контролу.
    expect(rowOf({ references: [] }).phone).toEqual({ t: 'leaf', ts: 'string' });
  });
});

describe('обязательные поля по шагам визарда', () => {
  const field = (path: string, required: boolean) => ({
    model: `$model(${path})`,
    component: '$component(Input)',
    componentProps: { label: path, ...(required ? { required: true } : {}) },
  });
  const schema = {
    format: 2,
    version: '1.0',
    root: {
      component: '$component(Box)',
      children: [
        field('agree', true),
        {
          component: '$component(Wizard)',
          children: [
            {
              selector: 'one-section',
              component: '$component(Step)',
              children: [
                {
                  component: '$html(div)',
                  children: [field('lastName', true), field('nick', false)],
                },
              ],
            },
            {
              selector: 'two-section',
              component: '$component(Step)',
              children: [field('email', true)],
            },
          ],
        },
      ],
    },
  } as unknown as JsonFormSchema;

  it('каждый шаг знает свои обязательные поля, вложенные тоже', () => {
    const c = collect(schema, synthMock(schema));
    expect(c.steps).toEqual([
      { selector: 'one-section', required: ['lastName'] },
      { selector: 'two-section', required: ['email'] },
    ]);
    // Поле вне визарда — только в общем списке: его проверяет отправка, а не «Далее».
    expect(c.requiredPaths).toEqual(expect.arrayContaining(['agree', 'lastName', 'email']));
  });

  it('без визарда шагов нет', () => {
    const plain = {
      format: 2,
      version: '1.0',
      root: field('x', true),
    } as unknown as JsonFormSchema;
    expect(collect(plain, synthMock(plain)).steps).toEqual([]);
  });
});

describe('именованные части документа', () => {
  const ADDRESS = {
    t: 'obj',
    fields: {
      region: { t: 'leaf', ts: "'' | 'option1' | 'option2' | 'option3'" },
      city: { t: 'leaf', ts: 'string' },
      noApartment: { t: 'leaf', ts: 'boolean' },
      apartment: { t: 'leaf', ts: 'string' },
    },
  };

  it('подформа даёт под своим путём тип части — под каждым подключением', () => {
    const { root } = collectOf(partsSchema());
    expect(root.fields.home).toEqual(ADDRESS);
    expect(root.fields.work).toEqual(ADDRESS);
  });

  it('массив с частью берёт тип строки из разметки части, включая часть внутри части', () => {
    const { root } = collectOf(partsSchema());
    expect(root.fields.guests).toEqual({
      t: 'arr',
      elem: {
        t: 'obj',
        fields: {
          name: { t: 'leaf', ts: 'string' },
          hasPhone: { t: 'leaf', ts: 'boolean' },
          phone: { t: 'leaf', ts: 'string' },
          address: ADDRESS,
        },
      },
    });
  });

  it('обязательные поля подформ — верхнеуровневые, с путём группы; поля строки — нет', () => {
    const c = collectOf(partsSchema());
    expect(c.requiredPaths).toEqual(['home.city', 'work.city']);
    expect(c.arrayPaths).toEqual(['guests']);
  });

  it('обязательное поле части принадлежит шагу, где часть смонтирована', () => {
    expect(collectOf(partsWizardSchema()).steps.map((step) => step.required)).toEqual([
      ['home.city', 'work.city'],
      [],
    ]);
  });

  it('компоненты и источники данных из разметки частей доезжают до сборки', () => {
    const c = collectOf(partsSchema());
    // `Select` и `REGIONS` стоят только в части `address`.
    expect(c.components).toEqual(expect.arrayContaining(['Select', 'FieldArray', 'Section']));
    expect([...c.ds.optionLike]).toEqual(['REGIONS']);
  });

  it('поле рядом с подформой под тем же путём — одна группа модели', () => {
    const schema = {
      format: 2,
      parts: {
        address: {
          component: '$component(Box)',
          children: [{ model: '$model(city)', component: '$component(Input)' }],
        },
      },
      root: {
        component: '$component(Box)',
        children: [
          { model: '$model(home.note)', component: '$component(Input)' },
          { model: '$model(home)', part: '$part(address)' },
        ],
      },
    } as unknown as JsonFormSchema;
    expect(collectOf(schema).root.fields.home).toEqual({
      t: 'obj',
      fields: { note: { t: 'leaf', ts: 'string' }, city: { t: 'leaf', ts: 'string' } },
    });
  });

  it('ссылка на часть, которой нет: группа пуста, строка массива — пустой объект', () => {
    const schema = {
      format: 2,
      root: {
        component: '$component(Box)',
        children: [
          { model: '$model(home)', part: '$part(nope)' },
          { model: '$model(rows)', item: '$part(nope)' },
        ],
      },
    } as unknown as JsonFormSchema;
    const { root } = collectOf(schema);
    expect(root.fields.home).toEqual({ t: 'obj', fields: {} });
    expect(root.fields.rows).toEqual({ t: 'arr', elem: { t: 'obj', fields: {} } });
  });

  it('часть, подключающая саму себя, второй раз не разворачивается — ни группой, ни строкой', () => {
    const schema = {
      format: 2,
      parts: {
        category: {
          component: '$component(Box)',
          children: [
            { model: '$model(title)', component: '$component(Input)' },
            { model: '$model(parent)', part: '$part(category)' },
            { model: '$model(children)', item: '$part(category)' },
          ],
        },
      },
      root: {
        component: '$component(Box)',
        children: [{ model: '$model(top)', part: '$part(category)' }],
      },
    } as unknown as JsonFormSchema;
    const loop = { t: 'leaf', ts: 'Record<string, unknown>' };
    expect(collectOf(schema).root.fields.top).toEqual({
      t: 'obj',
      fields: {
        title: { t: 'leaf', ts: 'string' },
        parent: loop,
        children: { t: 'arr', elem: loop },
      },
    });
  });
});

describe('вид значения поля из каталога кита', () => {
  /** Запись-поле каталога с объявленным типом значения (`x-runtimeProps.value.type`). */
  const fieldEntry = (name: string, type: string): CatalogEntry => ({
    name,
    role: 'field',
    propsSchema: {
      type: 'object',
      properties: {},
      'x-runtimeProps': {
        value: { group: 'Control', type, description: 'Значение поля.' },
      },
    } as unknown as CatalogEntry['propsSchema'],
    makeNode: () => ({ model: '$model(x)', component: `$component(${name})` }),
  });

  /** Каталог чужого кита: поля, которых в наборах имён синтеза нет. */
  const catalog: readonly CatalogEntry[] = [
    fieldEntry('CheckboxGroup', 'string[] | null'),
    fieldEntry('TimeRange', '[string, string] | null'),
    fieldEntry('WeeklySchedule', 'Record<string, number[]> | null'),
    fieldEntry('Level', "'low' | 'high'"),
    fieldEntry('TimeInput', 'string | null'),
  ];
  const valueTypeOf = valueTypesOf(catalog);

  /** Лист `x` формы из одного поля: тип и начальное значение по одной таблице. */
  function leafOf(component: string, props: Record<string, unknown> = {}) {
    const schema = {
      format: 2,
      version: '1.0',
      root: {
        component: '$component(Box)',
        children: [
          { model: '$model(x)', component: `$component(${component})`, componentProps: props },
        ],
      },
    } as unknown as JsonFormSchema;
    const mock = synthMock(schema, valueTypeOf);
    return { leaf: collect(schema, mock, valueTypeOf).root.fields.x, initial: mock.model.x };
  }

  it('таблица читает тип значения записей-полей, прочие молчат', () => {
    const container: CatalogEntry = {
      ...fieldEntry('Tabs', 'string'),
      role: 'container',
    };
    const bare: CatalogEntry = { ...fieldEntry('Bare', ''), propsSchema: {} };
    const table = valueTypesOf([...catalog, container, bare]);
    expect(table('CheckboxGroup')).toBe('string[] | null');
    expect(table('Tabs')).toBeUndefined();
    expect(table('Bare')).toBeUndefined();
    expect(table('Nope')).toBeUndefined();
  });

  it('CheckboxGroup со string[] | null — список строк, стартует с null', () => {
    const { leaf, initial } = leafOf('CheckboxGroup');
    expect(leaf).toEqual({ t: 'leaf', ts: 'string[] | null' });
    expect(initial).toBeNull();
    // С опциями — набор их значений, как у мультивыбора встроенного кита.
    const options = [
      { value: 'a', label: 'А' },
      { value: 'b', label: 'Б' },
    ];
    expect(leafOf('CheckboxGroup', { options }).leaf).toEqual({
      t: 'leaf',
      ts: "Array<'a' | 'b'> | null",
    });
  });

  it('TimeRange с [string, string] | null — raw: тип печатается как объявлен, мок — null', () => {
    const { leaf, initial } = leafOf('TimeRange');
    expect(leaf).toEqual({ t: 'leaf', ts: '[string, string] | null' });
    expect(initial).toBeNull();
    expect(leafOf('WeeklySchedule').leaf).toEqual({
      t: 'leaf',
      ts: 'Record<string, number[]> | null',
    });
  });

  it('raw без null в объявлении получает его: поле стартует с null', () => {
    const { leaf, initial } = leafOf('Level');
    expect(leaf).toEqual({ t: 'leaf', ts: "'low' | 'high' | null" });
    expect(initial).toBeNull();
  });

  it('строковое поле — по пропсам, как без каталога', () => {
    expect(leafOf('TimeInput')).toEqual({ leaf: { t: 'leaf', ts: 'string' }, initial: '' });
    expect(leafOf('TimeInput', { clearable: true }).leaf).toEqual({
      t: 'leaf',
      ts: 'string | null',
    });
  });

  it('raw в строке массива nullable и без строк в моке', () => {
    const schema = {
      format: 2,
      version: '1.0',
      root: {
        component: '$component(Box)',
        children: [
          {
            model: '$model(shifts)',
            component: '$component(FieldArray)',
            item: {
              $template: {
                component: '$component(Box)',
                children: [{ model: '$model(time)', component: '$component(TimeRange)' }],
              },
            },
          },
        ],
      },
    } as unknown as JsonFormSchema;
    const shifts = collect(schema, synthMock(schema, valueTypeOf), valueTypeOf).root.fields.shifts;
    expect(shifts.t === 'arr' && shifts.elem.t === 'obj' && shifts.elem.fields.time).toEqual({
      t: 'leaf',
      ts: '[string, string] | null',
    });
  });

  it('генерация берёт таблицу из каталога кита: мок и тип формы — по одному правилу', () => {
    const schema = {
      format: 2,
      version: '1.0',
      root: {
        component: '$component(Box)',
        children: [
          { model: '$model(days)', component: '$component(CheckboxGroup)' },
          { model: '$model(time)', component: '$component(TimeRange)' },
        ],
      },
    } as unknown as JsonFormSchema;
    const ctx = prepare({ schema, formName: 'Смена', kit: { kit: foreignKit().kit, catalog } });
    expect(ctx.mock.model).toEqual({ days: null, time: null });
    expect(ctx.collected.root.fields).toEqual({
      days: { t: 'leaf', ts: 'string[] | null' },
      time: { t: 'leaf', ts: '[string, string] | null' },
    });
  });

  it('встроенный кит: каталог не меняет ни вида, ни типа, ни начального значения поля', () => {
    // Для ui-kit таблица обязана быть пустым местом: наборы имён синтеза покрывают его поля, а
    // строковые типы и непечатаемые (`File | RemoteFileRef` у аватара) уходят на прежнее правило.
    const builtin = builtinEntries();
    const table = valueTypesOf(builtin);
    const variants: readonly Record<string, unknown>[] = [
      {},
      { options: [{ value: 'a', label: 'А' }] },
      { clearable: true },
      { type: 'number' },
      { min: 1 },
    ];
    for (const entry of builtin.filter((e) => e.role === 'field')) {
      for (const props of variants) {
        const schema = {
          format: 2,
          version: '1.0',
          root: {
            component: '$component(Box)',
            children: [
              {
                model: '$model(x)',
                component: `$component(${entry.name})`,
                componentProps: props,
              },
            ],
          },
        } as unknown as JsonFormSchema;
        const before = synthMock(schema);
        const after = synthMock(schema, table);
        expect(after, entry.name).toEqual(before);
        expect(collect(schema, after, table).root, entry.name).toEqual(
          collect(schema, before).root
        );
      }
    }
  });
});
