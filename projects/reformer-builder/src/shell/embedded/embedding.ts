/**
 * Билдер рядом с приложением: окружение и то, что к нему подключается после сборки.
 *
 * Вход (`main.tsx`) узнаёт от сервера запуска, что рядом есть приложение, и собирает билдер
 * с этим окружением вместо вкладки браузера. Здесь — всё, что из этого следует, одним куском:
 * входу остаётся две строки, а проверяется связка тестом, которого у входа быть не может.
 *
 * ## Где приложение
 *
 * В рамке — страница, поверх которой билдер открыт: адрес читается у неё в момент вопроса,
 * потому что человек ходит по приложению. Вкладкой с того же адреса — корень источника:
 * страницы-хозяина нет, а приложение есть.
 *
 * ## Запись на диск — событие для превью
 *
 * Превью рисует само приложение, и узнаёт оно о правке, только когда файл лёг на диск. Поэтому
 * за сохранениями рабочей области открытого проекта следят здесь и сообщают о них панели
 * превью (`AppPreviewService.onDidWriteSource`): та перезагружает рамку.
 *
 * @module shell/embedded/embedding
 */

import { toDisposable, type Disposable } from '@reformer/builder-plugin-api/internal';
import type { BuilderApp } from '@/shell/boot/boot';
import type { ShellEnvironment } from '@/shell/boot/environment';
import { createEmbeddedEnvironment } from './environment';
import {
  createAppPreviewService,
  createSourceWriteSignal,
  type PageLocation,
  type SourceWriteSignal,
} from './preview-address';

/** Окно билдера в объёме, который нужен, чтобы найти приложение. */
export interface EmbeddingWindow {
  readonly location: PageLocation;
  /** Окно, в рамке которого открыт документ; у вкладки — оно само. */
  readonly parent: EmbeddingWindow;
}

export interface Embedding {
  readonly environment: ShellEnvironment;
  /**
   * Начинает сообщать превью о сохранениях открытого проекта. Зовётся после сборки: проекта
   * до неё нет.
   */
  attach(app: Pick<BuilderApp, 'project'>): Disposable;
}

/** Адрес приложения, рядом с которым открыт билдер, — в момент вопроса. */
export function appLocationOf(win: EmbeddingWindow): () => PageLocation {
  return () => {
    if (win.parent !== win) {
      try {
        const { origin, pathname, search, hash } = win.parent.location;
        return { origin, pathname, search, hash };
      } catch {
        // Рамку держит страница другого источника: её адрес недоступен, и она не приложение.
      }
    }
    return { origin: win.location.origin, pathname: '/', search: '', hash: '' };
  };
}

/**
 * Следит за сохранениями открытого проекта. Подписка переезжает вместе с проектом: рабочая
 * область у каждого своя, а открыть и закрыть проект можно сколько угодно раз.
 */
export function followProjectSaves(
  app: Pick<BuilderApp, 'project'>,
  writes: Pick<SourceWriteSignal, 'emit'>
): Disposable {
  let saves: Disposable | null = null;
  const followProject = (): void => {
    saves?.dispose();
    const session = app.project.get();
    saves =
      session === null
        ? null
        : session.workspace.onDidChange((event) => {
            if (event.changes.some((change) => change.type === 'saved')) writes.emit();
          });
  };
  const projects = app.project.subscribe(followProject);
  followProject();
  return toDisposable(() => {
    projects.dispose();
    saves?.dispose();
    saves = null;
  });
}

export function createEmbedding(win: EmbeddingWindow): Embedding {
  const sourceWrites = createSourceWriteSignal();
  return {
    environment: createEmbeddedEnvironment({
      appPreview: createAppPreviewService(appLocationOf(win), sourceWrites),
    }),
    attach: (app) => followProjectSaves(app, sourceWrites),
  };
}
