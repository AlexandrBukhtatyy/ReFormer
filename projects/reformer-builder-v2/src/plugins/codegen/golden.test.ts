/**
 * Отпечаток генерации: побайтовый снимок модуля формы на шести комбинациях схемы, кита и правил.
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
 * `index.tsx` был бы проверен компилятором и линтером КАК ИСХОДНИК проекта — а это
 * сгенерированный модуль формы, импортирующий `./types` и `@reformer/form-registry`, то есть
 * `tsc -b` упал бы сразу. Суффикс `.snap` не claim-ит ни tsc, ни ESLint, ни `include`
 * node-прогона, поэтому править конфигурацию не нужно, а настоящее имя видно в диффе.
 *
 * ## Почему маркер срезается
 *
 * Он считается от финальных байт, поэтому любая правка содержимого дополнительно меняет
 * двенадцать hex — двойной шум без информации. Сам механизм покрыт `marker.test.ts`, а здесь
 * от него остаётся одно утверждение: маркер стоит ровно там, где обещан классом файла.
 *
 * Обновить снимки: `npm test -- -u`.
 *
 * @module plugins/codegen/golden.test
 */

import { describe, expect, it } from 'vitest';
import {
  builtinKit,
  foreignKit,
  noWizardKit,
  plainSchema,
  richSchema,
  seededRules,
  wizardSchema,
} from '@/lib/codegen/__fixtures__/kit';
import { acceptsMarker, MARKER_PREFIX, originOf, type CodegenInput } from '@/lib/codegen';
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
    dir: 'wizard-builtin',
    holds: 'шим визарда и обвязка submit через onInit(wizard)',
    input: { schema: wizardSchema(), formName: FORM_NAME, kit: builtinKit() },
  },
  {
    dir: 'wizard-foreign',
    holds: 'адаптер визарда чужого кита с собственным subpath',
    input: { schema: wizardSchema(), formName: FORM_NAME, kit: foreignKit() },
  },
  {
    dir: 'plain-rules',
    holds: 'единственный путь через билдеры @reformer/mcp и через все три вида render-правил',
    input: {
      schema: plainSchema(),
      formName: FORM_NAME,
      kit: builtinKit(),
      rules: seededRules(),
    },
  },
  {
    dir: 'rich-builtin',
    holds: 'источники данных всех трёх классов, массив с шаблоном элемента и визард со шагами',
    input: { schema: richSchema(), formName: FORM_NAME, kit: builtinKit() },
  },
  {
    dir: 'wizard-no-adapter',
    holds: 'визард в схеме есть, шима напечатать нечем — цель не применяется, а не бросает',
    input: { schema: wizardSchema(), formName: FORM_NAME, kit: noWizardKit() },
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

// Верхнеуровневый await: состав модуля нужен НА СБОРЕ тестов, чтобы у каждого файла был свой
// `it` и своё падение. Функции чистые, шесть прогонов стоят миллисекунды.
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
