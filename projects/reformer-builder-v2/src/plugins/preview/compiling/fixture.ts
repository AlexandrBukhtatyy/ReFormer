/**
 * Чтение и исполнение фикстуры формы.
 *
 * ## Почему это ОТДЕЛЬНЫЙ граф, а не файл в наборе сайдкаров
 *
 * Фикстура лежит в каталоге формы, рядом с сайдкарами, — соблазн взять её тем же набором велик:
 * одна загрузка вместо двух. Он ведёт к тихой поломке. Фикстура подставляет модули (`./api`),
 * а сайдкары их импортируют; окажись оба в одном графе, `api.ts` исполнился бы дважды — один раз
 * как импорт фикстуры, второй как импорт сайдкара, — и форма получила бы ДВА разных объекта под
 * одним именем. Это ровно та потеря идентичности, ради защиты от которой написан линковщик,
 * только зашедшая с чёрного хода. Держит их врозь отбор сайдкаров: `fixture.ts` в него не входит
 * (см. `./sources`).
 *
 * Отсюда правило, которое надо назвать вслух: **фикстура импортирует из формы только типы**.
 * `import type` стирается транспилятором и графа не создаёт; импорт значения из сайдкара
 * не разрешится вовсе, потому что сайдкаров в наборе фикстуры нет.
 *
 * ## Отсутствие фикстуры — не находка
 *
 * Её нет у большинства форм, и это норма: превью наполняет форму синтезом из схемы. Поэтому
 * промах чтения проходит молча, а вот СБОЙ ИСПОЛНЕНИЯ показывается — файл есть, человек его
 * писал, и «фикстура не применилась» без объяснения было бы худшим из ответов.
 *
 * @module plugins/preview/compiling/fixture
 */

import { FIXTURE_EXPORT, fixturePathOf, type FormFixture } from '@/lib/form-fixture';
import type { ResourceId } from '@/sdk';
import type { PreviewProblem } from '../contract';
import type { PreviewHost, PreviewModules } from '../host';

/** Что дала фикстура. */
export interface LoadedFixture {
  /** Разобранная фикстура либо `null` — её нет или она не исполнилась. */
  readonly fixture: FormFixture | null;
  /** Путь файла, если он нашёлся. Для сообщений: человеку надо знать, что именно применилось. */
  readonly path: string | null;
  readonly problems: readonly PreviewProblem[];
}

const NOTHING: LoadedFixture = Object.freeze({ fixture: null, path: null, problems: [] });

const describe = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/** Похоже ли исполненное на фикстуру. Форма проверяется по факту, а не по вере в контракт. */
function asFixture(value: unknown): FormFixture | null {
  return typeof value === 'object' && value !== null ? (value as FormFixture) : null;
}

/**
 * Читает и исполняет фикстуру документа схемы.
 *
 * @param schemaPath путь документа внутри источника — из него выводится адрес фикстуры
 */
export async function loadFixture(
  host: PreviewHost,
  modules: PreviewModules | undefined,
  documentId: ResourceId,
  schemaPath: string
): Promise<LoadedFixture> {
  const resolveFromRoot = host.resolveFromRoot;
  if (modules === undefined || resolveFromRoot === undefined) return NOTHING;

  const path = fixturePathOf(schemaPath);
  if (path === null) return NOTHING;

  let source: string;
  try {
    source = await host.readText(resolveFromRoot(documentId, path));
  } catch {
    // Фикстуры нет — самый частый случай, и он не событие.
    return NOTHING;
  }

  let primed;
  try {
    primed = await modules.prepare?.(new Map([[path, source]]));
  } catch (error) {
    return { fixture: null, path, problems: [problem(path, 'transpile', describe(error))] };
  }

  let graph;
  try {
    graph = await modules.load(new Map([[path, source]]), path, { ready: primed?.ready });
  } catch (error) {
    return { fixture: null, path, problems: [problem(path, 'evaluate', describe(error))] };
  }

  if (primed !== undefined && graph.compiled !== undefined && graph.compiled.size > 0) {
    void primed.commit(graph.compiled).catch(() => {
      // Кэш ускоряет следующую сборку; не записался — не беда, и молчать об этом честно.
    });
  }

  const problems = graph.errors.map((error) => problem(error.file, error.phase, error.message));
  const exported = (graph.entry as Record<string, unknown> | undefined)?.[FIXTURE_EXPORT];
  if (exported === undefined) {
    // Файл есть, а экспорта нет — почти всегда опечатка в имени. Молчать нельзя: человек
    // правит фикстуру и не понимает, почему форма её не видит.
    if (problems.length === 0) {
      problems.push(
        problem(
          path,
          'evaluate',
          `фикстура не экспортирует «${FIXTURE_EXPORT}» — форма её не увидит`
        )
      );
    }
    return { fixture: null, path, problems };
  }

  return { fixture: asFixture(exported), path, problems };
}

function problem(file: string, phase: PreviewProblem['phase'], message: string): PreviewProblem {
  return { file, phase, message };
}
