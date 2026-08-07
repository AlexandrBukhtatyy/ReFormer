/**
 * Реестр Runtime-preview: `имя → React-компонент` — строится ДАННЫМИ из каталога (`getCatalog()`),
 * тем же источником, что и палитра, поэтому с ней не расходится (спека §9). Для каждой registrable
 * записи `render-policy` резолвит либо живой компонент активного кита, либо нейтральный стаб
 * «предпросмотр ограничен».
 *
 * Статических импортов `@reformer/ui-kit` здесь больше нет: namespace приходит из
 * {@link getActiveNamespace}, а правило резолва и INFRA-имена — из дескриптора активного кита.
 * Конкретный кит живёт в `kits/adapters/*`.
 *
 * Плюс INFRA-имена ВНЕ палитрового каталога, но нужные рендереру: враппер поля (он же
 * `FIELD_WRAPPER`), граница async и `List`.
 *
 * Палитровые compound'ы `Wizard`/`Step` — builder-адаптеры поверх рендерера, а не компоненты кита:
 * {@link PreviewStep} и {@link createWizardPreview} над тем символом, который кит объявил в
 * `descriptor.adapters.wizard`. Кит без пошаговой формы адаптера не получает, и записи `Wizard`/
 * `Step` штатно деградируют в стаб.
 *
 * @module reformer-builder/preview-runtime/known-components
 */

import type * as React from 'react';
import type { ComponentType } from 'react';
import { getCatalog } from '../catalog';
import { getActiveDescriptor } from '../kits/active';
import { getActiveNamespace } from '../kits/runtime';
import type { KitDescriptor, KitNamespace } from '../kits/types';
import { classify, isRegistrable } from './render-policy';
import { isolateComponent } from './isolate-component';
import { makePreviewLimitedComponent } from './unknown-component';
import { PreviewStep } from './preview-step';
import { createWizardPreview, type KitFormWizard } from './wizard-preview';
import { INFRA_NAMES } from './known-names';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Namespace для резолва: компоненты кита плюс builder-адаптеры визарда. Под именами `Wizard`/`Step`
 * у кита экспортов нет и быть не должно — это узлы схемы билдера, а не компоненты дизайн-системы.
 */
function previewNamespace(descriptor: KitDescriptor, kit: KitNamespace): KitNamespace {
  const wizardSymbol = descriptor.adapters.wizard?.symbol;
  const FormWizard = wizardSymbol ? kit[wizardSymbol] : undefined;
  if (!FormWizard) return kit;
  return {
    ...kit,
    Wizard: createWizardPreview(FormWizard as KitFormWizard),
    // Builder-версия шага с DOM-обёрткой: cdk-шаг рендерит голый фрагмент, на который не сядет
    // класс-токен превью.
    Step: PreviewStep,
  };
}

/** Компоненты для INFRA-имён (вне каталога) — по именам, которые объявил дескриптор кита. */
function infraLookup(descriptor: KitDescriptor, ns: KitNamespace): Record<string, unknown> {
  return {
    FormField: ns[descriptor.infra.fieldWrapper],
    AsyncBoundary: ns[descriptor.infra.asyncBoundary],
    List: ns[descriptor.infra.list],
  };
}

/**
 * Собрать карту `имя → компонент` из каталога. Каждый компонент изолируется
 * ({@link isolateComponent}): падение одного контрола показывает плашку вместо того, чтобы
 * обрушить всё превью.
 */
export function buildKnownComponents(
  descriptor: KitDescriptor = getActiveDescriptor(),
  kit: KitNamespace = getActiveNamespace()
): Record<string, ComponentType<any>> {
  const ns = previewNamespace(descriptor, kit);
  const infra = infraLookup(descriptor, ns);
  const map: Record<string, ComponentType<any>> = {};

  for (const name of INFRA_NAMES) {
    const component = infra[name];
    // Кит, не поставивший INFRA-компонент, не должен ронять сборку реестра: показываем стаб.
    map[name] = isolateComponent(
      (component as ComponentType<any>) ??
        makePreviewLimitedComponent(name, `нет в ${descriptor.package}`),
      name
    );
  }

  for (const entry of getCatalog()) {
    if (!isRegistrable(entry)) continue;
    const decision = classify(entry, ns, descriptor);
    map[entry.name] = isolateComponent(
      decision.policy === 'live'
        ? decision.component
        : makePreviewLimitedComponent(entry.name, decision.reason),
      entry.name
    );
  }
  return map;
}

/**
 * Обёртка поддерева превью от активного кита, если он её объявил
 * (`descriptor.adapters.provider`). Нужна китам, чей рендер требует контекста: тема
 * styled-components, i18n, конфиг портала. `undefined` — обёртка не нужна (так у ui-kit).
 */
export function kitProviderComponent(): ComponentType<{ children?: React.ReactNode }> | undefined {
  const symbol = getActiveDescriptor().adapters.provider?.symbol;
  if (!symbol) return undefined;
  const component = getActiveNamespace()[symbol];
  return typeof component === 'function' || (typeof component === 'object' && component !== null)
    ? (component as ComponentType<{ children?: React.ReactNode }>)
    : undefined;
}

/** Мемо реестра: пересобирается только после {@link resetKnownComponents} (смена кита — этап 3). */
let cache: Record<string, ComponentType<any>> | null = null;

/** Дефолтный реестр preview: имя → React-компонент (каталог + INFRA). */
export function knownComponents(): Record<string, ComponentType<any>> {
  return (cache ??= buildKnownComponents());
}

/** Сбросить мемо реестра (тесты; смена активного кита — этап 3). */
export function resetKnownComponents(): void {
  cache = null;
}

/**
 * Классификация каждой registrable-записи каталога (для тестов/диагностики). React-зависима
 * (тянет namespace кита) — использовать только в jsdom-тестах, не в node-suite.
 */
export function classifyCatalog(): Array<{
  name: string;
  policy: 'live' | 'limited';
  reason?: string;
}> {
  const descriptor = getActiveDescriptor();
  const ns = previewNamespace(descriptor, getActiveNamespace());
  return getCatalog()
    .filter(isRegistrable)
    .map((entry) => {
      const d = classify(entry, ns, descriptor);
      return d.policy === 'live'
        ? { name: entry.name, policy: 'live' as const }
        : { name: entry.name, policy: 'limited' as const, reason: d.reason };
    });
}
