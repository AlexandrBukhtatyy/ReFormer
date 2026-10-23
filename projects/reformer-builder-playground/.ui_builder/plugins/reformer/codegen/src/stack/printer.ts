/**
 * Возможность «напечатать модуль формы» — печать без записи, по заказу шаблонов форм.
 *
 * Заведена ради шаблонов: встроенный шаблон формы — это схема, которую надо превратить в модуль,
 * и печатает его ровно тот же конвейер, что и панель экспорта. Раньше переходник жил в композиции
 * и тянул кодоген динамическим импортом МИМО состава: профиль без генерации всё равно печатал бы
 * шаблоны её кодом. Теперь это возможность, и «нет стека генерации — нет встроенных шаблонов»
 * стало честной деградацией вместо тихого исключения из правил.
 *
 * Возможность — стека, а не хозяина генерации: печать знает схему ReFormer, его цели и кит, а
 * записи в ней нет вовсе.
 *
 * @module plugins/reformer/codegen/stack/printer
 */

import type { CodegenInput } from '../../../core/codegen';
import { ensureSchema } from '../../../core/form-model';
import { defineCapability, type KitDescriptor } from '@reformer/builder-plugin-api';
import type { CatalogEntry } from '../../../core/catalog';
import { generateModule } from './generate';
import { BUILTIN_TARGETS } from './targets';

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

/** Версия `1.0.0` — исходная. */
export const ModulePrinterCapability = defineCapability<ModulePrinterService>({
  id: 'reformer.codegen.printer',
  version: '1.0.0',
});

export interface ModulePrinterService {
  /** Схема и имя формы — набор файлов модуля. Пустой список означает «печатать нечем». */
  print(schema: unknown, formName: string, seed?: PrintSeed): Promise<readonly PrintedFile[]>;
}

/** Кит и каталог — спрашиваются в момент печати. */
export interface PrinterKit {
  kit(): KitDescriptor | null;
  catalog(): readonly CatalogEntry[];
}

/**
 * Служба печати.
 *
 * Кит спрашивается в момент печати, а не при сборке службы: его переключают, и напечатать надо
 * тем, что действует СЕЙЧАС. Кита нет — печатать нечем, и пустой список честнее модуля с
 * импортами чужого пакета.
 */
export function modulePrinter(source: PrinterKit): ModulePrinterService {
  return {
    print: async (schema, formName, seed) => {
      const kit = source.kit();
      if (kit === null) return [];
      // Граница возможности: снаружи она описана `unknown`, потому что ни схема формы, ни
      // правила не выразимы в SDK — их типы принадлежат рендереру. Схему приводит
      // `ensureSchema`: конвейер печатает только формат 2, а прислать сюда вправе и документ
      // прежнего формата — он напечатался бы пустым модулем без единой ошибки. Правила и мок
      // проверять нечем и не нужно: печатает тот же конвейер, что и панель.
      //
      // Пути файлов — от корня модуля формы, в раскладке «папки по ролям»: документ лежит в
      // `schema/form.schema.json`, страница — `<Тип>.tsx`, реэкспорты — `index.ts`.
      const built = await generateModule(BUILTIN_TARGETS, {
        schema: ensureSchema(schema),
        formName,
        rules: seed?.rules as CodegenInput['rules'],
        mock: seed?.mock as CodegenInput['mock'],
        splitSteps: seed?.splitSteps,
        kit: { kit, catalog: source.catalog() },
      });
      return built.files.map(({ path, content }) => ({ path, content }));
    },
  };
}
