/// <reference types="vite/client" />

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import tailwindcss from '@tailwindcss/vite';

/**
 * Раскладка вывода сборки.
 *
 * По умолчанию rollup ссыпает всё в один плоский `assets/`, и на сорока с лишним файлах это
 * перестаёт быть навигацией: по имени чанка не видно, чей он. Раскладываем по происхождению —
 * плагины, вендоры, monaco, стили, шрифты — и правила ниже единственное место, где это решается.
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

/** Чей это модуль: `…/src/plugins/<id>/…` → `<id>`. */
const pluginOf = (id: string): string | undefined => {
  const marker = '/src/plugins/';
  const s = norm(id);
  const at = s.lastIndexOf(marker);
  if (at === -1) return undefined;
  const rest = s.slice(at + marker.length);
  const slash = rest.indexOf('/');
  return slash === -1 ? undefined : rest.slice(0, slash);
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

const isMonaco = (id: string): boolean => norm(id).includes('/node_modules/monaco-editor/');

const FONT = new Set(['.ttf', '.woff', '.woff2', '.otf', '.eot']);
const IMAGE = new Set(['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.avif', '.ico']);

// https://vite.dev/config/
export default defineConfig({
  // Prod-сборка для GitHub Pages идёт в подкаталог /ReFormer/builder/, поэтому base
  // задаётся через env (BUILDER_BASE) в CI. Локально (dev, preview) остаётся «/».
  base: process.env.BUILDER_BASE ?? '/',
  plugins: [react(), tailwindcss()],
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

          // Сначала monaco: `monaco-runtime` — это один модуль src на тысячу модулей движка,
          // и проверку «все модули вендорные» он бы не прошёл. Отсюда доля, а не «все».
          if (real.filter(isMonaco).length * 2 > real.length) {
            return 'assets/monaco/[name]-[hash].js';
          }

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
          // с кодом плагина в чанк почти всегда попадает общий `lib/`, и по такому правилу
          // плагин уезжал в `assets/js/` под именем `index`. Поэтому владелец — единственный
          // плагин среди владельцев, и его модулей должно быть не меньше половины: иначе это
          // общий чанк, куда чужой модуль попал попутчиком.
          const owners = new Set(own.map(pluginOf).filter((id) => id !== undefined));
          const owned = own.filter((id) => pluginOf(id) !== undefined).length;
          if (owners.size === 1 && owned * 2 >= own.length) {
            const owner = [...owners][0];
            // У бареля `[name]` — всегда `index`, и `plugins/ai-index` ничего не добавляет
            // к `plugins/ai`. У остальных имя несёт смысл и остаётся.
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
   * вовсе — каталог им задаётся только здесь. Сегодня воркеры в проекте одни: `editor.worker`
   * и `json.worker` из monaco, поэтому и каталог у них общий с движком.
   */
  worker: {
    rollupOptions: {
      output: {
        entryFileNames: 'assets/monaco/[name]-[hash].js',
        chunkFileNames: 'assets/monaco/[name]-[hash].js',
      },
    },
  },
  resolve: {
    // Дедупликация singleton-рантаймов при workspace-линке: одна копия React, Radix и
    // @preact/signals-core на всё дерево (иначе `instanceof Signal` / контекст Radix ломаются).
    dedupe: ['react', 'react-dom', 'radix-ui', '@preact/signals-core'],
    alias: { '@': path.resolve(__dirname, './src') },
  },
});
