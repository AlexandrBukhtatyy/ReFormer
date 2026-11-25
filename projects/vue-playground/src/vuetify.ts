/**
 * Vuetify для страниц проверки. Экземпляр — на каждое приложение: страница монтируется заново
 * по команде харнесса, а экземпляр живёт столько же, сколько приложение.
 */
import { markRaw } from 'vue';
import { createVuetify } from 'vuetify';
import { VSlideYTransition } from 'vuetify/components/transitions';
import { aliases, mdi } from 'vuetify/iconsets/mdi-svg';

export function createKitVuetify(): ReturnType<typeof createVuetify> {
  return createVuetify({
    // Иконки — SVG из самого пакета: набор по умолчанию ждёт шрифт `@mdi/font`, которого на
    // странице нет, и флажок остался бы без квадрата.
    icons: { defaultSet: 'mdi', aliases, sets: { mdi } },
    defaults: {
      // Анимации выключены: сценарии читают DOM сразу после покоя страницы.
      global: { ripple: false },
      // Сообщение об ошибке уходит из DOM сразу, а не в конце перехода: по умолчанию группа
      // переходов держит уходящее сообщение до конца анимации, и сценарий увидел бы ошибку,
      // которой уже нет. Компонент перехода — без реактивной обёртки: это описание компонента.
      VMessages: {
        transition: { component: markRaw(VSlideYTransition), group: true, disabled: true },
      },
      VTextField: { variant: 'outlined', density: 'comfortable', hideDetails: 'auto' },
      VTextarea: { variant: 'outlined', density: 'comfortable', hideDetails: 'auto', rows: 3 },
      // Панель списка открывается и уходит без перехода: закрытой панели в DOM нет сразу.
      VSelect: {
        variant: 'outlined',
        density: 'comfortable',
        hideDetails: 'auto',
        transition: false,
      },
      VCheckbox: { density: 'comfortable', hideDetails: 'auto' },
      VRadioGroup: { density: 'comfortable', hideDetails: 'auto' },
    },
  });
}
