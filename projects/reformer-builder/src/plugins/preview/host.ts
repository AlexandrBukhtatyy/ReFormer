/**
 * Порт платформы для превью-хоста: ровно то, чем он пользуется, и ничего сверх.
 *
 * Хосту от документа нужен только АДРЕС — вид, ссылка и провайдер модели, — чтобы спросить
 * поверхности, берутся ли они за него. Текст, модель, кит и загрузчик модулей нужны тому, кто
 * рисует, то есть поверхностям стеков, и приходят к ним их собственными путями.
 *
 * Типы — СТРУКТУРНЫЕ копии платформенных и обязаны быть их подмножествами: в
 * {@link PreviewHostPort} присваивается порт, который композиция собирает для поверхностей
 * стека ReFormer. Совместимость проверяется компиляцией там, где композиция подставляет его.
 *
 * @module plugins/preview/host
 */

import type {
  Disposable,
  DocumentKind,
  ResourceId,
  ResourceRef,
} from '@reformer/builder-plugin-api';

/** Открытый документ — в объёме, нужном выбору поверхности. */
export interface LiveDocument {
  readonly id: ResourceId;
  readonly ref: ResourceRef;
  readonly kind: DocumentKind;
  /** Провайдер модели, который взялся за документ; есть только у модельного. */
  readonly providerId?: string;
}

/**
 * Возможности источника — в объёме одного вопроса: можно ли исполнять его код. Ширина порта
 * равна ширине принимаемого решения, поэтому «а можно ли ещё вот это» здесь не выразимо.
 */
export interface PreviewSourceCapabilities {
  readonly executesCode: boolean;
}

export interface PreviewHostPort {
  /** Открытый документ по адресу; `null` — такого нет или проект не открыт. */
  documentOf(id: ResourceId): LiveDocument | null;
  /** Права источника документа; `null` — источник неизвестен (проект не открыт). */
  sourceOf(id: ResourceId): PreviewSourceCapabilities | null;
  /**
   * Файлы рабочей области изменились: их находки сборки устарели. Необязателен — без него
   * находки живут до следующей сборки, как и раньше.
   */
  onDidChangeFiles?(cb: (changed: readonly ResourceId[]) => void): Disposable;
}
