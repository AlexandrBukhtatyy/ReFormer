/**
 * Тесты реестра сеансов и самого сеанса — вида на ручку модельного документа.
 *
 * Здесь проверяется ровно то, чем сеанс остался после снятия `session.ts`: стабильный снимок,
 * чистка выделения от исчезнувших адресов и пересылка правки в ручку. История, расхождение,
 * отсев собственного эха и перерисовка буфера — механика ПЛАТФОРМЫ, и проверена у неё
 * (`host/workspace/model/model-document.test`) и на шве композиции
 * (`app/document-models.test`). Повторять её здесь значило бы держать третью копию правила.
 *
 * @module plugins/editor-schema/session/sessions.test
 */

import { describe, expect, it } from 'vitest';
import { sampleSchema } from '@/lib/form-model/__fixtures__/sample-schema';
import { getAt } from '@/lib/form-model/paths';
import { indexNodes } from '../model/node-index';
import { removeOp, setPropOp } from '../model/ops';
import { createSessionRegistry, type SchemaSession } from './sessions';
import { createFakeSchemaHost, createFakeSelectionChannel } from '../testing';

const TEXT = JSON.stringify(sampleSchema());
const DOCUMENT = 'fake:form.json';
const FIELD_PATH = ['root', 'componentProps', 'steps', 0, 'children', 1];

function registry() {
  const host = createFakeSchemaHost({ text: TEXT });
  return { host, registry: createSessionRegistry({ host }) };
}

/** Адрес узла по пути — тесты правки адресуют узлы так же, как это делает канвас. */
function idAt(session: SchemaSession, path: readonly (string | number)[]): string {
  const id = indexNodes(session.get().model).idAt(path);
  if (id === undefined) throw new Error(`нет адреса по пути ${path.join('/')}`);
  return id;
}

describe('createSessionRegistry', () => {
  it('открывает сеанс документа и делает его активным', () => {
    const { registry: sessions } = registry();
    const session = sessions.open(DOCUMENT);
    expect(session).not.toBeNull();
    expect(sessions.active()).toBe(session);
    expect(sessions.get(DOCUMENT)).toBe(session);
  });

  it('второе открытие того же документа не создаёт второй сеанс', () => {
    const { registry: sessions } = registry();
    expect(sessions.open(DOCUMENT)).toBe(sessions.open(DOCUMENT));
  });

  it('сеанс переживает уход с вкладки: история и выделение при возврате на месте', () => {
    const { registry: sessions } = registry();
    const session = sessions.open(DOCUMENT);
    session?.setSelection(['a0000001']);

    sessions.close(DOCUMENT);
    expect(sessions.active()).toBeNull();
    expect(sessions.get(DOCUMENT)).toBe(session);

    expect(sessions.open(DOCUMENT)).toBe(session);
    expect(sessions.active()?.get().selection).toEqual(['a0000001']);
  });

  it('сеанс закрытого документа убирается при следующем открытии', () => {
    const { host, registry: sessions } = registry();
    sessions.open(DOCUMENT);
    host.closeDocument();
    expect(sessions.open(DOCUMENT)).toBeNull();
    expect(sessions.get(DOCUMENT)).toBeNull();
    expect(sessions.active()).toBeNull();
  });

  it('не открывает сеанс документа, которого ещё нет', () => {
    const { registry: sessions } = registry();
    expect(sessions.open('fake:другой.json')).toBeNull();
  });

  it('версия растёт на каждое изменение, подписчики уведомлены', () => {
    const { registry: sessions } = registry();
    let calls = 0;
    const subscription = sessions.subscribe(() => {
      calls += 1;
    });
    const before = sessions.version();
    const session = sessions.open(DOCUMENT);
    session?.setSelection(['a0000001']);
    expect(sessions.version()).toBeGreaterThan(before);
    expect(calls).toBe(2);
    subscription.dispose();
  });

  it('чужая правка буфера доходит до сеанса', () => {
    const { host, registry: sessions } = registry();
    const session = sessions.open(DOCUMENT);
    host.setText('{ сломано');
    expect(session?.get().syncState).toBe('diverged');
  });

  it('после разрушения реестра правка буфера сеансов не касается', () => {
    const { host, registry: sessions } = registry();
    const session = sessions.open(DOCUMENT);
    const before = session?.get();
    sessions.dispose();
    host.setText('{ сломано');
    expect(session?.get()).toBe(before);
  });
});

describe('сеанс как вид на ручку', () => {
  it('снимок стабилен по ссылке, пока ничего не менялось', () => {
    const { registry: sessions } = registry();
    const session = sessions.open(DOCUMENT);
    if (session === null) throw new Error('сеанс не открылся');
    expect(session.get()).toBe(session.get());
  });

  it('правка меняет модель и доезжает до рабочей копии', () => {
    const { host, registry: sessions } = registry();
    const session = sessions.open(DOCUMENT);
    if (session === null) throw new Error('сеанс не открылся');

    const target = idAt(session, FIELD_PATH);
    expect(session.apply(setPropOp(target, 'placeholder', 'сумма')).status).toBe('applied');

    const props = getAt(session.get().model, [...FIELD_PATH, 'componentProps']) as Record<
      string,
      unknown
    >;
    expect(props.placeholder).toBe('сумма');
    expect(host.written[host.written.length - 1]).toContain('"placeholder": "сумма"');
  });

  it('переносит выделение на `focus` операции', () => {
    const { registry: sessions } = registry();
    const session = sessions.open(DOCUMENT);
    if (session === null) throw new Error('сеанс не открылся');

    const target = idAt(session, FIELD_PATH);
    session.setSelection([target]);
    session.apply(removeOp(target));

    // Узел исчез — выделение переехало на его родителя, а не осталось на исчезнувшем.
    expect(session.get().selection).toEqual([
      idAt(session, ['root', 'componentProps', 'steps', 0]),
    ]);
  });

  it('чистит выделение от адресов, которых в модели больше нет', () => {
    const { registry: sessions } = registry();
    const session = sessions.open(DOCUMENT);
    if (session === null) throw new Error('сеанс не открылся');

    const first = idAt(session, [...FIELD_PATH.slice(0, -1), 0]);
    const second = idAt(session, FIELD_PATH);
    session.setSelection([first, second]);
    session.apply(removeOp(second));

    // Платформа держит выделение, но `NodeId` для неё непрозрачная строка: «жив ли ещё
    // такой узел» знает только домен, поэтому чистка осталась плагинной.
    expect(session.get().selection).not.toContain(second);
  });

  it('отказывает в расхождении, не трогая модель и не печатая в буфер', () => {
    const { host, registry: sessions } = registry();
    const session = sessions.open(DOCUMENT);
    if (session === null) throw new Error('сеанс не открылся');
    const target = idAt(session, FIELD_PATH);
    const written = host.written.length;

    host.setText('{ сломано');
    expect(session.get().syncState).toBe('diverged');
    expect(session.get().parseError).not.toBeNull();

    const outcome = session.apply(setPropOp(target, 'placeholder', 'сумма'));
    expect(outcome.status).toBe('rejected');
    if (outcome.status === 'rejected') expect(outcome.reason).toBe('diverged');
    expect(host.written).toHaveLength(written);
  });

  it('отказывает на негодной операции, не трогая модель', () => {
    const { registry: sessions } = registry();
    const session = sessions.open(DOCUMENT);
    if (session === null) throw new Error('сеанс не открылся');
    const before = session.get().model;

    const outcome = session.apply(removeOp('zzzzzzzz'));

    expect(outcome.status).toBe('rejected');
    if (outcome.status === 'rejected') expect(outcome.reason).toBe('provider-error');
    expect(session.get().model).toBe(before);
  });

  it('отмена и повтор объявляются заранее и работают', () => {
    const { registry: sessions } = registry();
    const session = sessions.open(DOCUMENT);
    if (session === null) throw new Error('сеанс не открылся');
    expect(session.get().canUndo).toBe(false);

    session.apply(setPropOp(idAt(session, FIELD_PATH), 'placeholder', 'сумма'));
    expect(session.get().canUndo).toBe(true);

    expect(session.undo()).toBe(true);
    const props = getAt(session.get().model, [...FIELD_PATH, 'componentProps']) as Record<
      string,
      unknown
    >;
    expect(props.placeholder).toBeUndefined();
    expect(session.get().canRedo).toBe(true);
    expect(session.redo()).toBe(true);
  });
});

/**
 * Обе половины общего канала выделения.
 *
 * Отражение между двумя сторонами — тот случай, где важнее «не зациклилось», чем «доехало»:
 * доехавшее видно сразу, а вечный круг — только по зависшей вкладке. Поэтому здесь считаются
 * уведомления канала, а не только значения.
 *
 * Двойник канала (`./testing`) воспроизводит защиту службы от эха — отсутствие уведомления
 * о совпадающем по содержимому значении. Настоящую службу плагину не импортировать
 * (`src/plugins/**` не видит `@/shell`, правило линтера), поэтому сквозная проверка на
 * НАСТОЯЩЕЙ службе вместе с превью — работа композиции, `src/app`.
 */
describe('createSessionRegistry — канал выделения', () => {
  it('выделение канваса уходит наружу вместе с адресом документа', () => {
    const { registry: sessions } = registry();
    const channel = createFakeSelectionChannel();
    sessions.connectSelection(channel);
    const session = sessions.open(DOCUMENT);
    const field = idAt(session!, FIELD_PATH);

    session?.setSelection([field]);

    expect(channel.get(DOCUMENT)).toEqual([field]);
  });

  it('выделение, пришедшее извне, переезжает на канвас', () => {
    const { registry: sessions } = registry();
    const channel = createFakeSelectionChannel();
    sessions.connectSelection(channel);
    const session = sessions.open(DOCUMENT);
    const field = idAt(session!, FIELD_PATH);

    channel.set(DOCUMENT, [field]);

    expect(session?.get().selection).toEqual([field]);
  });

  it('сеанс, открытый ПОСЛЕ чужого щелчка, читает выделение сразу', () => {
    // Тот самый порядок, ради которого выделение — служба, а не событие: превью выбрало узел
    // раньше, чем открыли вкладку редактора. Реестр пересоздаётся над ТЕМ ЖЕ документом —
    // адреса узлов выдаёт разбор, и у нового документа они были бы другими.
    const { host, registry: first } = registry();
    const field = idAt(first.open(DOCUMENT)!, FIELD_PATH);
    first.dispose();

    const channel = createFakeSelectionChannel();
    const second = createSessionRegistry({ host });
    second.connectSelection(channel);
    channel.set(DOCUMENT, [field]);

    expect(second.open(DOCUMENT)?.get().selection).toEqual([field]);
  });

  it('мёртвый адрес из канала на канвас не попадает — и очищенное уходит обратно', () => {
    const { registry: sessions } = registry();
    const channel = createFakeSelectionChannel();
    sessions.connectSelection(channel);
    const session = sessions.open(DOCUMENT);
    const field = idAt(session!, FIELD_PATH);

    channel.set(DOCUMENT, [field, 'zzzzzzzz']);

    expect(session?.get().selection).toEqual([field]);
    // Чистка принадлежит плагину, но её результат обязан дойти до второй стороны: иначе
    // превью продолжало бы подсвечивать узел, которого нет.
    expect(channel.get(DOCUMENT)).toEqual([field]);
  });

  it('отражение затухает: чужая запись даёт ровно одно уведомление', () => {
    const { registry: sessions } = registry();
    const channel = createFakeSelectionChannel();
    sessions.connectSelection(channel);
    const session = sessions.open(DOCUMENT);
    const field = idAt(session!, FIELD_PATH);
    const before = channel.notifications();

    channel.set(DOCUMENT, [field]);

    expect(channel.notifications()).toBe(before + 1);
  });

  it('свой щелчок тоже даёт ровно одно уведомление, а не круг', () => {
    const { registry: sessions } = registry();
    const channel = createFakeSelectionChannel();
    sessions.connectSelection(channel);
    const session = sessions.open(DOCUMENT);
    const field = idAt(session!, FIELD_PATH);
    const before = channel.notifications();

    session?.setSelection([field]);

    expect(channel.notifications()).toBe(before + 1);
  });

  it('удалённый узел уходит из канала: выделение чистится вместе с моделью', () => {
    const { registry: sessions } = registry();
    const channel = createFakeSelectionChannel();
    sessions.connectSelection(channel);
    const session = sessions.open(DOCUMENT);
    const field = idAt(session!, FIELD_PATH);
    session?.setSelection([field]);

    session?.apply(removeOp(field));

    expect(channel.get(DOCUMENT)).not.toContain(field);
  });

  it('снятие подписки прекращает и запись, и приём', () => {
    const { registry: sessions } = registry();
    const channel = createFakeSelectionChannel();
    const subscription = sessions.connectSelection(channel);
    const session = sessions.open(DOCUMENT);
    const field = idAt(session!, FIELD_PATH);
    const other = idAt(session!, ['root', 'componentProps', 'steps', 0, 'children', 0]);
    subscription.dispose();

    session?.setSelection([field]);
    expect(channel.get(DOCUMENT)).toEqual([]);

    channel.set(DOCUMENT, [other]);
    expect(session?.get().selection).toEqual([field]);
  });

  it('без канала редактор работает и ничего не публикует', () => {
    const { registry: sessions } = registry();
    const session = sessions.open(DOCUMENT);
    const field = idAt(session!, FIELD_PATH);
    expect(() => {
      session?.setSelection([field]);
    }).not.toThrow();
    expect(session?.get().selection).toEqual([field]);
  });
});
