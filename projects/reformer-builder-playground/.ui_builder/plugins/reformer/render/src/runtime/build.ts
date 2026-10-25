/**
 * Сборка бандла рантайм-поверхности: схема → форма, готовая к отрисовке.
 *
 * ## Сборка — та же, что у приложения
 *
 * Форму собирает единая сборка ядра (`createForm`): модель → дерево узлов из документа (его строит
 * реестр, `resolveSchema`) → ноды формы → поведение → валидация. Рисует её `FormRenderer`. Своей
 * сборки у превью нет: вторая разошлась бы с настоящей, и «в превью работает» перестало бы значить
 * «в приложении работает».
 *
 * ## Порядок здесь не декоративный
 *
 * Сборка обязана отработать ДО монтирования рендерера: именно она создаёт form-node'ы,
 * привязанные к сигналам модели. Поэтому она синхронна и завершается целиком.
 *
 * ## Сборка не бросает
 *
 * Битая схема — обычное состояние документа, который правят прямо сейчас. Исключение отсюда
 * уронило бы поверхность, и вместо объяснения человек увидел бы пустой прямоугольник. Поэтому
 * отказ возвращается ДАННЫМИ и показывается словами.
 *
 * ## Отправка дописывается к правилам здесь
 *
 * Модуль формы отдаёт поведение двумя половинами: правила функцией над областью
 * (`behaviorRules`) и отправку (`wireSubmit`). Сборка приложения (`application/create.ts`)
 * складывает их в одно поведение — и превью складывает так же ({@link ModuleBehavior}), потому что
 * страницу приложения оно не исполняет, а итог отправки должен куда-то прийти. Отказ отправки
 * форму не роняет: правила уже применились, и форма без кнопки «Отправить» полезнее пустого места.
 *
 * @module plugins/reformer/render/runtime/build
 */

import {
  createForm,
  unknownSchemaSelectors,
  type CreateFormConfig,
  type FormBundle,
} from '@reformer/core';
import { defineFormBehavior, type BehaviorScope } from '@reformer/core/behaviors';
import {
  composeRegistries,
  isJsonStepRef,
  type ComponentRegistry,
  type JsonFormSchema,
} from '@reformer/renderer-json';
import type { CatalogEntry } from '../../../core/catalog';
import { moduleFilesOf, valueTypesOf } from '../../../core/codegen';
import type { KitDescriptor, KitNamespace } from '@reformer/builder-plugin-api';
import { annotateSchema } from '../schema/annotate';
import type { PreviewMock, PreviewProblem } from '@reformer/builder-plugin-api';
import { mergeFormData, type FormFixture } from '../../../core/form-fixture';
import { carryValues } from './carry';
import { fitInitialValues } from './initial';
import { fieldKindsOf } from './kinds';
import { overlayDataSources, synthMock } from './mock';
import { buildPreviewRegistry } from './registry';

/** Форма данных модели превью: она приходит из схемы, и сузить её нечем. */
export type Shape = Record<string, unknown>;

/** Собранная форма превью — бандл единой сборки. */
export type PreviewForm = FormBundle<Shape>;

type FormConfig = CreateFormConfig<Shape>;

/** Правила поведения модуля функцией над областью — экспорт `behaviorRules`. */
export type BehaviorRules = (scope: BehaviorScope<Shape>) => void;

/** Куда отправка сообщает итог: текст для человека и признак успеха. */
export type SubmitResultHandler = (message: string, ok: boolean) => void;

/** Отправка модуля над областью поведения — экспорт `wireSubmit`. */
export type WireSubmit = (
  scope: BehaviorScope<Shape>,
  options: { readonly onResult?: SubmitResultHandler }
) => void;

/**
 * Поведение модуля двумя половинами — как его складывает сборка приложения
 * (`application/create.ts`): сначала правила, затем отправка.
 */
export interface ModuleBehavior {
  readonly rules: BehaviorRules;
  readonly wireSubmit: WireSubmit;
  /** Куда отправка сообщает итог. Без него отправка работает, а итог никому не виден. */
  readonly onResult?: SubmitResultHandler;
}

/**
 * Из каких файлов модуля взяты артефакты — пути от его корня. Ими называются находки сборки:
 * «реестр не сложился» без имени файла отправляет человека искать по всему модулю. Файл, который
 * не назван, называется именем раскладки «папки по ролям» ({@link DEFAULT_FILES}).
 */
export interface ArtifactFiles {
  readonly initial?: string;
  readonly validation?: string;
  /** Словарь замечаний: в сборку он не входит — его подключает компилирующая поверхность. */
  readonly messages?: string;
  readonly flow?: string;
  readonly behavior?: string;
  readonly submit?: string;
  readonly registry?: string;
}

export interface RuntimeBundleInput {
  readonly schema: JsonFormSchema;
  readonly catalog: readonly CatalogEntry[];
  readonly descriptor: KitDescriptor;
  readonly namespace: KitNamespace;
  /** Мок автора; `null` — синтезируем из схемы. */
  readonly mock: PreviewMock | null;
  /**
   * Значения источников из правил формы (файл правил рядом с документом) — поверх мока, вместо
   * выдуманных вариантов. Те же значения напечатает генерация в `constants/`.
   */
  readonly dataSources?: Readonly<Record<string, unknown>>;
  /**
   * Фикстура формы — авторский артефакт из её каталога (`fixture.ts`).
   *
   * Только у компилирующей поверхности: фикстура — исполняемый код, а рантайм-поверхность
   * объявляет `executesCode: false` и не вправе его запускать.
   */
  readonly fixture?: FormFixture | null;
  /**
   * Реестр формы поверх билдерского (`createRegistry` модуля). Компилирующая поверхность
   * передаёт его сюда, чтобы не заводить вторую сборку реестра со своими правилами.
   */
  readonly extraRegistry?: ComponentRegistry;
  /**
   * Начальные значения поверх мока: то, что объявил модуль формы (`createInitialValues`).
   * Применяются только там, где у живой схемы есть для них место (см. {@link './initial'}).
   */
  readonly initialOverride?: Shape;
  /**
   * Значения прежней формы — то, что человек успел ввести до этой пересборки.
   *
   * Переносятся только пути, которым в новой форме есть место, и только значения, которые
   * годятся полю новой формы — его вид берётся из схемы (см. {@link './carry'}, {@link './kinds'}).
   * Без этого правка схемы стирает введённое, а в конструкторе схему правят непрерывно.
   */
  readonly carry?: Shape;
  /** Поведение формы, правила валидации и поток шагов из модуля формы. */
  readonly behavior?: FormConfig['behavior'];
  readonly validation?: FormConfig['validation'];
  readonly flow?: FormConfig['flow'];
  /**
   * Поведение модуля двумя половинами — правила и отправка. Старше {@link behavior}: это те же
   * правила, но с отправкой, итог которой придёт в `onResult`.
   */
  readonly moduleBehavior?: ModuleBehavior;
  /** Файлы артефактов — ими называются находки сборки. */
  readonly files?: ArtifactFiles;
}

export interface RuntimeBundle {
  /** Аннотированная копия схемы — та, что уйдёт в рендерер. Исходная не тронута. */
  readonly schema: JsonFormSchema | null;
  readonly form: PreviewForm | null;
  readonly registry: ComponentRegistry | null;
  readonly problems: readonly PreviewProblem[];
}

const describe = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/**
 * Имена файлов для находок, когда вызывающий их не назвал, — раскладка «папки по ролям». От
 * имени формы эти пути не зависят, поэтому раскладка берётся без имени.
 */
const DEFAULT_FILES = moduleFilesOf({ dir: 'form', TypeName: 'Form' });

/**
 * Область, которая запоминает, к каким узлам схемы обратились.
 *
 * Обращение к узлу, которого в схеме нет, ничего не бросает: правило записывается и молчит. Для
 * отправки это худший из исходов — кнопка есть, а нажатие ничего не делает. Узлы, названные
 * отправкой, сверяются со схемой после сборки ({@link missingSubmitNodes}).
 */
function recordingScope(scope: BehaviorScope<Shape>, seen: Set<string>): BehaviorScope<Shape> {
  return {
    ...scope,
    schema: {
      ...scope.schema,
      node: (selector) => {
        seen.add(selector);
        return scope.schema.node(selector);
      },
    },
  };
}

/** Узлы, к которым привязалась отправка, но которых нет в корневом дереве собранной формы. */
function missingSubmitNodes(form: PreviewForm, named: ReadonlySet<string>): readonly string[] {
  const tree = form.render.tree;
  if (tree === undefined || named.size === 0) return [];
  const root = form.render.controller.scopeOf(form.model);
  return unknownSchemaSelectors(root.__overrideMaps, tree).filter((selector) =>
    named.has(selector)
  );
}

/**
 * Ссылки на файлы шагов, которые остались несобранными, — по всем местам узлов.
 *
 * Превью рисует собранную форму: шаги из своих файлов подставляет сборка документа редактора.
 * Ссылка, дошедшая сюда, значит, что шаг не собран, — и рендерер бросил бы на ней внутренней
 * ошибкой с советом позвать `composeJsonFormSchema`, которая человеку ничего не говорит. Поэтому
 * отказ называется здесь, своими словами и с файлами.
 */
function unresolvedStepRefs(value: unknown, found: string[] = []): string[] {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return found;
  if (isJsonStepRef(value)) {
    found.push(value.$ref);
    return found;
  }
  const node = value as Record<string, unknown>;
  if (Array.isArray(node.children))
    for (const child of node.children) unresolvedStepRefs(child, found);
  unresolvedStepRefs((node.item as { $template?: unknown } | undefined)?.$template, found);
  unresolvedStepRefs(node.wrapper, found);
  return found;
}

/** Собирает форму по схеме. Отказ — данные, а не исключение. */
export function buildRuntimeBundle(input: RuntimeBundleInput): RuntimeBundle {
  const problems: PreviewProblem[] = [];

  const unresolved = unresolvedStepRefs(input.schema.root);
  if (unresolved.length > 0) {
    const files = unresolved.map((ref) => `«${ref}»`).join(', ');
    return {
      schema: null,
      form: null,
      registry: null,
      problems: [
        {
          file: '',
          phase: 'schema',
          message:
            `шаги мастера не собраны: ${files}. Проверьте, что файлы шагов лежат рядом с ` +
            'документом, и откройте вкладку заново',
        },
      ],
    };
  }

  let annotated: JsonFormSchema;
  try {
    annotated = annotateSchema(input.schema);
  } catch (error) {
    return {
      schema: null,
      form: null,
      registry: null,
      problems: [{ file: '', phase: 'schema', message: describe(error) }],
    };
  }

  // Порядок старшинства целиком живёт в `@/plugins/reformer/core/form-fixture`: синтез <
  // начальные значения модуля < фикстура. Фикстура старше значений модуля потому, что пишется
  // РАДИ проверки, — иначе «покажи форму с пустой моделью» было бы невыразимо.
  // Вид значения полей чужого кита — из его каталога, той же таблицей, что у кодогена: иначе
  // превью синтезировало бы не ту модель, которую печатает экспорт.
  const valueTypeOf = valueTypesOf(input.catalog);
  const base = overlayDataSources(
    input.mock ?? synthMock(annotated, valueTypeOf),
    input.dataSources
  );
  const mock = mergeFormData(
    base,
    // Значения модуля печатались по схеме на момент генерации, а схему с тех пор правили:
    // поверх мока ложится только то, чему в живой схеме есть место (см. `./initial`).
    fitInitialValues(base.model, input.initialOverride),
    input.fixture ?? null
  );
  // Перенос идёт последним шагом: введённое человеком старше всех слоёв — но только
  // там, где новая форма оставила для него место. Годится ли значение месту, решает вид поля
  // по ЭТОЙ схеме: у числа, даты и мультивыбора начальное значение — `null`, и по паре
  // «`null` и введённое» этого не понять (см. `./carry`).
  const initial = carryValues(
    mock.model,
    input.carry,
    input.carry === undefined ? undefined : fieldKindsOf(annotated, valueTypeOf)
  );

  let registry: ComponentRegistry;
  try {
    registry = buildPreviewRegistry({
      schema: annotated,
      catalog: input.catalog,
      descriptor: input.descriptor,
      namespace: input.namespace,
      dataSources: mock.dataSources,
      fns: input.fixture?.fns,
      locale: input.fixture?.locale,
    });
  } catch (error) {
    return {
      schema: annotated,
      form: null,
      registry: null,
      problems: [{ file: '', phase: 'render', message: describe(error) }],
    };
  }

  if (input.extraRegistry !== undefined) {
    try {
      // Реестр формы поверх билдерского: побеждает последний, поэтому свои компоненты формы
      // перекрывают одноимённые каталожные, а не наоборот.
      registry = composeRegistries(registry, input.extraRegistry);
    } catch (error) {
      problems.push({
        file: input.files?.registry ?? DEFAULT_FILES.registry,
        phase: 'evaluate',
        message: describe(error),
      });
    }
  }

  const parts = input.moduleBehavior;
  const submitFile = input.files?.submit ?? DEFAULT_FILES.submit;
  /** Узлы схемы, к которым привязалась отправка. */
  const submitNodes = new Set<string>();
  const behavior =
    parts === undefined
      ? input.behavior
      : defineFormBehavior<Shape>((scope) => {
          parts.rules(scope);
          // Отказ отправки форму не роняет: бросок из поведения сборка считает своим и снимает
          // форму целиком, а здесь это всего лишь не подключившаяся кнопка.
          try {
            parts.wireSubmit(recordingScope(scope, submitNodes), { onResult: parts.onResult });
          } catch (error) {
            problems.push({ file: submitFile, phase: 'evaluate', message: describe(error) });
          }
        });

  try {
    const form = createForm<Shape>({
      initial,
      schema: annotated,
      registry,
      behavior,
      validation: input.validation,
      flow: input.flow,
    });
    // Форма собрана: сломана не отрисовка, а привязка отправки — и подпись должна сказать это.
    for (const selector of missingSubmitNodes(form, submitNodes)) {
      problems.push({
        file: submitFile,
        phase: 'bind',
        message: `отправка привязана к узлу «${selector}», которого нет в схеме: событие отправки не подключено`,
      });
    }
    return { schema: annotated, form, registry, problems };
  } catch (error) {
    problems.push({ file: '', phase: 'render', message: describe(error) });
    return { schema: annotated, form: null, registry, problems };
  }
}
