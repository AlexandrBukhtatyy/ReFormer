/**
 * Контролы кита на Vuetify: имена реестра формы (`TextInput`, `MaskedInput`, `NumberInput`,
 * `DateInput`, `Textarea`, `Select`, `RadioGroup`, `Checkbox`, `CaptchaWidget`) — тонкие адаптеры
 * над компонентами библиотеки.
 *
 * Контрол — самодостаточное поле: подпись и ошибку рисует компонент Vuetify. Для этого контрол
 * объявляет две статики ReFormer: `reformerLayout = 'inline-label'` — получить `label`, и
 * `reformerNeedsControl` — получить ноду поля, из которой берётся текст показанной ошибки.
 *
 * Тот же документ формы рисуют киты на `@reformer/ui-kit` и Taiga UI, поэтому значение поля у трёх
 * стеков обязано совпадать: текст остаётся строкой, пустое поле — пустой строкой; число — числом,
 * пустое числовое поле — `null`.
 */
import {
  defineComponent,
  h,
  onMounted,
  shallowRef,
  withDirectives,
  type Component,
  type PropType,
  type VNode,
} from 'vue';
import type { FormControl } from '@reformer/core';
import { useFieldError } from '@reformer/renderer-vue';
import { VBtn } from 'vuetify/components/VBtn';
import { VCheckbox } from 'vuetify/components/VCheckbox';
import { VRadio } from 'vuetify/components/VRadio';
import { VRadioGroup } from 'vuetify/components/VRadioGroup';
import { VSelect } from 'vuetify/components/VSelect';
import { VTextarea } from 'vuetify/components/VTextarea';
import { VTextField } from 'vuetify/components/VTextField';
import {
  CAPTCHA_CANVAS,
  applyMask,
  drawCaptcha,
  getCaptcha,
} from '../../../forms-benchmark/src/cross/page';
import {
  errorMessages,
  errorSlot,
  fieldIdOf,
  vFieldTestIds,
  vFieldValue,
  vRadioGroupTestIds,
  withoutTestId,
} from './field';

/** Пункт списка или группы радиокнопок, как его задаёт документ формы. */
export interface Option {
  value: string;
  label: string;
}

/** Контрол рисует поле целиком: рендерер отдаёт ему подпись и ноду поля. */
function selfSufficient<C extends object>(component: C): C {
  return Object.assign(component, {
    reformerLayout: 'inline-label',
    reformerNeedsControl: true,
  });
}

const fieldProps = {
  /** Значение поля — диалект `v-model`. */
  modelValue: { type: null as unknown as PropType<unknown>, default: '' },
  /** Нода поля: источник текста ошибки. */
  control: { type: Object as PropType<FormControl<unknown>>, required: true as const },
  label: { type: String, default: undefined },
  disabled: { type: Boolean, default: false },
};

const textProps = {
  ...fieldProps,
  placeholder: { type: String, default: undefined },
  type: { type: String, default: 'text' },
  /** Только чтение — имя пропа общее для трёх китов: его ставит поведение формы. */
  readOnly: { type: Boolean, default: false },
};

const optionsProp = { type: Array as PropType<readonly Option[]>, default: () => [] };

const fieldEmits = ['update:modelValue', 'blur'];

type Emit = (event: 'update:modelValue' | 'blur', ...args: unknown[]) => void;

interface TextFieldOptions {
  /** Идентификатор поля в testid. */
  id: string | undefined;
  /** Роль `field-{id}` на корне поля Vuetify; иначе её несёт разметка вокруг. */
  fieldRole: boolean;
  props: {
    modelValue: unknown;
    label?: string;
    placeholder?: string;
    type?: string;
    disabled: boolean;
    readOnly?: boolean;
  };
  error: string | undefined;
  attrs: Record<string, unknown>;
  emit: Emit;
  /** Компонент поля: однострочное по умолчанию. */
  component?: Component;
}

/**
 * Текстовое поле Vuetify, привязанное к полю формы: значение строкой, ошибка — текстом показанного
 * замечания.
 */
function textField({
  id,
  fieldRole,
  props,
  error,
  attrs,
  emit,
  component = VTextField as Component,
}: TextFieldOptions): VNode {
  return withDirectives(
    h(
      component,
      {
        ...withoutTestId(attrs),
        'data-testid': fieldRole && id ? `field-${id}` : undefined,
        modelValue: props.modelValue ?? '',
        label: props.label,
        placeholder: props.placeholder,
        type: props.type,
        disabled: props.disabled,
        readonly: props.readOnly === true,
        errorMessages: errorMessages(error),
        'onUpdate:modelValue': (value: unknown) =>
          emit('update:modelValue', value == null ? '' : String(value)),
        onBlur: () => emit('blur'),
      },
      { message: errorSlot(id) }
    ),
    [[vFieldTestIds, id]]
  );
}

export const TextInput = selfSufficient(
  defineComponent({
    name: 'KitTextInput',
    inheritAttrs: false,
    props: textProps,
    emits: fieldEmits,
    setup(props, { attrs, emit }) {
      const error = useFieldError(props.control);
      return () =>
        textField({
          id: fieldIdOf(attrs),
          fieldRole: true,
          props,
          error: error.value,
          attrs,
          emit,
        });
    },
  })
);

/**
 * Поле с маской. Формат маски у Vuetify свой, как и у остальных библиотек, — поэтому у трёх стеков
 * одна функция `applyMask`: она правит текст в самом элементе на фазе перехвата, до того как
 * событие ввода дойдёт до поля Vuetify и уйдёт в форму.
 */
export const MaskedInput = selfSufficient(
  defineComponent({
    name: 'KitMaskedInput',
    inheritAttrs: false,
    props: { ...textProps, mask: { type: String, required: true } },
    emits: fieldEmits,
    setup(props, { attrs, emit }) {
      const error = useFieldError(props.control);
      const onInputCapture = (event: Event): void => {
        const input = event.target as HTMLInputElement;
        const masked = applyMask(input.value, props.mask);
        if (masked !== input.value) input.value = masked;
      };
      return () =>
        h('div', { onInputCapture }, [
          textField({
            id: fieldIdOf(attrs),
            fieldRole: true,
            props,
            error: error.value,
            attrs: { inputmode: 'tel', ...attrs },
            emit,
          }),
        ]);
    },
  })
);

/** Дата — нативный `type="date"` в поле Vuetify: значение остаётся строкой `YYYY-MM-DD`. */
export const DateInput = selfSufficient(
  defineComponent({
    name: 'KitDateInput',
    inheritAttrs: false,
    props: textProps,
    emits: fieldEmits,
    setup(props, { attrs, emit }) {
      const error = useFieldError(props.control);
      return () =>
        textField({
          id: fieldIdOf(attrs),
          fieldRole: true,
          props: { ...props, type: 'date' },
          error: error.value,
          attrs,
          emit,
        });
    },
  })
);

export const Textarea = selfSufficient(
  defineComponent({
    name: 'KitTextarea',
    inheritAttrs: false,
    props: textProps,
    emits: fieldEmits,
    setup(props, { attrs, emit }) {
      const error = useFieldError(props.control);
      return () =>
        textField({
          id: fieldIdOf(attrs),
          fieldRole: true,
          // У многострочного поля типа нет.
          props: { ...props, type: undefined },
          error: error.value,
          attrs,
          emit,
          component: VTextarea as Component,
        });
    },
  })
);

/** Текст числового поля → число формы: пустое и нечисловое — `null`. */
function parseNumber(text: string): number | null {
  if (text.trim() === '') return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Число — нативный `type="number"` в поле Vuetify: значение формы — число либо `null`.
 *
 * Поле держит набранный текст, пока он означает то же число, что в форме: иначе «1.50» посреди
 * ввода схлопнулось бы в «1.5». Значение, записанное в форму извне, вытесняет текст.
 */
export const NumberInput = selfSufficient(
  defineComponent({
    name: 'KitNumberInput',
    inheritAttrs: false,
    props: {
      ...fieldProps,
      modelValue: { type: Number as PropType<number | null>, default: null },
      placeholder: { type: String, default: undefined },
      readOnly: { type: Boolean, default: false },
    },
    emits: fieldEmits,
    setup(props, { attrs, emit }) {
      const error = useFieldError(props.control);
      const typed = shallowRef('');
      const onEvent: Emit = (event, ...args) => {
        if (event === 'blur') return emit('blur');
        typed.value = String(args[0] ?? '');
        emit('update:modelValue', parseNumber(typed.value));
      };
      return () => {
        const value = props.modelValue ?? null;
        const text = parseNumber(typed.value) === value ? typed.value : String(value ?? '');
        return textField({
          id: fieldIdOf(attrs),
          fieldRole: true,
          props: { ...props, modelValue: text, type: 'number' },
          error: error.value,
          attrs,
          emit: onEvent,
        });
      };
    },
  })
);

/** Пункт панели списка Vuetify с опорой DOM-контракта `option-{id}-{значение}`. */
const selectItem = (id: string | undefined, value: string, title: string) => ({
  value,
  title,
  props: { 'data-testid': id === undefined ? undefined : `option-${id}-${value}` },
});

/**
 * Список. Значение формы — строка, пустая — «не выбрано»: пустой пункт стоит первым и несёт
 * подсказку, как у нативного `<select>`.
 *
 * Нативного `<select>` у `VSelect` нет: в поле ввода — подпись выбранного пункта, пункты — панель,
 * которой нет в DOM, пока она закрыта. Сценарию кит даёт значение в `data-value` на `input-{id}`
 * и `option-{id}-{значение}` на пунктах открытой панели.
 */
export const Select = selfSufficient(
  defineComponent({
    name: 'KitSelect',
    inheritAttrs: false,
    props: {
      ...fieldProps,
      placeholder: { type: String, default: 'Выберите…' },
      options: optionsProp,
    },
    emits: fieldEmits,
    setup(props, { attrs, emit }) {
      const error = useFieldError(props.control);
      return () => {
        const id = fieldIdOf(attrs);
        const value = props.modelValue == null ? '' : String(props.modelValue);
        return withDirectives(
          h(
            VSelect as Component,
            {
              ...withoutTestId(attrs),
              'data-testid': id && `field-${id}`,
              modelValue: value,
              items: [
                selectItem(id, '', props.placeholder),
                ...props.options.map((option) => selectItem(id, option.value, option.label)),
              ],
              label: props.label,
              disabled: props.disabled,
              errorMessages: errorMessages(error.value),
              'onUpdate:modelValue': (selected: unknown) =>
                emit('update:modelValue', selected == null ? '' : String(selected)),
              onBlur: () => emit('blur'),
            },
            { message: errorSlot(id) }
          ),
          [
            [vFieldTestIds, id],
            [vFieldValue, value],
          ]
        );
      };
    },
  })
);

/**
 * Группа радиокнопок. Каждая кнопка — нативный `<input type="radio">` внутри `VRadio` с ролью
 * `input-{id}-{значение}`; общее имя группы раздаёт сама `VRadioGroup`.
 */
export const RadioGroup = selfSufficient(
  defineComponent({
    name: 'KitRadioGroup',
    inheritAttrs: false,
    props: {
      ...fieldProps,
      name: { type: String, default: undefined },
      options: optionsProp,
    },
    emits: fieldEmits,
    setup(props, { attrs, emit }) {
      const error = useFieldError(props.control);
      // Событие `blur` не всплывает: уход фокуса из группы ловится на её корне.
      const onFocusout = (event: FocusEvent): void => {
        const group = event.currentTarget as HTMLElement;
        if (!group.contains(event.relatedTarget as Node | null)) emit('blur');
      };
      return () => {
        const id = fieldIdOf(attrs);
        return withDirectives(
          h(
            VRadioGroup as Component,
            {
              ...withoutTestId(attrs),
              'data-testid': id && `field-${id}`,
              modelValue: props.modelValue,
              label: props.label,
              name: props.name,
              disabled: props.disabled,
              errorMessages: errorMessages(error.value),
              'onUpdate:modelValue': (value: unknown) => emit('update:modelValue', value),
              onFocusout,
            },
            {
              default: () =>
                props.options.map((option) =>
                  withDirectives(
                    h(VRadio as Component, {
                      key: option.value,
                      label: option.label,
                      value: option.value,
                    }),
                    [[vFieldTestIds, id && `${id}-${option.value}`]]
                  )
                ),
              message: errorSlot(id),
            }
          ),
          [[vRadioGroupTestIds, id]]
        );
      };
    },
  })
);

/** Вычисляемое значение: подпись и `<output>`, контрола нет. */
export const ReadonlyValue = defineComponent({
  name: 'KitReadonlyValue',
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

export const Checkbox = selfSufficient(
  defineComponent({
    name: 'KitCheckbox',
    inheritAttrs: false,
    props: { ...fieldProps, modelValue: { type: Boolean, default: false } },
    emits: fieldEmits,
    setup(props, { attrs, emit }) {
      const error = useFieldError(props.control);
      return () => {
        const id = fieldIdOf(attrs);
        return withDirectives(
          h(
            VCheckbox as Component,
            {
              ...withoutTestId(attrs),
              'data-testid': id && `field-${id}`,
              modelValue: props.modelValue === true,
              label: props.label,
              disabled: props.disabled,
              errorMessages: errorMessages(error.value),
              'onUpdate:modelValue': (value: unknown) => emit('update:modelValue', value === true),
              onBlur: () => emit('blur'),
            },
            { message: errorSlot(id) }
          ),
          [[vFieldTestIds, id]]
        );
      };
    },
  })
);

/**
 * Капча: картинка на canvas, «Обновить», поле ввода. Код выдаёт и проверяет «сервер»; виджет
 * рисует картинку и отдаёт введённый текст. Картинка загружается один раз на монтирование,
 * обновление — только по кнопке: прежний код после него недействителен, и поле очищается.
 */
export const CaptchaWidget = selfSufficient(
  defineComponent({
    name: 'KitCaptchaWidget',
    inheritAttrs: false,
    props: textProps,
    emits: fieldEmits,
    setup(props, { attrs, emit }) {
      const error = useFieldError(props.control);
      const canvas = shallowRef<HTMLCanvasElement | null>(null);

      const load = (clear: boolean): void => {
        void getCaptcha().then((challenge) => {
          const target = canvas.value;
          if (!target) return;
          drawCaptcha(target, challenge);
          target.dataset.challenge = challenge.challengeId;
          if (clear) emit('update:modelValue', '');
        });
      };
      onMounted(() => load(false));

      return () => {
        const id = fieldIdOf(attrs);
        return h('div', { class: 'cross-captcha', 'data-testid': id && `field-${id}` }, [
          h('div', { class: 'cross-captcha__row' }, [
            h('canvas', {
              ref: canvas,
              width: CAPTCHA_CANVAS.width,
              height: CAPTCHA_CANVAS.height,
              'data-testid': 'captcha-image',
              'aria-label': 'Картинка капчи',
              role: 'img',
            }),
            h(
              VBtn as Component,
              {
                type: 'button',
                variant: 'outlined',
                'data-testid': 'captcha-refresh',
                onClick: () => load(true),
              },
              { default: () => 'Обновить' }
            ),
          ]),
          textField({
            id,
            fieldRole: false,
            props,
            error: error.value,
            attrs: { autocomplete: 'off', ...attrs },
            emit,
          }),
        ]);
      };
    },
  })
);
