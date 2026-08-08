/**
 * Компиляция каталога формы: исходники → исполненные модули.
 *
 * Две фазы, и это не косметика: транспиляция асинхронна (ленивый `typescript`), а `require` внутри
 * CJS-модуля обязан быть синхронным. Поэтому сперва транспилируем ВСЁ, что нашли, и только потом
 * линкуем — тогда `./model` из `validation.ts` резолвится мгновенно.
 *
 * Изоляция ошибок пофайловая: битый `validation.ts` не должен лишать превью работающего
 * `form-behavior.ts`. Всё, что не собралось, уезжает в {@link LiveError} и показывается в панели
 * «Сборка» — молча деградировать нельзя, иначе «форма не отрабатывает» снова без объяснений.
 *
 * @module reformer-builder/preview-runtime/live/compile-form
 */

import { evalCjsModule } from './link';
import { resolveModule, type ModuleExports } from './module-registry';
import { transpileTs } from './transpile';
import type { FormSources } from './sibling-sources';

/** Ошибка сборки одного файла каталога формы. */
export interface LiveError {
  /** Имя файла (`validation.ts`) либо `''`, если ошибка не привязана к файлу. */
  file: string;
  /** На чём споткнулись: компиляция TS или исполнение модуля. */
  phase: 'transpile' | 'evaluate';
  message: string;
}

/** Результат компиляции каталога. */
export interface CompiledForm {
  /** Имя файла → его экспорты. Только те, что собрались. */
  modules: Record<string, ModuleExports>;
  errors: LiveError[];
}

/** Расширения, которые пробуем при резолве относительного импорта без расширения. */
const EXTENSIONS = ['.ts', '.tsx', ''] as const;

/** Файлы, которые тянем сами. Остальные подтянутся импортами из них. */
const ENTRY_FILES = [
  'model.ts',
  'validation.ts',
  'form-behavior.ts',
  'render-behavior.ts',
  'registry.ts',
  // Имена из ранних шаблонов билдера — форма, сгенерированная давно, тоже должна оживать.
  'behavior.ts',
  'ui.ts',
] as const;

const message = (e: unknown): string => (e instanceof Error ? e.message : String(e));

/** Нормализовать относительный спецификатор (`./model`, `../shared/api.ts`) в имя файла каталога. */
function resolveLocal(spec: string, available: ReadonlySet<string>): string | null {
  // Каталог формы плоский: вложенность и выход наверх не поддерживаем — про это скажет ошибка.
  const bare = spec.replace(/^\.\//, '');
  if (bare.includes('/')) return null;
  for (const ext of EXTENSIONS) {
    const candidate = `${bare}${ext}`;
    if (available.has(candidate)) return candidate;
  }
  return null;
}

/**
 * Транспилировать и исполнить каталог формы. Точки входа — {@link ENTRY_FILES}; всё, что они
 * импортируют внутри каталога, подтягивается рекурсивно и кэшируется (один модуль исполняется один
 * раз, как в настоящем CJS).
 */
export async function compileForm(sources: FormSources): Promise<CompiledForm> {
  const errors: LiveError[] = [];
  const js: Record<string, string> = {};

  for (const [name, code] of Object.entries(sources.files)) {
    try {
      js[name] = await transpileTs(code, name);
    } catch (e) {
      errors.push({ file: name, phase: 'transpile', message: message(e) });
    }
  }

  const available = new Set(Object.keys(js));
  const modules: Record<string, ModuleExports> = {};
  /** Файлы в процессе исполнения — детект циклического импорта. */
  const inFlight = new Set<string>();

  const requireFrom = (importer: string, spec: string): ModuleExports => {
    if (!spec.startsWith('.')) return resolveModule(spec);

    const file = resolveLocal(spec, available);
    if (!file) {
      throw new Error(
        `${importer}: импорт «${spec}» не найден среди файлов каталога формы` +
          (Object.keys(sources.files).length
            ? ` (есть: ${Object.keys(sources.files).join(', ')})`
            : '')
      );
    }
    return loadFile(file);
  };

  const loadFile = (file: string): ModuleExports => {
    const done = modules[file];
    if (done) return done;
    if (inFlight.has(file)) {
      throw new Error(`Циклический импорт: ${[...inFlight, file].join(' → ')}`);
    }
    inFlight.add(file);
    try {
      const exports = evalCjsModule(js[file], (spec) => requireFrom(file, spec), file);
      modules[file] = exports;
      return exports;
    } finally {
      inFlight.delete(file);
    }
  };

  for (const file of ENTRY_FILES) {
    if (!available.has(file) || modules[file]) continue;
    try {
      loadFile(file);
    } catch (e) {
      errors.push({ file, phase: 'evaluate', message: message(e) });
    }
  }

  return { modules, errors };
}
