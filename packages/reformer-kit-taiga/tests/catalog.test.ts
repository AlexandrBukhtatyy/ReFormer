/**
 * Каталог кита (`component-catalog.json`, вход `./catalog`) — то, по чему кит узнают читатели
 * каталога: генератор форм, его проверки, подсказки. Он обязан говорить о ките правду: каждая
 * запись — компонент входа пакета, каждый проп записи компонент объявляет входом, а входы
 * компонента, которые задаются в `componentProps`, в записи есть.
 */
import { reflectComponentType, type Type } from '@angular/core';
import { loadCatalogValidator } from '@reformer/builder-plugin-api/tooling';
import { describe, expect, it } from 'vitest';
import catalog from '../component-catalog.json';
import manifest from '../package.json';
import * as kit from '../src/public-api';

/** Входы, которые подставляет форма или рендерер: в `componentProps` их не бывает. */
const SUPPLIED = new Set(['value', 'control', 'disabled', 'children', 'onSubmit', 'data-testid']);
/** Мета-проп: `data-testid` из него выводит рендерер. */
const META = new Set(['testId']);

type Entry = (typeof catalog.components)[number];

const components = Object.entries(kit).flatMap(([name, value]) => {
  if (typeof value !== 'function') return [];
  const mirror = reflectComponentType(value as Type<unknown>);
  return mirror ? [[name, mirror.inputs.map((input) => input.templateName)] as const] : [];
});

const declared = (name: string): readonly string[] => {
  const inputs = components.find(([exported]) => exported === name)?.[1];
  if (!inputs) throw new Error(`во входе пакета нет компонента ${name}`);
  return inputs;
};

const catalogProps = (entry: Entry): string[] => Object.keys(entry.propsSchema.properties);

describe('каталог кита Taiga UI', () => {
  it('проходит контракт каталога', async () => {
    const validate = await loadCatalogValidator();
    expect(validate(catalog).errors).toEqual([]);
  });

  it('называет свой пакет, фреймворк Angular и отсутствие обёртки поля', () => {
    expect(catalog.kit.package).toBe(manifest.name);
    expect(catalog.kit.codegen.importSpecifier).toBe(manifest.name);
    expect(catalog.kit.framework).toBe('angular');
    expect(catalog.kit.infra.fieldWrapper).toBeNull();
    expect(manifest.exports['./catalog']).toBe('./component-catalog.json');
  });

  it('записи — ровно компоненты входа пакета', () => {
    expect(catalog.components.map((entry) => entry.name).sort()).toEqual(
      components.map(([name]) => name).sort()
    );
  });

  it('адаптеры — экспорты входа пакета', () => {
    const { wizard, step, provider } = catalog.kit.adapters;
    for (const symbol of [wizard.symbol, step.symbol, provider.symbol]) {
      expect(kit, symbol).toHaveProperty(symbol);
    }
  });

  it('каждый проп записи компонент объявляет входом', () => {
    for (const entry of catalog.components) {
      const own = new Set(declared(entry.name));
      const foreign = catalogProps(entry).filter((prop) => !own.has(prop) && !META.has(prop));
      expect(foreign, entry.name).toEqual([]);
    }
  });

  it('каждый вход компонента, кроме подставляемых формой, описан в записи', () => {
    for (const entry of catalog.components) {
      const listed = new Set(catalogProps(entry));
      const missing = declared(entry.name).filter(
        (prop) => !SUPPLIED.has(prop) && !listed.has(prop)
      );
      expect(missing, entry.name).toEqual([]);
    }
  });
});
