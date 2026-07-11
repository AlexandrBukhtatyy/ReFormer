import {
  useEffect,
  useId,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import clsx from 'clsx';
import BrowserOnly from '@docusaurus/BrowserOnly';
import { useColorMode } from '@docusaurus/theme-common';
import CodeBlock from '@theme/CodeBlock';
import { GripVertical, Info } from 'lucide-react';
import styles from './styles.module.css';

/** Один флейвор кода для таба Code (напр. ReFormer-нода vs «сырой» React). */
export interface CodeFlavor {
  id: string;
  label: string;
  /** Язык подсветки. По умолчанию `tsx`. */
  language?: string;
  code: string;
}

export interface ApiPreviewProps {
  /** Живой превью-контент (form-bound поле или произвольный компонент). */
  children: ReactNode;
  /** Флейворы кода. 0 — таб Code скрыт; 1 — без селекта; >1 — с селектом. */
  codeFlavors?: CodeFlavor[];
  /** Футер (form-data + value-bar). Показывается только во вкладке Preview. */
  footer?: ReactNode;
  /** Показывать футер. По умолчанию `true`; на Variants/Examples — `false`. */
  showFooter?: boolean;
  /**
   * Компактный режим: в шапке только табы Preview/Code (тумблеры темы/фона
   * скрыты), превью рендерится edge-to-edge без отступов, рамки и ручки ресайза.
   * По умолчанию `false`; включается на Variants/Examples.
   */
  minimal?: boolean;
  /**
   * Подсказка у правого края шапки: наведение на иконку показывает этот контент.
   * Иконка рендерится только когда `hint` задан — в любом режиме и на любой вкладке.
   */
  hint?: ReactNode;
}

const FALLBACK = <span className={styles.fallback}>Загрузка демо…</span>;

/**
 * Панель превью в стиле TaigaUI: тулбар (табы Preview/Code + тумблеры темы/фона),
 * ресайзящийся тематизированный канвас и опциональный футер. Переиспользуется
 * табами Variants / Examples / API — футер (form-data + Reset/Submit) присущ только
 * API, поэтому скрывается через `showFooter={false}`.
 *
 * Тулбар и код рендерятся и на сервере; живой `children` — только на клиенте
 * (`<BrowserOnly>`), т.к. использует ReFormer-хуки.
 */
export function ApiPreview({
  children,
  codeFlavors = [],
  footer,
  showFooter = true,
  minimal = false,
  hint,
}: ApiPreviewProps) {
  // Наследуем тему из активной темы сайта на маунте, дальше toggle независим.
  // Инициализируемся `false` (совпадает с SSR), синхронизируемся эффектом —
  // иначе на doc-страницах (панель рендерится и на сервере) возможен hydration-mismatch.
  const { colorMode } = useColorMode();
  const [dark, setDark] = useState(false);
  const [bg, setBg] = useState(false);
  const [viewTab, setViewTab] = useState<'preview' | 'code'>('preview');
  const [flavorId, setFlavorId] = useState<string>(codeFlavors[0]?.id ?? '');
  const hintId = useId();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDark(colorMode === 'dark');
  }, []);

  const hasCode = codeFlavors.length > 0;
  const activeFlavor = codeFlavors.find((f) => f.id === flavorId) ?? codeFlavors[0];
  const showCode = viewTab === 'code' && hasCode && activeFlavor;

  // В minimal тумблер темы скрыт — превью живо следует активной теме сайта
  // (реактивный `colorMode`). В обычном режиме тема превью независима (тумблер).
  const previewDark = minimal ? colorMode === 'dark' : dark;

  return (
    <div className={styles.apiPreview}>
      {/* Toolbar: слева табы Preview/Code (+ выбор флейвора кода), справа тумблеры превью */}
      <div className={styles.apiToolbar}>
        <div className={styles.apiViewTabs}>
          <button
            type="button"
            className={clsx(styles.apiViewTab, viewTab === 'preview' && styles.apiViewTabActive)}
            onClick={() => setViewTab('preview')}
          >
            Preview
          </button>
          {hasCode && (
            <button
              type="button"
              className={clsx(styles.apiViewTab, viewTab === 'code' && styles.apiViewTabActive)}
              onClick={() => setViewTab('code')}
            >
              Code
            </button>
          )}
          {viewTab === 'code' && codeFlavors.length > 1 && (
            <select
              className={styles.knobControl}
              value={flavorId}
              onChange={(e) => setFlavorId(e.target.value)}
              aria-label="Формат кода"
            >
              {codeFlavors.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
          )}
        </div>

        {((viewTab === 'preview' && !minimal) || hint) && (
          <div className={styles.apiToolbarRight}>
            {viewTab === 'preview' && !minimal && (
              <>
                <label className={styles.apiToggle}>
                  <input
                    type="checkbox"
                    checked={dark}
                    onChange={(e) => setDark(e.target.checked)}
                  />{' '}
                  Dark mode
                </label>
                <label className={styles.apiToggle}>
                  <input type="checkbox" checked={bg} onChange={(e) => setBg(e.target.checked)} />{' '}
                  Background
                </label>
              </>
            )}

            {hint && (
              <div className={styles.apiHint}>
                <button
                  type="button"
                  className={styles.hintTrigger}
                  aria-label="Подсказка"
                  aria-describedby={hintId}
                >
                  <Info size={16} aria-hidden />
                </button>
                <div role="tooltip" id={hintId} className={styles.apiTooltip}>
                  {hint}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {showCode ? (
        <div className={styles.apiCodeView}>
          <CodeBlock language={activeFlavor.language ?? 'tsx'}>{activeFlavor.code}</CodeBlock>
        </div>
      ) : (
        <>
          {/* Canvas — ширину тянем ручкой на правом крае (в minimal — edge-to-edge, без ручки) */}
          <ResizableCanvas dark={previewDark} bg={bg} minimal={minimal}>
            <BrowserOnly fallback={FALLBACK}>{() => children}</BrowserOnly>
          </ResizableCanvas>

          {showFooter && footer}
        </>
      )}
    </div>
  );
}

/**
 * Обёртка превью с «шторкой» на правом крае: тянешь ручку — меняешь ширину
 * контейнера, чтобы проверить поведение компонента при разных размерах.
 * По умолчанию — во всю доступную ширину и с выравниванием по левому краю.
 * Двойной клик по ручке сбрасывает ширину обратно на 100%.
 */
function ResizableCanvas({
  children,
  dark,
  bg,
  minimal,
}: {
  children: ReactNode;
  dark: boolean;
  bg: boolean;
  minimal: boolean;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number | null>(null); // null → во всю ширину
  const [dragging, setDragging] = useState(false);

  const onHandleDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const box = boxRef.current;
    if (!box) return;
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = box.getBoundingClientRect().width;
    const parent = box.parentElement;
    let maxWidth = startWidth;
    if (parent) {
      const cs = getComputedStyle(parent);
      maxWidth = parent.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    }
    setDragging(true);
    const onMove = (ev: PointerEvent) => {
      setWidth(Math.min(maxWidth, Math.max(200, startWidth + ev.clientX - startX)));
    };
    const onUp = () => {
      setDragging(false);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  return (
    // Трек во всю ширину сохраняет непрерывный разделитель карточки, а внутри —
    // тематизированная превью-поверхность (её и ресайзит ручка на правом крае).
    <div className={clsx(styles.apiCanvasTrack, minimal && styles.apiCanvasTrackMinimal)}>
      <div
        ref={boxRef}
        className={clsx(
          'reformer-demo',
          styles.apiCanvas,
          minimal ? styles.apiCanvasMinimal : styles.resizable,
          bg && styles.apiCanvasBg
        )}
        data-preview-theme={dark ? 'dark' : 'light'}
        style={minimal || width == null ? undefined : { width }}
      >
        <div className={styles.resizableContent}>{children}</div>
        {!minimal && dragging && (
          <span className={styles.resizableWidth}>
            {width == null ? '100%' : `${Math.round(width)}px`}
          </span>
        )}
        {!minimal && (
          <button
            type="button"
            className={styles.resizableHandle}
            onPointerDown={onHandleDown}
            onDoubleClick={() => setWidth(null)}
            title="Потяните, чтобы изменить ширину превью. Двойной клик — сбросить."
            aria-label="Изменить ширину превью"
          >
            <GripVertical size={16} aria-hidden />
          </button>
        )}
      </div>
    </div>
  );
}
