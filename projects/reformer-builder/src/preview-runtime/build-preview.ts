/**
 * Сборка бандла Runtime-preview: `{ registry, model, form }` для `<JsonFormRenderer>` (спека §9).
 *
 * Как в эталоне (`CreditApplicationFormRendererJson`): строится модель, реестр (ui-kit +
 * `FIELD_WRAPPER` + плейсхолдеры неизвестных `$component` + значения источников) и **форма** через
 * `createForm({ model, schema: convertJsonToM1Tree(...) })`. Именно `createForm` создаёт form-node'ы,
 * привязанные к сигналам модели — без него рендерер пишет «No form node for signal …» и не рисует
 * поля.
 *
 * Модель и значения источников по умолчанию берутся из {@link synthMock} (представительный мок,
 * а не пустые дефолты) — поэтому форма в превью сразу заполнена, Select с опциями. Вызывающий может
 * передать свой {@link MockData} (правки из панели мок-данных). Behavior/validation — не здесь
 * (данные-only путь; поведение/валидация — режим `live`, Фаза 3).
 *
 * @module reformer-builder/preview-runtime/build-preview
 */

import { createForm, createModel } from '@reformer/core';
import type { FormModel } from '@reformer/core';
import {
  convertJsonToM1Tree,
  defineRegistry,
  FIELD_WRAPPER,
  type ComponentRegistry,
  type JsonFormSchema,
} from '@reformer/renderer-json';
import { KNOWN_COMPONENTS } from './known-components';
import { registerMockSources } from './mock-sources';
import { synthMock, type MockData } from './mock-synth';
import { collectUnknownComponentNames } from './unknown';
import { makeUnknownComponent } from './unknown-component';

/** Бандл для монтирования Runtime-preview. `form` удерживается, чтобы form-node'ы не собрал GC. */
export interface PreviewBundle {
  registry: ComponentRegistry;
  model: FormModel<Record<string, unknown>>;
  form: unknown;
}

/**
 * Реестр превью: ui-kit-компоненты + `FIELD_WRAPPER` + плейсхолдеры неизвестных `$component` +
 * значения `$dataSource/$fn/$locale`. Вынесен отдельно — переиспользуется live-путём (Фаза 3).
 */
export function buildRegistry(
  schema: JsonFormSchema,
  dataSources: Record<string, unknown>
): ComponentRegistry {
  return defineRegistry((reg) => {
    for (const [name, component] of Object.entries(KNOWN_COMPONENTS))
      reg.component(name, component);
    reg.component(FIELD_WRAPPER, KNOWN_COMPONENTS.FormField);
    for (const name of collectUnknownComponentNames(schema)) {
      reg.component(name, makeUnknownComponent(name));
    }
    registerMockSources(reg, schema, dataSources);
  });
}

/** Собрать `{ registry, model, form }` из схемы (+ опц. мок). Может бросить на битой схеме — ловит вызывающий. */
export function buildPreview(schema: JsonFormSchema, mock?: MockData): PreviewBundle {
  const data = mock ?? synthMock(schema);
  const model = createModel(data.model);
  const registry = buildRegistry(schema, data.dataSources);
  const form = createForm({ model, schema: convertJsonToM1Tree(schema, registry, model) });
  return { registry, model, form };
}
