/**
 * Возможность «напечатать модуль формы» — контракт ВНУТРИ домена ReFormer.
 *
 * Её отдаёт стек ReFormer в генерации кода (`reformer.codegen-schema`), берёт стек ReFormer в
 * шаблонах: встроенный шаблон формы — это затравка, которую надо превратить в модуль, и печатает
 * его ровно тот же конвейер, что и панель экспорта. Оба плагина — домена ReFormer, схема и правила
 * в контракте — его же, поэтому контракт лежит в ядре домена, а не в SDK: другому стеку он не
 * нужен, а в SDK стал бы обещанием, которое никто, кроме ReFormer, не выполнит.
 *
 * Снаружи схема и правила описаны `unknown`: возможность — граница плагинов, и проверяет вход тот,
 * кто печатает.
 *
 * @module plugins/reformer/core/contracts/printer
 */

import { defineCapability } from '@reformer/builder-plugin-api';

/**
 * Один файл напечатанного модуля: путь от КОРНЯ МОДУЛЯ формы и содержимое.
 *
 * Модуль разложен по папкам ролей: документ формы — `schema/form.schema.json`, страница —
 * `<Тип>.tsx`, реэкспорты — `index.ts`, остальное — в `application/`, `model/`, `validation/`,
 * `behavior/`, … Потребитель кладёт файлы как есть, от каталога формы.
 */
export interface PrintedFile {
  readonly path: string;
  readonly content: string;
}

/** Чем затравка дополняет схему: правила формы и мок источников данных. */
export interface PrintSeed {
  readonly rules?: unknown;
  readonly mock?: unknown;
  /** Вынести шаги визарда в свои файлы — шаблон «Пошаговая форма». */
  readonly splitSteps?: boolean;
}

export interface ModulePrinterService {
  /** Схема и имя формы — набор файлов модуля. Пустой список означает «печатать нечем». */
  print(schema: unknown, formName: string, seed?: PrintSeed): Promise<readonly PrintedFile[]>;
}

/** Версия `1.0.0` — исходная. */
export const ModulePrinterCapability = defineCapability<ModulePrinterService>({
  id: 'reformer.codegen.printer',
  version: '1.0.0',
});
