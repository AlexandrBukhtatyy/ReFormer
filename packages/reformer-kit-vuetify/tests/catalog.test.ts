/**
 * Каталог кита (`component-catalog.json`, вход `./catalog`) — то, по чему кит узнают читатели
 * каталога: генератор форм, его проверки, подсказки. Он обязан говорить о ките правду: каждая
 * запись — компонент входа пакета, каждый проп записи компонент объявляет, а пропсы компонента,
 * которые задаются в `componentProps`, в записи есть.
 */
import { describe, expect, it } from 'vitest';
import { loadCatalogValidator } from '@reformer/builder-plugin-api/tooling';
import catalog from '../component-catalog.json';
import manifest from '../package.json';
import * as kit from '../src/index';

/** Пропсы, которые подставляет форма или рендерер: в `componentProps` их не бывает. */
const SUPPLIED = new Set([
  'modelValue',
  'control',
  'disabled',
  'children',
  'renderNode',
  'onSubmit',
]);
/** Мета-проп: `data-testid` из него выводит рендерер, компонент его не объявляет. */
const META = new Set(['testId']);

type Entry = (typeof catalog.components)[number];

const components = (Object.entries(kit) as [string, unknown][]).filter(
  ([, value]) => typeof value === 'object' && value !== null && 'props' in value
) as [string, { props: Record<string, unknown> | string[] }][];

const declared = (name: string): string[] => {
  const component = components.find(([exported]) => exported === name)?.[1];
  if (!component) throw new Error(`во входе пакета нет компонента ${name}`);
  return Array.isArray(component.props) ? component.props : Object.keys(component.props);
};

const catalogProps = (entry: Entry): string[] => Object.keys(entry.propsSchema.properties);

describe('каталог кита Vuetify', () => {
  it('проходит контракт каталога', async () => {
    const validate = await loadCatalogValidator();
    expect(validate(catalog).errors).toEqual([]);
  });

  it('называет свой пакет, фреймворк Vue и отсутствие обёртки поля', () => {
    expect(catalog.kit.package).toBe(manifest.name);
    expect(catalog.kit.codegen.importSpecifier).toBe(manifest.name);
    expect(catalog.kit.framework).toBe('vue');
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

  it('каждый проп записи компонент объявляет', () => {
    for (const entry of catalog.components) {
      const own = new Set(declared(entry.name));
      const foreign = catalogProps(entry).filter((prop) => !own.has(prop) && !META.has(prop));
      expect(foreign, entry.name).toEqual([]);
    }
  });

  it('каждый проп компонента, кроме подставляемых формой, описан в записи', () => {
    for (const entry of catalog.components) {
      const listed = new Set(catalogProps(entry));
      const missing = declared(entry.name).filter(
        (prop) => !SUPPLIED.has(prop) && !listed.has(prop)
      );
      expect(missing, entry.name).toEqual([]);
    }
  });
});
