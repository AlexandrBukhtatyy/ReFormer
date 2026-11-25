/**
 * Капча — компонент приложения, а не кита: картинка на canvas, «Обновить» и поле ввода — `Input`
 * кита. Поле кита самодостаточное (подпись, ошибка, роли `field-`, `label-`, `input-`,
 * `error-{id}`), поэтому капча объявляет те же статики ReFormer и отдаёт ему подпись, ноду поля и
 * `data-testid` от рендерера как есть.
 *
 * Код выдаёт и проверяет «сервер»; картинка загружается один раз на монтирование, обновление —
 * только по кнопке: прежний код после него недействителен, и поле очищается.
 */
import { defineComponent, h, onMounted, shallowRef, type Component, type PropType } from 'vue';
import type { FormControl } from '@reformer/core';
import { Input } from '@reformer/kit-vuetify';
import { VBtn } from 'vuetify/components/VBtn';
import {
  CAPTCHA_CANVAS,
  drawCaptcha,
  getCaptcha,
} from '../../../../forms-benchmark/src/cross/page';

export const CaptchaWidget = Object.assign(
  defineComponent({
    name: 'CaptchaWidget',
    inheritAttrs: false,
    props: {
      modelValue: { type: String as PropType<string | null>, default: '' },
      control: { type: Object as PropType<FormControl<unknown>>, required: true },
      label: { type: String, default: undefined },
      required: { type: Boolean, default: false },
      disabled: { type: Boolean, default: false },
      placeholder: { type: String, default: undefined },
    },
    emits: ['update:modelValue', 'blur'],
    setup(props, { attrs, emit }) {
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

      return () =>
        h('div', { class: 'cross-captcha' }, [
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
          h(Input as Component, {
            ...attrs,
            autocomplete: 'off',
            modelValue: props.modelValue,
            control: props.control,
            label: props.label,
            required: props.required,
            disabled: props.disabled,
            placeholder: props.placeholder,
            'onUpdate:modelValue': (value: unknown) => emit('update:modelValue', value),
            onBlur: () => emit('blur'),
          }),
        ]);
    },
  }),
  // Подпись и нода поля — капче, как полю кита: она отдаёт их вложенному `Input`.
  { reformerLayout: 'inline-label', reformerNeedsControl: true }
);
