/**
 * Компилирующая поверхность: сайдкары формы транспилируются, линкуются и исполняются
 * в ТОМ ЖЕ realm, что и оболочка.
 *
 * ## Почему в том же realm
 *
 * Ось контракта Э8 — realm, а не «нужен ли компилятор». Рендер в iframe при компиляторе
 * в оболочке дал бы второй экземпляр ядра, а второй экземпляр ломает идентичность сигналов
 * и поиск узла по сигналу. Поэтому исполняющая поверхность обязана быть своей, и коду
 * подставляются уже загруженные модули оболочки — реестром модулей платформы.
 *
 * ## Отказ по источнику виден, а не молчалив
 *
 * Проверку выполняет тот, кто монтирует (см. `../source-guard`), поэтому сюда управление
 * доходит только при разрешении. Обратное — «поверхность проверяет себя сама» — защищало бы
 * ровно её, а точка расширения открыта для чужих вкладов.
 *
 * ## Компиляция и сборка разведены
 *
 * Сайдкары читаются и транспилируются по документу и версии рабочих копий; форма собирается
 * по схеме. Один эффект на двоих означал бы перекомпиляцию сайдкаров на каждое нажатие
 * клавиши в конструкторе — и, что хуже, падение в «собирается» вместо показанной формы.
 * В живом виде конструктора это видно постоянно: форма там на экране всегда.
 *
 * Отсюда и `pending`: он показывается только на ПЕРВОЙ компиляции. Пустое место во время
 * пересборки — это потеря того, на что человек смотрит, ради того, чего он ещё не просил.
 *
 * ## Деградация частями
 *
 * Битый `validation.ts` не лишает превью работающего `form.behavior.ts`: сбои приходят списком
 * и показываются, а форма собирается из того, что исполнилось. «Форма не отрабатывает» без
 * указания виновного — та самая жалоба, ради которой изоляция и делалась.
 *
 * @module plugins/preview/compiling/CompilingView
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { JsonFormRenderer, JsonRendererProvider } from '@reformer/renderer-json';
import { ScrollArea } from '@reformer/ui-kit/scroll-area';
import { toDescriptor } from '@/lib/kits/descriptor';
import type { KitDescriptor, KitNamespace } from '@/lib/kits/types';
import type { PreviewContext, PreviewProblem, PreviewValues } from '../contract';
import type { PreviewHost } from '../host';
import { nodeAt } from '../schema/node-token';
import { buildRuntimeBundle, type RuntimeBundle } from '../runtime/build';
import { Highlight } from '../ui/Highlight';
import { Notice } from '../ui/Notice';
import { useFilesVersion, useKitVersion, usePreviewSchema, usePreviewSelection } from '../ui/hooks';
import type { ComponentRegistry } from '@reformer/renderer-json';
import { createAmbient, type FormFixture } from '@/lib/form-fixture';
import { compileForm } from './compile';
import { loadFixture } from './fixture';
import {
  appliedArtifacts,
  extractContract,
  type AppliedArtifact,
  type FormContract,
} from './exports';
import { attributeProblems, readSidecars } from './read';

/** Идентификатор поверхности. Он же имя источника находок. */
export const COMPILING_SURFACE_ID = 'preview.compiling';

const NO_NAMESPACE: KitNamespace = Object.freeze({});

function fallbackDescriptor(): KitDescriptor {
  return toDescriptor({ version: '1.0', components: [] });
}

/** Что дали сайдкары. Пересобирается ТОЛЬКО при их правке, но не при правке схемы. */
interface CompiledSources {
  readonly contract: FormContract | null;
  /** Реестр компонентов формы: собран один раз, при исполнении `registry.ts`. */
  readonly registry: ComponentRegistry | undefined;
  /**
   * Фикстура формы: данные, подстановки и окружение.
   *
   * Живёт рядом с контрактом, потому что читается тем же эффектом и по тому же поводу —
   * правке файлов, а не схемы.
   */
  readonly fixture: FormFixture | null;
  readonly applied: readonly AppliedArtifact[];
  readonly problems: readonly PreviewProblem[];
  /** Идёт первая компиляция: показывать нечего вовсе. */
  readonly pending: boolean;
}

const PENDING: CompiledSources = Object.freeze({
  contract: null,
  registry: undefined,
  fixture: null,
  applied: [],
  problems: [],
  pending: true,
});

/** Загрузчика модулей нет: сайдкары не исполнятся, но форма по схеме соберётся. */
const NOTHING: CompiledSources = Object.freeze({
  contract: {},
  registry: undefined,
  fixture: null,
  applied: [],
  problems: [],
  pending: false,
});

export interface CompilingViewProps {
  readonly ctx: PreviewContext;
  readonly host: PreviewHost;
}

export function CompilingView({ ctx, host }: CompilingViewProps): ReactNode {
  const t = host.useTranslate();
  const schema = usePreviewSchema(ctx);
  const selection = usePreviewSelection(ctx);
  const kitVersion = useKitVersion(host);
  const filesVersion = useFilesVersion(host);
  const surface = useRef<HTMLDivElement | null>(null);
  const [sources, setSources] = useState<CompiledSources>(PENDING);
  /** Форма прошлой сборки — источник значений для следующей (см. `../runtime/carry`). */
  const live = useRef<{ model: { get(): unknown } } | null>(null);

  const modules = host.modules;
  const documentId = ctx.doc.id;
  // Путь документа нужен для адреса фикстуры: она лежит рядом с формой (`fixture.ts` в её
  // каталоге), и этот адрес выводится из пути схемы.
  const schemaPath = host.documentOf(documentId)?.ref.path ?? '';
  const mock = ctx.mock();

  const kit = useMemo(() => {
    // Счётчик читается намеренно: кит приходит ФУНКЦИЯМИ порта, и только он связывает
    // пересборку со сменой активного кита.
    void kitVersion;
    return {
      catalog: host.catalog(),
      descriptor: host.kit() ?? fallbackDescriptor(),
      namespace: host.kitNamespace() ?? NO_NAMESPACE,
    };
  }, [host, kitVersion]);

  // Сайдкары: от схемы НЕ зависят вовсе. Их правят в соседних вкладках, и об этом сообщает
  // `filesVersion`, а не изменение модели документа.
  useEffect(() => {
    if (modules === undefined) {
      setSources(NOTHING);
      return;
    }

    // Отменяем не работу, а ПРИМЕНЕНИЕ результата: компиляция уже запущена, остановить её
    // нечем, но опоздавший результат обязан быть отброшен — иначе он затрёт свежий.
    let cancelled = false;
    // В «собирается» падаем только с пустого места: пересборка сайдкаров не должна убирать
    // с экрана форму, которая уже показана.
    setSources((previous) => (previous.contract === null ? PENDING : previous));

    void (async () => {
      // Фикстура исполняется ПЕРВОЙ и отдельным графом: её подстановки нужны сайдкарам,
      // а общий граф исполнил бы `./api` дважды — один раз для неё, другой для формы.
      const loaded = await loadFixture(host, modules, documentId, schemaPath);
      const isolation = {
        overrides:
          loaded.fixture?.modules === undefined
            ? undefined
            : new Map(Object.entries(loaded.fixture.modules)),
        ambient: createAmbient(loaded.fixture),
      };

      const read = await readSidecars(host, documentId);
      const compiled = await compileForm(read.files, modules, isolation);
      if (cancelled) return;

      const contract = extractContract(compiled.modules);
      const problems: PreviewProblem[] = [
        ...loaded.problems,
        ...read.problems,
        ...compiled.problems,
      ];

      let registry: ComponentRegistry | undefined;
      if (contract.createRegistry !== undefined) {
        try {
          registry = contract.createRegistry();
        } catch (error) {
          problems.push({
            file: 'registry.ts',
            phase: 'evaluate',
            message: error instanceof Error ? error.message : String(error),
          });
        }
      }

      setSources({
        contract,
        registry,
        fixture: loaded.fixture,
        applied: appliedArtifacts(contract),
        // Адрес файла — чтобы находка ушла в свод диагностик туда, где чинить, а не на схему.
        problems: attributeProblems(problems, read.resources),
        pending: false,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [host, documentId, schemaPath, modules, filesVersion]);

  // Форма: синхронная сборка по схеме и уже исполненным сайдкарам. Правка схемы доходит
  // сюда и никуда больше — компилятор она не трогает.
  const bundle = useMemo<RuntimeBundle | null>(() => {
    const contract = sources.contract;
    if (schema === null || contract === null) return null;
    const carry = (live.current?.model.get() as PreviewValues | undefined) ?? ctx.values();
    return buildRuntimeBundle({
      schema,
      catalog: kit.catalog,
      descriptor: kit.descriptor,
      namespace: kit.namespace,
      mock,
      fixture: sources.fixture,
      extraRegistry: sources.registry,
      initialOverride: contract.initial,
      behavior: contract.behavior,
      validation: contract.validation,
      renderBehavior: contract.renderBehavior,
      carry,
    });
  }, [schema, kit, mock, sources, ctx]);

  useEffect(() => {
    live.current = bundle?.form ?? null;
    // Панель модели читает и правит ЭТУ форму. Публикуем после сборки и снимаем на
    // размонтировании: наблюдателю нечего показывать, когда поверхности нет.
    ctx.publishForm?.(bundle?.form ?? null);
    return () => {
      ctx.publishForm?.(null);
    };
  }, [bundle, ctx]);

  useEffect(() => {
    // Размонтирование — последний момент, когда модель ещё жива.
    return () => {
      const form = live.current;
      if (form !== null) ctx.keepValues(form.model.get() as PreviewValues);
    };
  }, [ctx]);

  const problems = useMemo(
    () => [...sources.problems, ...(bundle?.problems ?? [])],
    [sources.problems, bundle]
  );

  useEffect(() => {
    ctx.report(COMPILING_SURFACE_ID, problems);
  }, [ctx, problems]);

  const onClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      const root = surface.current;
      if (root === null) return;
      const el = event.target as Element;
      // Полоса прокрутки лежит внутри той же `ScrollArea`, по которой ловится клик, поэтому
      // тычок в неё дошёл бы сюда как промах по форме и снял бы выделение прямо в момент
      // перетаскивания ползунка. Прокрутка — не выбор узла и не отказ от него.
      if (el.closest('[data-slot="scroll-area-scrollbar"]') !== null) return;
      const id = nodeAt(el, root);
      ctx.select(id === null ? [] : [id]);
    },
    [ctx]
  );

  if (modules === undefined) {
    return (
      <Notice tone="warning" title={t('empty.no-loader')} detail={t('empty.no-loader.detail')} />
    );
  }
  if (schema === null) {
    return <Notice title={t('empty.no-schema')} detail={t('empty.no-schema.detail')} />;
  }
  // Пустое место показывается только на ПЕРВОЙ компиляции: дальше прошлая форма остаётся
  // на экране, пока не готова новая.
  if (sources.pending) {
    return <Notice title={t('empty.compiling')} />;
  }
  if (bundle === null || bundle.form === null) {
    return <Notice tone="warning" title={t('empty.build-failed')} detail={problems[0]?.message} />;
  }

  // Полоса «сайдкары такие-то, проблем столько-то» убрана. Она отвечала на вопрос панели
  // превью — «что вообще подцепилось», — а панели больше нет: поверхность монтируют в тело
  // редактора, где та же строка отнимает высоту у формы на каждой вкладке. Число находок
  // без их текста всё равно ничего не давало: разбирать их надо в панели проблем, куда они
  // пока не доезжают (см. задачу о находках сборки).
  return (
    <div className="flex h-full flex-col">
      <ScrollArea ref={surface} className="min-h-0 flex-1" onClick={onClick}>
        {/* Отступ лежит на содержимом, а не на `ScrollArea`: на корне он оставил бы полосу
            прокрутки внутри поля, а нижний отступ перестал бы уезжать вместе с формой. */}
        <div className="p-4">
          <Highlight selection={selection} />
          <JsonRendererProvider settings={{ registry: bundle.form.registry }}>
            <JsonFormRenderer form={bundle.form} />
          </JsonRendererProvider>
        </div>
      </ScrollArea>
    </div>
  );
}
