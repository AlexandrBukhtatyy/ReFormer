/**
 * Структурный линт: формы из живых прогонов ассистента — по схеме валидные, на экране мёртвые.
 *
 * @module reformer-builder/io/structure-lint.test
 */

import { describe, expect, it } from 'vitest';
import type { JsonFormSchema } from '@reformer/renderer-json';
import { makeNodeFor } from '../catalog';
import { validateSchema } from './validate';
import { lintStructure } from './structure-lint';

const schemaOf = (root: unknown): JsonFormSchema =>
  structuredClone({ version: '1.0', root }) as JsonFormSchema;

const trigger = (value?: string) => ({
  component: '$component(TabsTrigger)',
  ...(value === undefined ? {} : { componentProps: { value } }),
  children: ['Вкладка'],
});

const panel = (value?: string) => ({
  component: '$component(TabsContent)',
  ...(value === undefined ? {} : { componentProps: { value } }),
  children: [],
});

const tabs = (props: Record<string, unknown>, triggers: unknown[], panels: unknown[]) =>
  schemaOf({
    component: '$component(Box)',
    children: [
      {
        component: '$component(Tabs)',
        componentProps: props,
        children: [{ component: '$component(TabsList)', children: triggers }, ...panels],
      },
    ],
  });

describe('вкладки', () => {
  it('исправные вкладки замечаний не дают', () => {
    const schema = tabs(
      { defaultValue: 'a' },
      [trigger('a'), trigger('b')],
      [panel('a'), panel('b')]
    );
    expect(lintStructure(schema)).toEqual([]);
  });

  it('скелет из палитры чист — эталон семейства', () => {
    // Если бы правила расходились с тем, что создаёт сам билдер, они ловили бы собственную вставку.
    const schema = schemaOf({
      component: '$component(Box)',
      children: [makeNodeFor('Tabs', 'container')],
    });
    expect(lintStructure(schema)).toEqual([]);
  });

  it('панель без вкладки: содержимое недостижимо', () => {
    // Прогон 1: агент удалил рабочий триггер, четыре поля третьего шага остались без входа.
    const schema = tabs({ defaultValue: 'a' }, [trigger('a')], [panel('a'), panel('b')]);
    const warnings = lintStructure(schema);
    expect(warnings.join('\n')).toContain('панель value="b" без вкладки');
  });

  it('вкладка без панели: откроется пустота', () => {
    const schema = tabs({ defaultValue: 'a' }, [trigger('a'), trigger('b')], [panel('a')]);
    expect(lintStructure(schema).join('\n')).toContain('вкладка value="b" без панели');
  });

  it('вкладка и панель вовсе без value', () => {
    // Прогон 2: в DOM это trigger-undefined/content-undefined — работает случайно, до второй такой.
    const schema = tabs({}, [trigger()], [panel()]);
    const text = lintStructure(schema).join('\n');
    expect(text).toContain('у вкладки нет value');
    expect(text).toContain('у панели нет value');
  });

  it('defaultValue в пустоту: не открыта ни одна вкладка', () => {
    // Прогон 2 дословно: defaultValue="step1", а триггеры — tab-1/tab-2. Форма выглядела пустой.
    const schema = tabs({ defaultValue: 'step1' }, [trigger('tab-1')], [panel('tab-1')]);
    expect(lintStructure(schema).join('\n')).toContain('defaultValue="step1"');
  });
});

describe('шаги мастера', () => {
  it('исправный мастер замечаний не даёт', () => {
    const schema = schemaOf(makeNodeFor('Wizard', 'container'));
    expect(lintStructure(schema)).toEqual([]);
  });

  it('поле вместо шага', () => {
    // Ровно то, что раньше делал insert_node молча: поле вставало страницей мастера.
    const schema = schemaOf({
      component: '$component(Wizard)',
      componentProps: {
        steps: [{ value: '$model(a.b)', component: '$component(Input)' }],
      },
    });
    expect(lintStructure(schema).join('\n')).toContain('шагом мастера стоит Input');
  });

  it('Box шагом — законно: реальные формы так и устроены', () => {
    const schema = schemaOf({
      component: '$component(Wizard)',
      componentProps: {
        steps: [{ component: '$component(Box)', children: [] }],
      },
    });
    expect(lintStructure(schema)).toEqual([]);
  });
});

describe('связь с гейтом валидации', () => {
  it('замечания не делают форму невалидной', () => {
    // Применение хода (agent/apply) требует полной валидности: ошибка здесь заблокировала бы
    // агенту работу на любой чужой форме с изъяном, включая попытку её починить.
    const schema = tabs({ defaultValue: 'нет-такой' }, [trigger('a')], [panel('a')]);
    const res = validateSchema(schema, { strict: true, baseline: schema });
    expect(res.valid).toBe(true);
    expect(res.warnings.length).toBeGreaterThan(0);
  });

  it('в мягком режиме замечаний нет — ручное сохранение их не ждёт', () => {
    const schema = tabs({ defaultValue: 'нет-такой' }, [trigger('a')], [panel('a')]);
    expect(validateSchema(schema).warnings).toEqual([]);
  });
});
