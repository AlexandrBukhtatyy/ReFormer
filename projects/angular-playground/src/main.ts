/**
 * Вход playground. Сборка Angular CLI даёт одну HTML-страницу, а страниц у playground несколько,
 * и лежат они по тем же путям, что у хостов на React и Vue (`/cross/<форма>/`). Сервер на любой
 * путь без расширения отдаёт эту же страницу, а она по пути выбирает, что монтировать; код
 * страницы грузится отдельным чанком.
 */
interface PageModule {
  start(container: HTMLElement): void | Promise<void>;
}

const PAGES: Record<string, () => Promise<PageModule>> = {
  '/cross/registration/': () => import('./cross/registration/page'),
  '/cross/credit/': () => import('./cross/credit/page'),
  '/spike/': () => import('./spike/page'),
};

const container = document.getElementById('root');
if (!container) throw new Error('#root not found');

const path = location.pathname.endsWith('/') ? location.pathname : `${location.pathname}/`;
const load = PAGES[path];

if (load) {
  void load().then((page) => page.start(container));
} else {
  const list = document.createElement('ul');
  for (const href of Object.keys(PAGES)) {
    const link = document.createElement('a');
    link.href = href;
    link.textContent = href;
    list.appendChild(document.createElement('li')).appendChild(link);
  }
  container.appendChild(list);
}
