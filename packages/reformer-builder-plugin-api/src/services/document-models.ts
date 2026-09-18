/**
 * Модели открытых документов — возможность оболочки.
 *
 * ## Зачем
 *
 * Модельный документ (`workspace/model/model-document`) заводит оболочка: провайдер из точки
 * `document.model` разбирает буфер, и у вкладки появляется вторая истина. Редактору модели нужна
 * РУЧКА этого документа — правка операциями, история, выделение. Раньше её отдавал порт, который
 * оболочка собирала для редактора схемы ReFormer, и в порту жило знание «этот провайдер — того
 * плагина». Второй стек означал бы второй порт в оболочке.
 *
 * Служба отдаёт ручку ЛЮБОГО модельного документа с моделью `unknown`. Тип сужает тот, кто знает
 * формат: сверил `handle.document.providerId` со своим провайдером — модель его.
 *
 * ## Чего здесь нет
 *
 * Открытия и закрытия: ручка живёт, пока открыта вкладка, и её время жизни принадлежит оболочке.
 * Отсюда `null` на всё, что не открыто или открыто текстом.
 *
 * @module @reformer/builder-plugin-api/services/document-models
 */

import { defineCapability, type Capability } from '../primitives/capability.js';
import type { ResourceId } from '../primitives/resource.js';
import type { ModelDocumentHandle } from '../workspace/model/model-document.js';

export interface DocumentModelsService {
  /**
   * Ручка модельного документа открытой вкладки.
   *
   * `null` — три разные вещи, одинаковые для редактора: вкладка ещё открывается, её закрыли,
   * документ текстовый (провайдер не взялся или первый разбор не удался). Во всех трёх случаях
   * править нечего.
   */
  handleOf(id: ResourceId): ModelDocumentHandle<unknown> | null;
}

/**
 * Возможность «модели документов». Провайдер — оболочка (`platform/services/host-capabilities`):
 * модели заводит она, и без проекта служба честно отвечает `null`.
 *
 * Версия `1.0.0` — исходная.
 */
export const DocumentModelsCapability: Capability<DocumentModelsService> =
  defineCapability<DocumentModelsService>({ id: 'reformer.workspace.models', version: '1.0.0' });
