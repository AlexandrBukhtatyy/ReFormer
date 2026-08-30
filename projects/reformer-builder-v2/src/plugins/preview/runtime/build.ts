/**
 * Сборка бандла рантайм-поверхности: схема → форма, готовая к отрисовке.
 *
 * ## Порядок здесь не декоративный
 *
 * `createJsonForm` обязан отработать ДО монтирования рендерера: именно он создаёт form-node'ы,
 * привязанные к сигналам модели. Без него рендерер пишет «No form node for signal …» и рисует
 * пустоту вместо полей. Поэтому сборка синхронна и завершается целиком.
 *
 * ## Сборка не бросает
 *
 * Битая схема — обычное состояние документа, который правят прямо сейчас. Исключение отсюда
 * уронило бы поверхность, и вместо объяснения человек увидел бы пустой прямоугольник. Поэтому
 * отказ возвращается ДАННЫМИ и показывается словами.
 *
 * @module plugins/preview/runtime/build
 */

import {
  composeRegistries,
  createJsonForm,
  type ComponentRegistry,
  type JsonForm,
  type JsonFormSchema,
} from '@reformer/renderer-json';
import type { CatalogEntry } from '@/lib/catalog/types';
import type { KitDescriptor, KitNamespace } from '@/lib/kits/types';
import { annotateSchema } from '../annotate';
import type { PreviewMock, PreviewProblem } from '../contract';
import { carryValues } from './carry';
import { synthMock } from './mock';
import { buildPreviewRegistry } from './registry';

/** Форма данных модели превью: она приходит из схемы, и сузить её нечем. */
type Shape = Record<string, unknown>;

export interface RuntimeBundleInput {
  readonly schema: JsonFormSchema;
  readonly catalog: readonly CatalogEntry[];
  readonly descriptor: KitDescriptor;
  readonly namespace: KitNamespace;
  /** Мок автора; `null` — синтезируем из схемы. */
  readonly mock: PreviewMock | null;
  /**
   * Реестр формы поверх билдерского (`createRegistry` из сайдкаров). Компилирующая поверхность
   * передаёт его сюда, чтобы не заводить вторую сборку реестра со своими правилами.
   */
  readonly extraRegistry?: ComponentRegistry;
  /** Начальные значения поверх мока: то, что объявил `model.ts` формы. */
  readonly initialOverride?: Shape;
  /**
   * Значения прежней формы — то, что человек успел ввести до этой пересборки.
   *
   * Переносятся только пути, которым в новой форме есть место (см. {@link './carry'}).
   * Без этого правка схемы стирает введённое, а в конструкторе схему правят непрерывно.
   */
  readonly carry?: Shape;
  /** Поведение модели и правила валидации из сайдкаров. */
  readonly behavior?: Parameters<typeof createJsonForm<Shape>>[0]['behavior'];
  readonly validation?: Parameters<typeof createJsonForm<Shape>>[0]['validation'];
  readonly renderBehavior?: Parameters<typeof createJsonForm<Shape>>[0]['renderBehavior'];
}

export interface RuntimeBundle {
  /** Аннотированная копия схемы — та, что уйдёт в рендерер. Исходная не тронута. */
  readonly schema: JsonFormSchema | null;
  readonly form: JsonForm<Shape> | null;
  readonly registry: ComponentRegistry | null;
  readonly problems: readonly PreviewProblem[];
}

const describe = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

function isPlainObject(value: unknown): value is Shape {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Слияние вглубь: значения `patch` перекрывают `base`, объекты сливаются рекурсивно. */
export function deepMerge(base: Shape, patch: Shape): Shape {
  const out: Shape = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    const previous = out[key];
    out[key] = isPlainObject(previous) && isPlainObject(value) ? deepMerge(previous, value) : value;
  }
  return out;
}

/** Собирает форму по схеме. Отказ — данные, а не исключение. */
export function buildRuntimeBundle(input: RuntimeBundleInput): RuntimeBundle {
  const problems: PreviewProblem[] = [];

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

  const mock = input.mock ?? synthMock(annotated);
  const declared =
    input.initialOverride === undefined ? mock.model : deepMerge(mock.model, input.initialOverride);
  // Перенос идёт последним шагом: введённое человеком старше и мока, и `model.ts` — но только
  // там, где новая форма оставила для него место.
  const initial = carryValues(declared, input.carry);

  let registry: ComponentRegistry;
  try {
    registry = buildPreviewRegistry({
      schema: annotated,
      catalog: input.catalog,
      descriptor: input.descriptor,
      namespace: input.namespace,
      dataSources: mock.dataSources,
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
      problems.push({ file: 'registry.ts', phase: 'evaluate', message: describe(error) });
    }
  }

  try {
    const form = createJsonForm<Shape>({
      schema: annotated,
      registry,
      initial,
      behavior: input.behavior,
      validation: input.validation,
      renderBehavior: input.renderBehavior,
    });
    return { schema: annotated, form, registry, problems };
  } catch (error) {
    problems.push({ file: '', phase: 'render', message: describe(error) });
    return { schema: annotated, form: null, registry, problems };
  }
}
