import { themes as prismThemes } from 'prism-react-renderer';
import type { Config } from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';
// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

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
    [
      'docusaurus-plugin-typedoc',
      {
        entryPoints: ['../../packages/reformer/src/index.ts'],
        tsconfig: '../../packages/reformer/tsconfig.json',
        // Убрать префиксы "Class:", "Interface:" и дженерики из заголовков
        pageTitleTemplates: {
          index: '{projectName}',
          // Функция удаляет дженерики: FormNode<T> -> FormNode
          member: (args: { name: string }) =>
            args.name.replace(/\\<[^>]*\\>/g, '').replace(/<[^>]*>/g, ''),
          module: '{name}',
        },
        useCodeBlocks: true,
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
          editUrl: 'https://github.com/AlexandrBukhtatyy/ReFormer/tree/main/projects/reform-doc/',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: 'img/reformer-social-card.jpg',
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
          sidebarId: 'docsSidebar',
          position: 'left',
          label: 'Docs',
        },
        {
          to: '/docs/api',
          position: 'left',
          label: 'API',
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
              label: 'API Reference',
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
