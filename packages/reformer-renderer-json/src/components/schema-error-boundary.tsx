/**
 * SchemaErrorBoundary — ловит ошибки конвертации/рендера JSON-схемы и рисует {@link SchemaErrorPanel}
 * вместо падения поддерева (§8).
 *
 * Зачем: невалидную схему `convertNodeM1`/`resolveComponent` бросает на этапе РЕНДЕРА (`render()` в
 * `FormRenderer`), а не в useMemo. При выключенном `validateSchema` (обычно prod) это раньше роняло
 * поддерево — пользователь видел белый экран вместо панели ошибок. Error boundary (только классовый
 * компонент умеет ловить render-ошибки) переводит это в ту же панель, что и `validateSchema`.
 *
 * @module reformer/renderer-json/components
 */

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { SchemaErrorPanel } from './schema-error-panel';

/** Props of {@link SchemaErrorBoundary}. */
export interface SchemaErrorBoundaryProps {
  /** Поддерево рендера формы (обычно `<FormRenderer />`). */
  children: ReactNode;
  /**
   * Ключ сброса: при изменении (новая схема/модель → новый `schemaProxy`) boundary забывает прошлую
   * ошибку и пробует отрисовать заново. Иначе React держит error-состояние до размонтирования.
   */
  resetKey?: unknown;
  /**
   * Своя отрисовка ошибки вместо {@link SchemaErrorPanel}.
   *
   * Нужна потребителям, которые монтируют форму по данным извне (реестр форм, схема из сети):
   * там уместнее показать доменную панель с кнопкой повтора и идентификатором формы, чем
   * техническую подсказку про мета-схему.
   */
  fallback?: (error: Error) => ReactNode;
}

interface SchemaErrorBoundaryState {
  error: Error | null;
}

export class SchemaErrorBoundary extends Component<
  SchemaErrorBoundaryProps,
  SchemaErrorBoundaryState
> {
  state: SchemaErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): SchemaErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    if (typeof console !== 'undefined') {
      console.error(
        '[JsonFormRenderer] schema conversion/render failed:',
        error,
        info.componentStack
      );
    }
  }

  componentDidUpdate(prev: SchemaErrorBoundaryProps): void {
    // Новая попытка (сменился resetKey) — сбрасываем ошибку, чтобы отрисовать свежую схему.
    if (this.state.error && prev.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  render(): ReactNode {
    const { error } = this.state;
    if (error) {
      return (
        this.props.fallback?.(error) ?? (
          <SchemaErrorPanel errors={[`Schema conversion/render failed: ${error.message}`]} />
        )
      );
    }
    return this.props.children;
  }
}
