/**
 * Подготовка прогона: сборка плагинов playground.
 *
 * Плагин проекта — npm-пакет в `.ui_builder/plugins/<id>/` playground: исходники в `src/`,
 * а сборка для билдера (`build:dev` пакета) — в корне того же каталога, откуда билдер плагин
 * и грузит. В git она не едет, поэтому перед тестами её нужно получить — той же командой, что
 * у человека: `npm run plugins:build -w reformer-builder-playground`. Заодно прогон проверяет,
 * что пакеты плагинов собираются и проходят правила оболочки.
 *
 * Собирается каждый раз, а не «если нет»: сборка занимает секунды, а устаревшая незаметно
 * проверяла бы вчерашний плагин.
 *
 * Собирает плагины CLI автора плагина (`reformer-plugin`), а он запускается из своего `dist/`,
 * которого в свежем клоне нет. Тогда сначала собирается он — вместе с SDK: CLI импортирует
 * его собранным.
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

const built = (pkg: string, file: string): boolean =>
  existsSync(path.join(REPO_ROOT, 'packages', pkg, 'dist', file));

export default function globalSetup(): void {
  if (!built('reformer-builder-plugin-api', 'index.js')) {
    npm('run build -w @reformer/builder-plugin-api');
  }
  if (!built('reformer-builder-plugin-cli', 'cli.js')) {
    npm('run build -w @reformer/builder-plugin-cli');
  }
  npm('run plugins:build -w reformer-builder-playground');
}
