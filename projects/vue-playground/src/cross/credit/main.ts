/**
 * Страница кросс-фреймворк проверки: кредитная заявка на Vue и `@reformer/kit-vuetify`.
 *
 * Документ формы, правила шагов, поведение и API — общие с React- и Angular-страницами
 * (forms-benchmark/src/cross/credit.ts); здесь — реестр кита Vuetify (../registry.ts), рендерер Vue
 * и оболочка страницы: заголовок, `<form>` и подтверждение отправки. Кнопки шагов и «Отправить»
 * рисует визард кита. «Сервер» формы живёт в памяти страницы. `window.__bench` публикует общий
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
  type PropType,
} from 'vue';
import 'vuetify/styles';
import '@reformer/kit-vuetify/styles.css';
import { VApp } from 'vuetify/components/VApp';
import { createKitVuetify } from '@reformer/kit-vuetify';
import { FormRenderer, useFormBundle } from '@reformer/renderer-vue';
import { installBench } from '../../../../forms-benchmark/src/cross/page';
import {
  createCreditForm,
  createCreditStart,
  creditMessages,
  type CreditDictionaries,
  type CreditValues,
} from '../../../../forms-benchmark/src/cross/credit';
import { creditRegistry } from '../registry';
import '../cross.css';

const CreditForm = defineComponent({
  name: 'CreditForm',
  props: {
    initial: { type: Object as PropType<CreditValues>, required: true },
    dictionaries: { type: Object as PropType<CreditDictionaries>, required: true },
  },
  setup(props) {
    // Текст подтверждения приходит из поведения формы: визард кита проверил и отправил заявку.
    const result = shallowRef<string | null>(null);
    const bundle = useFormBundle(() =>
      createCreditForm(creditRegistry, props.initial, props.dictionaries, (message) => {
        result.value = message;
      })
    );
    // Кнопки визарда — `type="button"`; Enter в поле не отправляет форму в обход визарда.
    return () =>
      h(
        'form',
        {
          novalidate: true,
          class: 'cross-form',
          onSubmit: (event: Event) => event.preventDefault(),
        },
        [
          h(FormRenderer, { form: bundle, messages: creditMessages }),
          result.value
            ? h('p', { role: 'status', 'data-testid': 'submit-result' }, result.value)
            : null,
        ]
      );
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

    return () =>
      h(VApp, null, {
        default: () =>
          h('main', { class: 'cross-page' }, [
            h('h1', 'Заявка на кредит'),
            initial.value
              ? h(CreditForm, { initial: initial.value, dictionaries: start.dictionaries })
              : null,
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
  app = createApp(CreditPage);
  app.use(vuetify);
  app.mount(container);
};

installBench('credit', container, { mount, unmount });
