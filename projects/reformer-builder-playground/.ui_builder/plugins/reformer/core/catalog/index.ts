/**
 * Контракт каталога компонентов (`component-catalog.schema.json`) и производные для
 * палитры и инспектора: категории, варианты, compound-части, фабрики узлов по записи.
 *
 * «Какой каталог взять» и «какой кит активен» решает вызывающий — сервис плагина китов;
 * здесь только то, что из каталога следует.
 *
 * @module plugins/reformer/core/catalog
 */

export * from './catalog';
export * from './class-names';
export * from './compound';
export * from './contract';
export * from './grouping';
export * from './html-tags';
export * from './make-node';
export * from './role';
export * from './synthetic-entries';
export * from './types';
export * from './variants';
export * from './widgets';
