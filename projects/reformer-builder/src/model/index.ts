/**
 * Слой `model/` — чистые операции над `JsonFormSchema` (без React/браузера). Источник истины
 * редактора — сам объект схемы, правится иммутабельно; здесь — пути, виды узлов/слоты,
 * запросы, структурные мутации и фабрики.
 *
 * @module reformer-builder/model
 */

export * from './paths';
export * from './node-kind';
export * from './query';
export * from './normalize';
export * from './mutate';
