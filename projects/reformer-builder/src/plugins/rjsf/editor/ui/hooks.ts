/**
 * Подписки React на то, чем живут тело редактора и панель свойств: ручка документа, модель,
 * выделение, вид и поля кита.
 *
 * Общие, потому что читают их двое: тело вкладки знает свой документ, а панель в правом доке —
 * только то, что она панель, и находит документ по активной вкладке. Выделение у обоих одно —
 * оно живёт в ручке модели, поэтому поле, выбранное в структуре, видит и панель.
 *
 * Снимки — ссылки, которые платформа меняет только на изменении (`getModel`, `getSelection`,
 * ручка по ресурсу), поэтому кэшировать их здесь не нужно.
 *
 * @module plugins/rjsf/editor/ui/hooks
 */

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { RjsfForm } from '@/plugins/rjsf/core';
import type {
  Disposable,
  KitsService,
  ModelDocumentHandle,
  PreviewLiveService,
  ResourceId,
} from '@reformer/builder-plugin-api';
import { rjsfHandleOf, type RjsfServices } from '../commands';
import type { RjsfView, RjsfViewStore } from '../view';

export type Translate = (key: string, params?: Record<string, unknown>) => string;

const NOOP: Disposable = { dispose: () => {} };

/** Ручка документа как внешнее состояние: вкладка открывается раньше, чем модель готова. */
export function useHandle(
  services: RjsfServices,
  documentId: ResourceId
): ModelDocumentHandle<RjsfForm> | null {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const subscription = services.documents()?.onDidChange(onChange) ?? NOOP;
      return () => {
        subscription.dispose();
      };
    },
    [services]
  );
  const snapshot = useCallback(() => rjsfHandleOf(services, documentId), [services, documentId]);
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

/** Ручка документа активной вкладки; `null` — вкладок нет или документ не форма домена. */
export function useActiveHandle(services: RjsfServices): ModelDocumentHandle<RjsfForm> | null {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const subscription = services.documents()?.onDidChange(onChange) ?? NOOP;
      return () => {
        subscription.dispose();
      };
    },
    [services]
  );
  const snapshot = useCallback(() => {
    const id = services.documents()?.activeResource() ?? null;
    return id === null ? null : rjsfHandleOf(services, id);
  }, [services]);
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

/** Модель документа: перечитывается на каждую правку, отмену и разбор. */
export function useModel(handle: ModelDocumentHandle<RjsfForm>): RjsfForm {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const subscription = handle.document.onDidChangeModel(onChange);
      return () => {
        subscription.dispose();
      };
    },
    [handle]
  );
  const snapshot = useCallback(() => handle.document.getModel(), [handle]);
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

/** Выделение документа: его переносят операции (`focus`), щелчок по строке и отмена. */
export function useSelection(handle: ModelDocumentHandle<RjsfForm>): readonly string[] {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const subscription = handle.document.onDidChangeModel(onChange);
      return () => {
        subscription.dispose();
      };
    },
    [handle]
  );
  const snapshot = useCallback(() => handle.document.getSelection(), [handle]);
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

/**
 * Выбранное поле: ровно одно имя, и поле с таким именем в форме есть.
 *
 * Адрес поля — его имя, а имя переживает не всё: поле удалили, добавление отменили. Такое
 * выделение — «поле не выбрано», а не повод показывать свойства поля, которого нет.
 *
 * `null` читается как «выбрана форма целиком»: своего адреса у формы нет, и структура с панелью
 * показывают её выбранной именно тогда, когда не выбрано ни одно поле.
 */
export function selectedFieldOf(form: RjsfForm, selection: readonly string[]): string | null {
  const name = selection.length === 1 ? selection[0] : undefined;
  return name !== undefined && Object.hasOwn(form.schema.properties, name) ? name : null;
}

/** Действующий вид вкладки. Снимок — строка, кэшировать нечего. */
export function useRjsfView(store: RjsfViewStore): RjsfView {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const subscription = store.subscribe(onChange);
      return () => {
        subscription.dispose();
      };
    },
    [store]
  );
  const snapshot = useCallback(() => store.view(), [store]);
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

/**
 * Перерисовка по смене состава поверхностей превью (плагин рендера выключили или включили).
 *
 * Счётчик, а не снимок: `chosen()` собирает объект на каждый вызов, а сам сигнал значения
 * не несёт — после него перечитываются и выбранная поверхность, и действующий вид.
 */
export function useLiveRevision(
  live: PreviewLiveService | undefined,
  documentId: ResourceId
): void {
  const [, setVersion] = useState(0);
  useEffect(() => {
    const subscription = live?.onDidChange(documentId, () => {
      setVersion((previous) => previous + 1);
    });
    return () => {
      subscription?.dispose();
    };
  }, [live, documentId]);
}

/** Поля активного кита — виджеты под своими именами. Кита нет — пусто. */
export function useKitFields(kits: KitsService | undefined): readonly string[] {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const subscription = kits?.onDidChange(onChange) ?? NOOP;
      return () => {
        subscription.dispose();
      };
    },
    [kits]
  );
  const snapshot = useCallback(() => kits?.catalogJson() ?? null, [kits]);
  const catalog = useSyncExternalStore(subscribe, snapshot, snapshot);
  return useMemo(
    () =>
      catalog === null
        ? []
        : catalog.components
            .filter((record) => record.role === 'field')
            .map((record) => record.name),
    [catalog]
  );
}
