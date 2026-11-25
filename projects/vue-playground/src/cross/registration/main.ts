/**
 * Страница кросс-фреймворк проверки: форма регистрации на Vue и Vuetify.
 *
 * Документ формы, правила и API — общие с React- и Angular-страницами
 * (forms-benchmark/src/cross/registration.ts); здесь — реестр компонентов Vuetify и рендерер Vue.
 * «Сервер» формы живёт в памяти страницы. `window.__bench` публикует общий харнесс (готовность
 * первого экрана, покой, вызовы API, отправленные данные) — по нему e2e ведёт три стека одним
 * сценарием.
 */
import {
  createApp,
  defineComponent,
  h,
  onBeforeUnmount,
  onMounted,
  provide,
  shallowRef,
  type App,
  type PropType,
} from 'vue';
import 'vuetify/styles';
import { VApp } from 'vuetify/components/VApp';
import { FormRenderer, useFormBundle } from '@reformer/renderer-vue';
import { installBench } from '../../../../forms-benchmark/src/cross/page';
import {
  createRegistrationForm,
  loadRegistrationInitial,
  registrationMessages,
  submitRegistration,
  type RegistrationValues,
} from '../../../../forms-benchmark/src/cross/registration';
import { FORM_ACTIONS } from '../../kit/form-actions';
import { registrationRegistry } from '../../kit/registry';
import { createKitVuetify } from '../../vuetify';
import '../cross.css';

const RegistrationRenderer = defineComponent({
  name: 'RegistrationRenderer',
  props: { initial: { type: Object as PropType<RegistrationValues>, required: true } },
  setup(props) {
    const bundle = useFormBundle(() => createRegistrationForm(registrationRegistry, props.initial));
    return () => h(FormRenderer, { form: bundle, messages: registrationMessages });
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

    provide(FORM_ACTIONS, {
      submit: (values) => submitRegistration(values as RegistrationValues),
    });

    return () =>
      h(VApp, null, {
        default: () => (initial.value ? h(RegistrationRenderer, { initial: initial.value }) : null),
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

// Первое монтирование приложения Vue синхронно: рендер, запись в DOM и хуки монтирования
// заканчиваются до возврата из `mount()` — отдельного синхронного режима хосту не нужно.
const mount = (): void => {
  unmount();
  app = createApp(RegistrationPage);
  app.use(createKitVuetify());
  app.mount(container);
};

installBench('registration', container, { mount, unmount });
