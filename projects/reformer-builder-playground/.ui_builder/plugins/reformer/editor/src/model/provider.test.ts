/**
 * Тесты провайдера модели: разбор, печать, круговой обход и выбор «моё — не моё».
 *
 * Круговой обход здесь главный: на нём стоит и сравнение с буфером, и переживание
 * перезагрузки выделением. Если печать перестанет хранить адреса, тест упадёт именно тут,
 * а не в редакторе через неделю.
 *
 * @module plugins/reformer/editor/model/provider.test
 */

import { describe, expect, it } from 'vitest';
import type { JsonNode } from '@reformer/renderer-json';
import { sampleSchema } from '../../../core/testing';
import { nodeIdOf, type NodeIdFactory } from '../../../core/form-model';
import { getAt } from '../../../core/form-model';
import { walkNodes } from '../../../core/form-model';
import type { EditorProbe, ResourceRef } from '@reformer/builder-plugin-api';
import { createFakeSchemaHost } from '../testing';
import { indexNodes } from './node-index';
import { insertOp, SchemaOpError, setPropOp } from './ops';
import {
  createSchemaModelProvider,
  isFormSchemaResource,
  looksLikeFormSchema,
  parseFormSchema,
  printFormSchema,
  SCHEMA_MODEL_PROVIDER_ID,
} from './provider';

function sequentialIds(prefix = 'n'): NodeIdFactory {
  let counter = 0;
  return () => `${prefix}${String((counter += 1)).padStart(7, '0')}`;
}

const SCHEMA_TEXT = JSON.stringify(sampleSchema());

function ref(mediaType = 'application/json'): ResourceRef {
  return {
    id: 'fs:form.json',
    sourceId: 'fs',
    path: 'form.json',
    name: 'form.json',
    kind: 'file',
    mediaType,
  };
}

/** Проба над известным текстом — та, что достаётся кандидатам на пути открытия документа. */
function syncProbe(text: string): EditorProbe {
  return { text: () => Promise.resolve(text), peek: () => text } as EditorProbe;
}

/** Проба без `peek`: содержимое ещё не прочитано (дерево ресурсов даёт именно такую). */
function lazyProbe(text: string): EditorProbe {
  return { text: () => Promise.resolve(text) };
}

describe('parse', () => {
  it('выдаёт адрес каждому узлу схемы', () => {
    const model = parseFormSchema(SCHEMA_TEXT, sequentialIds());
    const missing: string[] = [];
    walkNodes(model, (node, path) => {
      if (nodeIdOf(node) === undefined) missing.push(path.join('/'));
    });
    expect(missing).toEqual([]);
  });

  it('отказывается разбирать не схему', () => {
    expect(() => parseFormSchema('{"name":"пакет"}')).toThrow();
    expect(() => parseFormSchema('нет')).toThrow();
  });

  it('файл с двумя узлами под одним адресом ОТКРЫВАЕТСЯ, а адрес чинится', () => {
    // Так выглядит копипаста поддерева в редакторе текста или склейка двух файлов.
    const twins = JSON.stringify({
      format: 2,
      version: '1.0',
      root: {
        $nodeId: 'rrrrrrrr',
        component: '$html(div)',
        children: [
          { $nodeId: 'aaaaaaaa', model: '$model(a)', component: '$component(Input)' },
          { $nodeId: 'aaaaaaaa', model: '$model(b)', component: '$component(Input)' },
        ],
      },
    });

    const model = parseFormSchema(twins, sequentialIds('n'));
    const ids: string[] = [];
    walkNodes(model, (node) => {
      const id = nodeIdOf(node);
      if (id !== undefined) ids.push(id);
    });
    expect(new Set(ids).size).toBe(ids.length);
    // Первый носитель адрес сохранил: правка, уже нацеленная на него, попадёт куда целилась.
    expect(nodeIdOf(getAt(model, ['root', 'children', 0]) as JsonNode)).toBe('aaaaaaaa');
  });

  it('после починки указатель узлов ведёт к РАЗНЫМ узлам, а не к одному дважды', () => {
    const twins = JSON.stringify({
      format: 2,
      version: '1.0',
      root: {
        $nodeId: 'rrrrrrrr',
        component: '$html(div)',
        children: [
          { $nodeId: 'aaaaaaaa', model: '$model(a)', component: '$component(Input)' },
          { $nodeId: 'aaaaaaaa', model: '$model(b)', component: '$component(Input)' },
        ],
      },
    });
    const model = parseFormSchema(twins, sequentialIds('n'));
    const index = indexNodes(model);
    const first = index.idAt(['root', 'children', 0]);
    const second = index.idAt(['root', 'children', 1]);
    expect(first).not.toBe(second);
    // Именно это и ломал двойник: адрес второго вёл на первый.
    expect(index.find(second!)?.path).toEqual(['root', 'children', 1]);
  });
});

describe('круговой обход', () => {
  it('разобрать → напечатать → разобрать даёт ту же модель', () => {
    const once = parseFormSchema(SCHEMA_TEXT, sequentialIds());
    const twice = parseFormSchema(printFormSchema(once), sequentialIds('другой-'));
    expect(twice).toEqual(once);
  });

  it('печать детерминированна', () => {
    const model = parseFormSchema(SCHEMA_TEXT, sequentialIds());
    expect(printFormSchema(model)).toBe(printFormSchema(model));
  });

  it('печать сохраняет адреса: повторный разбор не выдаёт новых', () => {
    const model = parseFormSchema(SCHEMA_TEXT, sequentialIds('a'));
    const text = printFormSchema(model);
    expect(text).toContain('"$nodeId": "a0000001"');
    const again = parseFormSchema(text, sequentialIds('b'));
    expect(JSON.stringify(again)).not.toContain('"b0');
  });

  it('обход переживает и правку: напечатанное после операции разбирается в то же', () => {
    const provider = createSchemaModelProvider({ newId: sequentialIds('a') });
    const model = provider.parse(SCHEMA_TEXT);
    const root = nodeIdOf(model.root);
    const applied = provider.apply(model, {
      ...insertOp({ component: '$component(Box)', children: [] }, { parent: root }),
    });
    expect(provider.parse(provider.print(applied.model))).toEqual(applied.model);
  });
});

describe('«моё — не моё»', () => {
  it('узнаёт схему формы по содержимому', () => {
    expect(looksLikeFormSchema(SCHEMA_TEXT)).toBe(true);
  });

  it('не берётся за чужой JSON и за неразбираемый текст', () => {
    expect(looksLikeFormSchema('{"name":"reformer","version":"1.0"}')).toBe(false);
    expect(looksLikeFormSchema('[]')).toBe(false);
    expect(looksLikeFormSchema('{ не json }')).toBe(false);
  });

  it('решает по содержимому, а не по расширению', () => {
    expect(isFormSchemaResource(ref(), syncProbe(SCHEMA_TEXT))).toBe(true);
    expect(isFormSchemaResource(ref(), syncProbe('{"name":"пакет"}'))).toBe(false);
  });

  it('не берётся за двоичный и нетекстовый ресурс', () => {
    expect(isFormSchemaResource(ref('image/png'), syncProbe(SCHEMA_TEXT))).toBe(false);
  });

  it('не гадает, когда содержимого нет', () => {
    expect(isFormSchemaResource(ref(), lazyProbe(SCHEMA_TEXT))).toBe(false);
  });
});

describe('вклад', () => {
  it('называется видом ресурса, который оболочка кладёт в контекст применимости', () => {
    expect(createSchemaModelProvider().id).toBe(SCHEMA_MODEL_PROVIDER_ID);
  });

  it('применяет операции тем же генератором адресов, что и разбор', () => {
    const provider = createSchemaModelProvider({ newId: sequentialIds('a') });
    const model = provider.parse(SCHEMA_TEXT);
    const root = nodeIdOf(model.root);
    const result = provider.apply(
      model,
      insertOp({ component: '$component(Box)', children: [] }, { parent: root })
    );
    expect(result.focus).toMatch(/^a\d{7}$/);
  });
});

/**
 * Документ прежнего формата: поля `format` нет, привязки в `value` / `array`, шаги визарда в
 * `componentProps.steps`. Таким файл лежит на диске у форм, собранных до формата 2.
 */
const LEGACY_TEXT = `${JSON.stringify(
  {
    version: '1.0',
    root: {
      component: '$component(RendererFormWizard)',
      componentProps: {
        className: 'bg-white',
        steps: [
          {
            component: '$component(Step)',
            componentProps: { title: 'Кредит' },
            children: [
              {
                value: '$model(loanType)',
                component: '$component(Select)',
                componentProps: { label: 'Тип кредита' },
              },
            ],
          },
          {
            component: '$component(Step)',
            componentProps: { title: 'Имущество' },
            children: [
              {
                array: '$model(properties)',
                item: {
                  $template: {
                    component: '$component(Box)',
                    children: [{ value: '$model(type)', component: '$component(Select)' }],
                  },
                },
              },
            ],
          },
        ],
      },
    },
  },
  null,
  2
)}\n`;

describe('документ прежнего формата', () => {
  const FIELD = ['root', 'children', 0, 'children', 0] as const;

  it('узнаётся как схема формы — до перевода', () => {
    expect(looksLikeFormSchema(LEGACY_TEXT)).toBe(true);
    expect(isFormSchemaResource(ref(), syncProbe(LEGACY_TEXT))).toBe(true);
  });

  it('открывается моделью формата 2: привязки в `model`, шаги — `children` визарда', () => {
    const model = parseFormSchema(LEGACY_TEXT, sequentialIds());
    expect(model.format).toBe(2);
    expect(getAt(model, ['root', 'componentProps'])).toEqual({ className: 'bg-white' });

    const paths: string[] = [];
    walkNodes(model, (node, path) => {
      paths.push(path.join('/'));
      expect(nodeIdOf(node)).toBeDefined();
    });
    expect(paths).toEqual([
      'root',
      'root/children/0',
      'root/children/0/children/0',
      'root/children/1',
      'root/children/1/children/0',
      'root/children/1/children/0/item/$template',
      'root/children/1/children/0/item/$template/children/0',
    ]);
    expect((getAt(model, FIELD) as { model?: string }).model).toBe('$model(loanType)');
  });

  it('открыть → поправить → напечатать: на диск уходит формат 2', () => {
    const provider = createSchemaModelProvider({ newId: sequentialIds('a') });
    const model = provider.parse(LEGACY_TEXT);
    const field = indexNodes(model).idAt(FIELD);
    const applied = provider.apply(model, setPropOp(field!, 'placeholder', 'выберите'));

    const text = provider.print(applied.model);
    expect(text).toContain('"format": 2');
    expect(text).toContain('"model": "$model(loanType)"');
    expect(text).toContain('"model": "$model(properties)"');
    expect(text).toContain('"model": "$model(type)"');
    // Прежних ключей привязки и шагов в пропсах в напечатанном нет.
    expect(text).not.toMatch(/"(value|array)":/);
    expect(text).not.toContain('"steps"');

    const printed = JSON.parse(text) as {
      format: number;
      root: {
        componentProps: Record<string, unknown>;
        children: {
          component: string;
          componentProps: { title: string };
          children: { componentProps?: Record<string, unknown> }[];
        }[];
      };
    };
    expect(printed.format).toBe(2);
    expect(printed.root.componentProps).toEqual({ className: 'bg-white' });
    expect(
      printed.root.children.map((step) => [step.component, step.componentProps.title])
    ).toEqual([
      ['$component(Step)', 'Кредит'],
      ['$component(Step)', 'Имущество'],
    ]);
    // Сама правка тоже на месте — в поле первого шага.
    expect(printed.root.children[0].children[0].componentProps).toEqual({
      label: 'Тип кредита',
      placeholder: 'выберите',
    });

    // Напечатанное — уже формат 2: повторный разбор ничего не переводит и не перевыдаёт.
    expect(provider.parse(text)).toEqual(applied.model);
  });

  it('открытие файл не переписывает — его переписывает первая правка', () => {
    const host = createFakeSchemaHost({ text: LEGACY_TEXT });
    const handle = host.modelOf('fake:form.json');
    expect(handle).not.toBeNull();
    expect(host.written).toEqual([]);

    const field = indexNodes(handle!.document.getModel()).idAt(FIELD);
    expect(handle!.apply(setPropOp(field!, 'placeholder', 'выберите')).status).toBe('applied');
    expect(host.written).toHaveLength(1);
    expect(host.written[0]).toContain('"format": 2');
    expect(host.written[0]).not.toMatch(/"(value|array)":/);
    expect(host.written[0]).not.toContain('"steps"');
  });
});

describe('подформа и массив с именованной частью', () => {
  /** Формат 2 с `parts`: править части редактор пока не умеет, но открывать обязан. */
  const PARTS_TEXT = `${JSON.stringify(
    {
      format: 2,
      version: '1.0',
      parts: {
        address: {
          component: '$component(Box)',
          children: [{ model: '$model(city)', component: '$component(Input)' }],
        },
      },
      root: {
        component: '$component(Box)',
        children: [
          { model: '$model(home)', part: '$part(address)' },
          { model: '$model(offices)', item: '$part(address)' },
        ],
      },
    },
    null,
    2
  )}\n`;

  it('документ открывается, узлы получают адреса и попадают в указатель', () => {
    const provider = createSchemaModelProvider({ newId: sequentialIds('a') });
    const model = provider.parse(PARTS_TEXT);
    const entries = indexNodes(model).entries();
    expect(entries.map((entry) => entry.path.join('/'))).toEqual([
      'root',
      'root/children/0',
      'root/children/1',
    ]);
    // Ссылки на часть целы: строка `item` шаблоном не подменяется.
    expect(getAt(model, ['root', 'children', 0, 'part'])).toBe('$part(address)');
    expect(getAt(model, ['root', 'children', 1, 'item'])).toBe('$part(address)');
    expect(provider.nodePaths?.(model).size).toBe(3);
  });

  it('круговой обход и правка рядом с ними части не портят', () => {
    const provider = createSchemaModelProvider({ newId: sequentialIds('a') });
    const model = provider.parse(PARTS_TEXT);
    expect(provider.parse(provider.print(model))).toEqual(model);

    const root = nodeIdOf(model.root);
    const applied = provider.apply(
      model,
      insertOp({ model: '$model(name)', component: '$component(Input)' }, { parent: root })
    );
    const printed = JSON.parse(provider.print(applied.model)) as {
      parts: unknown;
      root: { children: Record<string, unknown>[] };
    };
    expect(printed.parts).toEqual((JSON.parse(PARTS_TEXT) as { parts: unknown }).parts);
    expect(printed.root.children).toHaveLength(3);
    expect(printed.root.children[0]).toMatchObject({
      model: '$model(home)',
      part: '$part(address)',
    });
    expect(printed.root.children[1]).toMatchObject({
      model: '$model(offices)',
      item: '$part(address)',
    });
  });

  it('в подформу и в массив с частью вложить нельзя: детей в узле у них нет', () => {
    const provider = createSchemaModelProvider({ newId: sequentialIds('a') });
    const model = provider.parse(PARTS_TEXT);
    const index = indexNodes(model);
    const node = { model: '$model(x)', component: '$component(Input)' } as JsonNode;
    for (const path of [
      ['root', 'children', 0],
      ['root', 'children', 1],
    ]) {
      const parent = index.idAt(path);
      expect(() => provider.apply(model, insertOp(node, { parent }))).toThrow(SchemaOpError);
    }
  });
});
