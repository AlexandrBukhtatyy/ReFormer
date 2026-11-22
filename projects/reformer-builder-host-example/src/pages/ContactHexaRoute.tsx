import ContactHexaPage from '../forms/contact-hexa';

/**
 * Та же форма обращения на ките Kaspersky HexaUI — модуль `forms/contact-hexa`.
 *
 * Страница грузится лениво (`app/App.tsx`): дизайн-система с её CSS и шрифтами попадает в документ,
 * только когда страницу открыли. Её стили действуют внутри провайдера кита, которым страница формы
 * оборачивает себя сама, — ограничивает их Vite-плагин `hexaUiStyles()` (`vite.config.ts`).
 */
export default function ContactHexaRoute() {
  return (
    <section className="app-page">
      <p className="app-page__lead">
        Та же форма обращения, нарисованная дизайн-системой Kaspersky HexaUI. Список городов и
        отправка — те же сервисы приложения.
      </p>
      <ContactHexaPage />
    </section>
  );
}
