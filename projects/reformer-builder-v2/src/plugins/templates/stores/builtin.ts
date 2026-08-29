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
import { emptySchema } from '@/lib/form-model/normalize';
import type { JsonFormSchema, JsonNode } from '@reformer/renderer-json';
import type { FormTemplate, TemplateFile, TemplateStore } from '../contract';
import { tokenize } from '../placeholders';

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
  formName: string
) => Promise<readonly TemplateFile[]>;

function withField(name: string, model: string, label: string): JsonNode {
  const node = fieldNode(name) as JsonNode & {
    value: string;
    componentProps: Record<string, unknown>;
  };
  return { ...node, value: `$model(${model})`, componentProps: { ...node.componentProps, label } };
}

/** Затравка простой формы: два поля в колонке. Кнопку отправки проставит сам кодоген. */
export function simpleSeed(): JsonFormSchema {
  const schema = emptySchema();
  const root = schema.root as JsonNode & { children: unknown[] };
  root.children = [
    withField('Input', 'fullName', 'Имя'),
    withField('Input', 'email', 'Электронная почта'),
  ];
  return schema;
}

/** Затравка пошаговой формы: визард с двумя шагами по полю в каждом. */
export function wizardSeed(): JsonFormSchema {
  const schema = emptySchema();
  const root = schema.root as JsonNode & { children: unknown[] };
  const step = (title: string, field: JsonNode): JsonNode => {
    const node = stepNode(title) as JsonNode & { children: unknown[] };
    return { ...node, children: [field] };
  };
  root.children = [
    {
      component: '$component(Wizard)',
      componentProps: {
        steps: [
          step('Данные', withField('Input', 'fullName', 'Имя')),
          step('Контакты', withField('Input', 'email', 'Электронная почта')),
        ],
      },
    } satisfies JsonNode,
  ];
  return schema;
}

/** Затравка со своим заголовком и идентификатором. */
interface Seed {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly schema: () => JsonFormSchema;
}

const SEEDS: readonly Seed[] = [
  {
    id: SIMPLE_TEMPLATE_ID,
    name: 'Простая форма',
    description: 'Одна страница полей: модель, валидация, поведение и точка входа.',
    schema: simpleSeed,
  },
  {
    id: WIZARD_TEMPLATE_ID,
    name: 'Пошаговая форма',
    description: 'Визард с двумя шагами и шимом визарда под активный кит.',
    schema: wizardSeed,
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
          const printed = await print(seed.schema(), BUILTIN_BASE_NAME);
          const files = printed.map((file) => ({
            path: tokenize(file.path, BUILTIN_BASE_NAME),
            content: tokenize(file.content, BUILTIN_BASE_NAME),
          }));
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
