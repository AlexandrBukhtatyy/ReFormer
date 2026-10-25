/**
 * Транспорт MCP поверх `postMessage` — для сервера в Web Worker и для хоста, который с ним говорит.
 *
 * Кадр — голое сообщение JSON-RPC: одно событие `message` = один `JSONRPCMessage`, без конверта.
 * Конверт понадобился бы, если бы по тому же каналу шло что-то кроме MCP, а не идёт ничего:
 * воркер сервера — это и есть сервер. Голый кадр к тому же понятен любому хосту, который знает
 * MCP, — своего протокола загрузки поверх него нет.
 *
 * Модуль общий для обеих сторон: сервер в воркере передаёт сюда `self`, хост — сам `Worker` (или
 * `MessagePort`). Формат кадров поэтому один по построению, а не по договорённости двух копий.
 *
 * ## Почему порт — структурный тип
 *
 * В tsconfig пакета нет ни DOM, ни WebWorker: ядро обязано собираться под Node. Транспорту от
 * порта нужны три метода, и {@link MessagePortLike} описывает ровно их — им подходят и `self`
 * воркера, и `Worker`, и `MessagePort` (браузерный и Node-овский из `MessageChannel`).
 *
 * ## Сообщения до подписчика
 *
 * Слушатель вешается при СОЗДАНИИ транспорта, а сообщения до появления `onmessage` копятся. SDK
 * назначает `onmessage` в `connect()` синхронно, но хост вправе прислать `initialize` раньше,
 * чем скрипт воркера дойдёт до `connect`, — терять такой запрос нельзя: клиент ждал бы ответа до
 * таймаута.
 *
 * @module reformer-mcp/platform/worker/port-transport
 */

import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { JSONRPCMessageSchema, type JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';

/** Событие сообщения — в том объёме, в каком его читает транспорт. */
export interface MessageEventLike {
  readonly data: unknown;
}

/** Что транспорту нужно от порта: `self` воркера, `Worker` или `MessagePort`. */
export interface MessagePortLike {
  postMessage(message: unknown): void;
  addEventListener(type: 'message', listener: (event: MessageEventLike) => void): void;
  removeEventListener(type: 'message', listener: (event: MessageEventLike) => void): void;
  /** У `MessagePort` без `start()` сообщения не идут, если слушатель повешен `addEventListener`. */
  start?(): void;
}

export interface PortTransportOptions {
  /**
   * Что сделать при `close()` сверх отписки: хост останавливает воркер (`worker.terminate()`),
   * сервер в воркере — ничего, его останавливает хост.
   */
  readonly onClose?: () => void;
}

/** Транспорт MCP над портом. */
export function createPortTransport(
  port: MessagePortLike,
  options: PortTransportOptions = {}
): Transport {
  const early: JSONRPCMessage[] = [];
  let closed = false;

  const transport: Transport = {
    async start() {
      port.start?.();
      // Скопившееся до `connect` — подписчику, в порядке прихода.
      for (const message of early.splice(0)) transport.onmessage?.(message);
    },

    async send(message) {
      if (closed) throw new Error('MCP transport is closed');
      port.postMessage(message);
    },

    async close() {
      if (closed) return;
      closed = true;
      port.removeEventListener('message', listener);
      options.onClose?.();
      transport.onclose?.();
    },
  };

  function listener(event: MessageEventLike): void {
    if (closed) return;
    const parsed = JSONRPCMessageSchema.safeParse(event.data);
    if (!parsed.success) {
      // Чужой кадр на том же порту — не повод рвать соединение: сказать и пропустить.
      transport.onerror?.(new Error(`Not a JSON-RPC message: ${parsed.error.message}`));
      return;
    }
    if (transport.onmessage) transport.onmessage(parsed.data);
    else early.push(parsed.data);
  }

  port.addEventListener('message', listener);
  return transport;
}
