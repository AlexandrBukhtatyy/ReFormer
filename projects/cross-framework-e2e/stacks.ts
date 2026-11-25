/**
 * Стеки кросс-фреймворк проверки. Документ формы, правила и API у стеков одни; различаются
 * рендерер и библиотека компонентов. Страницы хоста лежат по пути `/cross/<форма>/`.
 *
 * У каждого стека свой порт: серверы хостов стоят одновременно, и ни один не занимает порт
 * разработки по умолчанию.
 */
export type StackId = 'react' | 'vue' | 'angular';
export type FormId = 'registration' | 'credit';

export interface Stack {
  /** Имя стека — суффикс проекта Playwright: `registration:react`. */
  id: StackId;
  /** Порт сервера хоста. */
  port: number;
  /** Каталог хоста относительно каталога этого проекта. */
  host: string;
  /** Команда сервера хоста; запускается в каталоге `host`. */
  command: string;
  /** Формы, страницы которых у хоста есть. */
  forms: FormId[];
}

const vite = (port: number) => `npx vite --port ${port} --strictPort --host 127.0.0.1`;

const STACKS: Stack[] = [
  {
    id: 'react',
    port: 4191,
    host: '../react-playground',
    command: vite(4191),
    forms: ['registration', 'credit'],
  },
  {
    id: 'vue',
    port: 4192,
    host: '../vue-playground',
    command: vite(4192),
    forms: ['registration', 'credit'],
  },
  {
    id: 'angular',
    port: 4193,
    host: '../angular-playground',
    // Сервер разработки Angular CLI: рендерер он берёт из собранного `dist/` пакета.
    command: 'npx ng serve --port 4193 --host 127.0.0.1',
    forms: ['registration', 'credit'],
  },
];

/** Сегмент пути страниц хоста — им же страница называется в `window.__bench`. */
export const CROSS_PAGE = 'cross';

export const stackOrigin = (stack: Stack): string => `http://127.0.0.1:${stack.port}`;

export const pageUrl = (stack: Stack, form: FormId): string =>
  `${stackOrigin(stack)}/${CROSS_PAGE}/${form}/`;

/**
 * Стеки прогона. `CROSS_STACKS=react,vue` оставляет названные: сервер хоста поднимается только
 * для них — так матрица CI ведёт каждый стек отдельным заданием.
 */
export function selectedStacks(): Stack[] {
  const only = process.env.CROSS_STACKS?.split(',')
    .map((id) => id.trim())
    .filter(Boolean);
  if (!only?.length) return STACKS;
  const unknown = only.filter((id) => !STACKS.some((stack) => stack.id === id));
  if (unknown.length) {
    throw new Error(
      `CROSS_STACKS: неизвестный стек ${unknown.join(', ')}; есть ${STACKS.map((s) => s.id).join(', ')}`
    );
  }
  return STACKS.filter((stack) => only.includes(stack.id));
}
