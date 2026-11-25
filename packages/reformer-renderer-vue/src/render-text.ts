/**
 * Текст контейнера: литералы и сигналы модели одной строкой.
 *
 * @module renderer-vue/render-text
 */

import { defineComponent, type PropType } from 'vue';
import type { SchemaTextPart } from '@reformer/core';
import { joinTextParts } from '@reformer/core/render';
import { useSignalValue } from './bridge/signals';

/**
 * Текстовые дети узла — подряд идущие части одного чанка. На части-сигналы компонент подписан
 * точечно: смена значения модели перерисовывает только этот текст, а не поддерево узла.
 */
export const RenderText = defineComponent({
  name: 'ReformerText',
  props: {
    parts: { type: Array as PropType<readonly SchemaTextPart[]>, required: true },
  },
  setup(props) {
    const parts = props.parts;
    const text = useSignalValue(() => joinTextParts(parts));
    return () => text.value;
  },
});
