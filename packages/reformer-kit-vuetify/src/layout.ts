/**
 * Контейнеры разметки ui-kit на Vuetify: `Box`, `Card`, `Section`. Дети — слот по умолчанию.
 */
import { defineComponent, h, type Component, type PropType } from 'vue';
import { VCard, VCardText } from 'vuetify/components/VCard';

/** Класс узла из схемы (`className`) — классом корня. */
const classNameProp = { className: { type: String, default: undefined } };

/** `Box` — блок без оформления. */
export const Box = defineComponent({
  name: 'KitBox',
  props: classNameProp,
  setup(props, { slots }) {
    return () => h('div', { class: ['kit-box', props.className] }, slots.default?.());
  },
});

/** `Card` — карточка Vuetify. */
export const Card = defineComponent({
  name: 'KitCard',
  props: classNameProp,
  setup(props, { slots }) {
    return () =>
      h(
        VCard as Component,
        { class: props.className, border: true, flat: true },
        {
          default: () =>
            h(VCardText as Component, { class: 'kit-stack' }, { default: () => slots.default?.() }),
        }
      );
  },
});

type Heading = 'h2' | 'h3' | 'h4' | 'h5' | 'h6';

/** `Section` — раздел формы с заголовком. */
export const Section = defineComponent({
  name: 'KitSection',
  props: {
    ...classNameProp,
    title: { type: String, default: undefined },
    titleAs: { type: String as PropType<Heading>, default: 'h3' },
    titleClassName: { type: String, default: undefined },
  },
  setup(props, { slots }) {
    return () =>
      h('section', { class: ['kit-section', 'kit-stack', props.className] }, [
        props.title
          ? h(props.titleAs, { class: ['kit-section__title', props.titleClassName] }, props.title)
          : null,
        slots.default?.(),
      ]);
  },
});
