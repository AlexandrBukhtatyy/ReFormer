/**
 * Форма превью в рамке активного кита.
 *
 * Рамку даёт служба китов (`KitsService.Frame`): скоуп стилей плагина-владельца и провайдер кита.
 * Форма кита, внесённого плагином, без рамки нарисована без своих стилей и без темы. Подсветка
 * выделения остаётся СНАРУЖИ: это оформление билдера, а не кита, и провайдер кита не должен
 * иметь над ней власти.
 *
 * Рамка приходит пропсом, а не берётся из порта здесь: компонент, полученный вызовом во время
 * отрисовки, для React — новый тип на каждый рендер. Компонент службы стабилен на всё время её
 * жизни, поэтому смена кита форму не размонтирует — рамка следит за ней сама.
 *
 * @module plugins/reformer/render/ui/KitFrame
 */

import type { ComponentType, ReactNode } from 'react';
import type { KitFrameProps } from '@reformer/builder-plugin-api';

export interface PreviewKitFrameProps {
  /** Рамка активного кита (`PreviewHost.kitFrame()`); `null` — службы китов нет. */
  readonly frame: ComponentType<KitFrameProps> | null;
  readonly children?: ReactNode;
}

export function KitFrame({ frame: Frame, children }: PreviewKitFrameProps): ReactNode {
  // Службы китов нет — форма рисуется как есть: рамка обязана добавлять окружение, а не условие.
  return Frame === null ? children : <Frame>{children}</Frame>;
}
