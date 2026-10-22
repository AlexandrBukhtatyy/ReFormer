/**
 * Отпечаток генерации: побайтовый снимок модуля формы на комбинациях схемы, кита и правил
 * (`COMBOS` — у каждой записано, что именно ею удерживается). Модуль — единого контракта сборки,
 * в раскладке «папки по ролям».
 *
 * ## Зачем, если рядом уже лежит `emit.test.ts`
 *
 * Тот проверяет вывод двумя десятками подстрочных `toContain`, и этого достаточно, чтобы
 * поймать «имя приехало не от кита». Но НЕ достаточно, чтобы поймать переформатирование: сдвиг
 * отступа, потерянную пустую строку, переставленные импорты — всё это оставляет каждое
 * `toContain` истинным. То есть переписать печать целиком и остаться зелёным сегодня можно.
 *
 * Здесь снимок берётся целиком и через {@link generateModule}, а не по эмиттерам поштучно:
 * так под защиту попадает ещё и то, чего у отдельного эмиттера нет вовсе — отбор по `applies`,
 * раскладка путей, список `ctx.files` в README и простановка маркеров.
 *
 * ## Почему `.snap`, а не настоящие имена файлов
 *
 * `tsconfig.app.json` включает весь `src`, а ESLint матчит `**\/*.{ts,tsx}`. Golden с именем
 * `application/create.ts` был бы проверен компилятором и линтером КАК ИСХОДНИК проекта — а это
 * сгенерированный модуль формы, импортирующий `../types/<форма>` и `@reformer/form-registry`,
 * то есть `tsc -b` упал бы сразу. Суффикс `.snap` не claim-ит ни tsc, ни ESLint, ни `include`
 * node-прогона, поэтому править конфигурацию не нужно, а настоящее имя видно в диффе.
 *
 * ## Снимок не доказывает, что модуль собирается
 *
 * Он держит только то, что вывод не изменился. Компилируемость напечатанного проверяется
 * отдельно — `tsc --noEmit` над выгруженными модулями с настоящими пакетами `@reformer/*`.
 *
 * ## Почему маркер срезается
 *
 * Он считается от финальных байт, поэтому любая правка содержимого дополнительно меняет
 * двенадцать hex — двойной шум без информации. Сам механизм покрыт `marker.test.ts`, а здесь
 * от него остаётся одно утверждение: маркер стоит ровно там, где обещан классом файла.
 *
 * ## Вывод проходит форматтер как есть
 *
 * Напечатанный модуль обязан проходить `prettier --check` без правок: иначе папку формы после
 * генерации форматируют отдельным шагом и перевыставляют маркеры, а билдер показывает не тот
 * текст, что ляжет в репозиторий. Снимок этого не держит — он закрепил бы и неотформатированный
 * вывод. Поэтому каждый файл каждого набора прогоняется через prettier с конфигом репозитория, и
 * то же — для имён формы другой длины: от имени зависит, какие строки шаблонов переносятся
 * (`createContactFormModel(initial?: Partial<ContactForm>)` помещается в строку, тот же заголовок
 * у `ZayavkaNaKreditForm` — нет). Prettier здесь — инструмент теста; в рантайм плагина он не
 * попадает.
 *
 * Обновить снимки: `npm test -- -u`.
 *
 * @module plugins/reformer/codegen/pipeline/golden.test
 */

import { fileURLToPath } from 'node:url';
import * as prettier from 'prettier';
import { describe, expect, it } from 'vitest';
import {
  builtinKit,
  foreignKit,
  noWizardKit,
  partsRules,
  partsSchema,
  partsWizardSchema,
  plainSchema,
  providerKit,
  richSchema,
  rowRules,
  rowRulesSchema,
  seededRules,
  subpathSchema,
  wizardSchema,
  wizardRulesSchema,
  wizardRules,
  wizardSlugsSchema,
  wizardSplitSource,
} from '../../../core/testing';
import { acceptsMarker, MARKER_PREFIX, originOf } from '@reformer/builder-toolkit';
import { type CodegenInput } from '../../../core/codegen';
import { generateModule } from './generate';
import { BUILTIN_TARGETS } from './targets';

/** Имя с кириллицей и пробелами: транслитерация участвует в КАЖДОМ файле модуля. */
const FORM_NAME = 'Заявка на кредит';

interface Combo {
  /** Каталог снимка. */
  readonly dir: string;
  /** Что именно этой комбинацией удерживается — она же причина её существования. */
  readonly holds: string;
  readonly input: CodegenInput;
}

const COMBOS: readonly Combo[] = [
  {
    dir: 'plain-builtin',
    holds: 'канонический состав модуля на настоящем ките',
    input: { schema: plainSchema(), formName: FORM_NAME, kit: builtinKit() },
  },
  {
    dir: 'plain-foreign',
    holds: 'имена и импорты приезжают от кита; Checkbox уходит в заглушку с причиной',
    input: { schema: plainSchema(), formName: FORM_NAME, kit: foreignKit() },
  },
  {
    dir: 'plain-subpath',
    holds:
      'компоненты за подпутём кита: импорт по входам пакета вместо заглушки, типы комбобокса и даты',
    input: { schema: subpathSchema(), formName: FORM_NAME, kit: builtinKit() },
  },
  {
    dir: 'wizard-builtin',
    holds: 'визард — библиотечный компонент кита: поток шагов, правила шага, отправка по onSubmit',
    input: { schema: wizardSchema(), formName: FORM_NAME, kit: builtinKit() },
  },
  {
    dir: 'wizard-foreign',
    holds: 'адаптер визарда чужого кита с собственным subpath',
    input: { schema: wizardSchema(), formName: FORM_NAME, kit: foreignKit() },
  },
  {
    dir: 'plain-provider',
    holds:
      'провайдер кита оборачивает страницу снаружи языка формы: символ с подпути, под KitProvider',
    input: { schema: plainSchema(), formName: FORM_NAME, kit: providerKit() },
  },
  {
    dir: 'plain-rules',
    holds: 'единственный путь через билдеры @reformer/mcp и через все три вида правил узлов',
    input: {
      schema: plainSchema(),
      formName: FORM_NAME,
      kit: builtinKit(),
      rules: seededRules(),
    },
  },
  {
    dir: 'rows-rules',
    holds:
      'правила узлов в областях строк массивов: поведение строки и вложенной строки, подключение applyEach, тип строки от типа родителя',
    input: {
      schema: rowRulesSchema(),
      formName: FORM_NAME,
      kit: builtinKit(),
      rules: rowRules(),
    },
  },
  {
    dir: 'parts-rules',
    holds:
      'именованные части документа: тип подформы и строки из части, начальные значения групп, источник данных из части, области правил — apply со списком групп, applyEach, apply из поведения части',
    input: {
      schema: partsSchema(),
      formName: FORM_NAME,
      kit: builtinKit(),
      rules: partsRules(),
    },
  },
  {
    dir: 'parts-wizard',
    holds:
      'части в шагах визарда: поле части — поле шага, где она смонтирована; без правил — обязательные поля частей в заготовке шага',
    input: { schema: partsWizardSchema(), formName: FORM_NAME, kit: builtinKit() },
  },
  {
    dir: 'parts-wizard-rules',
    holds:
      'правила валидации полей частей расходятся по шагам визарда, правила узлов частей — по областям',
    input: {
      schema: partsWizardSchema(),
      formName: FORM_NAME,
      kit: builtinKit(),
      rules: partsRules(),
    },
  },
  {
    dir: 'rich-builtin',
    holds: 'источники данных всех трёх классов, массив с шаблоном элемента и визард со шагами',
    input: { schema: richSchema(), formName: FORM_NAME, kit: builtinKit() },
  },
  {
    dir: 'wizard-no-adapter',
    holds:
      'визард в схеме есть, адаптера у кита нет — визард и шаг уходят в заглушки, поток и правила шагов печатаются',
    input: { schema: wizardSchema(), formName: FORM_NAME, kit: noWizardKit() },
  },
  {
    dir: 'wizard-rules',
    holds:
      'правила визарда по шагам: правило шага — в его файл, вне шагов — crossStepRules (extras); правило узла шага — в группе шага единого поведения',
    input: {
      schema: wizardRulesSchema(),
      formName: FORM_NAME,
      kit: builtinKit(),
      rules: wizardRules(),
    },
  },
  {
    dir: 'wizard-slugs',
    holds:
      'имена шагов: транслит, суффикс у одинаковых заголовков, запасное имя и селектор шага без заголовка',
    input: { schema: wizardSlugsSchema(), formName: FORM_NAME, kit: builtinKit() },
  },
  {
    dir: 'wizard-split',
    holds:
      'шаблон «Пошаговая форма»: все шаги в своих файлах рядом с документом, корень со ссылками, сборка собирает схему',
    input: { schema: wizardSchema(), formName: FORM_NAME, kit: builtinKit(), splitSteps: true },
  },
  {
    dir: 'wizard-split-source',
    holds:
      'разбитый источник: папка шага — из ссылки, а не из заголовка; новый шаг получает свой файл',
    input: { ...wizardSplitSource(), formName: FORM_NAME, kit: builtinKit() },
  },
];

/**
 * Тело файла без строки маркера.
 *
 * `slice` по первому переводу строки, а не `replace` по образцу: маркер — ПЕРВАЯ строка по
 * контракту, и поиск образца где-то ниже означал бы, что мы готовы срезать чужой текст.
 */
function withoutMarker(text: string): string {
  if (!text.startsWith(MARKER_PREFIX)) return text;
  const nl = text.indexOf('\n');
  return nl < 0 ? '' : text.slice(nl + 1);
}

/** Состав модуля одной строкой на файл: путь, класс, перевыводимость. */
function manifestOf(files: readonly { path: string; cls: string; regenerable: boolean }[]): string {
  return `${files.map((f) => `${f.path}\t${f.cls}${f.regenerable ? '\tregenerable' : ''}`).join('\n')}\n`;
}

/** Конфиг форматтера репозитория — тот же, с которым файл проверят у пользователя этого репо. */
const prettierConfig = (await prettier.resolveConfig(fileURLToPath(import.meta.url))) ?? {};

/** Файлы, которые форматтер умеет проверять. */
const FORMATTED = /\.(?:ts|tsx|json|md)$/;

/** Пути файлов модуля, которые форматтер оставил бы другими. */
async function unformatted(
  files: readonly { readonly path: string; readonly content: string }[]
): Promise<string[]> {
  const out: string[] = [];
  for (const file of files) {
    if (!FORMATTED.test(file.path)) continue;
    const ok = await prettier.check(file.content, { ...prettierConfig, filepath: file.path });
    if (!ok) out.push(file.path);
  }
  return out;
}

/**
 * Имена формы разной длины и вида: одна буква, короткое, с цифры в начале, занятое библиотекой
 * (`form` → тип `Form`) и длинное — каталог эталонной заявки этого репозитория.
 */
const OTHER_NAMES = [
  'a',
  'contact',
  '2024 анкета',
  'form',
  'complex multy step form renderer json',
];

// Верхнеуровневый await: состав модуля нужен НА СБОРЕ тестов, чтобы у каждого файла был свой
// `it` и своё падение. Функции чистые, прогон каждой комбинации стоит миллисекунды.
const modules = await Promise.all(
  COMBOS.map((combo) => generateModule(BUILTIN_TARGETS, combo.input))
);

COMBOS.forEach((combo, index) => {
  const module = modules[index];

  describe(`отпечаток: ${combo.dir} (${combo.holds})`, () => {
    it('прогон обошёлся без отказов целей', () => {
      expect(module.problems).toEqual([]);
    });

    // Отдельный снимок состава: без него исчезнувший файл просто перестал бы проверяться —
    // `it.each` ниже перечисляет то, что напечаталось, а не то, что обещано.
    it('состав модуля', async () => {
      await expect(manifestOf(module.files)).toMatchFileSnapshot(
        `./__golden__/${combo.dir}/_manifest.txt`
      );
    });

    it.each(module.files.map((file) => file.path))('%s', async (path) => {
      const file = module.files.find((f) => f.path === path);
      expect(file, `файл «${path}» пропал между сбором и прогоном`).toBeDefined();
      await expect(withoutMarker(file?.content ?? '')).toMatchFileSnapshot(
        `./__golden__/${combo.dir}/${path}.snap`
      );
    });

    it('маркер стоит ровно там, где обещан классом файла', () => {
      for (const file of module.files) {
        const wanted = (file.cls === 'derived' || file.regenerable) && acceptsMarker(file.path);
        expect(originOf(file.content), file.path).toBe(wanted ? 'generated' : 'handwritten');
      }
    });

    it('вывод проходит форматтер репозитория без правок', async () => {
      expect(await unformatted(module.files)).toEqual([]);
    });

    it('и с именем формы другой длины — тоже: переносы считаются, а не зашиты в шаблон', async () => {
      for (const formName of OTHER_NAMES) {
        const other = await generateModule(BUILTIN_TARGETS, { ...combo.input, formName });
        expect(other.problems, formName).toEqual([]);
        expect(await unformatted(other.files), formName).toEqual([]);
      }
    });

    // Активная защита начиная со стадии, где текст поедет через шаблонизатор: незакрытый тег
    // Eta не роняет рендер, он молча уезжает в файл литералом.
    it('в выводе нет неотработавших тегов шаблонизатора', () => {
      for (const file of module.files) {
        expect(file.content, file.path).not.toContain('<%');
        expect(file.content, file.path).not.toContain('%>');
      }
    });
  });
});
