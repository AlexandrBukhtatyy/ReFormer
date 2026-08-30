/**
 * Живой вид конструктора: настоящая форма из компонентов кита на всё тело вкладки.
 *
 * ## Форму рисуем не мы
 *
 * Компонент создаёт пустой элемент, отдаёт его поверхности превью и внутрь больше не пишет:
 * поверхность монтирует туда СВОЙ корень React. Второго конвейера сборки формы в билдере нет
 * и не заводится — ровно как «показать исходником» переиспользует чужое тело Monaco, а не
 * повторяет его.
 *
 * ## Монтирование ровно одно на пару «документ + поверхность»
 *
 * Это несущий инвариант, а не оптимизация. Правка схемы обязана доходить до формы через
 * `onDidChangeSchema` контекста, а не через пересоздание поверхности: перемонтирование теряет
 * и фокус в поле, и прокрутку, и введённые значения. Поэтому эффект монтирования зависит только
 * от документа, идентификатора поверхности и контекста, но НЕ от модели.
 *
 * ## Форма живая, выбор — по Alt
 *
 * Обычный щелчок уходит в форму: чекбокс переключается, поле принимает фокус, визард листает
 * шаги. Узел выбирают Alt+щелчком, и вот он перехватывается.
 *
 * Слушатели нативные и стоят в фазе ПЕРЕХВАТА — это не стилистика. При зажатом Alt событие
 * надо погасить, чтобы оно не дошло ни до формы, ни до собственного хит-теста поверхности
 * (иначе выбор поставился бы дважды, и второй раз — без разбора модификаторов). А событие,
 * погашенное в перехвате, обратно не всплывает — то есть делегированный React-обработчик
 * нашего же корня не сработал бы. Отсюда `addEventListener(..., true)`.
 *
 * ## Перетаскивают за ручку, а не за узел
 *
 * Ставить `draggable` на элементы чужого DOM (так делала первая версия) нельзя вместе с живой
 * формой: протяжка в текстовом поле начала бы тащить узел вместо выделения текста, а следить
 * за пересозданием чужих элементов пришлось бы наблюдателем мутаций. Поэтому источник
 * перетаскивания — ручка в оверлее, наш собственный элемент. Она стоит у ВЫДЕЛЕННОГО узла,
 * а не под курсором: ручка, бегающая за мышью, мельтешит поверх формы, с которой в этот
 * момент работают.
 *
 * ## Подсветка — правилами CSS
 *
 * Ни выделение, ни наведение не трогают чужой DOM: правила пишутся по классу-токену
 * ({@link '../live-style'}). Наведение живёт в отдельной таблице и обновляется императивно —
 * курсор двигается десятки раз в секунду, и перерисовывать из-за него React значило бы
 * перерисовывать форму.
 *
 * @module plugins/editor-schema/ui/LiveView
 */

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type ReactElement,
} from 'react';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@reformer/ui-kit/empty';
import type { NodeId, ResourceId } from '@/sdk';
import { carriesSchemaNode, DRAG_MIME, type DragSession } from '../drag-session';
import { createLiveContext } from '../live-context';
import { elementOf, hitAt } from '../live-hit';
import { hoverCss, liveCss } from '../live-style';
import { gripBox, indicatorFor, type Indicator } from '../live-zone';
import { targetAt, type LiveTarget } from '../live-target';
import { planSchematicDrop } from '../schematic-drop';
import type { LivePreviewPort, LiveSurfaceInfo, Translate } from '../host';
import { indexNodes } from '../node-index';
import { buildSchematic, schematicOrder } from '../schematic-tree';
import type { Rect } from '../schematic-zone';
import { LiveOverlay, type LiveOverlayHandle } from './LiveOverlay';
import { selectModeOf, selectNode } from '../selection';
import type { SchemaEditorState, SchemaSession } from '../sessions';

export interface LiveViewProps {
  readonly session: SchemaSession;
  readonly state: SchemaEditorState;
  readonly t: Translate;
  readonly live: LivePreviewPort;
  /**
   * Сеанс перетаскивания — общий с палитрой и остальными видами.
   *
   * Необязателен: без него живой вид не берётся ни тащить, ни принимать, и остаётся ровно тем,
   * чем был. Груз читается ИЗ СЕАНСА, а не из `dataTransfer`: на `dragover` браузер данные
   * не отдаёт вовсе — только список типов.
   */
  readonly drag?: DragSession | null;
}

/**
 * Счётчик смен выбранной поверхности.
 *
 * Счётчик, а не снимок: `chosen()` собирает объект на каждый вызов, и отдать его в
 * `useSyncExternalStore` значило бы получить «The result of getSnapshot should be cached» —
 * ошибку, которую в этом проекте ловили трижды. Здесь есть событие «пересчитай», и число
 * выражает его точнее выдуманного значения. Тот же приём, что у `useKitVersion` в превью.
 */
function useSurfaceVersion(live: LivePreviewPort, documentId: ResourceId): number {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const subscription = live.onDidChange(documentId, () => {
      setVersion((previous) => previous + 1);
    });
    return () => {
      subscription.dispose();
    };
  }, [live, documentId]);
  return version;
}

/** Область действия правил: значение `data-rb-live`. Годное для CSS, а не «почти годное». */
function useScope(): string {
  const raw = useId();
  return useMemo(() => `rb${raw.replace(/[^a-zA-Z0-9-]/g, '')}`, [raw]);
}

export function LiveView({ session, state, t, live, drag = null }: LiveViewProps): ReactElement {
  const documentId = session.documentId;
  const root = useRef<HTMLDivElement | null>(null);
  const mountPoint = useRef<HTMLDivElement | null>(null);
  const hoverStyle = useRef<HTMLStyleElement | null>(null);
  const overlay = useRef<LiveOverlayHandle | null>(null);
  const scope = useScope();
  const version = useSurfaceVersion(live, documentId);

  const info = useMemo<LiveSurfaceInfo | null>(() => {
    // Счётчик читается намеренно: он и есть связь с составом поверхностей и выбором человека.
    void version;
    return live.chosen(documentId);
  }, [live, documentId, version]);

  const ctx = useMemo(
    () =>
      createLiveContext({
        initial: session.get(),
        // Поверхность зовёт `select` на любой щелчок — так устроен её хит-тест. Но форма
        // настоящая, и обычный щелчок принадлежит ей; выбор ловит перехватчик ниже.
        accepts: () => false,
        onSelect: (ids) => {
          session.setSelection(ids);
        },
      }),
    [session]
  );

  useEffect(() => () => ctx.dispose(), [ctx]);

  // Правка модели и смена выделения доходят до поверхности отсюда: собственной подписки
  // у сеанса нет — снимок приходит пропом, а версию рассылает реестр.
  useEffect(() => {
    ctx.push(state);
  }, [ctx, state]);

  const surfaceId = info?.id ?? null;
  useEffect(() => {
    const element = mountPoint.current;
    if (element === null || surfaceId === null) return;
    const mounted = live.mount(documentId, element, ctx);
    return () => {
      mounted?.dispose();
    };
    // `surfaceId`, а не `info`: объект собирается заново на каждый пересчёт, и зависимость
    // от него перемонтировала бы форму на ровном месте.
  }, [live, documentId, ctx, surfaceId]);

  // То же дерево коробок, что рисует схематичный вид: из него берутся и порядок обхода,
  // и метаданные цели броска. Второе построение дало бы второе мнение о том, что такое слот.
  const tree = useMemo(() => buildSchematic(state.model), [state.model]);
  // Порядок обхода — тот же, что у схематичного вида и дерева. Иначе Shift-диапазон «прыгал»
  // бы оттого, что человек посмотрел на форму: выделение переживает переключение вида.
  const order = useMemo(() => schematicOrder(tree), [tree]);

  /** Свежие значения для нативных слушателей: переподписывать их на каждую правку незачем. */
  const latest = useRef({ session, state, order, tree });
  latest.current = { session, state, order, tree };

  const setHover = useCallback(
    (id: NodeId | null) => {
      const element = hoverStyle.current;
      if (element === null) return;
      const next = hoverCss(scope, id);
      // Сравнение перед записью: `mousemove` приходит десятками в секунду, а перезапись
      // таблицы стилей — это пересчёт каскада для всей формы.
      if (element.textContent !== next) element.textContent = next;
    },
    [scope]
  );

  const selectable = info !== null && info.hitTest && info.sameRealm;
  const [dragging, setDragging] = useState(false);

  /** Прямоугольник области формы: к нему приводятся координаты оверлея. */
  const hostRect = useCallback((): Rect | null => {
    const surface = mountPoint.current;
    return surface === null ? null : surface.getBoundingClientRect();
  }, []);

  /** Куда встал бы бросок сейчас; `null` — сюда нельзя или тащат не наше. */
  const targetUnder = useCallback(
    (event: DragEvent<HTMLElement>): LiveTarget | null => {
      const surface = mountPoint.current;
      const payload = drag?.payload() ?? null;
      if (surface === null || payload === null || !selectable) return null;
      const hit = hitAt(event.target as Element | null, surface);
      if (hit === null) return null;
      const { model, tree: boxes } = {
        model: latest.current.state.model,
        tree: latest.current.tree,
      };
      return targetAt(
        {
          model,
          tree: boxes,
          // Соседей меряем по их настоящим прямоугольникам: ось раскладки в живой форме
          // видно, а объявленная врёт везде, где класс сложнее `flex-row`.
          rectOf: (id) => elementOf(surface, id)?.getBoundingClientRect() ?? null,
        },
        { id: hit.id, rect: hit.element.getBoundingClientRect() },
        { x: event.clientX, y: event.clientY },
        payload
      );
    },
    [drag, selectable]
  );

  const endDrag = useCallback(() => {
    drag?.end();
    overlay.current?.showDrop(null);
    setDragging(false);
  }, [drag]);

  const onDragOver = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      // Чужой драг (файл из проводника) проходит в форму нетронутым: перехватывать всё
      // подряд значило бы ломать то, чего мы не понимаем.
      if (!carriesSchemaNode(event.dataTransfer.types)) return;
      const target = targetUnder(event);
      if (target === null) {
        // Запрет виден ДО отпускания кнопки: без `preventDefault` браузер бросок не разрешит.
        event.dataTransfer.dropEffect = 'none';
        overlay.current?.showDrop(null);
        return;
      }
      event.preventDefault();
      event.dataTransfer.dropEffect = drag?.payload()?.kind === 'new' ? 'copy' : 'move';
      setDragging(true);
      const host = hostRect();
      if (host === null) return;
      const indicator: Indicator = indicatorFor(
        target.spot.zone,
        target.rect,
        host,
        target.horizontalParent
      );
      overlay.current?.showDrop(indicator);
    },
    [drag, hostRect, targetUnder]
  );

  const onDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      if (!carriesSchemaNode(event.dataTransfer.types)) return;
      event.preventDefault();
      const payload = drag?.payload() ?? null;
      const target = targetUnder(event);
      endDrag();
      if (payload === null || target === null) return;
      const op = planSchematicDrop(latest.current.state.model, payload, target.spot);
      // Выделение переедет на брошенный узел само: его называет `focus` операции.
      if (op !== null) latest.current.session.apply(op);
    },
    [drag, endDrag, targetUnder]
  );

  const onDragLeave = useCallback((event: DragEvent<HTMLDivElement>) => {
    // Гасим, только если ушли ЗА ПРЕДЕЛЫ корня: `dragleave` прилетает и при переходе между
    // вложенными элементами формы, а мигающий на каждом поле указатель хуже отсутствующего.
    const to = event.relatedTarget;
    if (to instanceof Node && event.currentTarget.contains(to)) return;
    overlay.current?.showDrop(null);
  }, []);

  const onGripDragStart = useCallback(
    (event: DragEvent<HTMLElement>, id: NodeId) => {
      // Тот же протокол, что у палитры и схематичного вида: тип в `dataTransfer` — чтобы
      // `dragover` мог отличить наш груз, сам груз — в сеансе, потому что данные на
      // `dragover` браузер не отдаёт.
      drag?.begin({ kind: 'node', id });
      event.dataTransfer.setData(DRAG_MIME, id);
      event.dataTransfer.effectAllowed = 'move';
      setDragging(true);
    },
    [drag]
  );

  useEffect(() => {
    const container = root.current;
    const surface = mountPoint.current;
    if (container === null || surface === null || !selectable) return;

    const onDown = (event: MouseEvent): void => {
      if (!event.altKey) return;
      // Фокус не уходит в поле и выделение текста не начинается: жест принадлежит канвасу.
      event.preventDefault();
      event.stopPropagation();
    };

    const onClick = (event: MouseEvent): void => {
      if (!event.altKey) return;
      event.preventDefault();
      event.stopPropagation();
      const { session: current, state: snapshot, order: ordering } = latest.current;
      const hit = hitAt(event.target as Element | null, surface);
      // Промах по пустому месту снимает выделение: это ответ «здесь узла нет», а не молчание.
      current.setSelection(
        hit === null ? [] : selectNode(snapshot.selection, hit.id, selectModeOf(event), ordering)
      );
      container.focus({ preventScroll: true });
    };

    const onMove = (event: MouseEvent): void => {
      // Рамка наведения показывается только при зажатом Alt: без него щелчок уйдёт в форму,
      // и обещать выбор было бы враньём.
      if (!event.altKey) {
        setHover(null);
        return;
      }
      setHover(hitAt(event.target as Element | null, surface)?.id ?? null);
    };

    const onLeave = (): void => setHover(null);
    // Прокрутка не всплывает, поэтому слушатель обязан быть в перехвате: прокручивается
    // область ВНУТРИ поверхности, а не наш корень.
    const onScroll = (): void => setHover(null);

    container.addEventListener('mousedown', onDown, true);
    container.addEventListener('click', onClick, true);
    container.addEventListener('mousemove', onMove, true);
    container.addEventListener('mouseleave', onLeave, true);
    container.addEventListener('scroll', onScroll, true);
    return () => {
      container.removeEventListener('mousedown', onDown, true);
      container.removeEventListener('click', onClick, true);
      container.removeEventListener('mousemove', onMove, true);
      container.removeEventListener('mouseleave', onLeave, true);
      container.removeEventListener('scroll', onScroll, true);
      setHover(null);
    };
  }, [selectable, setHover]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const surface = mountPoint.current;
    if (surface === null || !selectable || order.length === 0) return;
    // После кадра: поверхность рисует своим корнем React, и до коммита её DOM ещё пуст.
    const frame = requestAnimationFrame(() => {
      const marked = order.some((id) => elementOf(surface, id) !== null);
      if (marked) return;
      // Сообщаем только про «ни одного», а не про каждый ненайденный: узлы неактивных шагов
      // визарда законно отсутствуют в DOM, и список с ними шумел бы на каждой форме. А вот
      // отсутствие ВСЕХ означает ровно одно — класс-токен до DOM не доехал, потому что
      // компонент кита не пробросил `className` на свой корень. В первой версии билдера
      // этот сторож завели не от хорошей жизни: без него «узел не выделяется» ищут часами.
      console.warn(
        '[editor-schema] живой вид: ни один узел формы не помечен классом-токеном — ' +
          'скорее всего компоненты кита не пробрасывают className на корневой элемент'
      );
    });
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [order, selectable, surfaceId]);

  const active = state.selection.at(-1) ?? null;
  const [offscreen, setOffscreen] = useState(false);

  useEffect(() => {
    const surface = mountPoint.current;
    if (surface === null || active === null) {
      setOffscreen(false);
      return;
    }
    const element = elementOf(surface, active);
    if (element === null) {
      // Узел есть в модели, но не нарисован: он на неактивном шаге визарда или в свёрнутой
      // части формы. Молчать здесь нельзя — человек видит инспектор без подсветки.
      setOffscreen(indexNodes(latest.current.state.model).find(active) !== undefined);
      return;
    }
    setOffscreen(false);
    // `nearest` не двигает уже видимое: выбор в дереве обязан показать узел, но щелчок
    // по самой форме не должен дёргать её под курсором.
    element.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [active, state.model]);

  /** Поставить ручку к активному узлу либо спрятать, если его на экране нет. */
  const syncGrip = useCallback(() => {
    const surface = mountPoint.current;
    const host = hostRect();
    if (surface === null || host === null || active === null || !selectable) {
      overlay.current?.showGrip(null);
      return;
    }
    const element = elementOf(surface, active);
    if (element === null) {
      overlay.current?.showGrip(null);
      return;
    }
    overlay.current?.showGrip({ id: active, box: gripBox(element.getBoundingClientRect(), host) });
  }, [active, hostRect, selectable]);

  useEffect(() => {
    syncGrip();
  }, [syncGrip, state.model]);

  useEffect(() => {
    const container = root.current;
    if (container === null) return;
    // Прокрутка не всплывает — слушаем в перехвате. Ручка обязана ехать вместе с узлом:
    // оставшись на месте, она принялась бы тащить не то, на что показывает.
    const onScroll = (): void => syncGrip();
    container.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      container.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [syncGrip]);

  if (info === null) {
    return (
      <Empty className="flex-1 border-0">
        <EmptyHeader>
          <EmptyTitle className="text-sm font-medium">{t('live.no-surface')}</EmptyTitle>
          <EmptyDescription className="text-xs">{t('live.no-surface.detail')}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div
      ref={root}
      data-rb-live={scope}
      data-focus-zone="canvas"
      tabIndex={0}
      className="flex min-h-0 flex-1 flex-col outline-none"
    >
      {/* Полоса появляется, только когда есть что сказать.

          Здесь стояло постоянное «Нарисовано: {имя поверхности}». Мысль была верной —
          «тихая подмена режима хуже отказа», решение контракта превью, — а исполнение нет:
          в норме подменять нечего, и строка сообщала то, что человек и так выбрал, отнимая
          полосу высоты у формы на каждой вкладке. Отказ же остался виден: если источник
          запретил исполнять код, причина стоит здесь и объясняет, почему валидация молчит. */}
      {info.notice !== null && (
        <div className="border-border border-b bg-amber-50/60 px-3 py-1 text-[11px] text-amber-700 dark:bg-amber-950/20 dark:text-amber-400">
          {info.notice}
        </div>
      )}
      {!selectable && (
        <div className="text-muted-foreground border-border border-b px-3 py-1 text-[11px]">
          {t('live.no-hit-test')}
        </div>
      )}
      {offscreen && (
        <div className="text-muted-foreground border-border border-b px-3 py-1 text-[11px]">
          {t('live.offscreen')}
        </div>
      )}
      <style>{liveCss({ scope, selection: state.selection, hover: null, dragging })}</style>
      {/* Отдельная таблица под наведение: её переписывает мышь, и React о ней не знает. */}
      <style ref={hoverStyle} />
      <div
        className="relative min-h-0 flex-1"
        onDragOver={onDragOver}
        onDrop={onDrop}
        onDragLeave={onDragLeave}
      >
        <div ref={mountPoint} className="h-full" />
        <LiveOverlay
          api={overlay}
          labels={{ row: t('live.axis.row'), column: t('live.axis.column'), grip: t('live.grip') }}
          onGripDragStart={onGripDragStart}
          onGripDragEnd={endDrag}
        />
      </div>
    </div>
  );
}
