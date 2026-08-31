import { describe, expect, it } from 'vitest';
import type { JsonFormSchema } from '@reformer/renderer-json';
import {
  classifyDataSources,
  inferFieldKind,
  mockOptions,
  mockTreeNodes,
  synthMock,
} from './mock-synth';
import { sampleSchema } from '../model/__fixtures__/sample-schema';
import { seedSchema } from '../app/seed-schema';

const NOW = new Date('2026-07-28T00:00:00.000Z');

/** Мини-схема с полями под токен-эвристики. */
function tokenSchema(): JsonFormSchema {
  return {
    version: '1.0',
    root: {
      component: '$component(Box)',
      children: [
        {
          value: '$model(email)',
          component: '$component(Input)',
          componentProps: { label: 'Email', type: 'email' },
        },
        {
          value: '$model(phone)',
          component: '$component(Input)',
          componentProps: { label: 'Телефон' },
        },
        {
          value: '$model(firstName)',
          component: '$component(Input)',
          componentProps: { label: 'Имя' },
        },
        {
          value: '$model(birthDate)',
          component: '$component(DatePicker)',
          componentProps: { label: 'Дата рождения' },
        },
        {
          value: '$model(agree)',
          component: '$component(Checkbox)',
          componentProps: { label: 'Согласен' },
        },
        {
          value: '$model(startDate)',
          component: '$component(Input)',
          componentProps: { label: 'Дата начала', type: 'date' },
        },
      ],
    },
  } as unknown as JsonFormSchema;
}

/** Схема с деревом: поле-комбобокс на инлайн-узлах и контейнер `Tree` на именованном источнике. */
function treeSchema(): JsonFormSchema {
  return {
    version: '1.0',
    root: {
      component: '$component(Box)',
      children: [
        {
          value: '$model(file)',
          component: '$component(ComboboxTree)',
          componentProps: {
            label: 'Файл',
            nodes: [
              { id: 'src', label: 'src', children: [{ id: 'src/app.ts', label: 'app.ts' }] },
              { id: 'readme.md', label: 'readme.md' },
            ],
          },
        },
        {
          value: '$model(files)',
          component: '$component(ComboboxTreeMulti)',
          componentProps: { label: 'Файлы', nodes: '$dataSource(PROJECT_TREE)' },
        },
        { component: '$component(Tree)', componentProps: { nodes: '$dataSource(PROJECT_TREE)' } },
      ],
    },
  } as unknown as JsonFormSchema;
}

describe('classifyDataSources', () => {
  it('раскладывает по бакетам: itemLabel → functionLike, list-проп → optionLike', () => {
    const cls = classifyDataSources(sampleSchema());
    expect([...cls.functionLike]).toEqual(['PROP_LABEL']);
    expect([...cls.optionLike]).toEqual(['LOAN_TYPES']);
    expect([...cls.treeLike]).toEqual([]);
    expect([...cls.scalarLike]).toEqual([]);
  });

  it('`nodes` → treeLike, а НЕ optionLike и не scalarLike', () => {
    // Промах в любую сторону виден только в рантайме: опции дадут узлы без `id` (пустое дерево),
    // скаляр — строку вместо массива, на которой обход иерархии падает вместе со всем превью.
    const cls = classifyDataSources(treeSchema());
    expect([...cls.treeLike]).toEqual(['PROJECT_TREE']);
    expect([...cls.optionLike]).toEqual([]);
    expect([...cls.scalarLike]).toEqual([]);
  });
});

describe('inferFieldKind', () => {
  it('Select+dataSource → select, number → number, Checkbox → boolean, DatePicker → date', () => {
    const s = tokenSchema().root as { children: Parameters<typeof inferFieldKind>[0][] };
    expect(inferFieldKind(s.children[0])).toBe('string'); // email по типу — string-input
    expect(inferFieldKind(s.children[3])).toBe('date'); // DatePicker
    expect(inferFieldKind(s.children[4])).toBe('boolean'); // Checkbox
    expect(inferFieldKind(s.children[5])).toBe('date'); // type:date
  });

  it('файловые контролы → files', () => {
    const node = (name: string) =>
      ({ value: '$model(docs)', component: `$component(${name})` }) as Parameters<
        typeof inferFieldKind
      >[0];
    expect(inferFieldKind(node('FileUpload'))).toBe('files');
    expect(inferFieldKind(node('FileUploadAvatar'))).toBe('files');
    expect(inferFieldKind(node('Attachment'))).toBe('files');
  });

  it('древовидные комбобоксы: одиночный → tree, множественный → multi', () => {
    const s = treeSchema().root as { children: Parameters<typeof inferFieldKind>[0][] };
    expect(inferFieldKind(s.children[0])).toBe('tree');
    expect(inferFieldKind(s.children[1])).toBe('multi');
  });
});

describe('synthMock — деревья', () => {
  it('одиночное дерево получает адрес ПЕРВОГО ЛИСТА, а не первого узла', () => {
    // Каталог верхнего уровня выбрать нельзя (`selectable: 'leaf'` у ComboboxTree) — мок со
    // значением 'src' показывал бы состояние, которого пользователь щелчком не добьётся.
    expect(synthMock(treeSchema(), { now: NOW }).model.file).toBe('src/app.ts');
  });

  it('множественное дерево — null (не [] и не строка)', () => {
    // Как у остальных мультивыборов: массив в начальном значении стал бы ModelArray, а не листом.
    expect(synthMock(treeSchema(), { now: NOW }).model.files).toBeNull();
  });

  it('treeLike-источник наполняется иерархией с детьми, а не плоскими опциями', () => {
    const { dataSources } = synthMock(treeSchema(), { now: NOW });
    expect(dataSources.PROJECT_TREE).toEqual(mockTreeNodes('PROJECT_TREE'));
    const nodes = dataSources.PROJECT_TREE as Array<{ id: string; children?: unknown[] }>;
    expect(nodes.some((n) => Array.isArray(n.children) && n.children.length > 0)).toBe(true);
    expect(nodes.every((n) => typeof n.id === 'string' && n.id.length > 0)).toBe(true);
  });
});

describe('synthMock — файловые поля', () => {
  /**
   * Регрессия: строка роняла FileUpload (`value.map is not a function`) и вместе с ним ВСЁ превью,
   * а массив модель превратила бы в ModelArray (лист остался бы без сигнала). Верно только `null`.
   */
  it('значение файлового поля — null (не строка и не массив)', () => {
    const schema = {
      version: '1.0',
      root: {
        component: '$component(Box)',
        children: [
          {
            value: '$model(docs)',
            component: '$component(FileUpload)',
            componentProps: { label: 'Документы' },
          },
        ],
      },
    } as unknown as JsonFormSchema;
    expect(synthMock(schema, { now: NOW }).model).toEqual({ docs: null });
  });
});

describe('synthMock — модель', () => {
  it('sampleSchema: select→option1, number по токену, массив descends (initialValue бьёт синтез)', () => {
    const { model } = synthMock(sampleSchema(), { now: NOW });
    expect(model.loanType).toBe('option1'); // связан с LOAN_TYPES → первая опция
    expect(model.loanAmount).toBe(50000); // токен «Сумма»
    // массив properties спускается в item.$template; initialValue { type:'apartment' } побеждает синтез
    expect(model.properties).toEqual([{ type: 'apartment' }]);
  });

  it('seedSchema: заполнены все поля осмысленно', () => {
    const { model } = synthMock(seedSchema(), { now: NOW });
    expect(model.loanType).toBe('option1');
    expect(model.loanAmount).toBe(50000);
    expect(model.comment).toBe('Пример текста');
    expect(model.agree).toBe(false);
  });

  it('токен-эвристики строк/дат', () => {
    const { model } = synthMock(tokenSchema(), { now: NOW });
    expect(model.email).toBe('ivan@example.com');
    expect(model.phone).toBe('+7 999 123-45-67');
    expect(model.firstName).toBe('Иван');
    expect(model.birthDate).toBe('1990-01-01'); // токен «рожд»
    expect(model.startDate).toBe('2026-07-28'); // now ISO
    expect(model.agree).toBe(false);
  });

  it('детерминизм при фиксированном now', () => {
    expect(synthMock(tokenSchema(), { now: NOW })).toEqual(synthMock(tokenSchema(), { now: NOW }));
  });
});

describe('synthMock — источники', () => {
  it('optionLike → 3 опции { value, label }; functionLike исключён из сериализуемого среза', () => {
    const { dataSources } = synthMock(sampleSchema(), { now: NOW });
    expect(dataSources.LOAN_TYPES).toEqual(mockOptions('LOAN_TYPES'));
    expect((dataSources.LOAN_TYPES as unknown[]).length).toBe(3);
    expect(dataSources.PROP_LABEL).toBeUndefined();
  });
});
