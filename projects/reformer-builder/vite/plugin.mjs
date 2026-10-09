/**
 * Плагин Vite: билдер на dev-сервере приложения.
 *
 * ```ts
 * // vite.config.ts приложения
 * import { reformerBuilder } from '@reformer/builder/vite';
 *
 * export default defineConfig({ plugins: [react(), reformerBuilder()] });
 * ```
 *
 * Плагин отдаёт билдер под префиксом `/__reformer-builder/` того же сервера, что и приложение.
 * Приложение билдер не компилирует: это отдельный документ, который открывается в рамке
 * поверх страницы (`<ReformerBuilder>` из `@reformer/builder`). Отсюда и то, чего приложению
 * больше не нужно, — псевдонимов исходников, Tailwind, путей в `tsconfig`, общего React.
 *
 * ## Тот же вход, что у `npx reformer-builder`
 *
 * Под префиксом работает тот же SPA и по тем же правилам, только отвечает на его вопросы
 * dev-сервер приложения, а не лаунчер:
 *
 * - конфиг запуска — `.ui_builder/config.json` от корня приложения (или названный `config`);
 * - плагины приложения — набор, который едет с билдером, либо каталог из `plugins`;
 * - плагины проекта, шаблоны, цели кодогена — в `.ui_builder/` открытого проекта, их читает
 *   сам билдер.
 *
 * ## Интерфейс — из исходников либо из поставки
 *
 * Рядом с плагином лежат исходники билдера — значит, это монорепозиторий, и интерфейс отдаёт
 * вложенный dev-сервер со своим конфигом (`../vite.config.ts`): свои псевдонимы, свой
 * Tailwind, своя «горячая» замена модулей. Сервер приложения только пересылает ему запросы
 * под префиксом. Поднимается он по первому такому запросу: приложение, в котором билдер
 * не открывали, за него не платит. Плагины приложения при этом берутся живьём из каталога
 * проекта-образца — из сборок на месте; пересобранный плагин оболочка перезагружает сама,
 * по возврату фокуса (индекс живого каталога несёт ревизии плагинов).
 *
 * Исходников нет — отдаётся готовая сборка (`../dist`), та же, что под лаунчером: она собрана
 * с относительным базовым адресом и работает под любым префиксом. Плагины приложения лежат
 * в ней же; набор для встроенного билдера плагин выбирает из них списком.
 *
 * Обычным JS и без сборки: модуль грузит `vite.config` приложения.
 *
 * @module vite/plugin
 */

import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRevisionMemo, resolvePluginsSet } from '../bin/plugins-index.mjs';
import { DEFAULT_CONFIG_FILE, readConfigForDevServer } from '../bin/runtime-bundle.mjs';
import { createStaticHandler, trimTrailingSeparators } from '../bin/static.mjs';
import { BUILDER_URL_PREFIX, createBuilderEndpoints } from './endpoints.mjs';

const builderDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Вход SPA: есть он — рядом исходники билдера. */
const SOURCE_ENTRY = path.join(builderDir, 'src', 'main.tsx');

/** Готовая сборка билдера — та же, что отдаёт лаунчер. */
const DIST_DIR = path.join(builderDir, 'dist');
const DIST_INDEX = path.join(DIST_DIR, 'index.html');

/** Набор плагинов приложения для встроенного билдера: корень и каталоги плагинов. */
const EMBEDDED_PLUGINS_LIST = path.join(builderDir, 'application-plugins.embedded.json');

/**
 * Кэш зависимостей вложенного сервера — свой, и на каждое приложение отдельный.
 *
 * Ключ кэша Vite базовый адрес не учитывает, и с каталогом по умолчанию вложенный сервер
 * делил бы кэш с `npm run dev` самого билдера: два сервера, пересобирающие один каталог.
 * По той же причине кэш не общий у приложений: dev-серверы двух приложений (или приложения
 * и его копии под тестами) работают одновременно.
 *
 * @param {string} appRoot корень приложения, чей dev-сервер отдаёт билдер
 */
function sourceCacheDir(appRoot) {
  const key = createHash('sha1').update(path.resolve(appRoot)).digest('hex').slice(0, 8);
  return path.join(builderDir, 'node_modules', '.vite-embedded', key);
}

/** Модуль моста — виртуальный: его нет на диске, код отдаёт плагин. */
const HOST_BRIDGE_ID = 'virtual:reformer-builder-host';
const RESOLVED_HOST_BRIDGE_ID = `\0${HOST_BRIDGE_ID}`;

/**
 * Мост к dev-серверу на странице приложения (`src/client/host-bridge.ts`).
 *
 * Клиент билдера — обычный React без обращений к сборщику, а узнать, что dev-сервер собрался
 * перезагрузить страницу, можно только из модуля, который обработал сам Vite. Этот модуль
 * плагин и кладёт на страницу: он заводит мост на глобальном объекте и пересылает в него
 * событие. Клиент, найдя мост, знает и то, что билдер на этом сервере есть.
 *
 * Обработчик возвращает то, что вернул клиент: Vite ждёт обработчиков события, и обещание,
 * которое не завершается, перезагрузку останавливает.
 */
const HOST_BRIDGE_SOURCE = `
const key = Symbol.for('reformer.builder.host');
const bridge = (globalThis[key] ??= { beforeReload: null });
if (import.meta.hot) {
  import.meta.hot.on('vite:beforeFullReload', (payload) => bridge.beforeReload?.(payload));
}
`;

/**
 * Переменная окружения, называющая источник интерфейса, когда его не назвал параметр `ui`.
 *
 * Нужна внутри монорепозитория: исходники там всегда рядом, и «что получит приложение
 * из опубликованного пакета» иначе проверялось бы только правкой конфига приложения.
 */
const UI_ENV = 'REFORMER_BUILDER_UI';

/**
 * Откуда отдаётся интерфейс: названное явно обязано быть на месте, иначе — что есть рядом.
 * Параметр важнее переменной окружения.
 *
 * @param {'auto' | 'source' | 'dist' | undefined} wanted
 * @returns {'source' | 'dist'}
 */
function resolveUi(wanted) {
  const ui = wanted ?? (process.env[UI_ENV] || 'auto');
  if (ui !== 'auto' && ui !== 'source' && ui !== 'dist') {
    throw new Error(
      `reformer-builder: «ui» (или ${UI_ENV}) — «auto», «source» или «dist», а не «${ui}»`
    );
  }
  const hasSource = existsSync(SOURCE_ENTRY);
  if (ui === 'source' && !hasSource) {
    throw new Error(`reformer-builder: исходников билдера нет — не найден «${SOURCE_ENTRY}»`);
  }
  if (ui === 'source' || (ui === 'auto' && hasSource)) return 'source';
  if (!existsSync(DIST_INDEX)) {
    throw new Error(
      `reformer-builder: нет собранного билдера — не найден «${DIST_INDEX}».\n` +
        (hasSource
          ? '  Соберите: npm run build -w @reformer/builder, затем плагины приложения (README).'
          : '  Похоже, пакет установлен без сборки — переустановите его.')
    );
  }
  return 'dist';
}

/**
 * Набор плагинов, который едет с билдером: список — один, а каталог зависит от того, откуда
 * отдаётся интерфейс. Из исходников — живой каталог проекта-образца со сборками на месте;
 * из поставки — каталог рядом со сборкой, куда плагины собраны для поставки.
 *
 * Живой каталог несёт память отпечатков: его плагины пересобирают под работающим билдером,
 * и индекс называет их ревизии. Каталог поставки не меняется — ревизий у него нет.
 *
 * @param {'source' | 'dist'} ui
 * @returns {{
 *   dir: string,
 *   include: readonly string[],
 *   revisions?: ReturnType<typeof createRevisionMemo>,
 *   hint: string,
 * }}
 */
function shippedPlugins(ui) {
  const list = resolvePluginsSet(EMBEDDED_PLUGINS_LIST);
  return ui === 'source'
    ? {
        dir: list.dir,
        include: list.include,
        revisions: createRevisionMemo(),
        hint: 'Соберите: npm run plugins:build -w reformer-builder-playground',
      }
    : {
        dir: path.join(DIST_DIR, 'plugins'),
        include: list.include,
        hint: 'Сборка билдера неполная: соберите плагины приложения заново (README).',
      };
}

/**
 * @param {{ config?: string, plugins?: string, ui?: 'auto' | 'source' | 'dist' }} [options]
 * @returns {import('vite').Plugin}
 */
export function reformerBuilder(options = {}) {
  /** Вложенный dev-сервер интерфейса: обещание, чтобы первый запрос не завёл второй. */
  let sourceUi = null;

  const closeSourceUi = async () => {
    const starting = sourceUi;
    sourceUi = null;
    if (starting === null) return;
    const server = await starting.catch(() => null);
    await server?.close();
  };

  /** Базовый адрес приложения: под ним dev-сервер отдаёт модули. */
  let appBase = '/';

  return {
    name: 'reformer-builder',
    apply: 'serve',

    config() {
      // Клиент билдера — исходники в чужом каталоге: без этого React для него мог бы найтись
      // не тот, что у приложения, а два React на одной странице хуков не делят.
      return { resolve: { dedupe: ['react', 'react-dom'] } };
    },

    configResolved(config) {
      appBase = config.base;
    },

    resolveId(id) {
      return id === HOST_BRIDGE_ID ? RESOLVED_HOST_BRIDGE_ID : null;
    },

    load(id) {
      return id === RESOLVED_HOST_BRIDGE_ID ? HOST_BRIDGE_SOURCE : null;
    },

    transformIndexHtml() {
      // Раньше кода приложения: клиент ищет мост при первой же отрисовке.
      return [
        {
          tag: 'script',
          attrs: { type: 'module', src: `${appBase}@id/${HOST_BRIDGE_ID}` },
          injectTo: 'head-prepend',
        },
      ];
    },

    configureServer(host) {
      const root = host.config.root;
      const report = (message) => {
        host.config.logger.error(message);
      };

      const uiSource = resolveUi(options.ui);
      const plugins =
        options.plugins === undefined
          ? shippedPlugins(uiSource)
          : {
              dir: trimTrailingSeparators(path.resolve(root, options.plugins)),
              // Свой каталог называют затем, чтобы править плагины в нём: он живой.
              revisions: createRevisionMemo(),
              hint: 'Каталог назван параметром «plugins» плагина reformerBuilder().',
            };

      /** О несобранном плагине сказано один раз, а не на каждую загрузку страницы. */
      const reportedMissing = new Set();
      const onMissingPlugins = (missing) => {
        const fresh = missing.filter((plugin) => !reportedMissing.has(plugin));
        if (fresh.length === 0) return;
        for (const plugin of fresh) reportedMissing.add(plugin);
        host.config.logger.warn(
          `[reformer-builder] плагины не собраны: ${fresh.join(', ')}.\n` +
            `  Каталог: ${plugins.dir}\n` +
            `  ${plugins.hint}`
        );
      };

      const startSourceUi = async () => {
        // Свой экземпляр Vite, а не сервер приложения: у билдера свой конфиг сборки.
        const { createServer } = await import('vite');
        return createServer({
          configFile: path.join(builderDir, 'vite.config.ts'),
          root: builderDir,
          base: BUILDER_URL_PREFIX,
          appType: 'spa',
          clearScreen: false,
          cacheDir: sourceCacheDir(root),
          server: {
            middlewareMode: true,
            // Сокет «горячей» замены — на сервере приложения, под префиксом билдера: адрес
            // у страницы один, и второго порта клиенту не нужно. Сервер приложения свой
            // сокет узнаёт по своему пути и чужой не трогает.
            hmr: host.httpServer ? { server: host.httpServer } : true,
          },
        });
      };

      const serveDist = createStaticHandler({ rootDir: DIST_DIR, indexHtmlPath: DIST_INDEX });
      /** Готовая сборка: обычная раздача файлов, адрес — без префикса билдера. */
      const distUi = (req, res, next) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') {
          res.writeHead(405, { Allow: 'GET, HEAD' });
          res.end('Method Not Allowed');
          return;
        }
        const pathname = (req.url ?? '/').split('?')[0].split('#')[0];
        serveDist(req, res, pathname.slice(BUILDER_URL_PREFIX.length - 1)).catch(next);
      };

      const liveUi = (req, res, next) => {
        sourceUi ??= startSourceUi();
        sourceUi.then(
          (server) => {
            server.middlewares(req, res, next);
          },
          (error) => {
            // Отказ не запоминается: следующий запрос попробует поднять сервер ещё раз.
            sourceUi = null;
            report(`[reformer-builder] интерфейс билдера не поднялся: ${error?.stack ?? error}`);
            next(error);
          }
        );
      };

      host.middlewares.use(
        createBuilderEndpoints({
          readConfig: () =>
            readConfigForDevServer({
              file: path.resolve(root, options.config ?? DEFAULT_CONFIG_FILE),
              explicit: options.config !== undefined,
              report,
            }),
          plugins,
          onMissingPlugins,
          ui: uiSource === 'source' ? liveUi : distUi,
        })
      );

      // Вложенный сервер держит наблюдателей за файлами и сокет на сервере приложения:
      // с закрытием и перезапуском сервера приложения он обязан уйти.
      host.httpServer?.once('close', () => {
        void closeSourceUi();
      });
    },

    async closeBundle() {
      await closeSourceUi();
    },
  };
}
