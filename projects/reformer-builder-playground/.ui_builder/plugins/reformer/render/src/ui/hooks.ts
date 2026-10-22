/**
 * Подписки React на контекст превью и на его состояние.
 *
 * Отдельно от поверхностей по той же причине, по которой у редактора схемы отделён `useSession`:
 * правила живут в чистых модулях, а здесь остаётся переходник `useSyncExternalStore`, в котором
 * нечему ломаться, кроме стабильности снимка.
 *
 * Про стабильность и речь: `getSnapshot` обязан возвращать ту же ссылку, пока ничего
 * не изменилось, иначе React падает с «The result of getSnapshot should be cached». Поэтому
 * контекст кэширует разобранную схему, а состояние отдаёт замороженный снимок.
 *
 * @module plugins/reformer/render/ui/hooks
 */

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import type { JsonFormSchema } from '@reformer/renderer-json';
import type { NodeId, ResourceId } from '@reformer/builder-plugin-api';
import type { PreviewContext } from '@reformer/builder-plugin-api';
import { ensureSchema, isFormSchema } from '../../../core/form-model';
import type { PreviewHost } from '../host';
import { rulesSidecarNameOf } from '../../../core/codegen/layout';
import { parseRulesText } from '../../../core/codegen/rules-file';

/** Перевод документа прежнего формата — по одному на объект: снимок обязан быть стабильным. */
const migrated = new WeakMap<object, JsonFormSchema>();

/**
 * Документ в формате 2.
 *
 * Модель документа редактора уже переведена, и для неё это та же ссылка. Но контекст превью
 * отдаёт модель любого источника, и документ прежнего формата единая сборка не собирает вовсе.
 */
function format2(schema: JsonFormSchema): JsonFormSchema {
  const known = migrated.get(schema);
  if (known !== undefined) return known;
  const next = ensureSchema(schema);
  migrated.set(schema, next);
  return next;
}

/**
 * Схема документа с перерисовкой на каждую правку буфера.
 *
 * Контекст отдаёт модель `unknown`: превью общее для стеков, а сужает модель поверхность —
 * своей проверкой. Проверка идёт в снимке, и ссылка при этом остаётся стабильной: сужение
 * отдаёт либо тот же объект, либо его перевод в формат 2 (один на объект, см. {@link format2}),
 * либо `null`.
 */
export function usePreviewSchema(ctx: PreviewContext): JsonFormSchema | null {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const subscription = ctx.onDidChangeSchema(onStoreChange);
      return () => {
        subscription.dispose();
      };
    },
    [ctx]
  );
  const snapshot = useCallback(() => {
    const schema = ctx.schema();
    return isFormSchema(schema) ? format2(schema) : null;
  }, [ctx]);
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

/** Выделение с перерисовкой на его смену. */
export function usePreviewSelection(ctx: PreviewContext): readonly NodeId[] {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const subscription = ctx.onDidChangeSelection(onStoreChange);
      return () => {
        subscription.dispose();
      };
    },
    [ctx]
  );
  const snapshot = useCallback(() => ctx.selection(), [ctx]);
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

/**
 * Счётчик смен активного кита.
 *
 * Нужен ровно затем, чтобы пересобрать реестр компонентов: каталог и namespace приходят
 * функциями порта, и без подписки превью осталось бы с китом, который был активен в момент
 * первой сборки. `useState`, а не `useSyncExternalStore`: снимка здесь нет вовсе — есть
 * событие «пересоберись», и счётчик выражает его точнее, чем выдуманное значение.
 */
export function useKitVersion(host: Pick<PreviewHost, 'onDidChangeKit'>): number {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const subscription = host.onDidChangeKit(() => {
      setVersion((previous) => previous + 1);
    });
    return () => {
      subscription.dispose();
    };
  }, [host]);
  return version;
}

/**
 * Счётчик правок рабочих копий.
 *
 * Отдельно от подписки на документ схемы: сайдкары формы правят в соседних вкладках, и
 * `onDidChangeContent` про них ничего не знает. Порт вправе такого канала не дать — тогда
 * счётчик остаётся нулём, и компиляция пересобирается только на смене схемы.
 */
export function useFilesVersion(host: Pick<PreviewHost, 'onDidChangeFiles'>): number {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const subscription = host.onDidChangeFiles?.(() => {
      setVersion((previous) => previous + 1);
    });
    return () => {
      subscription?.dispose();
    };
  }, [host]);
  return version;
}

/** Собранная форма в той части, что нужна поверхности: контроллер живой проверки. */
interface LiveForm {
  readonly validation?: { readonly controller: { start(): (() => void) | void } };
}

/**
 * Живая проверка формы — то же, что делает `useFormBundle` у приложения.
 *
 * Сборка только создаёт контроллер стратегии, запускает его React-эффект. Превью собирает форму
 * в `useMemo` (схему правят непрерывно, и форма пересобирается), поэтому запуск повторён здесь:
 * без него стратегии `onChange` и `onBlur` в превью молчали бы, и форма «не валидировалась».
 */
export function useLiveValidation(form: LiveForm | null): void {
  const controller = form?.validation?.controller;
  useEffect(() => controller?.start(), [controller]);
}

const formKeys = new WeakMap<object, number>();
let lastFormKey = 0;

/**
 * Ключ React для рендерера формы — свой у каждой сборки.
 *
 * Граница ошибок схемы внутри `FormRenderer` сбрасывается только перемонтированием: без ключа
 * ошибка прошлой сборки осталась бы на экране после того, как схему уже починили.
 */
export function formKeyOf(form: object): number {
  let key = formKeys.get(form);
  if (key === undefined) {
    lastFormKey += 1;
    key = lastFormKey;
    formKeys.set(form, key);
  }
  return key;
}

/** Путь файла правил документа от корня проекта: рядом с документом. */
function rulesPathOf(documentPath: string): string {
  const slash = documentPath.lastIndexOf('/');
  const dir = slash < 0 ? '' : documentPath.slice(0, slash + 1);
  return `${dir}${rulesSidecarNameOf(documentPath)}`;
}

/**
 * Значения источников данных из файла правил рядом с документом — их превью показывает вместо
 * выдуманных вариантов. Файл перечитывается, когда его правят в рабочей копии.
 *
 * Без адреса по пути (`resolveFromRoot`) файл не читается, и превью остаётся с выдуманными
 * вариантами — так же, как без файла правил. Битый файл — тоже «значений нет»: о нём говорят те,
 * кто в него пишет.
 */
export function useRuleDataSources(
  host: Pick<PreviewHost, 'readText' | 'resolveFromRoot' | 'onDidChangeFiles'>,
  doc: { readonly id: ResourceId; readonly ref: { readonly path: string } }
): Readonly<Record<string, unknown>> | undefined {
  const [sources, setSources] = useState<Readonly<Record<string, unknown>> | undefined>();
  useEffect(() => {
    const resolve = host.resolveFromRoot;
    if (resolve === undefined) return undefined;
    const id = resolve(doc.id, rulesPathOf(doc.ref.path));
    let live = true;
    const load = (): void => {
      host.readText(id).then(
        (text) => {
          const parsed = parseRulesText(text);
          if (live) setSources(parsed.ok ? parsed.rules.dataSources : undefined);
        },
        () => {
          if (live) setSources(undefined);
        }
      );
    };
    load();
    const subscription = host.onDidChangeFiles?.((changed) => {
      if (changed.includes(id)) load();
    });
    return () => {
      live = false;
      subscription?.dispose();
    };
  }, [host, doc.id, doc.ref.path]);
  return sources;
}
