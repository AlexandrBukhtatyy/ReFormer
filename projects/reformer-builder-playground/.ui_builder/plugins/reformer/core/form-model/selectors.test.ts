import { describe, expect, it } from 'vitest';
import type { JsonFormSchema } from '@reformer/renderer-json';
import {
  ensureSelector,
  selectorOf,
  setNodeSelector,
  suggestSelector,
  uniqueSelector,
} from './selectors';
import { findByPath } from './query';

const schema = (): JsonFormSchema =>
  ({
    version: '1.0',
    root: {
      component: '$html(div)',
      children: [
        {
          component: '$component(Section)',
          componentProps: { title: 'Доставка' },
          selector: 'dostavka-section',
          children: [],
        },
        {
          value: '$model(applicant.email)',
          component: '$component(Input)',
          componentProps: { label: 'Электронная почта' },
        },
        { value: '$model(amount)', component: '$component(Input)' },
      ],
    },
  }) as unknown as JsonFormSchema;

const at = (s: JsonFormSchema, i: number) => findByPath(s, ['root', 'children', i])!;

describe('suggestSelector — имя, понятное человеку', () => {
  it('берёт подпись и транслитерирует её', () => {
    expect(suggestSelector(at(schema(), 1))).toBe('elektronnaya-pochta');
  });

  it('без подписи откатывается на путь модели', () => {
    expect(suggestSelector(at(schema(), 2))).toBe('amount');
  });
});

describe('uniqueSelector — занятые имена берутся из схемы', () => {
  it('свободное имя отдаётся как есть', () => {
    expect(uniqueSelector(schema(), 'summa')).toBe('summa');
  });

  it('занятое получает суффикс', () => {
    expect(uniqueSelector(schema(), 'dostavka-section')).toBe('dostavka-section-2');
  });

  it('собственное имя узла занятым не считается — иначе переименование в себя плодило бы -2', () => {
    expect(uniqueSelector(schema(), 'dostavka-section', 'dostavka-section')).toBe(
      'dostavka-section'
    );
  });
});

describe('setNodeSelector', () => {
  it('задаёт селектор полю, у которого его не было', () => {
    const out = setNodeSelector(schema(), ['root', 'children', 2], 'summa');
    expect(selectorOf(at(out.schema, 2))).toBe('summa');
  });

  it('пустая строка убирает ключ', () => {
    const out = setNodeSelector(schema(), ['root', 'children', 0], '  ');
    expect(selectorOf(at(out.schema, 0))).toBeUndefined();
    expect('selector' in (at(out.schema, 0) as object)).toBe(false);
  });

  it('коллизия разводится, а не перетирает чужой адрес', () => {
    // Два узла с одним селектором — правило досталось бы первому попавшемуся, и понять, почему
    // оно «иногда работает», было бы нечем.
    const out = setNodeSelector(schema(), ['root', 'children', 2], 'dostavka-section');
    expect(selectorOf(at(out.schema, 2))).toBe('dostavka-section-2');
    expect(selectorOf(at(out.schema, 0))).toBe('dostavka-section');
  });

  it('схема не мутируется', () => {
    const before = schema();
    const snapshot = JSON.stringify(before);
    setNodeSelector(before, ['root', 'children', 2], 'x');
    expect(JSON.stringify(before)).toBe(snapshot);
  });
});

describe('ensureSelector — точка, которой пользуется инструмент агента', () => {
  it('существующий селектор возвращается как есть, схема не трогается', () => {
    const s = schema();
    const out = ensureSelector(s, ['root', 'children', 0])!;
    expect(out.selector).toBe('dostavka-section');
    expect(out.created).toBe(false);
    expect(out.schema).toBe(s);
  });

  it('отсутствующий выводится и проставляется', () => {
    const out = ensureSelector(schema(), ['root', 'children', 1])!;
    expect(out.selector).toBe('elektronnaya-pochta');
    expect(out.created).toBe(true);
    expect(selectorOf(at(out.schema, 1))).toBe('elektronnaya-pochta');
  });

  it('несуществующий узел даёт null, а не выдуманный адрес', () => {
    expect(ensureSelector(schema(), ['root', 'children', 99])).toBeNull();
  });
});
