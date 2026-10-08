/**
 * Стенд формы: приложение рисует ОДИН компонент — форму — вместо себя целиком.
 *
 * Показывается в рамке превью билдера по адресу с параметром стенда. Это настоящий код
 * приложения: модуль формы грузит его dev-сервер, реестр, API и провайдеры у формы свои —
 * стенд стоит внутри тех же провайдеров, что и приложение. Билдер о форме знает только путь
 * модуля; что в нём, решает приложение.
 *
 * ## Соглашение одно: компонент по умолчанию
 *
 * Модуль формы — `index.tsx` её каталога, и компонент формы в нём экспортирован по умолчанию.
 * Так печатает модуль формы кодоген билдера. Модуль без такого экспорта стенд не угадывает,
 * а называет причину.
 *
 * ## Стили — свои, строкой
 *
 * Стенд живёт в документе приложения, где стилей билдера нет и быть не должно. Сообщения
 * стенда оформлены встроенными стилями: его видят, только когда форму показать нечем.
 *
 * @module shell/embedded/FormStand
 */

import {
  Component,
  useEffect,
  useState,
  type ComponentType,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from 'react';

/** Загрузка модуля формы по пути от корня проекта. */
export type FormModuleLoader = (modulePath: string) => Promise<unknown>;

export interface FormStandProps {
  /** Путь модуля формы от корня открытого проекта. */
  readonly modulePath: string;
  readonly load: FormModuleLoader;
}

type StandState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly Form: ComponentType }
  | { readonly kind: 'failed'; readonly reason: string };

const NOTICE_STYLE: CSSProperties = {
  margin: 16,
  padding: 12,
  border: '1px solid #d4d4d8',
  borderRadius: 6,
  font: '13px/1.5 system-ui, sans-serif',
  color: '#3f3f46',
  background: '#fafafa',
  whiteSpace: 'pre-wrap',
};

/** Компонент формы из модуля либо `null`, если по умолчанию экспортирован не компонент. */
function defaultComponentOf(module: unknown): ComponentType | null {
  if (typeof module !== 'object' || module === null) return null;
  const exported = (module as { readonly default?: unknown }).default;
  // Функция либо объект с `$$typeof` (memo, forwardRef, lazy) — та же структурная проверка,
  // что у превью билдера: тащить сюда проверку React ради одного вопроса незачем.
  const isComponent =
    typeof exported === 'function' ||
    (typeof exported === 'object' && exported !== null && '$$typeof' in exported);
  return isComponent ? (exported as ComponentType) : null;
}

const describe = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

function StandNotice({ title, detail }: { title: string; detail?: string }): ReactElement {
  return (
    <div role="status" data-reformer-builder-stand="notice" style={NOTICE_STYLE}>
      <strong>{title}</strong>
      {detail === undefined ? null : `\n${detail}`}
    </div>
  );
}

/** Граница ошибок: упавшая форма не должна оставлять рамку превью пустой. */
class StandBoundary extends Component<
  { readonly modulePath: string; readonly children: ReactNode },
  { readonly error: unknown }
> {
  state: { readonly error: unknown } = { error: null };

  static getDerivedStateFromError(error: unknown): { readonly error: unknown } {
    return { error };
  }

  render(): ReactNode {
    if (this.state.error === null) return this.props.children;
    return (
      <StandNotice
        title={`Форма «${this.props.modulePath}» упала при отрисовке`}
        detail={describe(this.state.error)}
      />
    );
  }
}

export function FormStand({ modulePath, load }: FormStandProps): ReactElement {
  const [state, setState] = useState<StandState>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    load(modulePath).then(
      (module) => {
        if (cancelled) return;
        const Form = defaultComponentOf(module);
        setState(
          Form === null
            ? {
                kind: 'failed',
                reason:
                  'В модуле нет компонента по умолчанию. Стенд рисует то, что модуль формы ' +
                  'экспортирует как default.',
              }
            : { kind: 'ready', Form }
        );
      },
      (error: unknown) => {
        if (!cancelled) setState({ kind: 'failed', reason: describe(error) });
      }
    );
    return () => {
      cancelled = true;
    };
  }, [modulePath, load]);

  if (state.kind === 'loading') return <StandNotice title={`Загружаю «${modulePath}»…`} />;
  if (state.kind === 'failed') {
    return <StandNotice title={`Форму «${modulePath}» показать нечем`} detail={state.reason} />;
  }
  const { Form } = state;
  return (
    <StandBoundary modulePath={modulePath}>
      <div data-reformer-builder-stand="form">
        <Form />
      </div>
    </StandBoundary>
  );
}
