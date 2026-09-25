/**
 * Рамка активного кита — окружение, в котором стек рисует форму компонентами кита.
 *
 * Два дела, и оба — утверждения кита о себе, а не знание стека:
 *
 * - **скоуп стилей владельца.** Стили кита, внесённого плагином, оболочка подключает только
 *   внутри `[data-rb-plugin="<плагин>"]` (изоляция `scoped`), чтобы тема дизайн-системы не
 *   перекрасила интерфейс билдера. Форма из компонентов такого кита обязана лежать внутри этого
 *   скоупа — иначе она нарисована без собственных стилей;
 * - **провайдер кита** (`kit.adapters.provider`): тема styled-components, словарь, конфиг
 *   портала — без него компоненты такого кита рисуются неправильно.
 *
 * ## Встроенный кит DOM не меняет
 *
 * Скоуп ему не нужен (его стили — стили оболочки), провайдера у него нет. Лишний элемент между
 * контейнером превью и формой ломал бы селекторы «прямой потомок» — поэтому рамка встроенного
 * кита рисует детей как есть.
 *
 * ## Компонент стабилен
 *
 * Рамка создаётся один раз на службу и сама подписана на смену кита. Новый компонент на каждое
 * переключение означал бы размонтирование формы — с потерей введённых значений.
 *
 * @module plugins/kits/registry/frame
 */

import { Component, type ComponentType, type ReactNode, useSyncExternalStore } from 'react';
import {
  pluginScopeAttributes,
  type KitFrameProps,
  type KitsService,
} from '@reformer/builder-plugin-api';

/** Чем служба нужна рамке. */
export type KitFrameSource = Pick<
  KitsService,
  'activeId' | 'activeOrigin' | 'descriptor' | 'namespace' | 'onDidChange' | 'onDidLoadNamespace'
>;

/** Похоже ли значение на React-компонент: функция, класс или объект `memo`/`forwardRef`. */
function isComponentLike(value: unknown): value is ComponentType<{ children?: ReactNode }> {
  return (
    typeof value === 'function' ||
    (typeof value === 'object' && value !== null && '$$typeof' in value)
  );
}

interface ProviderBoundaryProps {
  readonly kitId: string;
  /** Те же дети, но без провайдера, — на случай, если упал он. */
  readonly bare: ReactNode;
  readonly children: ReactNode;
}

/**
 * Упавший провайдер кита не должен уносить форму: без темы она выглядит хуже, но остаётся
 * формой. Ошибка самой формы, повторившаяся уже без провайдера, уходит выше — у поверхности
 * превью своя граница и свой отчёт.
 */
class ProviderBoundary extends Component<ProviderBoundaryProps, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  componentDidCatch(error: unknown): void {
    console.error(
      `[kits] провайдер кита «${this.props.kitId}» упал — форма рисуется без него`,
      error
    );
  }

  render(): ReactNode {
    return this.state.failed ? this.props.bare : this.props.children;
  }
}

/** Собирает рамку службы. Зовётся один раз — компонент обязан быть стабилен. */
export function createKitFrame(kits: KitFrameSource): ComponentType<KitFrameProps> {
  // Версия состояния, которое видит рамка: смена кита и приезд пространства имён. Число,
  // а не объект, — снимок `useSyncExternalStore` обязан быть стабилен между событиями.
  let version = 0;
  const subscribe = (cb: () => void): (() => void) => {
    const bump = (): void => {
      version += 1;
      cb();
    };
    const onKit = kits.onDidChange(bump);
    const onNamespace = kits.onDidLoadNamespace(bump);
    return () => {
      onKit.dispose();
      onNamespace.dispose();
    };
  };
  const snapshot = (): number => version;

  function KitFrame({ children }: KitFrameProps): ReactNode {
    useSyncExternalStore(subscribe, snapshot, snapshot);
    const id = kits.activeId();
    const origin = kits.activeOrigin();
    const symbol = kits.descriptor().adapters.provider?.symbol;
    const candidate = symbol === undefined ? undefined : kits.namespace()?.[symbol];
    const Provider = isComponentLike(candidate) ? candidate : undefined;

    const content =
      Provider === undefined ? (
        children
      ) : (
        <ProviderBoundary key={id} kitId={id} bare={children}>
          <Provider>{children}</Provider>
        </ProviderBoundary>
      );

    if (origin.kind === 'builtin' && Provider === undefined) return <>{content}</>;
    return (
      <div
        {...(origin.kind === 'plugin' ? pluginScopeAttributes(origin.pluginId) : {})}
        data-rb-kit={id}
        style={{ display: 'contents' }}
      >
        {content}
      </div>
    );
  }
  KitFrame.displayName = 'KitFrame';
  return KitFrame;
}
