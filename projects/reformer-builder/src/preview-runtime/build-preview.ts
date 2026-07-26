/**
 * Сборка бандла Runtime-preview: `{ registry, model, form }` для `<JsonFormRenderer>` (спека §9).
 *
 * Как в эталоне (`CreditApplicationFormRendererJson`): строится модель, реестр (ui-kit +
 * `FIELD_WRAPPER` + плейсхолдеры неизвестных `$component` + мок-источники) и **форма** через
 * `createForm({ model, schema: convertJsonToM1Tree(...) })`. Именно `createForm` создаёт form-node'ы,
 * привязанные к сигналам модели — без него рендерер пишет «No form node for signal …» и не рисует
 * поля. Behavior/validation в JSON нет и для preview не нужны.
 *
 * @module reformer-builder/preview-runtime/build-preview
 */

import { createForm } from '@reformer/core';
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
import { collectUnknownComponentNames } from './unknown';
import { makeUnknownComponent } from './unknown-component';
import { synthModel } from './synth-model';

/** Бандл для монтирования Runtime-preview. `form` удерживается, чтобы form-node'ы не собрал GC. */
export interface PreviewBundle {
  registry: ComponentRegistry;
  model: FormModel<Record<string, unknown>>;
  form: unknown;
}

/** Собрать `{ registry, model, form }` из схемы. Может бросить на битой схеме — вызывающий ловит. */
export function buildPreview(schema: JsonFormSchema): PreviewBundle {
  const model = synthModel(schema);
  const registry = defineRegistry((reg) => {
    for (const [name, component] of Object.entries(KNOWN_COMPONENTS)) reg.component(name, component);
    reg.component(FIELD_WRAPPER, KNOWN_COMPONENTS.FormField);
    for (const name of collectUnknownComponentNames(schema)) {
      reg.component(name, makeUnknownComponent(name));
    }
    registerMockSources(reg, schema);
  });
  const form = createForm({ model, schema: convertJsonToM1Tree(schema, registry, model) });
  return { registry, model, form };
}
