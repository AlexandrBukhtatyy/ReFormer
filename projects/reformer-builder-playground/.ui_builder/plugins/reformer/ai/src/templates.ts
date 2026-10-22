/**
 * Создание формы в объёме, нужном ассистенту.
 *
 * Структурная копия контракта шаблонов (`reformer.templates.creator`): плагины друг друга не
 * импортируют, и совпадать обязана форма, а не объявление. Шаблонов в сборке может не быть — тогда
 * `create_form` отвечает модели «недоступно», а ход без открытой формы — «откройте форму».
 *
 * @module plugins/reformer/ai/templates
 */

import { defineCapability, type ResourceId } from '@reformer/builder-plugin-api';

/** Шаблон формы в списке. */
export interface TemplateSummary {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly source: 'builtin' | 'project' | 'local';
}

/** Исход создания формы. */
export type CreateFormReport =
  | {
      readonly ok: true;
      readonly documentId: ResourceId;
      /** Путь документа новой формы от корня проекта. */
      readonly path: string;
      /** Имя шаблона; `null` — пустая форма. */
      readonly template: string | null;
    }
  | { readonly ok: false; readonly error: string; readonly message: string };

export interface FormCreatorService {
  templates(): Promise<readonly TemplateSummary[]>;
  create(request: {
    readonly formName: string;
    readonly template?: string;
    readonly folder?: string;
    readonly near?: ResourceId;
  }): Promise<CreateFormReport>;
}

/** Возможность «создать форму». Объявляют её шаблоны. */
export const FormCreatorCapability = defineCapability<FormCreatorService>({
  id: 'reformer.templates.creator',
  version: '1.0.0',
});
