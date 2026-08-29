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
import type { PreviewContext, PreviewProblem } from '../contract';
import type { PreviewHost } from '../host';
import { nodeAt } from '../node-token';
import { buildRuntimeBundle, type RuntimeBundle } from '../runtime/build';
import { Highlight } from '../ui/Highlight';
import { Notice } from '../ui/Notice';
import { useFilesVersion, useKitVersion, usePreviewSchema, usePreviewSelection } from '../ui/hooks';
import { compileForm } from './compile';
import { appliedArtifacts, extractContract, type AppliedArtifact } from './exports';
import { readSidecars } from './read';

/** Идентификатор поверхности. Он же имя источника находок. */
export const COMPILING_SURFACE_ID = 'preview.compiling';

const NO_NAMESPACE: KitNamespace = Object.freeze({});

function fallbackDescriptor(): KitDescriptor {
  return toDescriptor({ version: '1.0', components: [] });
}

interface CompiledState {
  readonly bundle: RuntimeBundle | null;
  readonly applied: readonly AppliedArtifact[];
  readonly problems: readonly PreviewProblem[];
  readonly pending: boolean;
}

const PENDING: CompiledState = Object.freeze({
  bundle: null,
  applied: [],
  problems: [],
  pending: true,
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
  const [state, setState] = useState<CompiledState>(PENDING);

  const modules = host.modules;
  const documentId = ctx.doc.id;
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

  useEffect(() => {
    if (schema === null || modules === undefined) {
      setState({ bundle: null, applied: [], problems: [], pending: false });
      return;
    }

    // Отменяем не работу, а ПРИМЕНЕНИЕ результата: компиляция уже запущена, остановить её
    // нечем, но опоздавший результат обязан быть отброшен — иначе он затрёт свежий.
    let cancelled = false;
    setState(PENDING);

    void (async () => {
      const sources = await readSidecars(host, documentId);
      const compiled = await compileForm(sources.files, modules);
      if (cancelled) return;

      const contract = extractContract(compiled.modules);
      const problems: PreviewProblem[] = [...sources.problems, ...compiled.problems];

      let extraRegistry;
      if (contract.createRegistry !== undefined) {
        try {
          extraRegistry = contract.createRegistry();
        } catch (error) {
          problems.push({
            file: 'registry.ts',
            phase: 'evaluate',
            message: error instanceof Error ? error.message : String(error),
          });
        }
      }

      const bundle = buildRuntimeBundle({
        schema,
        catalog: kit.catalog,
        descriptor: kit.descriptor,
        namespace: kit.namespace,
        mock,
        extraRegistry,
        initialOverride: contract.initial,
        behavior: contract.behavior,
        validation: contract.validation,
        renderBehavior: contract.renderBehavior,
      });

      setState({
        bundle,
        applied: appliedArtifacts(contract),
        problems: [...problems, ...bundle.problems],
        pending: false,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [schema, host, documentId, modules, kit, mock, filesVersion]);

  useEffect(() => {
    ctx.report(COMPILING_SURFACE_ID, state.problems);
  }, [ctx, state.problems]);

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
  if (state.pending) {
    return <Notice title={t('empty.compiling')} />;
  }
  if (state.bundle === null || state.bundle.form === null) {
    return (
      <Notice tone="warning" title={t('empty.build-failed')} detail={state.problems[0]?.message} />
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="text-muted-foreground border-border flex flex-wrap items-center gap-1 border-b px-3 py-1 text-[11px]">
        {state.applied.length === 0 ? (
          <span>{t('applied.none')}</span>
        ) : (
          state.applied.map((artifact) => (
            <span key={artifact} className="border-border rounded border px-1 py-px font-mono">
              {artifact}
            </span>
          ))
        )}
        {state.problems.length === 0 ? null : (
          <span className="ml-2 text-amber-600 dark:text-amber-400">
            {t('applied.problems', { count: state.problems.length })}
          </span>
        )}
      </div>
      <ScrollArea ref={surface} className="min-h-0 flex-1" onClick={onClick}>
        {/* Отступ лежит на содержимом, а не на `ScrollArea`: на корне он оставил бы полосу
            прокрутки внутри поля, а нижний отступ перестал бы уезжать вместе с формой. */}
        <div className="p-4">
          <Highlight selection={selection} />
          <JsonRendererProvider settings={{ registry: state.bundle.form.registry }}>
            <JsonFormRenderer form={state.bundle.form} />
          </JsonRendererProvider>
        </div>
      </ScrollArea>
    </div>
  );
}
