/**
 * Поверхность превью «форма приложением»: вид открытой вкладки, в котором форму рисует само
 * запущенное приложение.
 *
 * ## Почему это поверхность, а не своя панель
 *
 * В самостоятельном билдере форму показывает вид «Форма» открытой вкладки — кнопка со значком
 * в полосе вкладок, рядом с деревом и исходником: редактор спрашивает у превью-хоста
 * поверхность и отдаёт ей тело вкладки. Билдер, встроенный в приложение, обязан выглядеть так
 * же: отличается не МЕСТО, где форму показывают, а ТОТ, кто её рисует. Поэтому плагин вносит
 * поверхность в общую точку (`preview.surface`) — и кнопка вида, и правило выбора, и тело
 * вкладки остаются редактора и превью-хоста, теми же, что и там.
 *
 * Раньше форма жила в панели правого дока, под переключателем «Форма / Приложение». Это был
 * второй ответ на вопрос «как посмотреть на форму», и у встроенного билдера он отличался
 * от ответа самостоятельного.
 *
 * ## Рамка, а не отрисовка здесь
 *
 * Билдер устройства приложения не знает: реестр, API и провайдеры формы есть только у него.
 * Поверхность ничего не рисует сама — она открывает в рамке стенд формы на адресе приложения.
 * У формы там настоящие стили и настоящая область просмотра, а стили билдера в рамку не
 * попадают вовсе: это отдельный документ. Отсюда и объявленные возможности: форму можно
 * трогать, но выбрать узел щелчком нельзя — чужой документ билдеру не виден.
 *
 * Кода документа поверхность не исполняет: его исполняет приложение в своём документе, и права
 * источника билдера к этому не относятся.
 *
 * ## Показано то, что записано, — и об этом сказано
 *
 * Приложение читает файлы с диска, а не рабочую копию билдера: несохранённую правку оно не
 * видит. Поэтому поверхность не слушает модель документа — она ждёт записи в источник
 * и перезагружает рамку. Перезагрузка, а не «горячее» обновление: собранную форму приложение
 * держит в состоянии компонента, и правка схемы приехала бы, а форма осталась прежней.
 *
 * Рендерер билдера ведёт себя иначе: его вид «Форма» рисует модель редактора, и правка видна
 * сразу. Здесь та же кнопка показывает сохранённое — и без объяснения это выглядит поломкой:
 * направление группы поменяли, а поля стоят как стояли. Пока в рабочей копии есть несохранённые
 * правки, над формой стоит полоса, которая это говорит и предлагает сохранить. Правки считаются
 * по всей рабочей копии, а не по одному документу: форму собирают и схема, и её сайдкары,
 * и сервис в чужом каталоге.
 *
 * О правках спрашивается служба сохранения — та же, по которой их считает строка состояния.
 * Спрашивать сами документы нельзя: у модельного документа буфер перерисовывается из модели
 * с задержкой, и «буфер не расходится с источником» там не значит «правок нет».
 *
 * ## Без React и без своих стилей
 *
 * Поверхность — рамка и пара строк текста вокруг неё. Корень React ради этого не заводится,
 * а оформление — токены кита встроенными стилями: своей таблицы у плагина нет.
 *
 * @module plugins/base/app-preview/form-surface
 */

import {
  APP_PREVIEW_FRAME_NAME,
  type AppPreviewService,
  type Disposable,
  type PreviewSurface,
  type WorkspaceFilesService,
  type WorkspaceSaveService,
} from '@reformer/builder-plugin-api';
import { FORM_MODULE_NAME, formModulePath, RELOAD_DELAY_MS } from './model';

/** Идентификатор поверхности. Он же — адрес вклада и имя источника её находок. */
export const APP_FORM_SURFACE_ID = 'app-preview.form';

export interface FormSurfaceDeps {
  readonly preview: Pick<AppPreviewService, 'formUrl' | 'onDidWriteSource'>;
  readonly files: Pick<WorkspaceFilesService, 'parentOf' | 'list' | 'onDidChange'>;
  /**
   * Служба сохранения: есть ли несохранённые правки и как их сохранить. Функция — служба
   * привилегированная и спрашивается в момент вопроса; `undefined` — права сохранять нет,
   * и тогда полосы о несохранённом нет вовсе: узнать о правках больше не у кого.
   */
  readonly saving?: () => Pick<WorkspaceSaveService, 'isDirty' | 'saveAll'> | undefined;
  /** Перевод в пространстве имён плагина. */
  readonly t: (key: string, params?: Record<string, unknown>) => string;
  /** Задержка перезагрузки после записи. Параметр ради тестов. */
  readonly reloadDelayMs?: number;
}

/**
 * Корень поверхности занимает тело вкладки целиком, каким бы ни был элемент редактора:
 * блоком с заданной высотой (тогда работает `height`) или гибкой колонкой (тогда — `flex`).
 * Наименьшая высота — на случай редактора, который высоты элементу не дал вовсе: рамка
 * нулевой высоты выглядела бы как отказ без объяснения.
 */
const ROOT_STYLE = `
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  width: 100%;
  height: 100%;
  min-height: 240px;
`;
/** Полоса о несохранённых правках: над формой, во всю ширину, не отнимая у неё больше строки. */
const UNSAVED_STYLE = `
  display: flex;
  flex: none;
  align-items: center;
  gap: 8px;
  padding: 4px 12px;
  border-bottom: 1px solid var(--border);
  font-size: 11px;
  color: var(--foreground);
  background: color-mix(in srgb, #f59e0b 14%, transparent);
`;
const UNSAVED_TEXT_STYLE = `
  flex: 1 1 auto;
  min-width: 0;
`;
const SAVE_STYLE = `
  flex: none;
  padding: 1px 8px;
  border: 1px solid var(--border);
  border-radius: 6px;
  font: inherit;
  color: inherit;
  background: var(--background);
  cursor: pointer;
`;
const BODY_STYLE = `
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
`;
// Фон рамки белый намеренно: это документ приложения, и тема билдера к нему не относится.
const FRAME_STYLE = `
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: 0;
  background: #fff;
`;
const EMPTY_STYLE = `
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 16px;
  text-align: center;
  font-size: 12px;
  color: var(--muted-foreground);
`;

export function createFormSurface(deps: FormSurfaceDeps): PreviewSurface {
  const delay = deps.reloadDelayMs ?? RELOAD_DELAY_MS;

  /** Есть ли в рабочей копии несохранённые правки. */
  const hasUnsaved = (): boolean => deps.saving?.()?.isDirty() === true;

  return {
    id: APP_FORM_SURFACE_ID,

    // За любой документ: какую форму показать, решает каталог документа, а не его формат —
    // стенд приложения рисует модуль формы, из чего бы тот ни был собран. Есть ли модуль,
    // выясняется при монтировании: здесь ответ обязан быть мгновенным.
    applies: () => true,

    capabilities: {
      interactive: true,
      hitTest: false,
      dragSource: false,
      executesCode: false,
      sameRealm: false,
    },

    title: () => deps.t('surface.title'),

    mount(host, ctx): Disposable {
      const view = host.ownerDocument;
      const root = view.createElement('div');
      root.dataset.appPreview = 'form';
      root.style.cssText = ROOT_STYLE;

      // ── Полоса о несохранённых правках ────────────────────────────────────────────────
      const unsaved = view.createElement('div');
      unsaved.dataset.appPreview = 'unsaved';
      unsaved.setAttribute('role', 'status');
      unsaved.style.cssText = UNSAVED_STYLE;
      const unsavedText = view.createElement('span');
      unsavedText.style.cssText = UNSAVED_TEXT_STYLE;
      const saveButton = view.createElement('button');
      saveButton.type = 'button';
      saveButton.style.cssText = SAVE_STYLE;
      saveButton.addEventListener('click', () => {
        // Отказ сохранения показывает рабочая область (диалог расхождения, уведомление):
        // здесь его некому повторить.
        void deps
          .saving?.()
          ?.saveAll()
          .catch((error: unknown) => {
            console.error('[app-preview] сохранение не удалось', error);
          });
      });
      unsaved.append(unsavedText, saveButton);

      // ── Область формы ─────────────────────────────────────────────────────────────────
      const body = view.createElement('div');
      body.style.cssText = BODY_STYLE;

      root.append(unsaved, body);
      host.append(root);

      /**
       * Привести полосу к рабочей копии. Тексты ставятся здесь же, а не один раз: язык
       * интерфейса меняют на ходу, а полоса живёт столько же, сколько вид.
       */
      const syncUnsaved = (): void => {
        const dirty = hasUnsaved();
        unsaved.hidden = !dirty;
        // `hidden` уступает `display` из встроенного стиля — прячем и им.
        unsaved.style.display = dirty ? 'flex' : 'none';
        if (!dirty) return;
        unsavedText.textContent = deps.t('unsaved.notice');
        saveButton.textContent = deps.t('unsaved.save');
      };
      syncUnsaved();

      const directory = deps.files.parentOf(ctx.doc.id);
      let disposed = false;
      /** Номер последнего чтения каталога: ответ опоздавшего чтения не показывается. */
      let turn = 0;

      const frameOf = (modulePath: string): HTMLIFrameElement => {
        const frame = view.createElement('iframe');
        // По имени компонент билдера в приложении узнаёт, что открыт в превью, и не показывает
        // кнопку билдера внутри самого себя.
        frame.name = APP_PREVIEW_FRAME_NAME;
        frame.title = deps.t('frame.form');
        frame.style.cssText = FRAME_STYLE;
        frame.src = deps.preview.formUrl(modulePath);
        return frame;
      };

      const emptyOf = (): HTMLElement => {
        const empty = view.createElement('div');
        empty.dataset.appPreview = 'empty';
        empty.setAttribute('role', 'status');
        empty.style.cssText = EMPTY_STYLE;
        empty.textContent = deps.t('empty.noModule', { name: FORM_MODULE_NAME });
        return empty;
      };

      /**
       * Показать форму заново. Каталог читается каждый раз: модуль формы мог появиться — его
       * только что напечатал кодоген — или исчезнуть. Рамка при этом всегда новая: перезагрузка
       * не зависит от того, что внутри прежней.
       */
      const show = async (): Promise<void> => {
        const mine = ++turn;
        // Каталог не прочитался (проект закрыли, каталог удалили) — модуля в нём нет.
        const modulePath = formModulePath(await deps.files.list(directory).catch(() => []));
        if (disposed || mine !== turn) return;
        body.replaceChildren(modulePath === null ? emptyOf() : frameOf(modulePath));
      };
      void show();

      let timer: ReturnType<typeof setTimeout> | null = null;
      const subscriptions: Disposable[] = [
        deps.preview.onDidWriteSource(() => {
          // Запись и есть сохранение: полоса уходит сразу, не дожидаясь перезагрузки рамки.
          syncUnsaved();
          // Несколько записей подряд (схема и её сайдкары) — одна перезагрузка.
          if (timer !== null) clearTimeout(timer);
          timer = setTimeout(() => {
            timer = null;
            void show();
          }, delay);
        }),
        // Любое событие рабочей копии — правка, откат, закрытие файла с правкой: после него
        // ответ «есть ли несохранённое» мог измениться.
        deps.files.onDidChange(syncUnsaved),
      ];

      return {
        dispose: () => {
          disposed = true;
          if (timer !== null) clearTimeout(timer);
          timer = null;
          for (const subscription of subscriptions) subscription.dispose();
          root.remove();
        },
      };
    },
  };
}
