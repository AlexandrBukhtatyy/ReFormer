/**
 * Где редактор держит прокрутку и позицию каретки между открытиями вкладки.
 *
 * ## Почему платформа, а не редактор
 *
 * Реестр жил в плагине Monaco (`plugins/editor-monaco/sync/view-state`), и композиция
 * передавала ОДИН его экземпляр троим: обычной вкладке кода, режиму «рядом» у markdown
 * и исходнику редактора схемы. Держалось это на дисциплине — «обязан быть тем же объектом»,
 * — которую компилятор не проверяет: второй экземпляр давал не отказ, а потерянную позицию
 * курсора при каждом переключении вида. Любой другой текстовый редактор (второй встроенный
 * или внешний из каталога проекта) своего снимка сюда не клал вовсе: дотянуться до чужого
 * плагина ему нечем.
 *
 * Поэтому хранилище — часть платформы, а редакторы получают его возможностью
 * {@link EditorViewStatesCapability}. Дисциплина «один объект» при этом не нужна: общее
 * здесь ХРАНИЛИЩЕ, а вид на него ({@link EditorViewStates.forEditor}) не держит состояния
 * и может создаваться сколько угодно раз.
 *
 * ## Почему ключ составной
 *
 * Снимок принадлежит ПАРЕ «редактор + документ»: у текстового редактора это прокрутка,
 * у структурного — свёрнутые ветки, и одно поле означает у них разное. Ключ из одного
 * документа означал бы, что переключение вида восстанавливает чужой снимок. Тем же
 * составным ключом живёт `ui/contributions/editors`.{@link ViewStateStore} — и это
 * РАЗНЫЕ половины одной задачи, а не дубль: то хранилище снимает состояние у редактора
 * в момент переключения вкладки (`capture`), а это — принимает написанное редактором
 * ЗАРАНЕЕ. Заранее — потому что `capture` зовётся в уборке эффекта раскладки, когда тело
 * редактора уже размонтировано, а спрашивать состояние у мёртвого экземпляра нечем
 * (подробнее — `plugins/editor-monaco/sync/view-state`).
 *
 * ## Почему значение непрозрачное
 *
 * Платформа в снимок не заглядывает и заглянуть не может: что там лежит, знает только
 * положивший. Отсюда `unknown` вместо типа: проверяет значение тот, кто его читает, — и
 * у Monaco эта проверка уже есть (`readViewState`), потому что в хранилище может прийти
 * снимок прошлой версии редактора.
 *
 * @module shell/platform/workspace/model/editor-view-states
 */

import { defineCapability, type Capability } from '@/shell/platform/primitives/capability';
import type { ResourceId } from '@/shell/platform/primitives/resource';

/** Вид хранилища для ОДНОГО редактора: ровно то, чем пользуется его тело. */
export interface EditorViewStateSlice {
  /** Запоминает снимок. Повторная запись того же значения — дело вызывающего. */
  record(id: ResourceId, state: unknown): void;
  /** Последний записанный снимок или `undefined`. Разбирает его читающий. */
  peek(id: ResourceId): unknown;
  /** Забывает снимок этого документа у ЭТОГО редактора. */
  forget(id: ResourceId): void;
}

export interface EditorViewStates {
  /**
   * Вид на хранилище от лица редактора `editorId`.
   *
   * `editorId` — идентификатор ВКЛАДА редактора (`EditorContribution.id`), а не плагина:
   * плагин вправе внести два редактора, и снимки у них разные.
   */
  forEditor(editorId: string): EditorViewStateSlice;
}

/**
 * Разделитель составного ключа.
 *
 * Пробел: ни в идентификаторе вклада, ни в идентификаторе ресурса (`sourceId:path`) он
 * невыразим, поэтому склейка однозначна, — а `:` был бы двусмыслен.
 */
const KEY_SEPARATOR = ' ';

export function createEditorViewStates(): EditorViewStates {
  const states = new Map<string, unknown>();
  const keyOf = (editorId: string, id: ResourceId): string => `${editorId}${KEY_SEPARATOR}${id}`;

  const slice = (editorId: string): EditorViewStateSlice => ({
    record(id, state) {
      states.set(keyOf(editorId, id), state);
    },
    peek: (id) => states.get(keyOf(editorId, id)),
    forget(id) {
      states.delete(keyOf(editorId, id));
    },
  });

  return { forEditor: slice };
}

/**
 * Возможность «снимки вида редакторов».
 *
 * Провайдер — оболочка (`services/host-capabilities`), а не редактор: хранилище делят
 * ВСЕ редакторы, и принадлежать оно не может ни одному из них. Версия `1.0.0` — исходная.
 */
export const EditorViewStatesCapability: Capability<EditorViewStates> =
  defineCapability<EditorViewStates>({ id: 'shell.editorViewStates', version: '1.0.0' });

/** Токен службы — ТОТ ЖЕ объект: возможность расширяет токен, второго реестра нет. */
export const EditorViewStatesToken = EditorViewStatesCapability;
