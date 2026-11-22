/**
 * Подготовка прогона: сборка плагинов playground.
 *
 * Плагин проекта — npm-пакет в `.ui_builder/plugins/` playground (прямо в каталоге плагинов
 * или в каталоге домена): исходники в `src/`, а сборка для билдера (`build:dev` пакета) —
 * в корне каталога пакета, откуда билдер плагин и грузит. В git она не едет, поэтому перед
 * тестами её нужно получить — той же командой, что у человека:
 * `npm run plugins:build -w reformer-builder-playground`. Заодно прогон проверяет, что пакеты
 * плагинов собираются и проходят правила оболочки.
 *
 * Собирается каждый раз, а не «если нет»: сборка занимает секунды, а устаревшая незаметно
 * проверяла бы вчерашний плагин. Среди плагинов — оба движка форм: без их сборки билдер
 * открыл бы форму текстом.
 *
 * Собирает плагины CLI автора плагина (`reformer-plugin`), а он запускается из своего `dist/`,
 * которого в свежем клоне нет. Тогда сначала собирается он — вместе с SDK: CLI импортирует
 * его собранным. То же с пакетами, которые плагины вкладывают в свой `main.js`: помощники
 * печати, тема RJSF и ядро знаний MCP находятся по `dist/`.
 *
 * @module tests/shared/global-setup
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { REPO_ROOT } from './paths';

/** npm из корня репозитория. Одной строкой через оболочку: на Windows `npm` — командный файл. */
function npm(command: string): void {
  execSync(`npm ${command}`, { cwd: REPO_ROOT, stdio: 'inherit' });
}

/** Пакет, который сборке плагинов нужен собранным. */
interface RequiredBuild {
  /** Каталог пакета в `packages/`. */
  readonly dir: string;
  /** Файл его `dist/`, по которому видно, что сборка есть. */
  readonly file: string;
  /** Имя пакета — для команды сборки. */
  readonly name: string;
}

/**
 * Что нужно сборке плагинов собранным — в порядке зависимостей.
 *
 * Список лежит данными: тем же списком пользуется запуск приложения-образца в прогоне
 * `embedded` (`tests/embedded/shared/serve-host.mjs`), а он стартует раньше этой подготовки.
 */
const REQUIRED_BUILDS = JSON.parse(
  readFileSync(path.join(__dirname, 'required-builds.json'), 'utf8')
) as readonly RequiredBuild[];

export default function globalSetup(): void {
  for (const { dir, file, name } of REQUIRED_BUILDS) {
    if (!existsSync(path.join(REPO_ROOT, 'packages', dir, 'dist', file))) {
      npm(`run build -w ${name}`);
    }
  }
  npm('run plugins:build -w reformer-builder-playground');
}
