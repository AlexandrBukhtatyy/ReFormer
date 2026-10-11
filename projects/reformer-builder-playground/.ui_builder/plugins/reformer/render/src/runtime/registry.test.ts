/**
 * Реестр превью: визард и шаг.
 *
 * Хозяева шагов и `Step` — синтетика каталога: кит под этими именами ничего не экспортирует.
 * Пока шаги лежали в пропсе, превью рисовало на их месте стаб без шагов. Теперь шаги — дети
 * узла, и рисовать их обязан визард кита; что он подключён, проверяется здесь, без DOM.
 *
 * @module plugins/reformer/render/runtime/registry.test
 */

import { describe, expect, it } from 'vitest';
import { toDescriptor } from '@reformer/builder-plugin-api';
import type { KitNamespace } from '@reformer/builder-plugin-api';
import { sampleSchema } from '../../../core/testing';
import { buildComponents } from './registry';
import { resolveWizard } from './policy';

function KitWizard(): null {
  return null;
}
// Статик-контракт: по нему рендерер отдаёт компоненту узлы-детей и функцию их отрисовки.
(KitWizard as unknown as { __selfManagedChildren: boolean }).__selfManagedChildren = true;

const WITH_WIZARD = toDescriptor({
  version: '1.0',
  kit: { package: '@test/kit', adapters: { wizard: { symbol: 'KitWizard' } } },
  components: [],
} as never);

const WITHOUT_WIZARD = toDescriptor({
  version: '1.0',
  kit: { package: '@test/kit', adapters: { wizard: null } },
  components: [],
} as never);

const NAMESPACE: KitNamespace = { KitWizard };

function componentsOf(descriptor: typeof WITH_WIZARD, namespace: KitNamespace) {
  return buildComponents({
    schema: sampleSchema(),
    catalog: [],
    descriptor,
    namespace,
    dataSources: {},
  });
}

describe('resolveWizard', () => {
  it('берёт компонент кита по символу адаптера', () => {
    expect(resolveWizard(WITH_WIZARD, NAMESPACE)).toBe(KitWizard);
  });

  it('кит без адаптера или без символа в namespace визарда не даёт', () => {
    expect(resolveWizard(WITHOUT_WIZARD, NAMESPACE)).toBeUndefined();
    expect(resolveWizard(WITH_WIZARD, {})).toBeUndefined();
  });
});

describe('buildComponents: визард', () => {
  it('все хозяева шагов рисуются визардом кита и сохраняют его статик-контракт', () => {
    const components = componentsOf(WITH_WIZARD, NAMESPACE);
    for (const name of ['Wizard', 'FormWizard', 'RendererFormWizard']) {
      const component = components[name] as unknown as { __selfManagedChildren?: boolean };
      expect(component, name).toBeDefined();
      // Без статика рендерер нарисовал бы шаги сам, подряд, и визард не узнал бы о них.
      expect(component.__selfManagedChildren, name).toBe(true);
    }
  });

  it('шаг зарегистрирован всегда — его тело рисуется и без визарда кита', () => {
    expect(componentsOf(WITH_WIZARD, NAMESPACE).Step).toBeDefined();
    expect(componentsOf(WITHOUT_WIZARD, {}).Step).toBeDefined();
  });

  it('кит без визарда хозяев шагов не регистрирует — они уйдут в подписанные заглушки', () => {
    const components = componentsOf(WITHOUT_WIZARD, {});
    expect(components.Wizard).toBeUndefined();
    expect(components.RendererFormWizard).toBeUndefined();
  });
});
