/**
 * Компонент, которым билдер встраивается в приложение: стоит в его корне и в зависимости от
 * того, ГДЕ открыт документ, рисует одно из четырёх.
 *
 * ```text
 * обычная страница             приложение и кнопку «Билдер»
 * режим включён                оверлей с билдером; приложение скрыто, но не размонтировано
 * рамка превью                 только приложение — кнопки билдера внутри собственного превью нет
 * рамка превью, адрес стенда   одну форму вместо приложения (`./FormStand`)
 * ```
 *
 * ## Модуль лёгкий, билдер — тяжёлый
 *
 * Здесь нет ни сборки, ни оболочки, ни плагинов: приложение платит за этот компонент кнопкой
 * и сотней строк, пока билдер не включён. Всё остальное приезжает отдельным чанком по первому
 * включению режима — загрузчик приходит параметром от входа библиотеки, потому что оболочке
 * нельзя знать состав приложения, а тяжёлая часть его знает.
 *
 * ## Билдер рисуется в СВОЙ корень React
 *
 * Оверлей — элемент в дереве приложения, а интерфейс билдера внутри него смонтирован отдельным
 * корнем. Так провайдеры, `StrictMode` и границы ошибок приложения не действуют на билдер,
 * а его сбой не роняет приложение. Экземпляр React при этом общий.
 *
 * ## Приложение под оверлеем скрыто, а не снято
 *
 * Закрыв билдер, человек возвращается на ту же страницу в том же состоянии. Скрывает его
 * `Activity` (React 19.2): без обёртки в DOM и с остановленными эффектами. В React постарше
 * её нет — тогда приложение размонтируется на время режима; хуже, но работает.
 *
 * @module shell/embedded/ReformerBuilderFrame
 */

import * as React from 'react';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ComponentType,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from 'react';
import { FormStand, type FormModuleLoader } from './FormStand';
import { browserModeStorage, createModeStore, type ModeStore } from './mode';
import { isPreviewFrame, moduleUrlOf, standRequest } from './preview-address';
import { holdReloads } from './reload-hold';

/** Запущенный билдер — в объёме, который нужен лёгкой части. */
export interface EmbeddedRuntime {
  /** Рисует интерфейс билдера в элемент оверлея. Возвращает «снять». */
  mount(container: HTMLElement): () => void;
}

/** Что лёгкая часть сообщает тяжёлой при запуске. */
export interface EmbeddedRuntimeRequest {
  readonly pluginsUrl: string;
}

/** Загрузка и запуск тяжёлой части. Зовётся один раз за жизнь страницы. */
export type EmbeddedRuntimeLoader = (request: EmbeddedRuntimeRequest) => Promise<EmbeddedRuntime>;

export interface ReformerBuilderProps {
  /** Приложение. */
  readonly children?: ReactNode;
  /** Адрес каталога плагинов билдера — того, в котором лежит их индекс. */
  readonly pluginsUrl: string;
  /**
   * Префикс адреса, под которым dev-сервер отдаёт папку, открытую в билдере как проект.
   * По умолчанию `/`: открыт корень dev-сервера.
   */
  readonly projectBase?: string;
  /**
   * Своя загрузка модуля формы по пути от корня проекта — для сборщиков, которые не отдают
   * исходники по адресу. По умолчанию модуль грузится с dev-сервера по его адресу.
   */
  readonly loadForm?: FormModuleLoader;
  /** Включён ли билдер вообще. По умолчанию — везде, кроме прод-сборки. */
  readonly enabled?: boolean;
  /** Подписи кнопки и оверлея. */
  readonly labels?: Partial<ReformerBuilderLabels>;
}

export interface ReformerBuilderLabels {
  readonly open: string;
  readonly close: string;
  readonly loading: string;
  readonly failed: string;
}

const DEFAULT_LABELS: ReformerBuilderLabels = {
  open: 'Билдер',
  close: 'Закрыть билдер',
  loading: 'Загружаю билдер…',
  failed: 'Билдер не запустился. Подробности — в консоли.',
};

/** Один режим на страницу: кнопка и оверлей обязаны видеть одно и то же. */
const pageMode = createModeStore(browserModeStorage());

/**
 * Запущенный билдер — один на страницу, что бы ни происходило с модулями.
 *
 * На глобальном объекте, а не в переменной модуля: dev-сервер перезагружает модуль при правке,
 * и новая копия модуля завела бы вторую сборку поверх тех же баз.
 */
const RUNTIME_KEY = Symbol.for('reformer.builder.embedded-runtime');

function obtainRuntime(
  load: EmbeddedRuntimeLoader,
  request: EmbeddedRuntimeRequest
): Promise<EmbeddedRuntime> {
  const registry = globalThis as { [RUNTIME_KEY]?: Promise<EmbeddedRuntime> };
  let running = registry[RUNTIME_KEY];
  if (running === undefined) {
    running = load(request);
    registry[RUNTIME_KEY] = running;
    // Отказ не запоминается: следующее включение режима попробует ещё раз.
    running.catch(() => {
      if (registry[RUNTIME_KEY] === running) delete registry[RUNTIME_KEY];
    });
  }
  return running;
}

/** `Activity` появилась в React 19.2; в версиях постарше её нет, и это не отказ. */
const Activity = (
  React as {
    readonly Activity?: ComponentType<{
      readonly mode: 'visible' | 'hidden';
      readonly children?: ReactNode;
    }>;
  }
).Activity;

// Оверлей — поверх страницы, но НИЖЕ диалогов и меню билдера: они уходят порталом в `body`
// со своим порядком наложения, и оверлей над ними спрятал бы их.
const OVERLAY_STYLE: CSSProperties = { position: 'fixed', inset: 0, zIndex: 40 };
const HOST_STYLE: CSSProperties = { position: 'absolute', inset: 0 };
const NOTICE_STYLE: CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  font: '13px/1.5 system-ui, sans-serif',
  color: '#3f3f46',
  background: '#fafafa',
};
const BUTTON_STYLE: CSSProperties = {
  position: 'fixed',
  zIndex: 2147483647,
  padding: '4px 10px',
  border: '1px solid #a1a1aa',
  borderRadius: 6,
  font: '12px/1.4 system-ui, sans-serif',
  color: '#18181b',
  background: '#fafafa',
  boxShadow: '0 1px 4px rgb(0 0 0 / 0.2)',
  cursor: 'pointer',
};
// Закрытый билдер — в углу страницы; открытый — в шапке билдера, где кнопка не закрывает
// строку состояния.
const BUTTON_CLOSED: CSSProperties = { ...BUTTON_STYLE, right: 12, bottom: 12 };
const BUTTON_OPEN: CSSProperties = { ...BUTTON_STYLE, right: 8, top: 6 };

type Phase = 'loading' | 'ready' | 'failed';

interface HostProps {
  readonly children?: ReactNode;
  readonly pluginsUrl: string;
  readonly labels: ReformerBuilderLabels;
  readonly loadRuntime: EmbeddedRuntimeLoader;
  readonly mode: ModeStore;
}

/** Обычная страница приложения: приложение, кнопка и — по кнопке — оверлей с билдером. */
function BuilderHost({ children, pluginsUrl, labels, loadRuntime, mode }: HostProps): ReactElement {
  const on = useSyncExternalStore(mode.subscribe, mode.get, mode.get);
  const [phase, setPhase] = useState<Phase>('loading');
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!on || host === null) return undefined;
    let cancelled = false;
    let unmount: (() => void) | null = null;
    // Пока билдер открыт, перезагрузки страницы от dev-сервера откладываются до закрытия.
    const release = holdReloads();
    obtainRuntime(loadRuntime, { pluginsUrl }).then(
      (runtime) => {
        if (cancelled) return;
        unmount = runtime.mount(host);
        setPhase('ready');
      },
      (error: unknown) => {
        console.error('[reformer-builder] билдер не запустился', error);
        if (!cancelled) setPhase('failed');
      }
    );
    return () => {
      cancelled = true;
      unmount?.();
      release();
    };
  }, [on, loadRuntime, pluginsUrl]);

  const toggle = (): void => {
    // Сбрасывается здесь, а не в эффекте: неудачный запуск обязан дать вторую попытку.
    if (!on) setPhase('loading');
    mode.set(!on);
  };

  return (
    <>
      {Activity === undefined ? (
        on ? null : (
          children
        )
      ) : (
        <Activity mode={on ? 'hidden' : 'visible'}>{children}</Activity>
      )}
      {on ? (
        <div data-reformer-builder="overlay" style={OVERLAY_STYLE}>
          {phase === 'ready' ? null : (
            <div role="status" style={NOTICE_STYLE}>
              {phase === 'loading' ? labels.loading : labels.failed}
            </div>
          )}
          {/* Пустой для React приложения: его содержимым владеет корень билдера. */}
          <div ref={hostRef} style={HOST_STYLE} />
        </div>
      ) : null}
      <button
        type="button"
        data-reformer-builder="toggle"
        aria-pressed={on}
        style={on ? BUTTON_OPEN : BUTTON_CLOSED}
        onClick={toggle}
      >
        {on ? labels.close : labels.open}
      </button>
    </>
  );
}

interface StandHostProps {
  readonly modulePath: string;
  readonly projectBase: string;
  readonly loadForm: FormModuleLoader | undefined;
}

/** Рамка превью с адресом стенда: одна форма вместо приложения. */
function StandHost({ modulePath, projectBase, loadForm }: StandHostProps): ReactElement {
  const load = useMemo<FormModuleLoader>(
    () =>
      loadForm ??
      ((path) => {
        const url = moduleUrlOf(window.location.origin, projectBase, path);
        if (url === null) {
          return Promise.reject(new Error('Путь модуля уводит за пределы проекта.'));
        }
        return import(/* @vite-ignore */ url);
      }),
    [loadForm, projectBase]
  );
  return <FormStand modulePath={modulePath} load={load} />;
}

export interface ReformerBuilderFrameProps extends ReformerBuilderProps {
  /** Загрузка тяжёлой части. Приходит от входа библиотеки. */
  readonly loadRuntime: EmbeddedRuntimeLoader;
  /** Хранилище режима. По умолчанию — одно на страницу; параметр ради тестов. */
  readonly mode?: ModeStore;
}

export function ReformerBuilderFrame(props: ReformerBuilderFrameProps): ReactElement {
  const enabled = props.enabled ?? process.env.NODE_ENV !== 'production';
  // Без окна (серверная отрисовка) и вне dev билдера нет: остаётся приложение как оно есть.
  if (!enabled || typeof window === 'undefined') return <>{props.children}</>;

  if (isPreviewFrame(window)) {
    const modulePath = standRequest(window.location.search);
    if (modulePath === null) return <>{props.children}</>;
    return (
      <StandHost
        modulePath={modulePath}
        projectBase={props.projectBase ?? '/'}
        loadForm={props.loadForm}
      />
    );
  }

  return (
    <BuilderHost
      pluginsUrl={props.pluginsUrl}
      labels={{ ...DEFAULT_LABELS, ...props.labels }}
      loadRuntime={props.loadRuntime}
      mode={props.mode ?? pageMode}
    >
      {props.children}
    </BuilderHost>
  );
}
