import { ContactRoute } from '../pages/ContactRoute';
import { HomeRoute } from '../pages/HomeRoute';
import { NotFoundRoute } from '../pages/NotFoundRoute';
import { Link, usePathname } from './router';

const ROUTES = [
  { path: '/', title: 'Главная', Page: HomeRoute },
  { path: '/contact', title: 'Обратная связь', Page: ContactRoute },
] as const;

export function App() {
  const pathname = usePathname();
  const route = ROUTES.find((candidate) => candidate.path === pathname);
  const Page = route?.Page ?? NotFoundRoute;

  return (
    <div className="app-shell">
      <header className="app-header">
        <span className="app-header__brand">Сервис доставки</span>
        <nav className="app-header__nav" aria-label="Разделы приложения">
          {ROUTES.map(({ path, title }) => (
            <Link
              key={path}
              to={path}
              className={path === pathname ? 'app-link app-link--current' : 'app-link'}
            >
              {title}
            </Link>
          ))}
        </nav>
      </header>
      <main className="app-main">
        <Page />
      </main>
    </div>
  );
}
