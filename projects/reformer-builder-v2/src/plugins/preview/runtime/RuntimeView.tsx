/**
 * Рантайм-поверхность: настоящий рендерер по схеме, без сайдкаров.
 *
 * Это та поверхность, которая работает ВСЕГДА, когда есть схема: ни компилятора, ни рабочей
 * области, ни разрешения источника ей не нужно. Отсюда и её место в правиле умолчания — она
 * выигрывает у каркаса и уступает компилирующей.
 *
 * ## Чего она не показывает, и это надо говорить вслух
 *
 * Валидации и поведения. Форма рисуется по схеме и мокам, а `validation.ts` и `form.behavior.ts`
 * не исполняются вовсе — для этого есть компилирующая поверхность. Молча делать вид, что
 * поведение подключено, было бы худшим вариантом: человек решил бы, что его правила не работают.
 *
 * ## Введённые значения переживают пересборку
 *
 * Форма пересобирается на каждую правку схемы, а модель пересоздаётся вместе с ней: прежнюю
 * переиспользовать нельзя — она не отрастит сигнал под путь, которого не было в её начальных
 * значениях. Поэтому перед сборкой снимается снимок прежней модели и переносится в новую
 * ({@link './carry'}), а при размонтировании уходит на хранение в состояние документа: вид
 * конструктора переключают, и поверхность при этом исчезает целиком.
 *
 * Снимок берётся ВНУТРИ сборки, а не в эффекте. Эффект отработал бы уже после того, как новая
 * форма собрана, и всё, что человек набрал после прошлой правки схемы, потерялось бы.
 *
 * ## Выбор узла кликом
 *
 * Работает по класс-токенам аннотированной копии схемы: клик всплывает до элемента с токеном
 * ({@link '../node-token'.nodeAt}). Отдельной карты «элемент → узел» нет, поэтому пересборка
 * формы её и не рассинхронизирует.
 *
 * @module plugins/preview/runtime/RuntimeView
 */

import { useCallback, useEffect, useMemo, useRef, type MouseEvent, type ReactNode } from 'react';
import { JsonFormRenderer, JsonRendererProvider } from '@reformer/renderer-json';
import { ScrollArea } from '@reformer/ui-kit/scroll-area';
import { toDescriptor } from '@/lib/kits/descriptor';
import type { KitDescriptor, KitNamespace } from '@/lib/kits/types';
import type { PreviewContext, PreviewValues } from '../contract';
import type { PreviewHost } from '../host';
import { nodeAt } from '../node-token';
import { Highlight } from '../ui/Highlight';
import { Notice } from '../ui/Notice';
import { useKitVersion, usePreviewSchema, usePreviewSelection } from '../ui/hooks';
import { buildRuntimeBundle } from './build';

/** Идентификатор поверхности. Он же имя источника находок в состоянии превью. */
export const RUNTIME_SURFACE_ID = 'preview.runtime';

/** Пустой namespace: кит недоступен, и всё уедет в подписанные стабы. */
const NO_NAMESPACE: KitNamespace = Object.freeze({});

/**
 * Дескриптор, когда кита нет вовсе.
 *
 * Выводится из пустого каталога теми же дефолтами билдера, что и настоящий, — своего
 * «дескриптора по умолчанию» превью не сочиняет: два представления о том, как называется
 * враппер поля, разошлись бы на первом же ките.
 */
function fallbackDescriptor(): KitDescriptor {
  return toDescriptor({ version: '1.0', components: [] });
}

export interface RuntimeViewProps {
  readonly ctx: PreviewContext;
  readonly host: PreviewHost;
}

export function RuntimeView({ ctx, host }: RuntimeViewProps): ReactNode {
  const t = host.useTranslate();
  const schema = usePreviewSchema(ctx);
  const selection = usePreviewSelection(ctx);
  const kitVersion = useKitVersion(host);
  const surface = useRef<HTMLDivElement | null>(null);
  /** Форма прошлой сборки — источник значений для следующей. */
  const live = useRef<{ model: { get(): unknown } } | null>(null);

  const bundle = useMemo(() => {
    // Счётчик читается намеренно: каталог и namespace приходят ФУНКЦИЯМИ порта, поэтому
    // единственное, что связывает пересборку со сменой кита, — это он.
    void kitVersion;
    if (schema === null) return null;
    // Своя живая модель свежее хранилища: она видела всё, что набрано после прошлой правки.
    const carry = (live.current?.model.get() as PreviewValues | undefined) ?? ctx.values();
    return buildRuntimeBundle({
      schema,
      catalog: host.catalog(),
      descriptor: host.kit() ?? fallbackDescriptor(),
      namespace: host.kitNamespace() ?? NO_NAMESPACE,
      mock: ctx.mock(),
      carry,
    });
  }, [schema, host, ctx, kitVersion]);

  useEffect(() => {
    live.current = bundle?.form ?? null;
  }, [bundle]);

  useEffect(() => {
    // Размонтирование — последний момент, когда модель ещё жива. Вид конструктора переключают
    // чаще, чем правят схему, и без этого возврат на форму давал бы пустые поля.
    return () => {
      const form = live.current;
      if (form !== null) ctx.keepValues(form.model.get() as PreviewValues);
    };
  }, [ctx]);

  useEffect(() => {
    // Находки публикуются эффектом, а не по ходу отрисовки: `report` меняет состояние,
    // а менять состояние во время рендера — гарантированный цикл перерисовок.
    ctx.report(RUNTIME_SURFACE_ID, bundle?.problems ?? []);
  }, [ctx, bundle]);

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
      // Промах по пустому месту снимает выделение: это ответ «здесь узла нет», а не отсутствие
      // ответа, и он должен отличаться от «ничего не произошло».
      ctx.select(id === null ? [] : [id]);
    },
    [ctx]
  );

  if (schema === null) {
    return <Notice title={t('empty.no-schema')} detail={t('empty.no-schema.detail')} />;
  }
  if (bundle === null || bundle.form === null) {
    const first = bundle?.problems[0];
    return <Notice tone="warning" title={t('empty.build-failed')} detail={first?.message} />;
  }

  return (
    <ScrollArea ref={surface} className="h-full" onClick={onClick}>
      {/* Отступ лежит на содержимом, а не на `ScrollArea`: на корне он оставил бы полосу
          прокрутки внутри поля, а нижний отступ перестал бы уезжать вместе с формой. */}
      <div className="p-4">
        <Highlight selection={selection} />
        <JsonRendererProvider settings={{ registry: bundle.form.registry }}>
          <JsonFormRenderer form={bundle.form} />
        </JsonRendererProvider>
      </div>
    </ScrollArea>
  );
}
