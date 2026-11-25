/**
 * Вычисляемое значение — компонент приложения, а не кита: подпись и `<output>`, контрола нет.
 * Роль DOM-контракта — `computed-{path}`.
 */
import { defineComponent, h, type PropType } from 'vue';

export const ReadonlyValue = defineComponent({
  name: 'ReadonlyValue',
  props: {
    /** Путь DOM-контракта: `computed-{path}`. */
    path: { type: String, required: true },
    label: { type: String, required: true },
    /** Уже вычисленное значение; числа выводятся без разделителей разрядов. */
    value: {
      type: null as unknown as PropType<string | number | null | undefined>,
      default: undefined,
    },
  },
  setup(props) {
    return () => {
      const labelId = `computed-label-${props.path}`;
      return h('div', { class: 'cross-readonly' }, [
        h('span', { id: labelId, class: 'cross-readonly__label' }, props.label),
        h(
          'output',
          { 'aria-labelledby': labelId, 'data-testid': `computed-${props.path}` },
          props.value == null ? '' : String(props.value)
        ),
      ]);
    };
  },
});
