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
 * @module plugins/reformer/render/runtime/build
 */

import { createForm, type CreateFormConfig, type FormBundle } from '@reformer/core';
import {
  composeRegistries,
  type ComponentRegistry,
  type JsonFormSchema,
} from '@reformer/renderer-json';
import type { CatalogEntry } from '../../../core/catalog';
import type { KitDescriptor, KitNamespace } from '@reformer/builder-plugin-api';
import { annotateSchema } from '../schema/annotate';
import type { PreviewMock, PreviewProblem } from '@reformer/builder-plugin-api';
import { mergeFormData, type FormFixture } from '../../../core/form-fixture';
import { carryValues } from './carry';
import { synthMock } from './mock';
import { buildPreviewRegistry } from './registry';

/** Форма данных модели превью: она приходит из схемы, и сузить её нечем. */
export type Shape = Record<string, unknown>;

/** Собранная форма превью — бандл единой сборки. */
export type PreviewForm = FormBundle<Shape>;

type FormConfig = CreateFormConfig<Shape>;

/**
 * Правила узлов прежнего контракта: фабрика из `form.render.ts`, которая по форме и модели отдаёт
 * функцию над областью схемы (`schema.node(...)`, `hideWhen`, `onComponentEvent`).
 *
 * В единой сборке отдельного слоя для них нет — правила узлов живут в поведении формы. Модули,
 * собранные раньше, всё ещё несут такой файл, и превью применяет его в `setup` сборки: операторы
 * узлов только записывают правило в контроллер схемы, а он у сборки один.
 */
export type LegacyRenderBehavior = (
  form: PreviewForm['form'],
  model: PreviewForm['model'],
  level: PreviewForm
) => ((schema: never) => void) | undefined;

export interface RuntimeBundleInput {
  readonly schema: JsonFormSchema;
  readonly catalog: readonly CatalogEntry[];
  readonly descriptor: KitDescriptor;
  readonly namespace: KitNamespace;
  /** Мок автора; `null` — синтезируем из схемы. */
  readonly mock: PreviewMock | null;
  /**
   * Фикстура формы — авторский артефакт из её каталога (`fixture.ts`).
   *
   * Только у компилирующей поверхности: фикстура — исполняемый код, а рантайм-поверхность
   * объявляет `executesCode: false` и не вправе его запускать.
   */
  readonly fixture?: FormFixture | null;
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
  /** Поведение формы, правила валидации и поток шагов из сайдкаров. */
  readonly behavior?: FormConfig['behavior'];
  readonly validation?: FormConfig['validation'];
  readonly flow?: FormConfig['flow'];
  /** Правила узлов из `form.render.ts` модуля прежнего контракта. */
  readonly renderBehavior?: LegacyRenderBehavior;
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

  // Порядок старшинства целиком живёт в `@/plugins/reformer/core/form-fixture`: синтез < model.ts < фикстура.
  // Фикстура старше `model.ts` потому, что пишется РАДИ проверки, — иначе «покажи форму
  // с пустой моделью» было бы невыразимо.
  const mock = mergeFormData(
    input.mock ?? synthMock(annotated),
    input.initialOverride,
    input.fixture ?? null
  );
  // Перенос идёт последним шагом: введённое человеком старше всех слоёв — но только
  // там, где новая форма оставила для него место.
  const initial = carryValues(mock.model, input.carry);

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
      problems.push({ file: 'registry.ts', phase: 'evaluate', message: describe(error) });
    }
  }

  const legacy = input.renderBehavior;
  try {
    const form = createForm<Shape>({
      initial,
      schema: annotated,
      registry,
      behavior: input.behavior,
      validation: input.validation,
      flow: input.flow,
      ...(legacy === undefined
        ? {}
        : {
            setup: (bundle: PreviewForm) => {
              // Отказ прежнего слоя форму не роняет: бросок из `setup` сборка считает своим и
              // снимает форму целиком, а здесь это всего лишь не применившиеся правила узлов.
              try {
                // Область корня — та же, что получает поведение формы: правила прежнего слоя
                // адресуют узлы тем же `schema.node(selector)`.
                const scope = bundle.render.controller.scopeOf(bundle.model);
                legacy(bundle.form, bundle.model, bundle)?.(scope as never);
              } catch (error) {
                problems.push({
                  file: 'form.render.ts',
                  phase: 'evaluate',
                  message: describe(error),
                });
              }
            },
          }),
    });
    return { schema: annotated, form, registry, problems };
  } catch (error) {
    problems.push({ file: '', phase: 'render', message: describe(error) });
    return { schema: annotated, form: null, registry, problems };
  }
}
