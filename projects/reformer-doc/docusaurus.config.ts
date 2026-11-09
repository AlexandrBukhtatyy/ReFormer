import { themes as prismThemes } from 'prism-react-renderer';
import type { Config, Plugin } from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';
import path from 'path';
import { createRequire } from 'module';
// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

const require = createRequire(import.meta.url);

/**
 * Инлайн-плагин для ЖИВЫХ демо @reformer/ui-kit:
 * 1. `configurePostCss` — подключает Tailwind v4 (@tailwindcss/postcss) в
 *    PostCSS-пайплайн Docusaurus, чтобы `src/css/reformer-demo.css`
 *    (theme+utilities+@source+@theme) компилировался.
 * 2. `configureWebpack` — дедуплицирует singleton-рантаймы (React, Radix,
 *    @preact/signals-core): одна копия на всё дерево, иначе ломаются
 *    `instanceof Signal` и React-контекст Radix при workspace-линке.
 *    Аналог `resolve.dedupe` из projects/react-playground/vite.config.ts.
 * 3. Импорт с суффиксом `?raw` отдаёт исходник файла строкой (`plugins/raw-source-loader.cjs`).
 *    На нём стоит `<LiveExample>`: пример импортируется дважды — как компонент и как
 *    текст, — поэтому вкладка «Код» показывает ровно то, что работает в превью.
 * 4. Один чанк на `@reformer/*` и общие рантаймы (клиентская production-сборка). Без него
 *    живые демо молча не показывали замечания: общий чанк `common` у Docusaurus собирает
 *    только модули, нужные половине страниц, поэтому ядро копировалось в чанк каждой страницы
 *    с демо, а объединение модулей (`concatenateModules`) делало каждую копию отдельным
 *    экземпляром. Нода, созданная ядром из чанка страницы, была чужой для `FormField` из
 *    основного бандла (глобальные MDX-компоненты): проверка ставила замечания, поле их не
 *    видело. В `docusaurus start` объединения нет — там всё работало, что и прятало поломку.
 */
function reformerLiveDemoPlugin(): Plugin<void> {
  // Каталог установленного пакета. Некоторые пакеты (@preact/signals-core,
  // @radix-ui/*) не экспортируют './package.json' — тогда резолвим entry и
  // поднимаемся до node_modules/<pkg>.
  const pkgDir = (pkg: string) => {
    try {
      return path.dirname(require.resolve(`${pkg}/package.json`));
    } catch {
      const entry = require.resolve(pkg);
      const marker = path.join('node_modules', ...pkg.split('/'));
      const idx = entry.lastIndexOf(marker);
      return idx === -1 ? path.dirname(entry) : entry.slice(0, idx + marker.length);
    }
  };
  return {
    name: 'reformer-live-demo',
    configurePostCss(postcssOptions) {
      postcssOptions.plugins.push(require('@tailwindcss/postcss'));
      return postcssOptions;
    },
    configureWebpack(_config, isServer) {
      return {
        ...(isServer
          ? {}
          : {
              optimization: {
                splitChunks: {
                  cacheGroups: {
                    reformer: {
                      test: /[\\/](packages[\\/]reformer[^\\/]*[\\/]dist|node_modules[\\/](@preact[\\/]signals-core|radix-ui|@radix-ui))[\\/]/,
                      name: 'reformer-runtime',
                      chunks: 'all' as const,
                      priority: 50,
                      enforce: true,
                    },
                  },
                },
              },
            }),
        resolve: {
          alias: {
            react: pkgDir('react'),
            'react-dom': pkgDir('react-dom'),
            '@preact/signals-core': pkgDir('@preact/signals-core'),
            '@radix-ui/react-select': pkgDir('@radix-ui/react-select'),
            '@radix-ui/react-slot': pkgDir('@radix-ui/react-slot'),
          },
        },
        module: {
          rules: [
            {
              resourceQuery: /raw/,
              enforce: 'pre',
              use: [require.resolve('./plugins/raw-source-loader.cjs')],
            },
          ],
        },
      };
    },
  };
}

const config: Config = {
  title: 'ReFormer',
  tagline: 'Reactive forms library with signals',
  favicon: 'img/favicon.ico',

  future: {
    // Флаги v4 перечислены явно, а не `v4: true`: с 3.10 сокращение включает ещё
    // `fasterByDefault` (сборка на Rspack, нужен пакет @docusaurus/faster),
    // `mdx1CompatDisabledByDefault` и `siteStorageNamespacing`. Переход на Rspack меняет
    // раскладку чанков, а от неё зависят живые демо (см. `reformerLiveDemoPlugin`), — его
    // включают отдельно, с проверкой демо в браузере.
    v4: {
      removeLegacyPostBuildHeadAttribute: true,
      useCssCascadeLayers: true,
    },
  },

  url: 'https://alexandrbukhtatyy.github.io',
  baseUrl: '/ReFormer/',

  organizationName: 'AlexandrBukhtatyy',
  projectName: 'ReFormer',
  trailingSlash: false,
  deploymentBranch: 'gh-pages',

  onBrokenLinks: 'throw',
  // Сборка сайта — единственная проверка ссылок в документации: битая ссылка или якорь
  // должны ронять её, а не теряться среди предупреждений.
  onBrokenAnchors: 'throw',

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. For example, if your site is Chinese, you
  // may want to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: 'ru',
    locales: ['ru', 'en'],
    localeConfigs: {
      en: {
        label: 'English',
        htmlLang: 'en-US',
      },
      ru: {
        label: 'Русский',
        htmlLang: 'ru-RU',
      },
    },
  },
  plugins: [
    reformerLiveDemoPlugin,
    [
      'docusaurus-plugin-typedoc',
      {
        // Корень и `react` помечены `@mergeModuleWith` — их символы лежат плоско (api/functions,
        // api/interfaces…). Остальные входы пакета — отдельными модулями: api/form/validation,
        // api/form/validators, api/form/behaviors, api/i18n, api/model (имена — из тегов `@module`).
        // Без них в справочнике не было ни правил, ни операторов поведения: корень их не реэкспортирует.
        entryPoints: [
          '../../packages/reformer/src/index.ts',
          '../../packages/reformer/src/react.ts',
          '../../packages/reformer/src/form/validation/index.ts',
          '../../packages/reformer/src/form/validators/index.ts',
          '../../packages/reformer/src/form/behaviors/index.ts',
          '../../packages/reformer/src/i18n.ts',
          '../../packages/reformer/src/model/index.ts',
        ],
        tsconfig: '../../packages/reformer/tsconfig.typedoc.json',
        readme: 'none',
        // Сортировка: enum, interface, type-alias, class, function, variable
        kindSortOrder: ['Enum', 'Interface', 'TypeAlias', 'Class', 'Function', 'Variable'],
        sortEntryPoints: false,
        sort: ['kind', 'alphabetical'],
        // Убрать префиксы "Class:", "Interface:" и дженерики из заголовков
        pageTitleTemplates: {
          index: 'Core API Reference',
          // Функция удаляет дженерики: FormNode<T> -> FormNode
          member: (args: { name: string }) =>
            args.name.replace(/\\<[^>]*\\>/g, '').replace(/<[^>]*>/g, ''),
          module: '{name}',
        },
        useCodeBlocks: true,
        excludeInternal: true,
        // Группировка и категоризация
        navigation: {
          includeGroups: true,
          includeCategories: true,
        },
        categorizeByGroup: true,
        groupOrder: ['Nodes', 'Types', 'React Hooks', 'Validation', 'Behaviors', 'Utilities', '*'],
        categoryOrder: [
          'Core Types',
          'Configuration Types',
          'Proxy Types',
          'Validation Types',
          'Behavior Types',
          'Core Functions',
          'Validators',
          'Behavior Rules',
          'Type Guards',
          '*',
        ],
      },
    ],
  ],
  markdown: {
    format: 'detect',
    // Схемы сайта рисуются компонентами из src/components/diagrams (примитивы Diagram/Box/Arrow,
    // SequenceDiagram), а не Mermaid: у Mermaid свои шрифты и заливки, его схема выбивается из
    // соседних. Поддержка Mermaid оставлена включённой, но новых блоков ```mermaid не добавляйте.
    mermaid: true,
    hooks: {
      onBrokenMarkdownLinks: 'throw',
    },
  },
  themes: ['@docusaurus/theme-mermaid'],
  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          editUrl: 'https://github.com/AlexandrBukhtatyy/ReFormer/tree/main/projects/reformer-doc/',
        },
        blog: false,
        theme: {
          customCss: ['./src/css/custom.css', './src/css/reformer-demo.css'],
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    announcementBar: {
      id: 'beta_banner',
      content:
        '🚧 ReFormer is in beta. API may change. <a href="https://github.com/AlexandrBukhtatyy/ReFormer/issues">Report issues</a>',
      backgroundColor: '#fef3c7',
      textColor: '#92400e',
      isCloseable: true,
    },
    colorMode: {
      respectPrefersColorScheme: true,
    },
    mermaid: {
      // neutral — серые узлы без «фирменной» сиреневой заливки, не спорят с палитрой сайта.
      theme: { light: 'neutral', dark: 'dark' },
    },
    navbar: {
      title: 'ReFormer',
      logo: {
        alt: 'ReFormer Logo',
        src: 'img/logo.svg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'coreSidebar',
          position: 'left',
          label: 'Core',
        },
        {
          type: 'docSidebar',
          sidebarId: 'cdkSidebar',
          position: 'left',
          label: 'CDK',
        },
        {
          type: 'docSidebar',
          sidebarId: 'uiKitSidebar',
          position: 'left',
          label: 'UI-Kit',
        },
        {
          type: 'docSidebar',
          sidebarId: 'rendererSidebar',
          position: 'left',
          label: 'Renderer',
        },
        {
          type: 'docSidebar',
          sidebarId: 'mcpSidebar',
          position: 'left',
          label: 'MCP',
        },
        {
          // Раздел документации билдера; бейдж «dev» — проект ещё в разработке.
          type: 'docSidebar',
          sidebarId: 'builderSidebar',
          position: 'left',
          label: 'Builder',
          className: 'navbar-builder-dev',
        },
        {
          // Сам билдер — отдельный Vite-SPA, задеплоен в подкаталог того же Pages-сайта.
          // `pathname://` → роутер не трогает ссылку и сам подставляет baseUrl (/ReFormer/).
          href: 'pathname:///builder/',
          label: 'Open builder',
          position: 'right',
        },
        {
          href: 'https://stackblitz.com/~/github.com/AlexandrBukhtatyy/ReFormer/tree/main/projects/react-playground?file=projects/react-playground/src/App.tsx',
          label: 'Stackblitz',
          position: 'right',
        },
        {
          href: 'https://github.com/AlexandrBukhtatyy/ReFormer',
          label: 'GitHub',
          position: 'right',
        },
        {
          type: 'localeDropdown',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Documentation',
          items: [
            {
              label: 'Getting Started',
              to: '/docs/getting-started/installation',
            },
            {
              label: 'UI-Kit',
              to: '/docs/ui-kit/overview',
            },
            {
              label: 'Core API Reference',
              to: '/docs/api',
            },
          ],
        },
        {
          title: 'Resources',
          items: [
            {
              label: 'Examples',
              to: '/docs/examples',
            },
            {
              label: 'StackBlitz',
              href: 'https://stackblitz.com/~/github.com/AlexandrBukhtatyy/ReFormer/tree/main/projects/react-playground?file=projects/react-playground/src/App.tsx',
            },
            {
              label: 'GitHub',
              href: 'https://github.com/AlexandrBukhtatyy/ReFormer',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} ReFormer. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['bash', 'json'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
