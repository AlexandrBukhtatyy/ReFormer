/// <reference types="vite/client" />

import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import tailwindcss from '@tailwindcss/vite';
import { createRevisionMemo, resolvePluginsSet } from './bin/plugins-index.mjs';
import { PLUGINS_URL_PREFIX, servePluginsDir } from './bin/plugins-serve.mjs';
import {
  DEFAULT_CONFIG_FILE,
  readConfigForDevServer,
  RUNTIME_BUNDLE_URL,
  runtimeBundleBody,
} from './bin/runtime-bundle.mjs';
import { sendJson } from './bin/static.mjs';
import { BUILDER_DEDUPE, builderSourceAliases } from './vite/source-resolve.mjs';

/**
 * Конфиг запуска в `npm run dev` — то, что в сборке отдаёт лаунчер.
 *
 * Без этого dev-сервер отвечал на адрес конфига страницей SPA, SPA читала «конфига нет», и
 * `preset`, свои профили и умолчания организации проверялись только собранным билдером.
 * Конфиг ищется как у лаунчера: файл из `REFORMER_BUILDER_CONFIG`, иначе
 * `<cwd>/.ui_builder/config.json`. Читается на каждый запрос — правка файла видна после
 * перезагрузки страницы, без перезапуска сервера. Формат не проверяется и здесь: разбор со
 * словами о каждом поле — у SPA. Адрес, чтение и ответ — общие с лаунчером
 * (`bin/runtime-bundle.mjs`).
 */
function devRuntimeConfig(): Plugin {
  return {
    name: 'reformer-builder:dev-runtime-config',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(RUNTIME_BUNDLE_URL, (request, response) => {
        const explicit = process.env.REFORMER_BUILDER_CONFIG;
        void readConfigForDevServer({
          file: path.resolve(process.cwd(), explicit ?? DEFAULT_CONFIG_FILE),
          explicit: explicit !== undefined,
          report: (message) => {
            server.config.logger.error(message);
          },
        }).then((config) => {
          sendJson(request, response, runtimeBundleBody(config));
        });
      });
    },
  };
}

/**
 * Плагины приложения в `npm run dev` — то, что в сборке лежит в `dist/plugins/`, а лаунчеру
 * называют флагом `--plugins`.
 *
 * Слой есть ПО УМОЛЧАНИЮ — набор опубликованного билдера (`application-plugins.json`) из сборок
 * на месте каталога проекта-образца. Без него dev-сервер отличался бы от поставки ровно тем,
 * что заметнее всего: дерево файлов, редакторы и движки — плагины, и каталог, в чьём
 * `.ui_builder` их нет, открывался «в пустоту» — проект открыт, показать его нечем
 * (ReFormer-eeq0.9, ReFormer-1847). Копия того же плагина в открытом проекте уступает
 * экземпляру приложения, а каталог живой: индекс несёт ревизии, и пересобранный плагин
 * оболочка перезагружает сама, по возврату фокуса, — разработка плагинов на месте не страдает.
 *
 * `REFORMER_BUILDER_PLUGINS` называет другой слой — путь от каталога пакета билдера: каталог
 * плагинов (отдаётся целиком, как у `--plugins`) либо файл набора (корень и список каталогов).
 * Пустое значение выключает слой: так проверяют то, что приходит плагинами ОТКРЫТОГО проекта.
 */
const DEFAULT_APPLICATION_PLUGINS = 'application-plugins.json';

function devApplicationPlugins(): Plugin {
  return {
    name: 'reformer-builder:dev-application-plugins',
    apply: 'serve',
    configureServer(server) {
      const named = process.env.REFORMER_BUILDER_PLUGINS ?? DEFAULT_APPLICATION_PLUGINS;
      if (named === '') return;
      const plugins = {
        ...resolvePluginsSet(path.resolve(process.cwd(), named)),
        revisions: createRevisionMemo(),
        onMissing: (missing: readonly string[]) => {
          server.config.logger.warnOnce(
            `[reformer-builder] плагины не собраны: ${missing.join(', ')} — ` +
              'соберите их: npm run plugins:build -w reformer-builder-playground'
          );
        },
      };
      // Каталог — `plugins/` от базового адреса: там же SPA ищет его в собранном билдере.
      const prefix = server.config.base + PLUGINS_URL_PREFIX.slice(1);
      server.middlewares.use((request, response, next) => {
        const pathname = (request.url ?? '/').split('?')[0];
        if (!pathname.startsWith(prefix)) {
          next();
          return;
        }
        servePluginsDir(request, response, pathname.slice(prefix.length), plugins).catch(next);
      });
    },
  };
}

/**
 * Раскладка вывода сборки.
 *
 * По умолчанию rollup ссыпает всё в один плоский `assets/`, и на сорока с лишним файлах это
 * перестаёт быть навигацией: по имени чанка не видно, чей он. Раскладываем по происхождению —
 * плагины, вендоры, стили, шрифты — и правила ниже единственное место, где это решается.
 *
 * ВАЖНО, чтобы этого не продавали как ускорение: раскладка НИЧЕГО не переносит между чанками
 * и стартовый граф не меняет — она только даёт файлам адрес. Что в каком чанке лежит, решает
 * граф импортов, и единственный рычаг там — ленивость (см. про `manualChunks` ниже).
 *
 * Путь разбирается строковыми операциями, а не регулярками: экранированные слэши в этом файле
 * уже переживали порчу при переносе, и один потерянный `\` меняет классификацию молча.
 */

/** Разделитель путей у rollup зависит от платформы; все проверки ведём по прямому слэшу. */
const WINDOWS_SEPARATOR = String.fromCharCode(92);
const norm = (id: string): string => id.split(WINDOWS_SEPARATOR).join('/');

/** Чей это модуль: `…/src/plugins/<домен>/<плагин>/…` → `<домен>-<плагин>`. */
const pluginOf = (id: string): string | undefined => {
  const marker = '/src/plugins/';
  const s = norm(id);
  const at = s.lastIndexOf(marker);
  if (at === -1) return undefined;
  const [domain, plugin, rest] = s.slice(at + marker.length).split('/', 3);
  if (rest === undefined) return undefined;
  return `${domain}-${plugin}`;
};

/** Словари оболочки: свой каталог, потому что их читают по одному и глазами. */
const isShellLocale = (id: string): boolean =>
  norm(id).includes('/src/shell/platform/services/i18n/locales/');

/**
 * Служебные идентификаторы rollup/vite (`commonjs-dynamic-modules`, `__vite-browser-external`).
 * Их обязательно отсеять ДО классификации: у чанка компилятора typescript таких три из шести,
 * и проверка «все модули вендорные» на них проваливается — 3.5 МБ уехали бы не в свой каталог.
 */
const isVirtual = (id: string): boolean => id.charCodeAt(0) === 0 || id.startsWith('__vite');

/** Пакет, которому принадлежит модуль: node_modules либо собственный пакет монорепо. */
const packageOf = (id: string): string | null => {
  const s = norm(id);
  const nodeModules = '/node_modules/';
  const at = s.lastIndexOf(nodeModules);
  if (at !== -1) {
    const [scope, name] = s.slice(at + nodeModules.length).split('/');
    return scope.startsWith('@') ? `${scope.slice(1)}-${name}` : scope;
  }
  const packages = '/packages/';
  const own = s.lastIndexOf(packages);
  if (own !== -1) {
    const name = s.slice(own + packages.length).split('/')[0];
    if (name.startsWith('reformer-')) return name;
  }
  return null;
};

const FONT = new Set(['.ttf', '.woff', '.woff2', '.otf', '.eot']);
const IMAGE = new Set(['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.avif', '.ico']);

/**
 * Базовый адрес приложения.
 *
 * Сборка для поставки — относительная (`./`): один и тот же `dist` отдаёт лаунчер с корня
 * своего сервера и плагин dev-сервера приложения под `/__reformer-builder/` (`vite/plugin.mjs`).
 * С абсолютной базой собранная страница искала бы чанки в корне чужого сервера. Относительная
 * годится потому, что страница у билдера одна: клиентской маршрутизации нет.
 *
 * Dev-сервер остаётся на `/`; под адресом приложения его базу задаёт плагин. GitHub Pages
 * называет свой подкаталог переменной `BUILDER_BASE` (CI).
 */
const baseOf = (command: 'build' | 'serve'): string =>
  process.env.BUILDER_BASE ?? (command === 'build' ? './' : '/');

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  base: baseOf(command),
  plugins: [react(), tailwindcss(), devRuntimeConfig(), devApplicationPlugins()],
  server: {
    // 5173 занят react-playground (и e2e ждёт его именно там), поэтому билдер живёт на 5174.
    // strictPort — чтобы порт не уезжал молча: адрес билдера должен быть предсказуем.
    port: 5174,
    strictPort: true,
  },
  build: {
    rollupOptions: {
      output: {
        entryFileNames: 'assets/js/[name]-[hash].js',
        /**
         * `manualChunks` здесь СОЗНАТЕЛЬНО нет, и это стоит объяснить: очевидный способ выдать
         * каждому плагину свой файл — назначить `src/plugins/<id>/**` в ручной чанк — измерен
         * и отвергнут.
         *
         * Ручной чанк перестраивает разбиение ВЕНДОРОВ. Обычная сборка делит модули
         * `@reformer/ui-kit` и `lucide-react` между эагерным и ленивым чанками ПОМОДУЛЬНО:
         * то, что нужно оболочке, едет в entry, остальное — в ленивый чанк кита. Ручной чанк
         * плагина это разбиение стирает и стягивает вендор целиком в себя, а он статически
         * достижим от входа — и 524 кБ, которые раньше грузились по требованию, въезжают
         * в стартовый граф. Замерено трижды: со всеми плагинами (+533 кБ), без ассистента,
         * и только с четырьмя эагерными (+524 кБ) — поглотитель лишь меняет имя.
         *
         * Поэтому отдельный файл плагина получается ЛЕНИВОСТЬЮ, а не раскладкой: динамический
         * импорт создаёт границу чанка, не трогая помодульное разбиение вендоров. Правило
         * `chunkFileNames` ниже кладёт такой чанк в `assets/plugins/` само.
         */
        /**
         * Куда лёг чанк, решается по СОСТАВУ, а не по фасаду: `facadeModuleId` у части чанков
         * обнуляется (барель, на который ссылаются изнутри, фасад теряет), и опора на него
         * молча уносит плагин мимо своего каталога.
         */
        chunkFileNames(chunk) {
          const real = chunk.moduleIds.filter((id) => !isVirtual(id));
          if (real.length === 0) return 'assets/js/[name]-[hash].js';

          const own = real.filter((id) => packageOf(id) === null);
          if (own.length === 0) {
            const packages = new Set(real.map(packageOf));
            // `[name]` сохраняем всегда: без него десяток чанков cdk сводится к одному имени
            // с разными хэшами, и понять по списку файлов, что именно распухло, уже нельзя.
            return packages.size === 1
              ? `assets/vendor/${[...packages][0]}/[name]-[hash].js`
              : 'assets/vendor/[name]-[hash].js';
          }

          if (own.every(isShellLocale)) return 'assets/i18n/[name]-[hash].js';

          // Чанк плагина: и сам барель, и его ленивые внутренности (BYOK, корпус знаний,
          // превью markdown). «Все модули этого плагина» — условие СЛИШКОМ строгое: рядом
          // с кодом плагина в чанк почти всегда попадает код пакетов и оболочки, и по такому
          // правилу плагин уезжал в `assets/js/` под именем `index`. Поэтому владелец —
          // единственный плагин среди владельцев, и его модулей должно быть не меньше половины
          // собственного кода: иначе это общий чанк, куда чужой модуль попал попутчиком.
          const owners = new Set(own.map(pluginOf).filter((id) => id !== undefined));
          const owned = own.filter((id) => pluginOf(id) !== undefined).length;
          if (owners.size === 1 && owned * 2 >= own.length) {
            const owner = [...owners][0];
            // У бареля `[name]` — всегда `index`, и `plugins/base-preview-index` ничего
            // не добавляет к `plugins/base-preview`. У остальных имя несёт смысл и остаётся.
            return chunk.name === 'index'
              ? `assets/plugins/${owner}-[hash].js`
              : `assets/plugins/${owner}-[name]-[hash].js`;
          }

          return 'assets/js/[name]-[hash].js';
        },
        assetFileNames(asset) {
          // `asset.name` объявлен устаревшим и печатает предупреждение на каждое чтение.
          const name = asset.names[0] ?? '';
          const ext = name.slice(name.lastIndexOf('.')).toLowerCase();
          if (ext === '.css') return 'assets/css/[name]-[hash][extname]';
          if (FONT.has(ext)) return 'assets/fonts/[name]-[hash][extname]';
          if (IMAGE.has(ext)) return 'assets/img/[name]-[hash][extname]';
          return 'assets/[name]-[hash][extname]';
        },
      },
    },
  },
  /**
   * Воркеры собираются ОТДЕЛЬНЫМ прогоном rollup и `build.rollupOptions.output` не подчиняются
   * вовсе — каталог им задаётся только здесь. Своих воркеров у билдера сегодня нет: воркеры
   * редактора кода уехали вместе с ним в плагин и едут внутри его сборки. Правило оставлено,
   * чтобы первый же воркер оболочки не лёг в плоский `assets/`.
   */
  worker: {
    rollupOptions: {
      output: {
        entryFileNames: 'assets/workers/[name]-[hash].js',
        chunkFileNames: 'assets/workers/[name]-[hash].js',
      },
    },
  },
  resolve: {
    // Дедупликация singleton-рантаймов при workspace-линке и псевдонимы исходников —
    // см. `./vite/source-resolve.mjs`.
    dedupe: [...BUILDER_DEDUPE],
    alias: builderSourceAliases(),
  },
}));
