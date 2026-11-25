/**
 * Страница кросс-фреймворк проверки: форма регистрации на Vue и `@reformer/kit-vuetify`.
 *
 * Документ формы, правила и API — общие с React- и Angular-страницами
 * (forms-benchmark/src/cross/registration.ts); здесь — реестр кита Vuetify (../registry.ts),
 * рендерер Vue и оболочка страницы: заголовок, `<form>`, «Зарегистрироваться», «Очистить» и
 * подтверждение отправки. «Сервер» формы живёт в памяти страницы. `window.__bench` публикует общий
 * харнесс (готовность первого экрана, покой, вызовы API, отправленные данные) — по нему e2e ведёт
 * три стека одним сценарием.
 */
import {
  createApp,
  defineComponent,
  h,
  onBeforeUnmount,
  onMounted,
  shallowRef,
  type App,
  type Component,
  type PropType,
} from 'vue';
import 'vuetify/styles';
import '@reformer/kit-vuetify/styles.css';
import { VApp } from 'vuetify/components/VApp';
import { VBtn } from 'vuetify/components/VBtn';
import { createKitVuetify } from '@reformer/kit-vuetify';
import { FormRenderer, useFormBundle } from '@reformer/renderer-vue';
import { installBench } from '../../../../forms-benchmark/src/cross/page';
import {
  createRegistrationForm,
  loadRegistrationInitial,
  registrationMessages,
  submitRegistration,
  type RegistrationValues,
} from '../../../../forms-benchmark/src/cross/registration';
import { registrationRegistry } from '../registry';
import '../cross.css';

/**
 * Форма с оболочкой. Отправка — `submission.submit(handler)`: проверяет форму и зовёт обработчик.
 * «Очистить» — `form.reset()`: значения, ноды и тихая фаза живой проверки; подтверждение прежней
 * отправки при этом скрывается.
 */
const RegistrationForm = defineComponent({
  name: 'RegistrationForm',
  props: { initial: { type: Object as PropType<RegistrationValues>, required: true } },
  setup(props) {
    const bundle = useFormBundle(() => createRegistrationForm(registrationRegistry, props.initial));
    const result = shallowRef<string | null>(null);

    const submit = async (event: Event): Promise<void> => {
      event.preventDefault();
      const outcome = await bundle.submission.submit(submitRegistration);
      if (outcome.status === 'submitted') result.value = outcome.result;
    };

    const reset = (): void => {
      bundle.form.reset();
      result.value = null;
    };

    return () =>
      h('form', { novalidate: true, class: 'cross-form', onSubmit: submit }, [
        h(FormRenderer, { form: bundle, messages: registrationMessages }),
        h('div', { class: 'cross-actions' }, [
          h(
            VBtn as Component,
            { type: 'submit', color: 'primary', 'data-testid': 'btn-submit' },
            { default: () => 'Зарегистрироваться' }
          ),
          h(
            VBtn as Component,
            { type: 'button', variant: 'outlined', 'data-testid': 'btn-reset', onClick: reset },
            { default: () => 'Очистить' }
          ),
        ]),
        result.value
          ? h('p', { role: 'status', 'data-testid': 'submit-result' }, result.value)
          : null,
      ]);
  },
});

const RegistrationPage = defineComponent({
  name: 'RegistrationPage',
  setup() {
    // Форма собирается с начальными значениями: по приглашению они приходят с «сервера».
    const initial = shallowRef<RegistrationValues | null>(null);
    let mounted = true;
    onMounted(() => {
      void loadRegistrationInitial().then((values) => {
        if (mounted) initial.value = values;
      });
    });
    onBeforeUnmount(() => {
      mounted = false;
    });

    return () =>
      h(VApp, null, {
        default: () =>
          h('main', { class: 'cross-page' }, [
            h('h1', 'Регистрация'),
            initial.value ? h(RegistrationForm, { initial: initial.value }) : null,
          ]),
      });
  },
});

const container = document.getElementById('root');
if (!container) throw new Error('#root not found');

let app: App | null = null;

const unmount = (): void => {
  app?.unmount();
  app = null;
};

// Кит ставится один раз на страницу, как провайдеры Angular-хоста: перемонтирование — новое
// приложение Vue с формой (как новый корень React), а не новая настройка библиотеки компонентов.
// Анимации выключены: сценарии читают DOM сразу после покоя страницы.
const vuetify = createKitVuetify({ animations: false });

// Первое монтирование приложения Vue синхронно: рендер, запись в DOM и хуки монтирования
// заканчиваются до возврата из `mount()` — отдельного синхронного режима хосту не нужно.
const mount = (): void => {
  unmount();
  app = createApp(RegistrationPage);
  app.use(vuetify);
  app.mount(container);
};

installBench('registration', container, { mount, unmount });
