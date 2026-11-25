/**
 * Секции и массивы кита на Vuetify: карточка `VCard` с кнопками `VBtn` и testid DOM-контракта
 * (`btn-add-{path}`, `btn-remove-{path}-{index}`).
 */
import { defineComponent, h, type Component, type PropType, type VNodeChild } from 'vue';
import type { ArrayItemSlot } from '@reformer/renderer-vue';
import { VBtn } from 'vuetify/components/VBtn';
import { VCard, VCardText, VCardTitle } from 'vuetify/components/VCard';

/** Карточка секции: заголовок третьего уровня и содержимое колонкой. */
function sectionCard(title: string, body: () => VNodeChild): VNodeChild {
  return h(
    VCard as Component,
    { tag: 'section', border: true, flat: true },
    {
      default: () => [
        h(VCardTitle as Component, { tag: 'h3' }, { default: () => title }),
        h(VCardText as Component, { class: 'cross-section__body' }, { default: body }),
      ],
    }
  );
}

/** Секция шага с заголовком: вложенная группа полей или условная часть шага. */
export const Section = defineComponent({
  name: 'KitSection',
  props: { title: { type: String, required: true } },
  setup(props, { slots }) {
    return () => sectionCard(props.title, () => slots.default?.());
  },
});

/**
 * Контейнер без своей разметки: корень части документа (адрес, строка массива) — поля стоят прямо
 * в секции.
 */
export const Group = defineComponent({
  name: 'KitGroup',
  // Корня-элемента у группы нет: атрибутам некуда лечь.
  inheritAttrs: false,
  setup(_, { slots }) {
    return () => slots.default?.();
  },
});

/**
 * Массив под-форм. Строки и их ключи отдаёт рендерер (`items`), компонент только оформляет их и
 * зовёт `onAdd` / `onRemove`. Путь DOM-контракта поля строки (`properties-0-type`) рендерер выводит
 * из живого пути поля в модели — он следует за индексом строки.
 */
export const ArraySection = defineComponent({
  name: 'KitArraySection',
  props: {
    items: { type: Array as PropType<readonly ArrayItemSlot[]>, default: () => [] },
    onAdd: { type: Function as PropType<() => void>, required: true },
    onRemove: { type: Function as PropType<(index: number) => void>, required: true },
    // Перестановки у формы нет; проп объявлен, чтобы не лечь атрибутом на корень.
    onMove: { type: Function as PropType<(from: number, to: number) => void>, default: undefined },
    /** Путь массива DOM-контракта: `properties`. */
    path: { type: String, required: true },
    title: { type: String, required: true },
    /** Заголовок строки: «{rowTitle} {номер}». */
    rowTitle: { type: String, required: true },
    addLabel: { type: String, required: true },
  },
  setup(props) {
    return () =>
      sectionCard(props.title, () => [
        props.items.map((item) =>
          h('div', { key: item.key, class: 'cross-row' }, [
            h('div', { class: 'cross-row__head' }, [
              h('span', { class: 'cross-row__title' }, `${props.rowTitle} ${item.index + 1}`),
              h(
                VBtn as Component,
                {
                  type: 'button',
                  variant: 'outlined',
                  size: 'small',
                  'data-testid': `btn-remove-${props.path}-${item.index}`,
                  onClick: () => props.onRemove(item.index),
                },
                { default: () => 'Удалить' }
              ),
            ]),
            item.children,
          ])
        ),
        h(
          VBtn as Component,
          {
            type: 'button',
            variant: 'outlined',
            class: 'cross-add',
            'data-testid': `btn-add-${props.path}`,
            onClick: () => props.onAdd(),
          },
          { default: () => props.addLabel }
        ),
      ]);
  },
});
