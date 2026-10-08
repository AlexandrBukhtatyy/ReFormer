/**
 * Переключатель режима превью в шапке дока: одна форма или приложение целиком.
 *
 * Стоит в шапке, а не в теле панели: там он занимал отдельную строку над рамкой, а док узкий
 * и высота нужнее приложению в ней. Шапка дока уже нарисована и справа от заголовка пуста.
 *
 * Шапку рисует оболочка, не панель, поэтому режим переключатель не хранит — он пишет его
 * в общее хранилище, откуда его читает панель.
 *
 * Стили встроенные, как у панели: своей таблицы стилей у плагина нет.
 *
 * @module plugins/base/app-preview/ui/PreviewModeSwitch
 */

import type { CSSProperties, ReactElement } from 'react';
import { useTranslate, type PluginI18n } from '@reformer/builder-plugin-api';
import type { PreviewMode, PreviewModeStore } from '../model';
import { usePreviewMode } from './usePreviewMode';

export interface PreviewModeSwitchProps {
  readonly mode: PreviewModeStore;
  readonly i18n: Pick<PluginI18n, 'locale' | 't' | 'onDidChangeLocale'>;
}

// Размер текста и цвет заданы здесь: в шапке дока у переключателя нет предка-панели,
// от которого он брал их в теле.
const SEGMENTS: CSSProperties = {
  display: 'flex',
  flex: 'none',
  border: '1px solid var(--border)',
  borderRadius: 6,
  overflow: 'hidden',
  color: 'var(--foreground)',
  fontSize: 12,
};
// Составные свойства (`font`, `border`) с их частями в одном элементе не смешиваются: React
// при смене стиля снимает их по одному, и часть пережила бы целое.
const SEGMENT: CSSProperties = {
  padding: '2px 8px',
  border: 0,
  fontFamily: 'inherit',
  fontSize: 'inherit',
  fontWeight: 400,
  // Высота строки своя: шапка дока — 34 пикселя, и переключатель обязан в неё поместиться.
  lineHeight: '16px',
  color: 'inherit',
  background: 'transparent',
  cursor: 'pointer',
};
const SEGMENT_ACTIVE: CSSProperties = { ...SEGMENT, background: 'var(--accent)', fontWeight: 600 };

const MODES: readonly { readonly mode: PreviewMode; readonly labelKey: string }[] = [
  { mode: 'form', labelKey: 'mode.form' },
  { mode: 'page', labelKey: 'mode.page' },
];

export function PreviewModeSwitch(props: PreviewModeSwitchProps): ReactElement {
  const t = useTranslate(props.i18n);
  const current = usePreviewMode(props.mode);

  return (
    <div role="group" aria-label={t('mode.label')} style={SEGMENTS} data-app-preview="mode">
      {MODES.map(({ mode, labelKey }) => (
        <button
          key={mode}
          type="button"
          aria-pressed={current === mode}
          style={current === mode ? SEGMENT_ACTIVE : SEGMENT}
          onClick={() => {
            props.mode.set(mode);
          }}
        >
          {t(labelKey)}
        </button>
      ))}
    </div>
  );
}
