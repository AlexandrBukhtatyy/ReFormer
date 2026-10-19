/**
 * Встроенные шаблоны — против настоящего печатника и настоящего предиката редактора схемы.
 *
 * Проверяется стык, который не виден ни одному из тестов по отдельности: шаблоны печатает
 * КОДОГЕН, а открывает напечатанное РЕДАКТОР СХЕМЫ, и плагины друг друга не импортируют —
 * встретиться они могут только здесь, в композиции. Разошлись они молча: схема (тогда ещё
 * `renderer.schema.json`, теперь `schema/form.schema.json`) уезжала со строкой-маркером `//`
 * первой, переставала быть JSON, и форма, созданная по шаблону, открывалась голым текстом вместо
 * канваса.
 *
 * Второй стык — имена. Список файлов шаблона печатается один раз, под базовое имя, а форму по нему
 * создают под любое; кодоген же потом перегенерирует её под имя каталога. Разойдись их имена
 * файлов — в модуле остались бы сироты, поэтому здесь пути шаблона, разложенные под имя,
 * сравниваются с путями кодогена для того же имени.
 *
 * Третий — тексты. Кодоген укладывает модуль под ширину строки, а ширина зависит от имён модуля,
 * поэтому текст под имя формы даёт не подстановка токенов, а ПЕЧАТЬ под это имя (`applyTemplate` —
 * ею форму создаёт операция). Созданное по шаблону сравнивается с выводом кодогена для того же
 * имени целиком: расхождение здесь — модуль, который собирается, но не проходит форматтер проекта.
 *
 * @module shell/boot/integration/builtin-templates.test
 */

import { describe, expect, it } from 'vitest';
import { isGenerated } from '@reformer/builder-toolkit';
import type { JsonFormSchema } from '@reformer/renderer-json';
import hexaCatalog from '../../kit-hexa-ui/catalog.json';
import { projectCatalog } from '../core/catalog';
import {
  isFlatLayoutPath,
  makeNames,
  moduleFilesOf,
  stepSchemaPath,
  stepValidationPath,
  type KitView,
} from '../core/codegen';
import { builtinKit } from '../core/testing';
import { BUILTIN_TARGETS, generateModule } from '../codegen/src';
import { looksLikeFormSchema } from '../editor/src/model/provider';
import {
  applyTemplate,
  BUILTIN_BASE_NAME,
  createBuiltinStore,
  materializeFiles,
  MODULE_TOKENS,
  SIMPLE_TEMPLATE_ID,
  WIZARD_TEMPLATE_ID,
  TOKENS,
  type FormTemplate,
  type ModulePrinter,
  type SeedExtras,
} from '../templates/src';

/** Что печатник получил на вход: по этому же входу кодоген печатает форму под другое имя. */
interface Printed {
  readonly schema: JsonFormSchema;
  readonly seed: SeedExtras | undefined;
}

/** Модуль формы — тем же конвейером, что возможность `reformer.codegen.printer`. */
async function generate(
  view: KitView,
  schema: JsonFormSchema,
  formName: string,
  seed: SeedExtras | undefined
) {
  const built = await generateModule(BUILTIN_TARGETS, {
    schema,
    formName,
    rules: seed?.rules,
    mock: seed?.mock,
    splitSteps: seed?.splitSteps,
    kit: view,
  });
  expect(built.problems, `цели не напечатались: ${formName}`).toEqual([]);
  return built.files.map(({ path, content }) => ({ path, content }));
}

/** Встроенные шаблоны под кит — и то, из чего каждый напечатан. */
async function templatesUnder(view: KitView) {
  const inputs: Printed[] = [];
  const print: ModulePrinter = async (schema, formName, seed) => {
    inputs.push({ schema, seed });
    return generate(view, schema, formName, seed);
  };
  const templates = await createBuiltinStore({
    print,
    catalog: () => view.catalog,
    kit: () => view.kit,
  }).list();
  return { templates, inputs };
}

/** Файлы МОДУЛЯ шаблона: всё, кроме фикстуры, — её кодоген не печатает. */
function modulePaths(template: FormTemplate): string[] {
  return template.files
    .filter((file) => (file.scope ?? 'form') === 'form')
    .map((file) => file.path);
}

function hexaKit(): KitView {
  const built = projectCatalog(hexaCatalog as never);
  return { kit: built.descriptor, catalog: built.entries };
}

/** Страница модуля в шаблоне: имя файла — токен типа формы. */
const PAGE = `${MODULE_TOKENS.type}.tsx`;

/** Имена форм, на которых написания имени расходятся с именами кодогена. */
const FORM_NAMES = [
  // Несколько слов: каталог — kebab, тип — PascalCase, запись реестра — camelCase.
  'my form',
  // Кириллица с пробелом: транслитерация участвует в каждом имени.
  'Профиль пользователя',
  // Имя уже оканчивается на `Form`: суффикс типа не удваивается.
  'contact form',
  // Заглавные подряд: `kebab` билдера слова не разбивает.
  'ABCForm',
];

describe('форма по встроенному шаблону открывается редактором схемы', () => {
  it('напечатанная схема — разбираемый json, который берёт редактор', async () => {
    const { templates } = await templatesUnder(builtinKit());
    expect(templates.map((t) => t.id)).toEqual([SIMPLE_TEMPLATE_ID, WIZARD_TEMPLATE_ID]);

    for (const template of templates) {
      const files = await applyTemplate(
        template,
        template.files.map((file) => file.path),
        'test'
      );
      // Документ формы лежит в папке ролей — его билдер и открывает после создания формы.
      const schema = files.find((file) => file.path === moduleFilesOf(makeNames('test')).schema);

      expect(schema, `шаблон «${template.name}» без схемы`).toBeDefined();
      expect(schema?.path).toBe('schema/form.schema.json');
      // Предикат ТОТ ЖЕ, по которому оболочка выбирает редактор: два разных ответа на этот
      // вопрос означали бы вкладку с текстом там, где ожидается канвас.
      expect(looksLikeFormSchema(schema?.content ?? ''), template.name).toBe(true);
    }
  });

  it('«Пошаговая форма» раскладывает шаги по файлам, простая — нет', async () => {
    const { templates } = await templatesUnder(builtinKit());
    const layout = moduleFilesOf(makeNames('test'));
    const pathsOf = (id: string): readonly string[] => {
      const template = templates.find((t) => t.id === id);
      if (template === undefined) throw new Error(`нет шаблона ${id}`);
      // Отмечена только точка входа — страница (в шаблоне её имя стоит токеном типа формы).
      // Остальное обязано приехать зависимостями, включая поток, правила и схемы шагов.
      return materializeFiles(template, [PAGE], 'test').map((file) => file.path);
    };

    const wizard = pathsOf(WIZARD_TEMPLATE_ID);
    // Порядок шагов и их правила задаёт поток — агрегатора шагов и переходника визарда больше нет.
    expect(wizard).toContain(layout.flow);
    for (const step of ['dannye', 'kontakty', 'dopolnitelno']) {
      expect(wizard).toContain(stepValidationPath(step));
      expect(wizard).toContain(stepSchemaPath(layout.schema, step));
    }
    expect(wizard).toContain(layout.create);
    expect(wizard).toContain(layout.registry);
    // Словарь замечаний страница импортирует сама (оборачивает форму в провайдер текстов) —
    // без него она не соберётся, и он обязан приехать вместе с ней.
    expect(wizard).toContain(layout.messages);
    // README, реэкспорты и запись реестра форм страница за собой не тянет.
    expect(wizard).not.toContain(layout.readme);
    expect(wizard).not.toContain(layout.barrel);
    expect(wizard).not.toContain(layout.entry);

    const simple = pathsOf(SIMPLE_TEMPLATE_ID);
    expect(simple).toContain(layout.page);
    expect(simple).toContain(layout.messages);
    expect(simple.some((path) => path.includes('/steps/'))).toBe(false);
    expect(simple).not.toContain(layout.flow);

    // Ни одного файла прежней плоской раскладки ни в одном шаблоне.
    for (const path of [...wizard, ...simple]) {
      expect(isFlatLayoutPath(path), path).toBe(false);
    }
  });

  it('реэкспорты тянут за собой весь модуль: страницу, запись реестра форм и их зависимости', async () => {
    const { templates } = await templatesUnder(builtinKit());
    const layout = moduleFilesOf(makeNames('test'));

    for (const template of templates) {
      const picked = materializeFiles(template, [layout.barrel], 'test').map((f) => f.path);
      const all = materializeFiles(template, modulePaths(template), 'test').map((f) => f.path);

      // Всё, кроме README: модулю он не нужен.
      expect([...picked].sort(), template.name).toEqual(
        all.filter((path) => path !== layout.readme).sort()
      );
    }
  });
});

describe('шаблон раскладывается так же, как печатает кодоген', () => {
  it.each(FORM_NAMES)('«%s»: список путей равен списку путей кодогена', async (formName) => {
    const view = builtinKit();
    const { templates, inputs } = await templatesUnder(view);

    for (const [index, template] of templates.entries()) {
      // Пути — ПОДСТАНОВКОЙ в пути шаблона: их показывает окно создания формы, и по ним же
      // текст, напечатанный под имя, находит своё место.
      const applied = materializeFiles(template, modulePaths(template), formName);
      const direct = await generate(view, inputs[index].schema, formName, inputs[index].seed);

      // Расхождение здесь — сироты после первой же генерации из билдера: шаблон положил бы
      // `types/myForm.ts`, а кодоген рядом — `types/my-form.ts`.
      expect(
        applied.map((file) => file.path),
        template.name
      ).toEqual(direct.map((file) => file.path));
    }
  });

  it.each(FORM_NAMES)(
    '«%s»: и содержимое то же — байт в байт, вместе с маркером',
    async (formName) => {
      const view = builtinKit();
      const { templates, inputs } = await templatesUnder(view);

      for (const [index, template] of templates.entries()) {
        // Так форму создаёт операция: шаблон печатается под её имя.
        const applied = await applyTemplate(template, modulePaths(template), formName);
        const direct = await generate(view, inputs[index].schema, formName, inputs[index].seed);

        // Целиком, а не по списку имён: импорты, заголовок, идентификатор формы в реестре, маршрут,
        // раскладка строк — всё, что кодоген выводит из имени формы, шаблон обязан вывести так же.
        expect(
          applied.map((file) => file.path),
          template.name
        ).toEqual(direct.map((file) => file.path));
        for (const file of direct) {
          const twin = applied.find((item) => item.path === file.path);
          expect(twin?.content, `${template.name} → ${file.path}`).toBe(file.content);
        }
      }
    }
  );

  it('подстановка токенов раскладку строк не переносит — под имя шаблон печатается', async () => {
    // Ради этого у встроенного шаблона и появилась печать под имя. Реестр формы импортирует
    // константы из `../constants/<каталог>`: под базовое имя импорт помещается в строку, под
    // длинное имя каталога — уже нет, и кодоген его рвёт. Подстановка переносит имя, но не перенос.
    const formName = 'Профиль пользователя';
    const view = builtinKit();
    const { templates, inputs } = await templatesUnder(view);
    const [simple] = templates;
    const registry = moduleFilesOf(makeNames(formName)).registry;
    const textOf = (files: readonly { path: string; content: string }[]): string =>
      files.find((file) => file.path === registry)?.content ?? '';
    const tooLong = (text: string): string[] =>
      text.split('\n').filter((line) => line.length > 100);

    const substituted = textOf(materializeFiles(simple, modulePaths(simple), formName));
    expect(tooLong(substituted)).toEqual([
      "import { CITY_LIST, GENDERS, POSITIONS, SKILLS, REFERENCE_LABEL } from '../constants/profil-polzovatelya';",
    ]);

    const printed = textOf(await applyTemplate(simple, modulePaths(simple), formName));
    expect(tooLong(printed)).toEqual([]);
    expect(printed).toBe(textOf(await generate(view, inputs[0].schema, formName, inputs[0].seed)));
  });

  it('файлы, которые кодоген метит маркером, остаются «сгенерированными»', async () => {
    const view = builtinKit();
    const { templates, inputs } = await templatesUnder(view);

    for (const [index, template] of templates.entries()) {
      const direct = await generate(
        view,
        inputs[index].schema,
        'Профиль пользователя',
        inputs[index].seed
      );
      const marked = direct.filter((file) => isGenerated(file.content)).map((file) => file.path);
      expect(marked.length, template.name).toBeGreaterThan(0);

      // Оба пути создания формы: печать под имя (маркер ставит кодоген) и подстановка — запасной
      // путь, когда печатника нет. У подстановки маркер считается от тела файла, а тело после
      // замены имени другое. «Правленный руками» файл поведения или валидации билдер не
      // перегенерирует из правил формы — то есть форма, только что созданная по шаблону, сразу
      // теряла бы связь с правилами.
      const ways = {
        печать: await applyTemplate(template, modulePaths(template), 'Профиль пользователя'),
        подстановка: materializeFiles(template, modulePaths(template), 'Профиль пользователя'),
      };
      for (const [way, applied] of Object.entries(ways)) {
        for (const path of marked) {
          const file = applied.find((item) => item.path === path);
          expect(isGenerated(file?.content), `${template.name} → ${path} (${way})`).toBe(true);
        }
      }
    }
  });
});

/**
 * Проверка, переживающая переформатирование.
 *
 * Заведена под перевод печати на шаблонизатор: golden-снимки ловят СДВИГ вывода, но молчат про
 * два отказа, которые от раскладки не зависят вовсе, — недоподставленный токен и пустой файл.
 * Первый уезжает пользователю буквально строкой `__FormType__` в коде, второй выглядит как
 * успешно созданная форма, у которой нечего открыть.
 *
 * Транспиляция сюда сознательно НЕ добавляется: она тянет чанк `typescript` на 3.5 МБ и снесла
 * бы бюджет node-прогона в 7-8 секунд ради проверки, которую делает сборка примера.
 */
describe('встроенный шаблон материализуется без следов затравки', () => {
  it('ни один токен имени не выжил и ни один файл не пуст', async () => {
    const { templates } = await templatesUnder(builtinKit());
    expect(templates.length).toBeGreaterThan(0);
    // Имена модуля, под которые печаталась затравка: в созданной форме их быть не должно.
    const base = makeNames(BUILTIN_BASE_NAME);
    const traces = [base.TypeName, base.entryConst, base.dir, base.title];

    for (const template of templates) {
      const all = template.files.map((file) => file.path);
      // Кириллица с пробелом: транслитерация участвует в каждом файле, а базовое имя затравки
      // обязано исчезнуть и из путей, и из текстов. Оба пути создания формы: печать под имя и
      // подстановка — запасной путь, когда печатника нет.
      const ways = {
        печать: await applyTemplate(template, all, 'Профиль пользователя'),
        подстановка: materializeFiles(template, all, 'Профиль пользователя'),
      };

      for (const [way, files] of Object.entries(ways)) {
        expect(files.length, `${template.name} (${way})`).toBe(template.files.length);

        for (const file of files) {
          const where = `${template.name} → ${file.path} (${way})`;
          expect(file.content.trim(), where).not.toBe('');
          for (const token of [...Object.values(TOKENS), ...Object.values(MODULE_TOKENS)]) {
            expect(file.path, where).not.toContain(token);
            expect(file.content, where).not.toContain(token);
          }
          for (const trace of traces) {
            expect(file.path, where).not.toContain(trace);
            expect(file.content, where).not.toContain(trace);
          }
        }
      }
    }
  });

  it('источники данных напечатаны настоящими значениями, а не синтезом', async () => {
    const { templates } = await templatesUnder(builtinKit());

    for (const template of templates) {
      const files = await applyTemplate(template, modulePaths(template), 'test');
      const constants = files.find((f) => f.path === moduleFilesOf(makeNames('test')).constants);

      expect(constants?.content, template.name).toContain('Москва');
      // Синтез печатает `option1/2/3` — по ним видно, что механизм работает, но не видно формы.
      for (const file of files) expect(file.content, file.path).not.toContain('option1');
    }
  });
});

describe('шаблон под внешним китом HexaUI', () => {
  /** Шаблоны под HexaUI — и реестр каждого, напечатанный под имя `test`. */
  async function hexaRegistries() {
    const { templates } = await templatesUnder(hexaKit());
    const layout = moduleFilesOf(makeNames('test'));
    return Promise.all(
      templates.map(async (template) => {
        const files = await applyTemplate(template, modulePaths(template), 'test');
        const registry = files.find((file) => file.path === layout.registry)?.content ?? '';
        return { template, files, registry };
      })
    );
  }

  it('оба шаблона: визард у кита есть — есть и пошаговая форма', async () => {
    const { templates } = await templatesUnder(hexaKit());

    // Пока у кита не было адаптера визарда, пошаговой формы не было: с заглушкой на месте визарда
    // она показывала бы все шаги разом и не отправлялась бы вовсе.
    expect(templates.map((t) => t.id)).toEqual([SIMPLE_TEMPLATE_ID, WIZARD_TEMPLATE_ID]);
  });

  it('поля анкеты — все, из каталога кита, и ни одной заглушки в реестре', async () => {
    for (const { template, files, registry } of await hexaRegistries()) {
      const where = template.name;
      // Заглушку кодоген ставит компоненту, которого в ките нет. Затравка таких не кладёт.
      expect(registry, where).not.toContain('Placeholder');
      // Полный каталог: у HexaUI есть каждый вид поля анкеты, включая маску, радиогруппу, дату,
      // комбобоксы и загрузку файлов, — затравка их больше не выбрасывает.
      for (const component of [
        'Input',
        'InputMask',
        'InputNumber',
        'Textarea',
        'DatePicker',
        'RadioGroup',
        'Select',
        'Combobox',
        'ComboboxMulti',
        'FileUploadDropzone',
        'Checkbox',
      ]) {
        expect(registry, `${where}: ${component}`).toContain(`reg.component('${component}',`);
      }
      // Компонента массива у кита нет, хотя ЗАПИСЬ массива в его каталоге есть — её добавляет
      // билдер. Массив в затравке уезжал в реестр импортом `FieldArray` из пакета кита, которого
      // там нет: модуль не собирался. Теперь массива нет вовсе — ни в схеме, ни в правилах.
      expect(registry, where).not.toContain('FieldArray');
      const text = files.map((file) => file.content).join('\n');
      for (const trace of ['references', 'hasReferences', 'REFERENCE_LABEL', 'applyEach']) {
        expect(text, `${where}: ${trace}`).not.toContain(trace);
      }
      // Подпутей кит не объявляет — и в реестре один импорт кита, из главного входа.
      expect(registry.match(/from '@reformer\/kit-hexa-ui[^']*'/g), where).toEqual([
        "from '@reformer/kit-hexa-ui'",
      ]);
    }
  });

  it('пошаговая форма: визард — адаптер кита, шаг — из cdk', async () => {
    const wizard = (await hexaRegistries()).find(
      ({ template }) => template.id === WIZARD_TEMPLATE_ID
    );
    const registry = wizard?.registry ?? '';

    // Символ визарда — из `kit.adapters.wizard` каталога; шаг у кита свой не объявлен
    // (`adapters.step: null`) — кодоген берёт библиотечный.
    expect(registry).toContain("reg.component('Wizard', FormWizard);");
    expect(registry).toContain("reg.component('Step', Step);");
    expect(registry).toMatch(/import \{[^}]*\bFormWizard\b[^}]*\} from '@reformer\/kit-hexa-ui';/);
    expect(registry).toContain("import { Step } from '@reformer/cdk/form-wizard';");
  });
});
