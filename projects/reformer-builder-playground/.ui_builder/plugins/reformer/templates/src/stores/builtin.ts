/**
 * Встроенные шаблоны: «Простая форма» и «Пошаговая форма».
 *
 * ## Здесь исчезли 900 строк v1
 *
 * Там встроенные шаблоны собирались из «рыб» — двадцати функций в `app/form-templates.ts`
 * и `app/wizard-templates.ts`, которые ПОВТОРЯЛИ РУКАМИ вывод кодогена. Повтор был признан
 * в комментариях самого кодогена: «тот же шим печатает встроенный шаблон визарда; здесь он
 * повторён, а не импортирован». Две копии одного текста расходятся на первой же правке
 * эмиттера, и расходятся молча: шаблон продолжает работать, просто он больше не такой,
 * как экспорт.
 *
 * Здесь встроенный шаблон — это ВЫВОД КОДОГЕНА по затравочной схеме. Печатает его тот, кто
 * умеет: печатник приходит параметром, потому что цели генерации живут в другом плагине,
 * а плагины друг друга не импортируют. Без печатника хранилище честно объявляет себя
 * недоступным — встроенных шаблонов просто не будет, а проектные и локальные останутся.
 *
 * ## Шаблон раскладывается так же, как печатает кодоген
 *
 * Модуль формы — папки по ролям (`@/plugins/reformer/core/codegen`): страница `<Тип>.tsx`,
 * реэкспорты `index.ts`, документ `schema/form.schema.json`, остальное — в `application/`,
 * `model/`, `validation/`, `behavior/`, … Часть путей зависит от имени формы, и вывести их из
 * написаний имени нельзя: тип формы и каталог считает `makeNames`. Поэтому затравка печатается
 * под базовое имя, а имена модуля в напечатанном заменяются токенами имён модуля
 * (`../render/placeholders`): при создании формы на их место встаёт то же, что кодоген напечатал бы
 * для неё сам. Разойдись они — первая же генерация из билдера положила бы свои файлы рядом
 * с файлами шаблона, и в модуле остались бы сироты.
 *
 * Затравки — в `./seeds`: состав анкеты, её правила и данные.
 *
 * @module plugins/reformer/templates/stores/builtin
 */

import type { KitDescriptor } from '@reformer/builder-plugin-api';
import type { JsonFormSchema } from '@reformer/renderer-json';
import type { CatalogEntry } from '../../../core/catalog';
import { makeNames, moduleFilesOf, type FormMock } from '../../../core/codegen';
import { emitFixture, FIXTURE_FILE } from '../../../core/form-fixture';
import { synthMock } from '../../../core/form-mock';
import type { FormRules } from '../../../core/form-model';
import { keepOrigin } from '../content/files';
import type { FormTemplate, TemplateFile, TemplateStore } from '../contract';
import { tokenizeModuleNames } from '../render/placeholders';
import {
  hasWizard,
  seedData,
  seedKitOf,
  simpleRules,
  simpleSeed,
  wizardRules,
  wizardSeed,
  type SeedData,
  type SeedKit,
} from './seeds';

/**
 * Базовое имя, под которое печатаются затравки перед заменой имён модуля токенами.
 *
 * Из двух слов, и это условие, а не вкус: у однословного имени каталог (`sample`) и начало
 * camelCase-идентификатора (`sampleFormEntry`) — одна и та же строка, и замена не различает,
 * где путь, а где имя. Здесь все четыре имени модуля разные и не входят друг в друга:
 * `template-seed`, `TemplateSeedForm`, `templateSeedForm`, `Template seed`. В текстах, которые
 * печатает кодоген, ни одно из них само не встречается.
 */
export const BUILTIN_BASE_NAME = 'template seed';

/** Идентификатор шаблона простой формы. */
export const SIMPLE_TEMPLATE_ID = 'builtin-simple-form';

/** Идентификатор шаблона пошаговой формы. */
export const WIZARD_TEMPLATE_ID = 'builtin-wizard-form';

/**
 * Печатник модуля формы: схема и имя — набор файлов.
 *
 * Функция, а не объект: у неё одна обязанность, и структурная совместимость с `generateModule`
 * кодогена достигается трёхстрочным переходником в композиции. Пути файлов — от корня модуля.
 */
export type ModulePrinter = (
  schema: JsonFormSchema,
  formName: string,
  seed?: SeedExtras
) => Promise<readonly TemplateFile[]>;

/**
 * Чем затравка дополняет схему.
 *
 * Без правил кодоген печатает заготовки поведения и валидации, без мока — синтезированные
 * `option1/2/3` в источниках данных.
 */
export interface SeedExtras {
  readonly rules?: FormRules;
  readonly mock?: FormMock;
  /** Вынести шаги визарда в свои файлы `schema/steps/<шаг>/form.schema.json`. */
  readonly splitSteps?: boolean;
}

/**
 * Мок для кодогена: начальные значения — синтез, источники — данные затравки.
 *
 * Источники те же, что уходят в фикстуру: разойдись они, модуль формы и её предпросмотр
 * показывали бы РАЗНЫЕ списки, и человек считал бы это дефектом превью. Значения полей из
 * затравки сюда НЕ идут: начальные значения модуля — пустая форма, а не анкета Иванова; они
 * нужны только предпросмотру и живут в фикстуре.
 */
function seedMock(schema: JsonFormSchema, data: SeedData): FormMock {
  const synthesized = synthMock(schema);
  return {
    model: synthesized.model,
    dataSources: { ...synthesized.dataSources, ...data.dataSources },
  };
}

/** Затравка со своим заголовком и идентификатором. */
interface Seed {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  /** Есть ли у кита из чего собрать шаблон. Нет — шаблон не показывается. */
  readonly available: (kit: SeedKit | undefined) => boolean;
  readonly schema: (kit: SeedKit | undefined) => JsonFormSchema;
  /** Правила: из них печатаются `validation/*.ts` и `behavior/index.ts`. */
  readonly rules: (kit: SeedKit | undefined) => FormRules;
  /** Шаги визарда — каждый в своём файле схемы: так пошаговая форма и хранится в билдере. */
  readonly splitSteps?: boolean;
}

const SEEDS: readonly Seed[] = [
  {
    id: SIMPLE_TEMPLATE_ID,
    name: 'Простая форма',
    description:
      'Анкета из трёх секций — по одному образцу каждого вида поля, который есть в ките: текст, ' +
      'маска, число, выбор даты, радиогруппа, список из источника данных, комбобокс с поиском, ' +
      'мультикомбобокс, многострочный текст, загрузка файлов, флажок и массив со ' +
      'строкой-шаблоном. С правилами валидации, вычисляемым полем, условной видимостью и ' +
      'фикстурой.',
    available: () => true,
    schema: simpleSeed,
    rules: simpleRules,
  },
  {
    id: WIZARD_TEMPLATE_ID,
    name: 'Пошаговая форма',
    description:
      'Та же анкета в три шага — с комбобоксом, мультикомбобоксом, выбором даты, загрузкой ' +
      'файлов и массивом: у каждого шага свой файл схемы и свои правила, которые проверяет ' +
      '«Далее»; порядок шагов задаёт поток.',
    available: hasWizard,
    schema: wizardSeed,
    rules: wizardRules,
    splitSteps: true,
  },
];

/** Имена модуля в напечатанном — токенами. */
const tokenized = (text: string): string => tokenizeModuleNames(text, BUILTIN_BASE_NAME);

/**
 * Зависимости файлов: что тянет за собой отмеченный файл.
 *
 * Роли берутся у раскладки кодогена, а состав — из фактически напечатанного: его решают цели
 * генерации, и список, набранный руками, разошёлся бы с ним на первой же чужой цели.
 *
 * - страница тянет ЯДРО модуля — всё, без чего она не соберётся;
 * - запись реестра форм тянет то же ядро: она собирает форму теми же частями;
 * - реэкспорты тянут страницу и запись — они их и отдают наружу.
 *
 * Ядру не принадлежат README (модулю он не нужен), сами реэкспорты и запись реестра форм
 * (страница работает и без них), а также фикстура: она идёт сверх модуля, и тянуть её за
 * страницей значило бы навязать данные предпросмотра тому, кто их не просил.
 */
function requiresOf(files: readonly TemplateFile[]): Record<string, string[]> {
  const layout = moduleFilesOf(makeNames(BUILTIN_BASE_NAME));
  const page = tokenized(layout.page);
  const entry = tokenized(layout.entry);
  const barrel = tokenized(layout.barrel);
  const outside = new Set([page, entry, barrel, tokenized(layout.readme)]);

  const paths = files.filter((file) => (file.scope ?? 'form') === 'form').map((file) => file.path);
  if (!paths.includes(page)) return {};

  const core = paths.filter((path) => !outside.has(path));
  const out: Record<string, string[]> = { [page]: core };
  if (paths.includes(entry)) out[entry] = core;
  if (paths.includes(barrel)) out[barrel] = [page, entry].filter((path) => paths.includes(path));
  return out;
}

export interface BuiltinStoreOptions {
  /** Печатник модуля. Без него встроенных шаблонов нет. */
  readonly print?: ModulePrinter;
  /**
   * Есть ли чем печатать ПРЯМО СЕЙЧАС. По умолчанию — «дан ли печатник».
   *
   * Отдельный вопрос, потому что печатник теперь берётся возможностью соседнего плагина
   * и появляется, когда тот активируется. Ответ «печатать нечем» обязан меняться вместе
   * с этим, иначе раздел встроенных шаблонов либо пуст навсегда, либо показывает
   * пустой список вместо честного «недоступно».
   */
  readonly ready?: () => boolean;
  /**
   * Каталог активного кита: затравка кладёт только те компоненты и пропсы, что в нём есть.
   *
   * Спрашивается на каждую печать — кит переключают. Не дан либо пуст (кит ещё не доехал) —
   * затравка собирается целиком.
   */
  readonly catalog?: () => readonly CatalogEntry[];
  /**
   * Дескриптор активного кита: по нему решается, есть ли у кита адаптер визарда. Без адаптера
   * «Пошаговая форма» не показывается — собрать её этому киту нечем.
   */
  readonly kit?: () => KitDescriptor | null;
}

/**
 * Хранилище встроенных шаблонов. Только чтение: встроенное нельзя ни переименовать,
 * ни удалить — оно приезжает вместе с билдером.
 */
export function createBuiltinStore(options: BuiltinStoreOptions): TemplateStore {
  return {
    source: 'builtin',
    available: () => options.ready?.() ?? options.print !== undefined,
    async list(): Promise<readonly FormTemplate[]> {
      const print = options.print;
      if (print === undefined) return [];
      const kit = seedKitOf(options.catalog?.() ?? [], options.kit?.() ?? null);
      const out: FormTemplate[] = [];
      for (const seed of SEEDS) {
        if (!seed.available(kit)) continue;
        // Отказ печати ОДНОГО шаблона не должен уносить остальные: печатник чужой,
        // а «список пуст» неотличимо от «встроенных шаблонов нет».
        try {
          const schema = seed.schema(kit);
          const data = seedData(kit);
          const printed = await print(schema, BUILTIN_BASE_NAME, {
            rules: seed.rules(kit),
            mock: seedMock(schema, data),
            ...(seed.splitSteps === true ? { splitSteps: true } : {}),
          });
          // Печатник ответил пустотой — кита нет, печатать нечем. Шаблон из одной фикстуры
          // выглядел бы созданной формой, у которой нечего открыть.
          if (printed.length === 0) continue;
          const files: TemplateFile[] = printed.map((file) => ({
            path: tokenized(file.path),
            // Маркер происхождения считается от тела файла, а тело после замены имён другое:
            // без перевыставления каждый файл шаблона выглядел бы «правленным руками».
            content: keepOrigin(file.content, tokenized(file.content)),
          }));
          // Фикстура идёт СВЕРХ вывода кодогена: контракт каталога модуля её не перечисляет,
          // и целью генерации она не выражается, хотя ложится в корень того же модуля.
          // Отсюда `scope`.
          files.push({
            path: FIXTURE_FILE,
            content: emitFixture(schema, data),
            scope: 'fixture',
          });
          out.push({
            id: seed.id,
            name: seed.name,
            description: seed.description,
            source: 'builtin',
            files,
            requires: requiresOf(files),
          });
        } catch (error) {
          console.warn(`[templates] встроенный шаблон «${seed.id}» не напечатался`, error);
        }
      }
      return out;
    },
  };
}
