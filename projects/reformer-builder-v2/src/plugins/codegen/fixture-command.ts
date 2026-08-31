/**
 * Команда «Создать фикстуру»: скелет данных предпросмотра — `fixture.ts` в каталоге формы.
 *
 * ## Почему команда, а не цель генерации
 *
 * Цели генерации перечисляют файлы МОДУЛЯ формы, и набор их закрыт контрактом
 * (`06-form-directory-layout`); фикстуры там нет — она артефакт предпросмотра, а не часть
 * модуля, и её пишут по явной просьбе, а не при каждой регенерации. Отдельная команда ещё и
 * бережёт правки: генерация модуля файл рядом не трогает.
 *
 * ## Правки человека не трутся
 *
 * Тем же механизмом, что и у генерации модуля: маркер происхождения в первой строке
 * ({@link '../../lib/codegen/marker'}). Файл со сходящимся хэшем перезаписывается, правленый —
 * пропускается СО СЛОВАМИ. Молчаливый `skip-if-exists` не годится: человек, нажавший «создать»,
 * обязан узнать, что ничего не произошло и почему.
 *
 * @module plugins/codegen/fixture-command
 */

import type { JsonFormSchema } from '@reformer/renderer-json';
import { emitFixture, fixturePathOf } from '@/lib/form-fixture';
import { isGenerated, withMarker } from '@/lib/codegen';
import type { ResourceId } from '@/sdk';
import type { CodegenHost } from './host';

/** Чем кончилась попытка создать фикстуру. Различаются, потому что человеку говорят разное. */
export type FixtureOutcome =
  /** Файл написан заново или перезаписан поверх нетронутого скелета. */
  | { readonly kind: 'written'; readonly path: string; readonly id: ResourceId }
  /** Файл правили руками — не трогаем. */
  | { readonly kind: 'edited'; readonly path: string; readonly id: ResourceId }
  /** Схема документа не разбирается: печатать скелет не из чего. */
  | { readonly kind: 'no-schema' }
  /** Писать некуда: источник только на чтение либо адрес не строится. */
  | { readonly kind: 'no-target' };

/** Похоже ли значение на схему формы. Проверка по факту: модель приходит из чужого документа. */
function asSchema(model: unknown): JsonFormSchema | null {
  return typeof model === 'object' && model !== null && 'root' in model
    ? (model as JsonFormSchema)
    : null;
}

/**
 * Создаёт или обновляет фикстуру документа схемы.
 *
 * Возвращает исход ДАННЫМИ: показывать его словами — дело вызывающего, у которого есть словарь
 * и уведомления.
 */
export async function createFixture(
  host: CodegenHost,
  documentId: ResourceId
): Promise<FixtureOutcome> {
  const document = host.documentOf(documentId);
  const schema = asSchema(document?.model());
  if (document === null || schema === null) return { kind: 'no-schema' };

  const path = fixturePathOf(document.ref.path);
  const resolveFromRoot = host.resolveFromRoot;
  if (path === null || resolveFromRoot === undefined) return { kind: 'no-target' };
  if (host.sourceOf(documentId)?.write !== true) return { kind: 'no-target' };

  const id = resolveFromRoot(documentId, path);
  const existing = await host.readText(id);
  if (existing !== null && !isGenerated(existing)) return { kind: 'edited', path, id };

  await host.writeText(id, withMarker(emitFixture(schema)));
  await host.save?.([id]);
  return { kind: 'written', path, id };
}
