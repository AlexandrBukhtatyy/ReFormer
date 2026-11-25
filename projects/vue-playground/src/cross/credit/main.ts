/**
 * Страница кросс-фреймворк проверки: кредитная заявка на Vue и Vuetify.
 *
 * Документ формы, правила шагов, поведение и API — общие с React- и Angular-страницами
 * (forms-benchmark/src/cross/credit.ts); здесь — реестр компонентов Vuetify и рендерер Vue.
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
  createCreditForm,
  createCreditStart,
  creditMessages,
  submitCredit,
  type CreditDictionaries,
  type CreditValues,
} from '../../../../forms-benchmark/src/cross/credit';
import { FORM_ACTIONS } from '../../kit/form-actions';
import { creditRegistry } from '../../kit/registry';
import { createKitVuetify } from '../../vuetify';
import '../cross.css';

const CreditRenderer = defineComponent({
  name: 'CreditRenderer',
  props: {
    initial: { type: Object as PropType<CreditValues>, required: true },
    dictionaries: { type: Object as PropType<CreditDictionaries>, required: true },
  },
  setup(props) {
    const bundle = useFormBundle(() =>
      createCreditForm(creditRegistry, props.initial, props.dictionaries)
    );
    return () => h(FormRenderer, { form: bundle, messages: creditMessages });
  },
});

const CreditPage = defineComponent({
  name: 'CreditPage',
  setup() {
    // Справочники — сигналы страницы: документ формы ссылается на них, значения придут позже.
    const start = createCreditStart();
    // Форма собирается с начальными значениями: данные заявки приходят с «сервера».
    const initial = shallowRef<CreditValues | null>(null);
    let mounted = true;
    onMounted(() => {
      void start.load().then((values) => {
        if (mounted) initial.value = values;
      });
    });
    onBeforeUnmount(() => {
      mounted = false;
    });

    provide(FORM_ACTIONS, {
      submit: (values) => submitCredit(values as CreditValues),
    });

    return () =>
      h(VApp, null, {
        default: () =>
          initial.value
            ? h(CreditRenderer, { initial: initial.value, dictionaries: start.dictionaries })
            : null,
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
  app = createApp(CreditPage);
  app.use(createKitVuetify());
  app.mount(container);
};

installBench('credit', container, { mount, unmount });
