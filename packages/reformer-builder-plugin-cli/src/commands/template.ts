/**
 * Шаблон нового плагина: файлы, которые `reformer-plugin create` кладёт в пустой каталог.
 *
 * Шаблон — функции, а не файлы в пакете. Файлы пришлось бы копировать при сборке и не забыть
 * в поле `files`, а их содержимое всё равно зависит от идентификатора и версий: подстановка
 * в строках честнее мини-шаблонизатора.
 *
 * ## Что в шаблоне и почему
 *
 * - **`manifest.json` исходников** — `main` указывает на `src/main.ts`, словари объявлены.
 *   Сразу проходит `reformer-plugin validate`: это проверяется тестом, иначе первым опытом
 *   автора был бы отказ на только что созданном плагине.
 * - **`src/main.ts`** — одна команда и её подпись из словаря. Минимум, который виден в оболочке
 *   (палитра команд) и при этом показывает оба обязательных приёма: вклад через `subscriptions`
 *   и строку через ключ, а не текстом.
 * - **`locales/ru.json`, `locales/en.json`** — плоские словари.
 * - **`src/main.test.ts`** — проверка, которую иначе сделает только оболочка: `id` кода совпадает
 *   с `id` манифеста. Расхождение — отказ загрузки (`id-mismatch`), и лучше увидеть его в тесте.
 * - **`package.json`** — `@reformer/builder-plugin-api` в `devDependencies`: в рантайме модуль
 *   даёт оболочка, в сборку он не попадает (см. README пакета контракта).
 *
 * @module @reformer/builder-plugin-cli/commands/template
 */

import { BUILDER_API_VERSION } from '@reformer/builder-plugin-api/tooling';

export interface TemplateInput {
  readonly id: string;
  readonly name: string;
  /** Версия самого CLI — для диапазона в `devDependencies` шаблона. */
  readonly cliVersion: string;
}

/** Путь внутри каталога плагина → содержимое. */
export type TemplateFiles = Readonly<Record<string, string>>;

const json = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;

/** Мажор API оболочки: диапазон, против которого написан новый плагин. */
function apiMajor(): string {
  return BUILDER_API_VERSION.split('.')[0] ?? '1';
}

export function manifestTemplate({ id, name }: Pick<TemplateInput, 'id' | 'name'>): string {
  return json({
    id,
    name,
    version: '0.1.0',
    apiVersion: `^${apiMajor()}`,
    main: 'src/main.ts',
    contributes: {
      messages: { ru: 'locales/ru.json', en: 'locales/en.json' },
    },
  });
}

export function pluginTemplate(input: TemplateInput): TemplateFiles {
  const { id, name, cliVersion } = input;
  const commandId = `${id}.hello`;

  return {
    'manifest.json': manifestTemplate(input),
    'package.json': json({
      // Имя пакета npm — только строчные; идентификатор плагина вправе быть другим.
      name: id.toLowerCase(),
      version: '0.1.0',
      private: true,
      type: 'module',
      scripts: {
        validate: 'reformer-plugin validate',
        build: 'reformer-plugin build',
        pack: 'reformer-plugin pack',
        test: 'vitest run',
      },
      devDependencies: {
        '@reformer/builder-plugin-api': `^${apiMajor()}.0.0`,
        '@reformer/builder-plugin-cli': `^${cliVersion}`,
        typescript: '^5.9.3',
        vitest: '^4.0.8',
      },
    }),
    'tsconfig.json': json({
      compilerOptions: {
        target: 'ES2022',
        module: 'ESNext',
        moduleResolution: 'bundler',
        strict: true,
        noEmit: true,
        skipLibCheck: true,
        resolveJsonModule: true,
      },
      include: ['src'],
    }),
    '.gitignore': 'node_modules/\ndist/\n',
    'src/main.ts': `import { definePlugin } from '@reformer/builder-plugin-api';

export default definePlugin({
  id: '${id}',
  activate(ctx) {
    ctx.subscriptions.push(
      ctx.commands.register({
        id: '${commandId}',
        // Ключ словаря плагина, а не текст: строки лежат в locales/*.json.
        titleKey: 'command.hello',
        run: () => true,
      })
    );
  },
});
`,
    'src/main.test.ts': `import { expect, it } from 'vitest';

import manifest from '../manifest.json';
import plugin from './main';

it('идентификатор кода совпадает с манифестом', () => {
  // Иначе оболочка откажет в загрузке (id-mismatch).
  expect(plugin.id).toBe(manifest.id);
});
`,
    'locales/ru.json': json({ 'command.hello': `${name}: привет` }),
    'locales/en.json': json({ 'command.hello': `${name}: hello` }),
  };
}
