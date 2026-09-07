/**
 * Находки сборки → диагностики платформы: чистый перевод, без службы и без React.
 *
 * ## Зачем находкам сборки второй канал
 *
 * `PreviewProblem` живёт в состоянии превью, и показывал его только живой вид — да и тот лишь
 * когда форма не собралась вовсе. Битый `validation.ts` при собравшейся форме молчал везде:
 * ни в редакторе этого файла, ни в панели проблем, ни пометкой в дереве. А все три места
 * читают ОДИН свод — службу диагностик, — и класть находку туда значит показать её во всех
 * трёх сразу, ничего в них не меняя.
 *
 * ## Код вместо текста
 *
 * Диагностика несёт ключ словаря Host, а находка сборки — готовый текст движка. Разница
 * снимается кодом на фазу (`build.<фаза>`) с текстом в параметре: фаза говорит, ГДЕ чинить
 * (импорт, синтаксис, исполнение), и это переводится; текст движка — что именно, и он
 * остаётся как есть, потому что перевести чужое сообщение нечем.
 *
 * ## Адрес — файл, если он назван
 *
 * Сбой транспиляции `validation.ts` — это находка `validation.ts`, а не схемы: подчёркивать
 * надо там, где чинить. Сбой без файла (схема не разбирается, рендер упал) относится к документу
 * схемы. Правило одно, {@link problemResource}, и им же пользуется композиция, отбирая, что
 * из находок показать в живом виде строкой, а что человек прочтёт из свода документа.
 *
 * @module plugins/preview/state/problem-diagnostics
 */

import type { Diagnostic, ResourceId } from '@/sdk';
import type { PreviewProblem, PreviewProblemPhase } from '../contract';

/**
 * Источник, под которым находки сборки публикуются в службу диагностик.
 *
 * Один на превью, а не по поверхности: смонтирована ровно одна, и два имени источника
 * значили бы, что при смене поверхности прежние находки некому снять.
 */
export const BUILD_DIAGNOSTICS_SOURCE = 'preview.build';

/** Код диагностики по фазе: ключ словаря Host — `errors.build.<фаза>`. */
export function buildCode(phase: PreviewProblemPhase): string {
  return `build.${phase}`;
}

/** Ресурс, к которому относится находка: свой файл, если он назван, иначе документ схемы. */
export function problemResource(documentId: ResourceId, problem: PreviewProblem): ResourceId {
  return problem.resource ?? documentId;
}

/**
 * Находка сборки как диагностика.
 *
 * Строгость всегда `error`: несобравшийся сайдкар — это форма, которая не делает того, что
 * написано в её файлах, и «предупреждением» это не назовёшь. Цель — диапазон, если движок
 * назвал место, иначе ресурс целиком (редактор положит такое на первую строку).
 */
export function toDiagnostic(problem: PreviewProblem): Diagnostic {
  return {
    source: BUILD_DIAGNOSTICS_SOURCE,
    severity: 'error',
    code: buildCode(problem.phase),
    params: { file: problem.file, message: problem.message },
    target:
      problem.range === undefined ? { kind: 'resource' } : { kind: 'range', range: problem.range },
  };
}

/**
 * Раскладывает находки документа по адресам публикации — по одному списку на ресурс.
 *
 * Порядок внутри ресурса — порядок находок: так их отдала сборка, и панель проблем
 * досортирует по строгости сама.
 */
export function groupByResource(
  documentId: ResourceId,
  problems: readonly PreviewProblem[]
): ReadonlyMap<ResourceId, readonly Diagnostic[]> {
  const out = new Map<ResourceId, Diagnostic[]>();
  for (const problem of problems) {
    const resource = problemResource(documentId, problem);
    const list = out.get(resource);
    if (list === undefined) out.set(resource, [toDiagnostic(problem)]);
    else list.push(toDiagnostic(problem));
  }
  return out;
}
