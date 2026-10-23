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
 * (`@reformer/builder-toolkit`). Файл со сходящимся хэшем перезаписывается, правленый —
 * пропускается СО СЛОВАМИ. Молчаливый `skip-if-exists` не годится: человек, нажавший «создать»,
 * обязан узнать, что ничего не произошло и почему.
 *
 * @module plugins/reformer/codegen/stack/fixture-command
 */

import { valueTypesOf } from '../../../core/codegen';
import { emitFixture, fixturePathOf } from '../../../core/form-fixture';
import { isGenerated, withMarker } from '@reformer/builder-toolkit';
import type { CatalogEntry } from '../../../core/catalog';
import type { CodegenDocument, ResourceId } from '@reformer/builder-plugin-api';
import { asFormSchema } from './source';

/** Рабочая область в объёме фикстуры: прочитать документ, решить адрес, записать и сохранить. */
export interface FixtureHost {
  documentOf(id: ResourceId): Pick<CodegenDocument, 'id' | 'ref' | 'model'> | null;
  /** Возможности источника ресурса; `null` — источника нет. */
  sourceOf(id: ResourceId): { readonly write: boolean } | null;
  /** Каталог активного кита: из него — вид значения поля. */
  catalog(): readonly CatalogEntry[];
  /** Адрес по пути от корня проекта. Нет — команда отказывается работать. */
  resolveFromRoot?(anchor: ResourceId, path: string): ResourceId;
  readText(id: ResourceId): Promise<string | null>;
  writeText(id: ResourceId, text: string): Promise<void>;
  save?(ids: readonly ResourceId[]): Promise<boolean>;
}

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

/**
 * Создаёт или обновляет фикстуру документа схемы.
 *
 * Возвращает исход ДАННЫМИ: показывать его словами — дело вызывающего, у которого есть словарь
 * и уведомления.
 */
export async function createFixture(
  host: FixtureHost,
  documentId: ResourceId
): Promise<FixtureOutcome> {
  const document = host.documentOf(documentId);
  // Проверка по факту, а не приведение: модель приходит из чужого документа. И перевод в формат 2
  // там же — по схеме прежнего формата скелет напечатался бы пустым: ни значений, ни источников.
  const schema = asFormSchema(document?.model());
  if (document === null || schema === null) return { kind: 'no-schema' };

  const path = fixturePathOf(document.ref.path);
  const resolveFromRoot = host.resolveFromRoot;
  if (path === null || resolveFromRoot === undefined) return { kind: 'no-target' };
  if (host.sourceOf(documentId)?.write !== true) return { kind: 'no-target' };

  const id = resolveFromRoot(documentId, path);
  const existing = await host.readText(id);
  if (existing !== null && !isGenerated(existing)) return { kind: 'edited', path, id };

  // Вид значения поля — из каталога активного кита, как у кодогена: фикстура, созданная под
  // HexaUI, кладёт `CheckboxGroup` пустым набором (`null`), а не строкой.
  await host.writeText(id, withMarker(emitFixture(schema, {}, valueTypesOf(host.catalog()))));
  await host.save?.([id]);
  return { kind: 'written', path, id };
}
