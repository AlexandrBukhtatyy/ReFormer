import { Link } from '../app/router';

export function NotFoundRoute() {
  return (
    <section className="app-page">
      <h1 className="app-page__title">Такой страницы нет</h1>
      <p>
        <Link to="/">На главную</Link>
      </p>
    </section>
  );
}
