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
import { existsSync } from 'fs';
import path from 'path';
import { REPO_ROOT } from './paths';

/** npm из корня репозитория. Одной строкой через оболочку: на Windows `npm` — командный файл. */
function npm(command: string): void {
  execSync(`npm ${command}`, { cwd: REPO_ROOT, stdio: 'inherit' });
}

/**
 * Что нужно сборке плагинов собранным — в порядке зависимостей: каталог пакета, файл его
 * `dist/`, по которому видно, что сборка есть, и имя пакета.
 */
const REQUIRED_BUILDS: readonly (readonly [dir: string, file: string, name: string])[] = [
  ['reformer-mcp', 'core/bundle.js', '@reformer/mcp'],
  ['reformer-builder-plugin-api', 'index.js', '@reformer/builder-plugin-api'],
  ['reformer-builder-toolkit', 'index.js', '@reformer/builder-toolkit'],
  ['reformer-builder-plugin-cli', 'cli.js', '@reformer/builder-plugin-cli'],
  ['rjsf-kit-theme', 'index.js', '@reformer/rjsf-kit-theme'],
];

export default function globalSetup(): void {
  for (const [dir, file, name] of REQUIRED_BUILDS) {
    if (!existsSync(path.join(REPO_ROOT, 'packages', dir, 'dist', file))) {
      npm(`run build -w ${name}`);
    }
  }
  npm('run plugins:build -w reformer-builder-playground');
}
