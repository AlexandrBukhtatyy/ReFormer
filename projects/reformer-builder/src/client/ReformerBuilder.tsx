/**
 * Компонент, которым билдер встраивается в приложение: стоит в его корне и в зависимости от
 * того, ГДЕ открыт документ, рисует одно из трёх.
 *
 * ```text
 * обычная страница             приложение и кнопку «Билдер»; по кнопке — рамка с билдером
 * рамка превью                 только приложение — кнопки билдера внутри собственного превью нет
 * рамка превью, адрес стенда   одну форму вместо приложения (`./FormStand`)
 * ```
 *
 * ## Клиент лёгкий, билдер — отдельный документ
 *
 * Здесь нет ни оболочки, ни плагинов, ни стилей билдера: приложение платит за компонент
 * кнопкой и парой сотен строк. Сам билдер приложение не компилирует вовсе — его отдаёт
 * dev-сервер приложения (плагин `@reformer/builder/vite`), а открывается он в рамке
 * (`./shell-frame`). Поэтому клиент импортирует только React и собирается любыми настройками.
 *
 * ## Оборачивает приложение ВНУТРИ его провайдеров
 *
 * Форму на стенде рисует это же приложение, и провайдеры ей нужны те же.
 *
 * ## Приложение под рамкой остаётся на месте
 *
 * Билдер открыт поверх страницы, а не вместо неё: приложение не размонтируется и не скрывается.
 * Закрыв билдер, человек возвращается на ту же страницу в том же состоянии.
 *
 * @module client/ReformerBuilder
 */

import {
  useEffect,
  useMemo,
  useSyncExternalStore,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from 'react';
import { isPreviewFrame, isShellFrame, moduleUrlOf, standRequest } from './addresses';
import { FormStand, type FormModuleLoader } from './FormStand';
import { hostBridge } from './host-bridge';
import { browserModeStorage, createModeStore, type ModeStore } from './mode';
import { holdReloads } from './reload-hold';
import { pageShellFrame, type ShellFrame } from './shell-frame';

export interface ReformerBuilderProps {
  /** Приложение. */
  readonly children?: ReactNode;
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
  /**
   * Включён ли билдер. По умолчанию — когда к dev-серверу приложения подключён плагин
   * билдера: в прод-сборке и без плагина компонент рисует одно приложение.
   */
  readonly enabled?: boolean;
  /** Подписи кнопки и сообщений. */
  readonly labels?: Partial<ReformerBuilderLabels>;
}

export interface ReformerBuilderLabels {
  readonly open: string;
  readonly close: string;
  readonly loading: string;
  /** Билдер включён, а dev-сервер его не отдаёт. */
  readonly missing: string;
}

const DEFAULT_LABELS: ReformerBuilderLabels = {
  open: 'Билдер',
  close: 'Закрыть билдер',
  loading: 'Загружаю билдер…',
  missing:
    'Билдер не подключён к dev-серверу приложения. Добавьте плагин reformerBuilder() ' +
    'из «@reformer/builder/vite» в конфиг сборки.',
};

/** Один режим на страницу: кнопка и рамка обязаны видеть одно и то же. */
const pageMode = createModeStore(browserModeStorage());

const NOTICE_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 24,
  textAlign: 'center',
  font: '13px/1.5 system-ui, sans-serif',
  color: '#3f3f46',
  background: '#fafafa',
};
// Над рамкой билдера (см. `./shell-frame`) и под кнопкой: пока документ билдера не загрузился,
// рамка пуста.
const LOADING_STYLE: CSSProperties = {
  ...NOTICE_STYLE,
  position: 'fixed',
  inset: 0,
  zIndex: 2147483646,
};
const MISSING_STYLE: CSSProperties = { ...NOTICE_STYLE, minHeight: '100vh' };
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

interface HostProps {
  readonly children?: ReactNode;
  readonly labels: ReformerBuilderLabels;
  readonly mode: ModeStore;
  readonly frame: ShellFrame;
}

/** Обычная страница приложения: приложение, кнопка и — по кнопке — рамка с билдером. */
function BuilderHost({ children, labels, mode, frame }: HostProps): ReactElement {
  const on = useSyncExternalStore(mode.subscribe, mode.get, mode.get);
  const loaded = useSyncExternalStore(frame.subscribe, frame.loaded, frame.loaded);

  useEffect(() => {
    if (!on) return undefined;
    // Пока билдер открыт, перезагрузки страницы от dev-сервера откладываются до закрытия:
    // вместе со страницей ушла бы и рамка.
    const release = holdReloads();
    frame.show();
    return () => {
      frame.hide();
      release();
    };
  }, [on, frame]);

  return (
    <>
      {children}
      {on && !loaded ? (
        <div role="status" data-reformer-builder="loading" style={LOADING_STYLE}>
          {labels.loading}
        </div>
      ) : null}
      <button
        type="button"
        data-reformer-builder="toggle"
        aria-pressed={on}
        style={on ? BUTTON_OPEN : BUTTON_CLOSED}
        onClick={() => {
          mode.set(!on);
        }}
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

export interface ReformerBuilderViewProps extends ReformerBuilderProps {
  /** Хранилище режима. По умолчанию — одно на страницу; параметр ради тестов. */
  readonly mode?: ModeStore;
  /** Рамка билдера. По умолчанию — одна на страницу; параметр ради тестов. */
  readonly frame?: ShellFrame;
}

/** Компонент с точками подмены для тестов. Приложению — {@link ReformerBuilder}. */
export function ReformerBuilderView(props: ReformerBuilderViewProps): ReactElement {
  // Без окна (серверная отрисовка) билдера нет: остаётся приложение как оно есть.
  if (typeof window === 'undefined') return <>{props.children}</>;
  const enabled = props.enabled ?? hostBridge() !== undefined;
  if (!enabled) return <>{props.children}</>;

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

  const labels = { ...DEFAULT_LABELS, ...props.labels };
  // В рамке билдера оказалось приложение: по адресу билдера сервер отдал его страницу, то есть
  // плагин не подключён. Открывать отсюда ещё одну рамку нельзя — она открыла бы следующую.
  if (isShellFrame(window)) {
    return (
      <div role="status" data-reformer-builder="missing" style={MISSING_STYLE}>
        {labels.missing}
      </div>
    );
  }

  return (
    <BuilderHost
      labels={labels}
      mode={props.mode ?? pageMode}
      frame={props.frame ?? pageShellFrame()}
    >
      {props.children}
    </BuilderHost>
  );
}

export function ReformerBuilder(props: ReformerBuilderProps): ReactElement {
  return <ReformerBuilderView {...props} />;
}
