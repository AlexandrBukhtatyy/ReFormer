/**
 * Панель превью: рамка, в которой запущенное приложение показано целиком.
 *
 * ## Рамка, а не отрисовка здесь
 *
 * Билдер, встроенный в приложение, его устройства не знает: маршруты, API и провайдеры есть
 * только у приложения. Поэтому панель ничего не рисует сама — она открывает адрес приложения
 * в рамке, и стили билдера в неё не попадают вовсе: это отдельный документ.
 *
 * Рамка названа именем из контракта (`APP_PREVIEW_FRAME_NAME`): по нему компонент билдера
 * в приложении узнаёт, что открыт в превью, и не показывает кнопку билдера внутри самого себя.
 *
 * ## Здесь приложение, а форма — во вкладке
 *
 * Одну форму показывает вид «Форма» открытой вкладки (`../form-surface`), как и в билдере без
 * приложения. Панели остаётся страница целиком: по ней ходят адресной строкой, чтобы увидеть
 * форму на её месте, среди остального приложения. Переключателя «форма / приложение» поэтому
 * нет — это были два ответа на разные вопросы в одном месте.
 *
 * ## После записи рамка перезагружается
 *
 * Приложение хранит собранную форму в состоянии компонента, и «горячее» обновление модулей его
 * сохраняет — правка схемы приехала бы, а форма осталась прежней. Перезагрузка рамки показывает
 * то, что записано, наверняка. Делается она с задержкой: dev-сервер приложения замечает запись
 * не мгновенно.
 *
 * ## Свои стили — встроенные
 *
 * Панель обходится токенами кита и встроенными стилями: своей таблицы стилей у плагина нет,
 * и утилит, которых может не оказаться в стилях оболочки, она не использует.
 *
 * @module plugins/base/app-preview/ui/PreviewPanel
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactElement,
} from 'react';
import {
  APP_PREVIEW_FRAME_NAME,
  useTranslate,
  type AppPreviewService,
  type PluginI18n,
} from '@reformer/builder-plugin-api';
import { RELOAD_DELAY_MS, resolveAddress } from '../model';

export interface PreviewPanelProps {
  readonly preview: Pick<AppPreviewService, 'pageUrl' | 'onDidWriteSource'>;
  readonly i18n: Pick<PluginI18n, 'locale' | 't' | 'onDidChangeLocale'>;
  /** Открыть адрес в новой вкладке. Параметр ради тестов. */
  readonly openTab?: (url: string) => void;
  /** Задержка перезагрузки после записи. Параметр ради тестов. */
  readonly reloadDelayMs?: number;
}

// Панель занимает область дока целиком (вклад с признаком `fill`): док — колонка, и корень
// панели растягивается в ней сам. `height` — для места, где панель стоит не в колонке.
const PANEL: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  flex: '1 1 0',
  height: '100%',
  minWidth: 0,
  minHeight: 0,
  color: 'var(--foreground)',
  fontSize: 12,
};
// Строка адреса — единственная над рамкой; черта под ней отделяет панель от документа
// приложения, у которого фон свой.
const ADDRESS_ROW: CSSProperties = {
  display: 'flex',
  flex: 'none',
  alignItems: 'stretch',
  gap: 6,
  padding: '6px 8px',
  borderBottom: '1px solid var(--border)',
};
const ADDRESS: CSSProperties = {
  flex: 1,
  minWidth: 0,
  padding: '3px 6px',
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: 'var(--border)',
  borderRadius: 6,
  font: 'inherit',
  color: 'inherit',
  background: 'var(--background)',
};
const ADDRESS_INVALID: CSSProperties = { ...ADDRESS, borderColor: 'var(--destructive)' };
const ACTION: CSSProperties = {
  flex: 'none',
  padding: '3px 8px',
  border: '1px solid var(--border)',
  borderRadius: 6,
  font: 'inherit',
  color: 'inherit',
  background: 'transparent',
  cursor: 'pointer',
};
const BODY: CSSProperties = { position: 'relative', flex: 1, minHeight: 0 };
// Фон рамки белый намеренно: это документ приложения, и тема билдера к нему не относится.
const FRAME: CSSProperties = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  border: 0,
  background: '#fff',
};

const defaultOpenTab = (url: string): void => {
  // Без связи с открывшим окном: новая вкладка не наследует режим билдера и показывает
  // приложение как оно есть.
  window.open(url, '_blank', 'noopener');
};

export function PreviewPanel(props: PreviewPanelProps): ReactElement {
  const { preview } = props;
  const t = useTranslate(props.i18n);
  const reloadDelay = props.reloadDelayMs ?? RELOAD_DELAY_MS;

  // Адрес страницы читается один раз: дальше человек ходит по приложению сам.
  const [address, setAddress] = useState(() => preview.pageUrl());
  const [draft, setDraft] = useState(address);
  const [invalid, setInvalid] = useState(false);
  /** Смена значения перезагружает рамку: она монтируется заново. */
  const [generation, setGeneration] = useState(0);
  /**
   * Где приложение в рамке находится СЕЙЧАС. Человек ходит по нему сам, и перезагрузка обязана
   * вернуть его туда же, а не на адрес, с которого рамка открылась.
   */
  const currentPage = useRef(address);

  const frameRef = useRef<HTMLIFrameElement | null>(null);
  /**
   * Адрес, на котором приложение в рамке находится в этот миг.
   *
   * Читается у самой рамки, а не из события загрузки: приложение ходит по своим страницам
   * без загрузки документа, и событие таких переходов не видит.
   */
  const livePage = useCallback((): string => {
    try {
      const href = frameRef.current?.contentWindow?.location.href;
      if (href !== undefined && href !== 'about:blank') currentPage.current = href;
    } catch {
      // Рамка ушла на другой источник — её адрес недоступен; остаётся последний известный.
    }
    return currentPage.current;
  }, []);

  const reload = useCallback(() => {
    setAddress(livePage());
    setGeneration((value) => value + 1);
  }, [livePage]);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const subscription = preview.onDidWriteSource(() => {
      // Несколько записей подряд (схема и её сайдкары) — одна перезагрузка.
      if (timer.current !== null) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        timer.current = null;
        reload();
      }, reloadDelay);
    });
    return () => {
      subscription.dispose();
      if (timer.current !== null) clearTimeout(timer.current);
      timer.current = null;
    };
  }, [preview, reload, reloadDelay]);

  const submitAddress = (event: FormEvent): void => {
    event.preventDefault();
    const resolved = resolveAddress(draft, address);
    if (resolved === null) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    currentPage.current = resolved;
    setAddress(resolved);
    setDraft(resolved);
    setGeneration((value) => value + 1);
  };

  /** Рамка загрузила страницу: адресная строка идёт за переходами по приложению. */
  const followFrame = (frame: HTMLIFrameElement): void => {
    let href: string | undefined;
    try {
      href = frame.contentWindow?.location.href;
    } catch {
      // Рамка ушла на другой источник — её адрес нам недоступен, и следовать не за чем.
      return;
    }
    if (href === undefined || href === 'about:blank') return;
    currentPage.current = href;
    setDraft(href);
    setInvalid(false);
  };

  return (
    <div style={PANEL} data-app-preview="panel">
      {/* Действия стоят в строке адреса: оба — про то, что по нему открыто. Кнопки внутри
          формы объявлены `type="button"`, иначе нажатие отправляло бы адрес. */}
      <form style={ADDRESS_ROW} onSubmit={submitAddress}>
        <input
          type="text"
          aria-label={t('address.label')}
          aria-invalid={invalid}
          title={invalid ? t('address.invalid') : undefined}
          style={invalid ? ADDRESS_INVALID : ADDRESS}
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            setInvalid(false);
          }}
        />
        <button
          type="button"
          style={ACTION}
          title={t('action.reload')}
          aria-label={t('action.reload')}
          onClick={reload}
        >
          ⟳
        </button>
        <button
          type="button"
          style={ACTION}
          title={t('action.openTab')}
          aria-label={t('action.openTab')}
          onClick={() => {
            (props.openTab ?? defaultOpenTab)(livePage());
          }}
        >
          ↗
        </button>
      </form>
      <div style={BODY}>
        <iframe
          // Новый ключ — новая рамка: перезагрузка не зависит от того, что внутри.
          key={`${address}#${generation}`}
          ref={frameRef}
          name={APP_PREVIEW_FRAME_NAME}
          title={t('frame.page')}
          src={address}
          style={FRAME}
          onLoad={(event) => {
            followFrame(event.currentTarget);
          }}
        />
      </div>
    </div>
  );
}
