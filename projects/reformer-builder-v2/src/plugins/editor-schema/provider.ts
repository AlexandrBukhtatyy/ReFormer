/**
 * Провайдер модели схемы формы: разбор, печать и правка одного формата.
 *
 * Это ядро плагина. Всё остальное — канвас, палитра, инспектор — рисует то, что провайдер
 * разобрал, и правит его операциями, которые провайдер умеет применять.
 *
 * ## Берётся по содержимому, а не по расширению
 *
 * `.json` бывает и схемой формы, и `package.json`, и мета-схемой. Поэтому {@link applies}
 * отвечает по РАЗБОРУ: текст обязан быть объектом с узлом в `root` ({@link isFormSchema}
 * домена). Проба отдаёт содержимое синхронно (`peek`), потому что его уже прочитал тот, кто
 * открывает документ, — второго чтения ради этого решения не происходит.
 *
 * Проба без `peek` означает, что содержимого сейчас нет (дерево ресурсов даёт ленивую пробу).
 * Тогда ответ — «не берусь»: угадать по имени файла значило бы дать модель конфигу пакета.
 *
 * ## Разбор выдаёт идентификаторы и чинит двойников
 *
 * Узел без `$nodeId` получает его сразу, поэтому адресация работает с момента открытия,
 * а не с первой правки. `ensureNodeIds` сохраняет structural sharing: ветка, где все
 * идентификаторы уже есть, возвращается той же по ссылке.
 *
 * **Два узла с одним `$nodeId` — тоже вход разбора, а не аварийный случай.** Схему пишут руками
 * и генерируют чужими инструментами; копипаста поддерева приносит двойника, и с ним ломается
 * адресация целиком: правка уходит не в тот узел, диагностика встаёт не на тот, выделение
 * подсвечивает не то. Разбор его снимает — второму носителю адрес перевыдаётся
 * ({@link '../../lib/form-model/node-id'.assignNodeIds}), — и **отказывать в открытии файла
 * из-за этого нельзя**: отказ оставил бы человека наедине с текстовым редактором ровно там,
 * где структурный и нужен. Правило то же, что для отсутствующего и для негодного по форме
 * адреса: адрес выдаёт машина, и починка его — её работа, а не пользователя.
 *
 * Цена названа честно: **починка молчалива до первого сохранения**, как и первичная выдача.
 * Сообщить о ней — дело валидатора: он получает исходный ТЕКСТ (`ValidateContext.text()`),
 * то есть единственное место, где двойник ещё видно; модель после разбора уже исправна.
 *
 * ## Печать детерминированна и хранит идентификаторы
 *
 * Два пробела отступа, порядок ключей — тот, что в модели (домен его не переставляет).
 * `$nodeId` печатается вместе с узлом: иначе повторный разбор выдал бы НОВЫЕ адреса, и
 * круговой обход «разобрать → напечатать → разобрать» перестал бы давать ту же модель —
 * а на нём стоит и сравнение с буфером, и переживание перезагрузки выделением.
 *
 * @module plugins/editor-schema/provider
 */

import type { JsonFormSchema } from '@reformer/renderer-json';
import { ensureNodeIds, newNodeId, type NodeIdFactory } from '@/lib/form-model/node-id';
import { ensureSchema, isFormSchema } from '@/lib/form-model/normalize';
import type { EditorProbe, ResourceRef } from '@/sdk';
import { applyEditOp } from './ops';
import type { ApplyResult, EditOp, SchemaModelProviderSpec } from './host';

/**
 * Идентификатор провайдера.
 *
 * Он же — «вид активного ресурса» в контексте применимости (`WhenContext.activeResourceKind`
 * равен `providerId` модельного документа), поэтому имя выбрано предметным, а не служебным:
 * предикат команды читается как «когда открыта схема формы».
 */
export const SCHEMA_MODEL_PROVIDER_ID = 'form.schema';

/** Отступ печати. Два пробела — то, чем набраны схемы в репозитории. */
const INDENT = 2;

/** Разбирает текст в схему формы с выданными идентификаторами. @throws если текст не схема. */
export function parseFormSchema(text: string, newId: NodeIdFactory = newNodeId): JsonFormSchema {
  const parsed: unknown = JSON.parse(text);
  return ensureNodeIds(ensureSchema(parsed), newId);
}

/** Печатает модель. Детерминированна: одна и та же модель даёт байт в байт один текст. */
export function printFormSchema(model: JsonFormSchema): string {
  return `${JSON.stringify(model, null, INDENT)}\n`;
}

/**
 * Похож ли текст на схему формы.
 *
 * Дешёвая проверка на `JSON.parse` + структурный дискриминатор домена. Ошибка разбора здесь
 * не диагностика, а ответ «не моё»: сообщать о синтаксисе будет валидатор того, кто за файл
 * взялся.
 */
export function looksLikeFormSchema(text: string): boolean {
  try {
    return isFormSchema(JSON.parse(text));
  } catch {
    return false;
  }
}

/** Проба, умеющая отдать текст синхронно. Структурная копия `SyncEditorProbe` платформы. */
function peekText(probe: EditorProbe): string | null {
  const peek = (probe as { peek?: () => string }).peek;
  return typeof peek === 'function' ? peek() : null;
}

/**
 * Синхронный ответ «это схема формы» по ссылке и пробе.
 *
 * Общий для {@link SchemaModelProviderSpec.applies} и для `canOpen` редактора: два разных
 * ответа на один вопрос означали бы документ, у которого есть модель, но нет редактора
 * (или наоборот).
 */
export function isFormSchemaResource(ref: ResourceRef, probe: EditorProbe): boolean {
  if (!ref.mediaType.includes('json')) return false;
  const text = peekText(probe);
  return text === null ? false : looksLikeFormSchema(text);
}

export interface SchemaModelProviderOptions {
  /** Генератор идентификаторов. В тестах — детерминированный. */
  readonly newId?: NodeIdFactory;
}

/** Собирает провайдер модели. Отдельно от плагина, чтобы тест звал его без реестров. */
export function createSchemaModelProvider(
  options: SchemaModelProviderOptions = {}
): SchemaModelProviderSpec {
  const newId = options.newId ?? newNodeId;
  return {
    id: SCHEMA_MODEL_PROVIDER_ID,
    applies: (ref, probe) => isFormSchemaResource(ref, probe),
    parse: (text) => parseFormSchema(text, newId),
    print: printFormSchema,
    apply: (model: JsonFormSchema, op: EditOp): ApplyResult<JsonFormSchema> =>
      applyEditOp(model, op, { newId }),
  };
}
