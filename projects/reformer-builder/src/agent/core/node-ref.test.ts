import { describe, expect, it } from 'vitest';
import type { JsonNode } from '@reformer/renderer-json';
import { appendNode, emptySchema, getAt } from '../../model';
import { P, sampleSchema } from '../../model/__fixtures__/sample-schema';
import {
  componentOf,
  isResolved,
  labelOf,
  modelOf,
  nodeRef,
  refToPath,
  resolveRef,
} from './node-ref';

const at = (schema: unknown, path: readonly (string | number)[]) => getAt(schema, path) as JsonNode;

describe('адрес узла (Pointer ⇄ путь)', () => {
  it('round-trip через строку сохраняет доступ к узлу', () => {
    const schema = sampleSchema();
    const ref = nodeRef(P.arrayTemplate);
    expect(ref).toBe('/root/componentProps/steps/1/children/0/item/$template');
    expect(getAt(schema, refToPath(ref))).toBe(at(schema, P.arrayTemplate));
  });
});

describe('чтение узла', () => {
  it('componentOf: компонент, html-тег и array без component', () => {
    const schema = sampleSchema();
    expect(componentOf(at(schema, P.step0field0))).toBe('Select');
    expect(componentOf(at(schema, P.array))).toBe('FormArray');
    const html = { component: '$html(div)', children: [] } as unknown as JsonNode;
    expect(componentOf(html)).toBe('$html(div)');
  });

  it('modelOf: поле и массив, у контейнера — undefined', () => {
    const schema = sampleSchema();
    expect(modelOf(at(schema, P.step0field0))).toBe('loanType');
    expect(modelOf(at(schema, P.array))).toBe('properties');
    expect(modelOf(at(schema, P.step0))).toBeUndefined();
  });

  it('labelOf: label поля и title шага', () => {
    const schema = sampleSchema();
    expect(labelOf(at(schema, P.step0field0))).toBe('Тип кредита');
    expect(labelOf(at(schema, P.step0))).toBe('Кредит');
  });
});

describe('resolveRef', () => {
  it('находит узел без ожидания', () => {
    const schema = sampleSchema();
    const found = resolveRef(schema, nodeRef(P.step0field1));
    expect(isResolved(found)).toBe(true);
    if (isResolved(found)) expect(componentOf(found.node)).toBe('Input');
  });

  it('несуществующий адрес → STALE_POINTER', () => {
    const found = resolveRef(sampleSchema(), '/root/children/42');
    expect(isResolved(found)).toBe(false);
    if (!isResolved(found)) expect(found.error?.code).toBe('STALE_POINTER');
  });

  it('адрес слота не выдаётся за устаревший — подсказывает узел-держатель', () => {
    // Живой прогон: модель позвала insert_node с parent="/root/children", получила «форму
    // изменили — перезапроси get_form_outline» и перечитала карту пять раз подряд, упершись в
    // предел шагов. Форму никто не менял: адрес указывал на слот, и совет был ложным.
    const found = resolveRef(sampleSchema(), '/root/children');
    expect(isResolved(found)).toBe(false);
    if (!isResolved(found)) {
      expect(found.text).toContain('is a slot');
      expect(found.text).toContain('/root');
      expect(found.text).not.toContain('get_form_outline');
    }
  });

  it('индекс за пределами слота называет, сколько детей есть', () => {
    // «Перезапроси карту» здесь бесполезно: карта уже прочитана, и в контейнере просто нет
    // столько детей. В прогонах модель на этом сообщении зависала.
    const found = resolveRef(sampleSchema(), '/root/componentProps/steps/0/children/9');
    expect(isResolved(found)).toBe(false);
    if (!isResolved(found)) {
      expect(found.text).toContain('has 2 child(ren)');
      expect(found.text).toContain('0…1');
    }
  });

  it('пустой контейнер объясняет, куда класть первый узел', () => {
    const found = resolveRef(emptySchema(), '/root/children/0');
    expect(isResolved(found)).toBe(false);
    if (!isResolved(found)) {
      expect(found.text).toContain('is still empty');
      expect(found.text).toContain('parent=/root');
    }
  });

  it('слот шагов тоже подсказывает держателя', () => {
    const found = resolveRef(sampleSchema(), '/root/componentProps/steps');
    expect(isResolved(found)).toBe(false);
    if (!isResolved(found)) expect(found.text).toContain('/root');
  });

  it('ожидание компонента не совпало → STALE_POINTER', () => {
    const found = resolveRef(sampleSchema(), nodeRef(P.step0field0), { component: 'Input' });
    expect(isResolved(found)).toBe(false);
    if (!isResolved(found)) expect(found.error?.message).toContain('Expected Input');
  });

  it('ожидание модели не совпало → STALE_POINTER', () => {
    const found = resolveRef(sampleSchema(), nodeRef(P.step0field0), { model: 'loanAmount' });
    expect(isResolved(found)).toBe(false);
  });

  it('съехавший после вставки соседа адрес ловится ожиданием, а не правит чужой узел', () => {
    // Агент увидел loanAmount по индексу 1 и собрался его править.
    const before = sampleSchema();
    const ref = nodeRef(P.step0field1);
    expect(modelOf(at(before, refToPath(ref)))).toBe('loanAmount');

    // Пользователь тем временем вставил поле в начало того же слота — индексы сдвинулись.
    const inserted = { value: '$model(inn)', component: '$component(Input)' } as JsonNode;
    const { schema } = appendNode(before, [...P.step0children], inserted);
    const moved = { ...schema } as typeof schema;
    const children = getAt(moved, [...P.step0children]) as JsonNode[];
    children.unshift(children.pop() as JsonNode);

    // Без ожидания правка ушла бы в соседний узел; с ожиданием — честная ошибка.
    expect(modelOf(at(moved, refToPath(ref)))).not.toBe('loanAmount');
    const found = resolveRef(moved, ref, { model: 'loanAmount' });
    expect(isResolved(found)).toBe(false);
    if (!isResolved(found)) expect(found.error?.code).toBe('STALE_POINTER');
  });
});
