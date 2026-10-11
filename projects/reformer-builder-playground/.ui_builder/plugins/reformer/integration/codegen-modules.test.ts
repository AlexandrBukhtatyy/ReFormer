/**
 * Кодоген домена встречается с реестром модулей оболочки.
 *
 * Сгенерированная форма импортирует кит, визард и тело шага по спецификаторам, которые печатает
 * кодоген (`schema/registry.ts`), а исполняет её превью оболочки — и находит модули в своём
 * реестре. Спецификаторы и реестр живут в разных местах, и совпасть они обязаны здесь: всё, что
 * печатает реестр формы, превью обязано уметь слинковать.
 *
 * С тех пор как подпуть записи каталога значит «откуда импортируется символ», реестр формы
 * печатает импорты с подпутей кита (`@reformer/ui-kit/combobox`, `…/date-picker`) — и каждый
 * такой спецификатор обязан быть в реестре оболочки поимённо: резолвит она точным совпадением.
 *
 * @module plugins/reformer/integration/codegen-modules.test
 */

import { describe, expect, it } from 'vitest';
import { RUNTIME_MODULES } from '@/application/composer/runtime-modules';
import { createPluginModules } from '@/shell/boot/plugin-modules';
import { buildView, makeNames, moduleFilesOf, prepare, STEP_IMPORT } from '../core/codegen';
import { BUILTIN_CATALOG, builtinKit, subpathSchema, wizardSchema } from '../core/testing';
import { BUILTIN_TARGETS, generateModule } from '../codegen/src';
import {
  createBuiltinStore,
  materializeFiles,
  SIMPLE_TEMPLATE_ID,
  WIZARD_TEMPLATE_ID,
  type ModulePrinter,
} from '../templates/src';

/** Спецификаторы пакетов из текста модуля — и `import … from`, и `import type … from`. */
function packageImports(source: string): string[] {
  const found: string[] = [];
  for (const match of source.matchAll(/^import\s[^;]*?\sfrom\s+'([^'.][^']*)';/gms)) {
    found.push(match[1]);
  }
  return found;
}

/**
 * Файлы модуля, которые превью исполняет или линкует по их импортам. Страницу, реэкспорты, сборку
 * приложения и запись реестра форм оно не исполняет — собирает форму само.
 */
function executedFiles(
  files: readonly { path: string; content: string }[],
  formName: string
): readonly { path: string; content: string }[] {
  const layout = moduleFilesOf(makeNames(formName));
  const skipped = new Set([layout.page, layout.barrel, layout.create, layout.entry]);
  return files.filter((file) => /\.tsx?$/.test(file.path) && !skipped.has(file.path));
}

/**
 * Файлы встроенного шаблона под встроенным китом, разложенные под имя формы, — то же, что человек
 * получит, создав форму по шаблону. Печатает их тот же конвейер, что возможность печатника.
 */
async function builtinTemplateFiles(
  id: string,
  formName: string
): Promise<readonly { path: string; content: string }[]> {
  const view = builtinKit();
  const print: ModulePrinter = async (schema, name, seed) => {
    const built = await generateModule(BUILTIN_TARGETS, {
      schema,
      formName: name,
      rules: seed?.rules,
      mock: seed?.mock,
      splitSteps: seed?.splitSteps,
      kit: view,
    });
    expect(built.problems, `цели не напечатались: ${name}`).toEqual([]);
    return built.files.map(({ path, content }) => ({ path, content }));
  };
  const templates = await createBuiltinStore({
    print,
    catalog: () => view.catalog,
    kit: () => view.kit,
  }).list();
  const template = templates.find((item) => item.id === id);
  if (template === undefined) throw new Error(`нет встроенного шаблона ${id}`);
  return materializeFiles(
    template,
    template.files.map((file) => file.path),
    formName
  );
}

describe('модули, которые просит сгенерированная форма', () => {
  it('визард и тело шага реестр формы берёт по спецификаторам, которые отдаёт реестр оболочки', () => {
    // Отказ, который это удерживает, уже случался: адаптер визарда объявлял подпуть, кодоген
    // печатал `import … from '@reformer/ui-kit/form-wizard'`, и выгруженная форма не
    // поднималась в превью — подпутей кита в реестре оболочки тогда не было (теперь они в нём
    // поимённо, см. `application/runtime/kit`). Снимок текста файла такое не ловит: он сверяет
    // строку с собой же.
    const { registry, kit } = buildView(
      prepare({ schema: wizardSchema(), formName: 'Заявка', kit: builtinKit() })
    );
    const modules = createPluginModules({ modules: RUNTIME_MODULES });

    // Визард — библиотечный, из адаптера кита; тело шага — всегда из cdk.
    expect(registry.wizard).not.toBeNull();
    expect(registry.wizard?.stepName).toBe('Step');
    expect(modules.specifiers).toContain(registry.wizard?.importFrom);
    expect(modules.specifiers).toContain(STEP_IMPORT);
    expect(modules.specifiers).toContain(kit.importSpecifier);
    // И всё остальное, что реестр формы импортирует сверх главного входа кита.
    expect(registry.extraImports.map((extra) => extra.from)).toContain(STEP_IMPORT);
    for (const extra of registry.extraImports) {
      expect(modules.specifiers).toContain(extra.from);
    }
    modules.dispose();
  });

  it('каждый пакет, который импортируют исполняемые превью файлы модуля, есть в реестре оболочки', async () => {
    // Вид реестра — половина дела: импорты печатают ещё и шаблоны остальных ролей. Сверяется
    // напечатанный ТЕКСТ тех файлов, которые превью исполняет или линкует по их импортам.
    const module = await generateModule(BUILTIN_TARGETS, {
      schema: wizardSchema(),
      formName: 'Заявка',
      kit: builtinKit(),
      splitSteps: true,
    });
    expect(module.problems).toEqual([]);
    const modules = createPluginModules({ modules: RUNTIME_MODULES });

    // Страницу, реэкспорты, сборку приложения и запись реестра форм превью не исполняет.
    const skipped = new Set([
      'ZayavkaForm.tsx',
      'index.ts',
      'application/create.ts',
      'application/entry.ts',
    ]);
    const executed = module.files.filter(
      (file) => /\.tsx?$/.test(file.path) && !skipped.has(file.path)
    );
    expect(executed.map((file) => file.path)).toEqual(
      expect.arrayContaining([
        'schema/registry.ts',
        'behavior/index.ts',
        'application/submit.ts',
        'validation/form.ts',
        'flow/zayavka-flow.ts',
      ])
    );

    const requested = new Set(executed.flatMap((file) => packageImports(file.content)));
    expect([...requested]).toEqual(
      expect.arrayContaining(['@reformer/ui-kit', STEP_IMPORT, '@reformer/renderer-json'])
    );
    for (const specifier of requested) {
      expect(modules.specifiers, `модуль «${specifier}» недоступен превью`).toContain(specifier);
    }
    modules.dispose();
  });
});

describe('компоненты за подпутём кита', () => {
  it('форма с комбобоксом и выбором даты импортирует их с подпутей, которые отдаёт оболочка', async () => {
    // Отказ, который это удерживает, симметричен прежнему: пока подпутей в реестре оболочки не
    // было, форма с `import { ComboboxMulti } from '@reformer/ui-kit/combobox'` у пользователя
    // собиралась, а в превью не поднималась («модуль недоступен»). Теперь такой импорт печатает
    // сам кодоген — и каждый напечатанный спецификатор обязан найтись в реестре.
    const formName = 'Анкета';
    const module = await generateModule(BUILTIN_TARGETS, {
      schema: subpathSchema(),
      formName,
      kit: builtinKit(),
    });
    expect(module.problems).toEqual([]);
    const modules = createPluginModules({ modules: RUNTIME_MODULES });

    const registry = module.files.find((file) => file.path === 'schema/registry.ts');
    expect(registry?.content).toContain(
      "import { Combobox, ComboboxMulti } from '@reformer/ui-kit/combobox';"
    );
    expect(registry?.content).toContain(
      "import { DatePicker } from '@reformer/ui-kit/date-picker';"
    );
    // Заглушки за подпуть больше нет — компонент зарегистрирован символом кита.
    expect(registry?.content).not.toContain('Placeholder');

    const requested = new Set(
      executedFiles(module.files, formName).flatMap((file) => packageImports(file.content))
    );
    expect([...requested]).toEqual(
      expect.arrayContaining([
        '@reformer/ui-kit',
        '@reformer/ui-kit/combobox',
        '@reformer/ui-kit/date-picker',
        '@reformer/ui-kit/carousel',
      ])
    );
    for (const specifier of requested) {
      expect(modules.specifiers, `модуль «${specifier}» недоступен превью`).toContain(specifier);
    }
    modules.dispose();
  });

  it.each([
    { name: 'Простая форма', id: SIMPLE_TEMPLATE_ID },
    { name: 'Пошаговая форма', id: WIZARD_TEMPLATE_ID },
  ])('встроенный шаблон «$name» линкуется превью целиком', async (template) => {
    // Шаблон — вывод кодогена по затравке, а в затравке теперь комбобокс, мультикомбобокс и
    // выбор даты. Сверяется то же, что человек получит, создав форму по шаблону.
    const formName = 'my form';
    const files = await builtinTemplateFiles(template.id, formName);
    const modules = createPluginModules({ modules: RUNTIME_MODULES });

    const registry = files.find((file) => file.path === 'schema/registry.ts')?.content ?? '';
    expect(registry).toContain(
      "import { Combobox, ComboboxMulti } from '@reformer/ui-kit/combobox';"
    );
    expect(registry).toContain("import { DatePicker } from '@reformer/ui-kit/date-picker';");
    // Каждое поле зарегистрировано символом кита: заглушка означала бы пустоту на месте поля.
    expect(registry).not.toContain('Placeholder');
    for (const component of ['Combobox', 'ComboboxMulti', 'DatePicker']) {
      expect(registry, component).toContain(`reg.component('${component}', ${component});`);
    }

    const executed = executedFiles(files, formName);
    expect(executed.map((file) => file.path)).toEqual(
      expect.arrayContaining(['schema/registry.ts', 'behavior/index.ts', 'validation/form.ts'])
    );
    const requested = new Set(executed.flatMap((file) => packageImports(file.content)));
    expect([...requested]).toEqual(
      expect.arrayContaining([
        '@reformer/ui-kit',
        '@reformer/ui-kit/combobox',
        '@reformer/ui-kit/date-picker',
      ])
    );
    for (const specifier of requested) {
      expect(modules.specifiers, `модуль «${specifier}» недоступен превью`).toContain(specifier);
    }
    modules.dispose();
  });

  it('каждый подпуть, который объявил каталог встроенного кита, оболочка отдаёт поимённо', () => {
    // Каталог целиком, а не только записи палитры: импорт напишет и человек — частью составного
    // компонента или провайдером, которых в палитре нет.
    const specifier = builtinKit().kit.codegen.importSpecifier;
    const subpaths = new Set(
      BUILTIN_CATALOG.components.flatMap((record) =>
        record.subpath === undefined ? [] : [record.subpath]
      )
    );
    expect([...subpaths]).toEqual(
      expect.arrayContaining(['calendar', 'combobox', 'date-picker', 'input-otp', 'table'])
    );
    const modules = createPluginModules({ modules: RUNTIME_MODULES });
    for (const subpath of subpaths) {
      expect(modules.specifiers, `подпуть «${subpath}» недоступен превью`).toContain(
        `${specifier}/${subpath}`
      );
    }
    modules.dispose();
  });
});
