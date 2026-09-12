/**
 * Синхронная проба и выбор провайдера модели по ресурсу.
 *
 * Сам провайдер, проба и точка расширения живут в пакете `@reformer/builder-plugin-api`,
 * и там же записано, почему провайдер регистрируется на тип ресурса, а не на редактор.
 *
 * @module shell/platform/workspace/model/provider
 */

import {
  DocumentModelPoint,
  type DocumentModelProvider,
  type EditorProbe,
  type ExtensionRegistry,
  type ResourceRef,
} from '@reformer/builder-plugin-api/internal';

/**
 * Проба над уже прочитанным текстом.
 *
 * Существует из-за расхождения в контракте: `applies` объявлен СИНХРОННЫМ, а `probe.text()`
 * возвращает промис — синхронный кандидат физически не может дождаться содержимого.
 * Разрешается это тем, что на пути открытия документа текст уже прочитан (его читает
 * `workspace.open`), и тогда проба умеет отдать его синхронно. Провайдер, которому мало
 * `ref`, сужает тип сам: `'peek' in probe`.
 *
 * `SyncEditorProbe` присваивается в `EditorProbe`, поэтому вклад, объявленный по контракту,
 * ничего не теряет.
 */
export interface SyncEditorProbe extends EditorProbe {
  /** Тот же текст, что отдаст `text()`, но без промиса. */
  peek(): string;
}

/**
 * Умеет ли проба отдать текст синхронно.
 *
 * Предикат, а не `'peek' in probe` на месте: `in` сужает к `Record<'peek', unknown>`, и вызвать
 * такое всё равно нельзя — проверка написалась бы приведением типа, то есть без проверки.
 */
export function isSyncEditorProbe(probe: EditorProbe): probe is SyncEditorProbe {
  return typeof (probe as Partial<SyncEditorProbe>).peek === 'function';
}

/** Проба над известным текстом: `text()` отдаёт готовый промис, `peek()` — саму строку. */
export function createEditorProbe(text: string): SyncEditorProbe {
  // Промис создаётся один раз: `text()` вызовут все кандидаты, а обещание — не работа.
  const promise = Promise.resolve(text);
  return {
    text: () => promise,
    peek: () => text,
  };
}

/** Минимум реестра, нужный для выбора провайдера: годится и корневой, и вид плагина. */
export type ModelProviderSource = Pick<ExtensionRegistry, 'get'>;

/**
 * Первый провайдер, который берётся за ресурс, — или `undefined`, и тогда документ текстовый.
 *
 * Порядок — тот, что задан вкладами (`order`, при равенстве — порядок регистрации), поэтому
 * специализированный провайдер обходит общий не «случайно раньше зарегистрировавшись»,
 * а объявленным приоритетом.
 *
 * Упавший `applies` не мешает открыть файл: провайдер-кандидат пропускается, остальные
 * спрашиваются дальше. Иначе один сломанный плагин делал бы недоступной часть файлов —
 * и не сообщал бы об этом ничем, кроме отказа открытия.
 */
export function resolveModelProvider(
  extensions: ModelProviderSource,
  ref: ResourceRef,
  probe: EditorProbe
): DocumentModelProvider<unknown> | undefined {
  for (const contribution of extensions.get(DocumentModelPoint)) {
    try {
      if (contribution.value.applies(ref, probe)) return contribution.value;
    } catch (err) {
      console.error(
        `[document.model] провайдер «${contribution.value.id}» упал на applies(${ref.id}); пропущен`,
        err
      );
    }
  }
  return undefined;
}
