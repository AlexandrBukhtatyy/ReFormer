/**
 * Реестр стенда: три формы × три источника схемы = девять записей.
 *
 * **Почему СВОЙ реестр, а не глобальный.** `FormOutlet`, вызванный без `version`, матчит все версии
 * записи и берёт первую после сортировки по убыванию версии. Обе витринные страницы
 * (`alerts-list-renderer-json`, `complex-multy-step-form-registry`) зовут его именно так — без
 * версии. Положи мы варианты в общий реестр, эти страницы начали бы монтировать вариант стенда:
 * MSW-источник, который в прод-сборке не отвечает вовсе, а под `?mocks=off` заглушен. Изоляция
 * снимает риск целиком и заодно освобождает выбор идентификаторов.
 *
 * Регистрация на уровне модуля, а не в `useEffect`, — тоже осознанно: в эффекте первый рендер
 * прошёл бы с `entry === undefined`, `FormOutlet` вернул бы `null` ДО `EntryMount`, и `fallback`
 * не показался бы; плюс StrictMode дал бы цикл register → unregister → register. При HMR модуль
 * переоценивается вместе с новым реестром, так что конфликта идентификаторов не возникает.
 *
 * @module react-playground/examples/form-registry-lab/lab-registry
 */

import { createFormRegistry, type FormEntry, type FormRegistry } from '@reformer/form-registry';
import type { JsonFormSchema } from '@reformer/renderer-json';
import { alertsFormEntry } from '../../demo/alerts-list-renderer-json/form-setup';
import { creditApplicationFormEntry } from '../../demo/complex-multy-step-form-registry/form-setup';
import { registrationFormEntry } from '../../demo/registration-form-renderer-json/form-entry';
import { SCHEMA_SOURCES, withSchemaSource, type SchemaSourceKind } from './schema-sources';

export interface LabForm {
  /** Идентификатор БЕЗ суффикса источника — им же назван файл схемы у статики и в MSW. */
  formId: string;
  title: string;
  /** Чем эта форма интересна кэшу. */
  note: string;
}

export const LAB_FORMS: readonly LabForm[] = [
  {
    formId: 'registration-form',
    title: 'Регистрация',
    note: 'Схема 9,7 КБ. AsyncBoundary грузит префилл — видно, что кэш схемы и загрузка данных независимы.',
  },
  {
    formId: 'credit-application',
    title: 'Кредитная заявка',
    note: 'Схема 68 КБ — ради таких и заведён L2: переживает F5 вместо повторной закачки.',
  },
  {
    formId: 'alerts-list',
    title: 'Список алертов',
    note: 'Схема 2 КБ — меньше порога инлайна Vite, поэтому статика подключена с no-inline.',
  },
];

/**
 * Схема из бандла берётся у самой базовой записи, а не импортируется отдельно.
 *
 * Так вариант «из бандла» гарантированно совпадает с тем, что монтирует обычная страница витрины:
 * второй импорт того же JSON дал бы формально другой объект и повод для расхождения.
 */
function inlineSchemaOf<T extends object>(entry: FormEntry<T>): JsonFormSchema<T> {
  if (entry.schema.kind !== 'inline') {
    throw new Error(
      `[стенд] Базовая запись "${entry.id}" обязана нести схему из бандла: от неё строятся все варианты`
    );
  }
  return entry.schema.value;
}

/** Базовые записи, от которых порождаются варианты. Порядок — как в LAB_FORMS. */
const BASE_ENTRIES = [
  registrationFormEntry,
  creditApplicationFormEntry,
  alertsFormEntry,
] as unknown as FormEntry[];

export const labEntries: readonly FormEntry[] = BASE_ENTRIES.flatMap((base) =>
  SCHEMA_SOURCES.map((source) => withSchemaSource(base, source.kind, inlineSchemaOf(base)))
);

/** Идентификатор записи для формы и источника. Должен совпадать с тем, что делает withSchemaSource. */
export const labEntryId = (formId: string, kind: SchemaSourceKind): string => `${formId}--${kind}`;

export const labRegistry: FormRegistry = createFormRegistry();
labRegistry.registerAll(labEntries);
