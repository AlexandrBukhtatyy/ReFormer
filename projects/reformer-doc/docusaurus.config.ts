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
    configureWebpack() {
      return {
        resolve: {
          alias: {
            react: pkgDir('react'),
            'react-dom': pkgDir('react-dom'),
            '@preact/signals-core': pkgDir('@preact/signals-core'),
            '@radix-ui/react-select': pkgDir('@radix-ui/react-select'),
            '@radix-ui/react-slot': pkgDir('@radix-ui/react-slot'),
          },
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
    v4: true,
  },

  url: 'https://alexandrbukhtatyy.github.io',
  baseUrl: '/ReFormer/',

  organizationName: 'AlexandrBukhtatyy',
  projectName: 'ReFormer',
  trailingSlash: false,
  deploymentBranch: 'gh-pages',

  onBrokenLinks: 'throw',

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
        entryPoints: ['../../packages/reformer/src/index.ts'],
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
  },
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
          href: 'https://stackblitz.com/~/github.com/AlexandrBukhtatyy/ReFormer/tree/main/projects/react-playground?file=projects/react-playground/src/App.tsx',
          label: 'Playground',
          position: 'left',
        },
        {
          type: 'localeDropdown',
          position: 'right',
        },
        {
          href: 'https://github.com/AlexandrBukhtatyy/ReFormer',
          label: 'GitHub',
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
