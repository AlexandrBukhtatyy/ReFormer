/**
 * Плагин превью: точка расширения поверхностей и две реализации.
 *
 * **Почему это плагин, а не часть Host.** Всё содержимое каталога — предметное знание: что такое
 * схема формы, какие файлы её составляют, чем рисуется `$component(...)`, что считать точкой
 * входа. В платформе оно означало бы, что второй вид превью вносится правкой ядра. Граница
 * проверяется линтером: `src/plugins/**` не видит `@/shell/*` — только `@/sdk` и `@/lib`.
 *
 * ## Своего интерфейса у плагина нет
 *
 * Панель превью с переключателем поверхностей отсюда убрана, и это не упрощение, а следствие:
 * форма стала ПРЕДСТАВЛЕНИЕМ редактора схемы (см. `plugins/editor-schema/ui/LiveView`), а панель
 * показывала ровно её же — только в полосе внизу и в другом масштабе. Две одинаковые картинки
 * на одном экране стоили двух сборок формы и заставляли выбирать, на какую смотреть.
 *
 * Вместе с панелью ушёл и переключатель: поверхность выбирается правилом по объявленным
 * возможностям (`./selection`), а живой вид называет выбранную и объясняет отказ источника.
 * Ручной выбор существовал ради вопроса «а как оно без моего кода», и это отладочная нужда,
 * а не рабочая, — вернуть её можно командой, не заводя полосу.
 *
 * Плагин остался поставщиком поверхностей, и точка расширения открыта по-прежнему: чужая
 * поверхность вносится вкладом и участвует в выборе наравне со встроенными.
 *
 * @module plugins/preview/plugin
 */

import { createElement } from 'react';
import {
  definePlugin,
  DiagnosticsServiceToken,
  PanelPoint,
  SelectionServiceToken,
  type Plugin,
  type SlotId,
  type WhenContext,
} from '@/sdk';
import { createCompilingSurface } from './compiling/surface';
import type { ExtensionPointRef, PreviewSurface } from './contract';
import { PreviewSurfacePoint } from './contract';
import type { MessageSink, PreviewHost } from './host';
import { PREVIEW_MESSAGES } from './messages';
import { createRuntimeSurface } from './runtime/surface';
import { createPreviewSessions, type PreviewSessions } from './state/sessions';
import { ModelPanel, MODEL_PANEL_ID } from './ui/ModelPanel';

/** Идентификатор плагина: пространство имён во всех реестрах и в словаре. */
export const PREVIEW_PLUGIN_ID = 'preview';

/**
 * Встроенные поверхности в порядке возрастания способностей.
 *
 * Каркасной среди них больше нет: она рисовала структуру формы рамками, а структуру уже
 * показывают дерево и схема — два вида того же конструктора, и оба умеют её ПРАВИТЬ, а не только
 * показывать. Третье представление той же структуры отвечало на вопрос, на который уже есть
 * два лучших ответа.
 */
export function builtinSurfaces(host: PreviewHost): readonly PreviewSurface[] {
  return [createRuntimeSurface(host), createCompilingSurface(host)];
}

export interface PreviewPluginOptions {
  readonly host: PreviewHost;
  /**
   * Точка расширения поверхностей.
   *
   * Параметром, а не импортом из `./contract` прямо в `activate`: вклад обязан уходить в ТОТ
   * объект, который дала композиция, — иначе, когда точка переедет в `@/sdk`, чужие поверхности
   * окажутся в одной точке, а наши в другой. Умолчание — наша же копия, чтобы плагин работал
   * и до переезда.
   */
  readonly surfacePoint?: ExtensionPointRef<PreviewSurface>;
  /** Приёмник словаря. Без него строки показываются маркерами промаха — см. `./messages`. */
  readonly i18n?: MessageSink;
  /**
   * Реестр состояний.
   *
   * Создаётся композицией: состояние документа делят плагин превью и живой вид редактора схемы,
   * и общий реестр — то, из-за чего находки сборки и введённые в форму значения у них ОДНИ.
   * Тот же приём и та же причина, что у реестров Monaco, делимых на троих.
   */
  readonly sessions?: PreviewSessions;
}

/**
 * Собирает плагин.
 *
 * `activate` только регистрирует: реестр состояний создаётся пустым, состояние документа
 * рождается при первом обращении. Словарь регистрируется здесь же, если приёмник дан, —
 * он не является подпиской и в `subscriptions` не кладётся.
 */
export function createPreviewPlugin(options: PreviewPluginOptions): Plugin {
  const { host } = options;
  const point = options.surfacePoint ?? PreviewSurfacePoint;
  const sessions = options.sessions ?? createPreviewSessions();

  return definePlugin({
    id: PREVIEW_PLUGIN_ID,
    activate(ctx) {
      for (const [locale, messages] of Object.entries(PREVIEW_MESSAGES)) {
        options.i18n?.contribute(locale, messages);
      }

      // Панель модели: единственный вклад превью в оболочку помимо поверхностей. Слот нижний —
      // строки значений читают в ширину, а не в высоту, и форме при этом остаётся весь экран.
      ctx.subscriptions.push(
        ctx.extensions.contribute(
          PanelPoint,
          {
            id: MODEL_PANEL_ID,
            slot: 'panel.bottom' as SlotId,
            titleKey: 'model.title',
            when: (when: WhenContext) => when.activeResourceKind === 'form.schema',
            order: 30,
            Body: () => createElement(ModelPanel, { host, sessions }),
          },
          { id: MODEL_PANEL_ID }
        )
      );

      for (const surface of builtinSurfaces(host)) {
        ctx.subscriptions.push(ctx.extensions.contribute(point, surface, { id: surface.id }));
      }

      // Клик по форме уходит в общий канал выделения. `get`, а не `require`: плагину
      // доступен только он, и отсутствие службы — штатная деградация, а не отказ. Так
      // собирается и тест плагина, где реестра сервисов нет вовсе.
      const selection = ctx.services.get(SelectionServiceToken);
      if (selection !== undefined) ctx.subscriptions.push(sessions.connectSelection(selection));

      // Находки сборки уходят в общий свод диагностик — под адресом файла, где чинить. Тот же
      // `get`, а не `require`, и та же деградация: без службы находки остаются в состоянии
      // превью, и живой вид показывает их, как и раньше.
      const diagnostics = ctx.services.get(DiagnosticsServiceToken);
      if (diagnostics !== undefined) {
        ctx.subscriptions.push(sessions.connectDiagnostics(diagnostics));
        // Правка файла снимает его находки сборки до следующей сборки: они про текст, которого
        // уже нет. Порт вправе канала не дать — тогда находки живут до пересборки, как и раньше.
        const files = host.onDidChangeFiles?.((changed) => {
          sessions.invalidate(changed);
        });
        if (files !== undefined) ctx.subscriptions.push(files);
      }
    },
    deactivate() {
      // Состояния не выражаются подпиской: они переживают перерисовку и переключение вкладки,
      // и снять их может только тот, кто их держит.
      sessions.dispose();
    },
  });
}
