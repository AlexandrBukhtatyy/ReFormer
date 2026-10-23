/**
 * Рабочая область стека шаблонов: кит ReFormer и печатник модуля формы.
 *
 * ## Кит — ReFormer-проекция службы китов
 *
 * Служба китов SDK нейтральна и отдаёт сырой каталог; записи каталога и дескриптор — знание стека
 * (`projectCatalog`). Спрашивается на каждый вызов: кит переключают без перезагрузки, а затравки
 * встроенных шаблонов и вид формы для шаблона на движке собираются под ДЕЙСТВУЮЩИЙ кит.
 *
 * ## Печатник модуля — возможность стека генерации
 *
 * Встроенный шаблон формы — это схема, которую надо превратить в модуль, а печатает его генерация
 * кода (`reformer.codegen.printer`, контракт — в ядре домена). «Нет генерации — нет встроенных
 * шаблонов» — честная деградация, а не тихое исключение из правил.
 *
 * Спрашивается возможность в момент ПЕЧАТИ, а не при сборке: оба плагина ленивые, порядок
 * активации незначим, и захваченное здесь значение было бы `undefined` навсегда.
 *
 * @module plugins/reformer/templates/stack/workspace
 */

import { KitsCapability, type PluginContext } from '@reformer/builder-plugin-api';
import { projectCatalog } from '../../../core/catalog';
import type { KitView } from '../../../core/codegen';
import { ModulePrinterCapability } from '../../../core/contracts/printer';
import type { ModulePrinter } from './builtin';

export { ModulePrinterCapability } from '../../../core/contracts/printer';
export type { ModulePrinterService } from '../../../core/contracts/printer';

/**
 * Активный кит из службы китов контекста — `get` на каждый вызов: плагин кита вправе подняться
 * позже. `null` — кита нет.
 */
export function templateStackKit(ctx: PluginContext): () => KitView | null {
  return () => {
    const service = ctx.services.get(KitsCapability);
    if (service === undefined) return null;
    const { descriptor, entries } = projectCatalog(service.catalogJson());
    return { kit: descriptor, catalog: entries };
  };
}

/**
 * Печатник поверх возможности: спрашивает её на каждую печать.
 *
 * Пустой список, когда возможности нет, — тот же ответ, что и у генерации без кита: «печатать
 * нечем». Встроенные шаблоны в этом случае просто не показываются.
 */
export function templatesPrinter(ctx: PluginContext): ModulePrinter {
  return async (schema, formName, seed) => {
    const printer = ctx.services.get(ModulePrinterCapability);
    if (printer === undefined) return [];
    return printer.print(schema, formName, seed);
  };
}

/**
 * Есть ли чем печатать прямо сейчас.
 *
 * Спрашивается на каждый вопрос «доступны ли встроенные шаблоны», а не один раз при сборке:
 * генерация кода — ленивый плагин и вправе подняться позже шаблонов. Ответ, снятый при
 * активации, оставил бы раздел встроенных пустым навсегда.
 */
export function hasPrinter(ctx: PluginContext): boolean {
  return ctx.services.get(ModulePrinterCapability) !== undefined;
}
