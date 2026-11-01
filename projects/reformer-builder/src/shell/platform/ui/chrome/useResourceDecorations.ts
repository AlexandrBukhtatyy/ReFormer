/**
 * Пометки ресурсов для отрисовки — общее у дерева и ряда вкладок.
 *
 * Пометку вешает вклад `ResourceDecorationPoint`, а показывают её двое: строка дерева и вкладка
 * документа. Обоим нужны одни и те же вклады и одна и та же перерисовка по сигналу вклада — иначе
 * пометка «ассистент правит эту форму» появлялась бы в дереве и отставала на вкладке.
 *
 * @module shell/platform/ui/chrome/useResourceDecorations
 */

import { useEffect, useReducer } from 'react';
import {
  ResourceDecorationPoint,
  type DecorationTone,
} from '@reformer/builder-plugin-api/internal';
import {
  observeDecorations,
  type DecorationEntry,
} from '@/shell/platform/ui/contributions/decorations';
import { useContributions, type ExtensionReader } from './usePanels';

/** Тон пометки → вариант значка кита. Соответствие визуальное, поэтому живёт в отрисовке. */
export const DECORATION_BADGE_VARIANT: Readonly<
  Record<DecorationTone, 'default' | 'secondary' | 'destructive' | 'outline'>
> = Object.freeze({
  default: 'secondary',
  accent: 'default',
  warning: 'outline',
  danger: 'destructive',
});

/**
 * Вклады пометок; перерисовывает и при смене состава вкладов, и по их сигналу «пометка изменилась».
 *
 * `useReducer` вместо `useSyncExternalStore`: у сигнала нет снимка — он не несёт значения
 * вовсе, а требование стабильности снимка при этом никуда не девается, и подсовывать ему
 * счётчик значило бы заводить состояние ради того, чтобы его не читать. Функция-диспетчер
 * стабильна по контракту React, поэтому эффект переподписывается только при смене состава
 * вкладов.
 */
export function useResourceDecorations(extensions: ExtensionReader): readonly DecorationEntry[] {
  const entries = useContributions(extensions, ResourceDecorationPoint);
  const [, bump] = useReducer((revision: number) => revision + 1, 0);
  useEffect(() => {
    const subscription = observeDecorations(entries, bump);
    return () => {
      subscription.dispose();
    };
  }, [entries]);
  return entries;
}
