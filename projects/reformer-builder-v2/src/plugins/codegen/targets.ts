/**
 * Встроенные цели генерации — те самые, что в v1 были литеральным массивом вызовов.
 *
 * Каждая запись отвечает на три вопроса, которые раньше были разнесены по четырём модулям:
 * как называется файл, перезаписывать ли его и производится ли он из правил. Порядок задаётся
 * `order` вклада, а не позицией в массиве, поэтому чужая цель может встать между нашими.
 *
 * Ни одна из них не знает ни рабочей области, ни источника: цель возвращает текст, записью
 * занимается доставка.
 *
 * @module plugins/codegen/targets
 */

import {
  emitApi,
  emitDataSources,
  emitFormBehavior,
  emitIndex,
  emitModel,
  emitReadme,
  emitRegistry,
  emitRenderBehavior,
  emitSchema,
  emitTypes,
  emitValidation,
  emitWizard,
  wizardShimOf,
} from '@/lib/codegen';
import type { CodegenTarget } from './contract';

/**
 * Встроенные цели в каноническом порядке раскладки renderer-json.
 *
 * `order` кратен десяти: между любыми двумя нашими целями помещается чужая, и вставка не
 * требует перенумеровать соседей.
 */
export const BUILTIN_TARGETS: readonly (CodegenTarget & { readonly order: number })[] =
  Object.freeze([
    {
      id: 'codegen.schema',
      titleKey: 'target.schema',
      path: 'renderer.schema.json',
      cls: 'derived',
      order: 10,
      emit: emitSchema,
    },
    {
      id: 'codegen.types',
      titleKey: 'target.types',
      path: 'types.ts',
      cls: 'derived',
      order: 20,
      emit: emitTypes,
    },
    {
      id: 'codegen.model',
      titleKey: 'target.model',
      path: 'model.ts',
      cls: 'derived',
      order: 30,
      emit: emitModel,
    },
    {
      id: 'codegen.registry',
      titleKey: 'target.registry',
      path: 'registry.ts',
      cls: 'derived',
      order: 40,
      emit: emitRegistry,
    },
    {
      id: 'codegen.index',
      titleKey: 'target.index',
      path: 'index.tsx',
      cls: 'derived',
      order: 50,
      emit: emitIndex,
    },
    {
      // Шим визарда — опциональный файл канона: он появляется ровно у той формы, где есть
      // узел-визард, И только если кит поставляет адаптер. Без адаптера файл не печатается,
      // а `registry.ts` регистрирует заглушку с внятной причиной — это лучше импорта из
      // чужого пакета, который у пользователя не соберётся.
      id: 'codegen.wizard',
      titleKey: 'target.wizard',
      path: 'renderer.wizard.tsx',
      cls: 'derived',
      order: 60,
      applies: (ctx) => wizardShimOf(ctx) !== null,
      emit: emitWizard,
    },
    {
      id: 'codegen.data-sources',
      titleKey: 'target.data-sources',
      path: 'data-sources.ts',
      cls: 'user',
      order: 70,
      emit: emitDataSources,
    },
    {
      // Производится из правил render-слоя, поэтому несёт маркер и перезаписывается,
      // пока его не правили руками.
      id: 'codegen.render-behavior',
      titleKey: 'target.render-behavior',
      path: 'renderer.behavior.ts',
      cls: 'user',
      regenerable: true,
      order: 80,
      emit: emitRenderBehavior,
    },
    {
      id: 'codegen.form-behavior',
      titleKey: 'target.form-behavior',
      path: 'form.behavior.ts',
      cls: 'user',
      regenerable: true,
      order: 90,
      emit: emitFormBehavior,
    },
    {
      id: 'codegen.validation',
      titleKey: 'target.validation',
      path: 'validation.ts',
      cls: 'user',
      regenerable: true,
      order: 100,
      emit: emitValidation,
    },
    // Заготовка под бэкенд: регенерировать её не из чего, поэтому маркера она не несёт.
    {
      id: 'codegen.api',
      titleKey: 'target.api',
      path: 'api.ts',
      cls: 'user',
      order: 110,
      emit: emitApi,
    },
    // README печатается последним не по прихоти: он перечисляет состав модуля, и состав
    // к этому моменту уже известен целиком.
    {
      id: 'codegen.readme',
      titleKey: 'target.readme',
      path: 'README.md',
      cls: 'derived',
      order: 120,
      emit: emitReadme,
    },
  ]);
