import ContactPage from '../forms/contact';

/** Страница с формой обращения. Сама форма — модуль `forms/contact`, его правят в билдере. */
export function ContactRoute() {
  return (
    <section className="app-page">
      <p className="app-page__lead">
        Оставьте обращение — ответим на почту в течение рабочего дня.
      </p>
      <ContactPage />
    </section>
  );
}
