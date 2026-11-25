/**
 * Vuetify для формы: экземпляр плагина с настройками полей кита. Подключается приложением один раз:
 * `createApp(App).use(createKitVuetify())`. Стили — `import 'vuetify/styles'` и
 * `@reformer/kit-vuetify/styles.css`.
 */
import { markRaw, type Plugin } from 'vue';
import { createVuetify } from 'vuetify';
import { VSlideYTransition } from 'vuetify/components/transitions';
import { aliases, mdi } from 'vuetify/iconsets/mdi-svg';

export interface KitVuetifyOptions {
  /**
   * Анимации Vuetify. `false` — без ряби на кнопках, панель списка открывается и уходит без
   * перехода: закрытой панели в DOM нет сразу. Нужно тестам и автоматизации.
   */
  animations?: boolean;
}

/**
 * Плагин Vue, а не тип экземпляра Vuetify: объявление тогда не тянет типы всей библиотеки (их разбор
 * — десятки секунд у каждого, кто проверяет типы формы). Тема и прочее — композиции Vuetify.
 */
export function createKitVuetify(options: KitVuetifyOptions = {}): Plugin {
  const still = options.animations === false;
  return createVuetify({
    // Иконки — SVG из самого пакета: набор по умолчанию ждёт шрифт `@mdi/font`, без которого флажок
    // остался бы без квадрата.
    icons: { defaultSet: 'mdi', aliases, sets: { mdi } },
    defaults: {
      ...(still ? { global: { ripple: false } } : {}),
      // Сообщение об ошибке уходит из DOM сразу, а не в конце перехода: по умолчанию группа
      // переходов держит уходящее сообщение до конца анимации, и `error-{testId}` оставался бы на
      // экране без ошибки. Компонент перехода — без реактивной обёртки: это описание компонента.
      VMessages: {
        transition: { component: markRaw(VSlideYTransition), group: true, disabled: true },
      },
      VTextField: { variant: 'outlined', density: 'comfortable', hideDetails: 'auto' },
      VTextarea: { variant: 'outlined', density: 'comfortable', hideDetails: 'auto' },
      VSelect: {
        variant: 'outlined',
        density: 'comfortable',
        hideDetails: 'auto',
        ...(still ? { transition: false } : {}),
      },
      VCheckbox: { density: 'comfortable', hideDetails: 'auto' },
      VSwitch: { density: 'comfortable', hideDetails: 'auto' },
      VRadioGroup: { density: 'comfortable', hideDetails: 'auto' },
    },
  });
}
