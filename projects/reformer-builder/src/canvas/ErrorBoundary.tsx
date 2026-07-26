/**
 * Error boundary для Runtime-preview: битая схема (неизвестный оператор, падение конвертера)
 * показывает fallback вместо краха всего билдера (спека §14: «битая схема не убивает приложение»).
 * Сбрасывается при смене `resetKey` (новая схема).
 *
 * @module reformer-builder/canvas/ErrorBoundary
 */

import { Component, type ReactNode } from 'react';

interface Props {
  resetKey: unknown;
  children: ReactNode;
}
interface State {
  error: Error | null;
}

export class PreviewErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidUpdate(prev: Props): void {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          <div className="font-medium">Не удалось отрендерить форму</div>
          <div className="mt-1 font-mono text-xs opacity-80">{this.state.error.message}</div>
        </div>
      );
    }
    return this.props.children;
  }
}
