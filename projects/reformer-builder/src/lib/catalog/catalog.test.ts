import { describe, expect, it } from 'vitest';
import { defaultPropSchemas } from '@reformer/ui-kit/meta';
import { buildCatalog } from './catalog';
import { BUILTIN_CATALOG, builtinCatalog, builtinEntries } from './__fixtures__/builtin-catalog';
import { kindOf } from '../form-model/node-kind';

describe('buildCatalog', () => {
  const catalog = builtinEntries();

  it('запись есть на каждое имя defaultPropSchemas + синтетические', () => {
    const names = new Set(catalog.map((e) => e.name));
    for (const name of Object.keys(defaultPropSchemas)) expect(names.has(name)).toBe(true);
    // синтетические
    expect(names.has('$html(div)')).toBe(true);
    expect(names.has('$html(h1)')).toBe(true);
    expect(names.has('$html(a)')).toBe(true);
    expect(names.has('FormArray')).toBe(true);
  });

  it('все $html-теги в разделе «HTML» (синтетика билдера), с их props', () => {
    const html = catalog.filter((e) => e.name.startsWith('$html('));
    for (const e of html) expect(e.category).toBe('HTML');

    const h1 = catalog.find((e) => e.name === '$html(h1)')!;
    expect(h1.propsSchema.properties).toHaveProperty('className');
    // text — ключ уровня узла (node.text), не componentProps: правится секцией «Содержимое».
    expect(h1.propsSchema.properties).not.toHaveProperty('text');
    expect(catalog.find((e) => e.name === '$html(a)')!.propsSchema.properties).toHaveProperty(
      'href'
    );
    expect(catalog.find((e) => e.name === '$html(img)')!.propsSchema.properties).toHaveProperty(
      'src'
    );
  });

  it('field-запись несёт wrapper-пропы (label/required) в propsSchema', () => {
    const input = catalog.find((e) => e.name === 'Input')!;
    expect(input.role).toBe('field');
    const props = input.propsSchema.properties ?? {};
    expect(props).toHaveProperty('label');
    expect(props).toHaveProperty('required');
    expect(props).toHaveProperty('type');
  });

  it('propsSchema field-записи не показывает seam как обычный проп', () => {
    const input = catalog.find((e) => e.name === 'Input')!;
    expect(input.propsSchema.properties).not.toHaveProperty('value');
    // но x-runtimeProps сохранён (для валидации/справки), просто скрывается инспектором
    expect(input.propsSchema['x-runtimeProps']).toBeDefined();
  });

  it('makeNode() даёт узел, чей kindOf совпадает с role', () => {
    for (const entry of catalog) {
      expect(kindOf(entry.makeNode())).toBe(entry.role);
    }
  });

  it('категории проставлены', () => {
    expect(catalog.find((e) => e.name === 'Input')!.category).toBe('Поля ввода');
    expect(catalog.find((e) => e.name === 'Box')!.category).toBe('Контейнеры');
    expect(catalog.find((e) => e.name === '$html(div)')!.category).toBe('HTML');
    expect(catalog.find((e) => e.name === 'FormArray')!.category).toBe('Массив');
  });

  it('дескриптор выводится из того же каталога и возвращается вместе с записями', () => {
    // В v1 дескриптор был побочным эффектом сборки (клался в `kits/active`), поэтому «кто его
    // положил» зависело от порядка импортов. Здесь он — часть результата, и проверить это можно.
    const { descriptor } = builtinCatalog();
    expect(descriptor.id).toBe('reformer-ui-kit');
    expect(descriptor.infra.fieldWrapper).toBe('FormField');
    expect(descriptor.leafComponents.has('Icon')).toBe(true);
  });
});

describe('buildCatalog: настройки клиента', () => {
  it('include/exclude сужают набор, categoryByName переопределяет раздел', () => {
    const { entries } = buildCatalog(BUILTIN_CATALOG, {
      components: { include: ['Input', 'Select'] },
      categoryByName: { Input: 'Кастом-поля' },
    });
    expect(entries.map((e) => e.name).sort()).toEqual(['Input', 'Select']);
    expect(entries.find((e) => e.name === 'Input')!.category).toBe('Кастом-поля');
  });

  it('сборка — чистая функция: повторный вызов не зависит от предыдущего', () => {
    const a = buildCatalog(BUILTIN_CATALOG).entries.map((e) => e.name);
    const b = buildCatalog(BUILTIN_CATALOG).entries.map((e) => e.name);
    expect(a).toEqual(b);
  });
});
