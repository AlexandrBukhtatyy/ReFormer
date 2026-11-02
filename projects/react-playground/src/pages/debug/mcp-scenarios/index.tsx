/**
 * Формы стенда сценариев MCP: каждая папка `<слот>/` — модуль формы, созданный агентом или собранный
 * из эталона, и страница `Page.tsx` вокруг него (`packages/reformer-mcp/eval/verify/browser.mjs`).
 *
 * Страницы находятся сами и грузятся лениво: сломанный модуль — обычный исход прогона, и его ошибка
 * обязана остаться на его странице, а не уронить приложение.
 */

import { Component, lazy, Suspense, type ComponentType, type ReactNode } from 'react';

const pages = import.meta.glob<{ default: ComponentType }>('./*/Page.tsx');

class ScenarioBoundary extends Component<{ children: ReactNode }, { message: string | null }> {
  state = { message: null };

  static getDerivedStateFromError(error: unknown) {
    return { message: error instanceof Error ? error.message : String(error) };
  }

  render() {
    return this.state.message === null ? (
      this.props.children
    ) : (
      <p data-testid="scenario-error">{this.state.message}</p>
    );
  }
}

export interface ScenarioRoute {
  readonly id: string;
  readonly path: string;
  readonly Component: ComponentType;
}

export const scenarioRoutes: ScenarioRoute[] = Object.entries(pages).map(([file, load]) => {
  const id = file.split('/')[1];
  const Page = lazy(load);
  return {
    id,
    path: `/mcp-scenarios/${id}`,
    Component: () => (
      <ScenarioBoundary>
        <Suspense fallback={<p>Загрузка формы сценария…</p>}>
          <Page />
        </Suspense>
      </ScenarioBoundary>
    ),
  };
});
