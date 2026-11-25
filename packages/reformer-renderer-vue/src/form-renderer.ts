/**
 * `FormRenderer` — отрисовать сборку `createForm` во Vue.
 *
 * @module renderer-vue/form-renderer
 */

import { defineComponent, h, markRaw, provide, type Component, type PropType } from 'vue';
import type { FormBundle } from '@reformer/core';
import type { IssueMessages } from '@reformer/core/i18n';
import { FORM_BUNDLE, OVERRIDE_MAPS, RENDER_SETTINGS, SCHEMA_CONTROLLER } from './context';
import { provideIssueMessages } from './platform/form-control';
import { RenderNode } from './render-node';
import { useScopeEffects } from './scope';
import type { RendererSettings } from './types';

/**
 * Рендер сборки `createForm`. Дерево узлов построено сборкой один раз; рендерер ставит контекст
 * сборки (форму и отправку из него берут компоненты реестра), исполняет правила узлов из
 * поведения формы (`hideWhen`, `onComponentEvent`, `onMount`) и даёт строкам массивов и
 * подформам собственные области схемы.
 *
 * Обёртка поля — `settings.fieldWrapper`, иначе та, что положил в сборку реестр. Без обёртки
 * контрол рисует поле целиком сам.
 *
 * Сборка читается при создании компонента: другой сборке — другой `key`.
 *
 * @example
 * ```ts
 * import { createForm } from '@reformer/core';
 * import { FormRenderer, useFormBundle } from '@reformer/renderer-vue';
 *
 * defineComponent({
 *   setup() {
 *     const bundle = useFormBundle(() => createForm({ schema, registry, initial }));
 *     return () => h(FormRenderer, { form: bundle, messages });
 *   },
 * });
 * ```
 */
export const FormRenderer = defineComponent({
  name: 'ReformerFormRenderer',
  props: {
    /** Сборка `createForm` со схемой. */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    form: { type: Object as PropType<FormBundle<any>>, required: true },
    settings: { type: Object as PropType<RendererSettings>, default: undefined },
    /** Словарь формы: тексты замечаний по коду, поверх локали. */
    messages: { type: Object as PropType<IssueMessages>, default: undefined },
  },
  setup(props) {
    // Сборка уходит компонентам контекстом: прокси Vue вместо неё порвал бы связь нод с моделью.
    const bundle = markRaw(props.form);
    const { tree, controller, fieldWrapper, errorBoundary } = bundle.render;
    if (tree === undefined) {
      throw new Error(
        'FormRenderer: в сборке нет дерева — у `createForm` не задана `schema`. ' +
          'Без схемы форму рисуют сами, по нодам `bundle.form`.'
      );
    }
    const rootMaps = controller.scopeOf(bundle.model as object).__overrideMaps;
    const bundleWrapper = fieldWrapper as Component | undefined;
    const settings: RendererSettings | undefined =
      props.settings?.fieldWrapper === undefined && bundleWrapper !== undefined
        ? { ...props.settings, fieldWrapper: bundleWrapper }
        : props.settings;

    provide(FORM_BUNDLE, bundle);
    provide(RENDER_SETTINGS, settings);
    provide(SCHEMA_CONTROLLER, { controller, rootMaps });
    provide(OVERRIDE_MAPS, rootMaps);
    if (props.messages) provideIssueMessages(props.messages);
    useScopeEffects(rootMaps.effectRegistry);

    const boundary = errorBoundary as Component | undefined;
    return () => {
      const content = h(RenderNode, { node: tree.root });
      return boundary ? h(boundary, null, { default: () => content }) : content;
    };
  },
});
