/**
 * Генерация кода формы в объёме, нужном ассистенту.
 *
 * Структурная копия контракта генерации кода (`reformer.codegen.generator`): плагины друг друга не
 * импортируют, и совпадать обязана форма, а не объявление. Генерации в сборке может не быть — тогда
 * `generate_code` отвечает модели «недоступно».
 *
 * @module plugins/reformer/ai/generator
 */

import { defineCapability, type ResourceId } from '@reformer/builder-plugin-api';

/** Отчёт прогона генерации. Пути файлов — от каталога модуля, `dir` — от корня проекта. */
export type GenerateReport =
  | {
      readonly ok: true;
      readonly formName: string;
      readonly dir: string;
      readonly written: readonly string[];
      readonly skipped: readonly {
        readonly path: string;
        readonly reason: 'authored' | 'edited' | 'refused';
        readonly message?: string;
      }[];
      readonly failed: readonly { readonly path: string; readonly message: string }[];
    }
  | { readonly ok: false; readonly error: string; readonly message: string };

export interface ModuleGeneratorService {
  /**
   * Напечатать модуль формы документа и записать его. `write` — дверь записи заказчика: строка —
   * отказ с этой причиной (файл попадает в отчёт пропущенным), `null` — записано.
   */
  generate(
    documentId: ResourceId,
    request?: {
      readonly write?: (id: ResourceId, text: string) => Promise<string | null>;
      readonly formName?: string;
    }
  ): Promise<GenerateReport>;
}

/** Возможность «сгенерировать код формы». Объявляет её генерация кода. */
export const ModuleGeneratorCapability = defineCapability<ModuleGeneratorService>({
  id: 'reformer.codegen.generator',
  version: '1.0.0',
});
