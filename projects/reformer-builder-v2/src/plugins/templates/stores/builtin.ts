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
 * ## Затравки — данные, а не текст
 *
 * Схемы собираются фабриками узлов домена (`lib/catalog/make-node`), а не литералами JSON:
 * так «пошаговая форма» остаётся пошаговой, даже когда изменится внутреннее устройство
 * узла-визарда.
 *
 * @module plugins/templates/stores/builtin
 */

import { fieldNode, stepNode } from '@/lib/catalog/make-node';
import { emitFixture, FIXTURE_FILE } from '@/lib/form-fixture';
import { synthMock, type FormMock } from '@/lib/form-mock';
import type { FormRules } from '@/lib/form-model/rules';
import { emptySchema } from '@/lib/form-model/normalize';
import type { JsonFormSchema, JsonNode } from '@reformer/renderer-json';
import type { FormTemplate, TemplateFile, TemplateStore } from '../contract';
import { tokenize } from '../render/placeholders';

/**
 * Базовое имя, под которое печатаются затравки перед токенизацией.
 *
 * Односложное и не встречающееся в текстах, поэтому замена не задевает ничего лишнего:
 * `sample` даёт `SampleForm`, что превращается в `__FormName__Form`.
 */
export const BUILTIN_BASE_NAME = 'sample';

/** Идентификатор шаблона простой формы. */
export const SIMPLE_TEMPLATE_ID = 'builtin-simple-form';

/** Идентификатор шаблона пошаговой формы. */
export const WIZARD_TEMPLATE_ID = 'builtin-wizard-form';

/** Точка входа модуля: она тянет за собой всё остальное. */
const ENTRY_FILE = 'index.tsx';

/** Файл, который точка входа НЕ тянет: README собирается, но модулю не нужен. */
const OPTIONAL_FILES: ReadonlySet<string> = new Set(['README.md']);

/**
 * Печатник модуля формы: схема и имя — набор файлов.
 *
 * Функция, а не объект: у неё одна обязанность, и структурная совместимость с `generateModule`
 * кодогена достигается трёхстрочным переходником в композиции.
 */
export type ModulePrinter = (
  schema: JsonFormSchema,
  formName: string,
  seed?: SeedExtras
) => Promise<readonly TemplateFile[]>;

/**
 * Чем затравка дополняет схему.
 *
 * Оба поля кодоген уже умеет принимать — просто печатнику шаблона их не передавали. Без правил
 * он печатает пустую заглушку поведения (`defineFormBehavior(() => {})`), без мока —
 * синтезированные `option1/2/3` в источниках данных.
 */
export interface SeedExtras {
  readonly rules?: FormRules;
  readonly mock?: FormMock;
}

function withField(
  name: string,
  model: string,
  label: string,
  extra: Record<string, unknown> = {}
): JsonNode {
  const node = fieldNode(name) as JsonNode & {
    value: string;
    componentProps: Record<string, unknown>;
  };
  return {
    ...node,
    value: `$model(${model})`,
    componentProps: { ...node.componentProps, label, ...extra },
  };
}

/**
 * Имя источника данных затравок.
 *
 * Источник в затравке не для красоты: без `$dataSource` кодоген не печатает `data-sources.ts`
 * содержательно, а превью нечего показать в списке — то есть «источники данных» в шаблоне
 * остались бы словом из описания.
 */
const CITY_SOURCE = 'CITY_LIST';

/**
 * Затравка простой формы.
 *
 * Состав подобран так, чтобы форму было ЧЕМ проверить сразу после создания: обязательные поля
 * дают валидацию, вычисляемое «Полное имя» — поведение, список городов — источник данных.
 * Прежняя затравка (два голых `Input`) печатала пустую заглушку поведения и пустую валидацию,
 * и проверять в такой форме было нечего.
 */
export function simpleSeed(): JsonFormSchema {
  const schema = emptySchema();
  const root = schema.root as JsonNode & { children: unknown[] };
  root.children = [
    withField('Input', 'lastName', 'Фамилия', { required: true }),
    withField('Input', 'firstName', 'Имя', { required: true }),
    withField('Input', 'fullName', 'Полное имя', { readOnly: true }),
    withField('Select', 'city', 'Город', { options: `$dataSource(${CITY_SOURCE})` }),
    withField('Input', 'email', 'Электронная почта', { required: true }),
  ];
  return schema;
}

/**
 * Правила простой формы: то, из чего кодоген напечатает `validation.ts` и `form.behavior.ts`.
 *
 * Печатает их не этот модуль, а существующий мост к билдерам MCP (`lib/codegen/emit/rules-bridge`):
 * второй комплект эмиттеров для того же самого разошёлся бы с первым молча.
 */
export function simpleRules(): FormRules {
  return {
    validation: [
      { target: 'lastName', rules: ['required'] },
      { target: 'firstName', rules: ['required'] },
      { target: 'email', rules: ['required', 'email'] },
    ],
    behavior: [
      {
        kind: 'computeFrom',
        target: 'fullName',
        sources: ['lastName', 'firstName'],
        expr: '[lastName, firstName].filter(Boolean).join(" ")',
      },
    ],
    // Поведение РЕНДЕРА — третий вид правил, и он не выражается двумя предыдущими: видимость
    // принадлежит УЗЛУ схемы, а не значению модели. Селектор проставляет сам кодоген из пути
    // (`fullName` → `full-name`, см. `lib/codegen/selectors`), поэтому здесь он предсказуем.
    render: [
      {
        kind: 'hideWhen',
        selector: 'full-name',
        condition: '!form.lastName.value.value || !form.firstName.value.value',
      },
    ],
  };
}

/** Затравка пошаговой формы: визард с двумя шагами. Состав — по тому же доводу, что у простой. */
export function wizardSeed(): JsonFormSchema {
  const schema = emptySchema();
  const root = schema.root as JsonNode & { children: unknown[] };
  const step = (title: string, fields: readonly JsonNode[]): JsonNode => {
    const node = stepNode(title) as JsonNode & { children: unknown[] };
    return { ...node, children: [...fields] };
  };
  root.children = [
    {
      component: '$component(Wizard)',
      componentProps: {
        steps: [
          step('Данные', [
            withField('Input', 'lastName', 'Фамилия', { required: true }),
            withField('Input', 'firstName', 'Имя', { required: true }),
            withField('Input', 'fullName', 'Полное имя', { readOnly: true }),
          ]),
          step('Контакты', [
            withField('Select', 'city', 'Город', { options: `$dataSource(${CITY_SOURCE})` }),
            withField('Input', 'email', 'Электронная почта', { required: true }),
          ]),
        ],
      },
    } satisfies JsonNode,
  ];
  return schema;
}

/** Правила пошаговой формы — те же, что у простой: поля совпадают, шаги на правила не влияют. */
export const wizardRules = simpleRules;

/**
 * Фикстура затравок: данные, с которыми форму видно сразу.
 *
 * Города заданы настоящими, а не синтезированными `option1/2/3`: список из трёх безымянных
 * значений показывает, что механизм работает, но не показывает, как выглядит форма.
 */
function seedFixture(): { model: Record<string, unknown>; dataSources: Record<string, unknown> } {
  return {
    model: { city: 'msk' },
    dataSources: {
      [CITY_SOURCE]: [
        { value: 'msk', label: 'Москва' },
        { value: 'spb', label: 'Санкт-Петербург' },
        { value: 'nsk', label: 'Новосибирск' },
      ],
    },
  };
}

/**
 * Тот же набор данных — но для кодогена, печатающего `data-sources.ts`.
 *
 * Один источник на двоих намеренно: разойдись они, модуль формы и её предпросмотр показывали бы
 * РАЗНЫЕ списки, и человек считал бы это дефектом превью. Синтез остаётся базой — он покрывает
 * пути, о которых затравка ничего не знает.
 */
function seedMock(schema: JsonFormSchema): FormMock {
  const seed = seedFixture();
  const synthesized = synthMock(schema);
  return {
    model: { ...synthesized.model, ...seed.model },
    dataSources: { ...synthesized.dataSources, ...seed.dataSources },
  };
}

/** Затравка со своим заголовком и идентификатором. */
interface Seed {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly schema: () => JsonFormSchema;
  /** Правила: из них печатаются `validation.ts` и `form.behavior.ts`. */
  readonly rules: () => FormRules;
}

const SEEDS: readonly Seed[] = [
  {
    id: SIMPLE_TEMPLATE_ID,
    name: 'Простая форма',
    description:
      'Готовая к проверке: обязательные поля, вычисляемое «Полное имя», список городов и фикстура.',
    schema: simpleSeed,
    rules: simpleRules,
  },
  {
    id: WIZARD_TEMPLATE_ID,
    name: 'Пошаговая форма',
    description: 'То же в два шага, плюс шим визарда под активный кит.',
    schema: wizardSeed,
    rules: wizardRules,
  },
];

/**
 * Зависимости файлов: точка входа тянет всё, кроме необязательного.
 *
 * Выводится из фактического состава, а не перечисляется: состав решают цели генерации,
 * и список, набранный руками, разошёлся бы с ним на первой же чужой цели.
 */
function requiresOf(files: readonly TemplateFile[]): Record<string, string[]> {
  const entry = files.find((f) => f.path === ENTRY_FILE);
  if (entry === undefined) return {};
  const rest = files
    // Фикстура — не часть модуля: `index.tsx` без неё собирается, и тянуть её за точкой
    // входа значило бы навязать данные предпросмотра тому, кто их не просил.
    .filter((f) => (f.scope ?? 'form') === 'form')
    .map((f) => f.path)
    .filter((path) => path !== ENTRY_FILE && !OPTIONAL_FILES.has(path));
  return { [ENTRY_FILE]: rest };
}

export interface BuiltinStoreOptions {
  /** Печатник модуля. Без него встроенных шаблонов нет. */
  readonly print?: ModulePrinter;
}

/**
 * Хранилище встроенных шаблонов. Только чтение: встроенное нельзя ни переименовать,
 * ни удалить — оно приезжает вместе с билдером.
 */
export function createBuiltinStore(options: BuiltinStoreOptions): TemplateStore {
  return {
    source: 'builtin',
    available: () => options.print !== undefined,
    async list(): Promise<readonly FormTemplate[]> {
      const print = options.print;
      if (print === undefined) return [];
      const out: FormTemplate[] = [];
      for (const seed of SEEDS) {
        // Отказ печати ОДНОГО шаблона не должен уносить остальные: печатник чужой,
        // а «список пуст» неотличимо от «встроенных шаблонов нет».
        try {
          const schema = seed.schema();
          const printed = await print(schema, BUILTIN_BASE_NAME, {
            rules: seed.rules(),
            // Тот же набор данных, что уходит в фикстуру: источники в модуле и в предпросмотре
            // обязаны совпадать, иначе форма в билдере и форма в приложении покажут разное.
            mock: seedMock(schema),
          });
          const files: TemplateFile[] = printed.map((file) => ({
            path: tokenize(file.path, BUILTIN_BASE_NAME),
            content: tokenize(file.content, BUILTIN_BASE_NAME),
          }));
          // Фикстура идёт СВЕРХ вывода кодогена: контракт каталога модуля её не перечисляет,
          // и целью генерации она не выражается, хотя ложится в тот же каталог. Отсюда `scope`.
          files.push({
            path: FIXTURE_FILE,
            content: tokenize(emitFixture(schema, seedFixture()), BUILTIN_BASE_NAME),
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
