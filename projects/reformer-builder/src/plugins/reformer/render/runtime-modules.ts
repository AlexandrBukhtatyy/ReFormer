/**
 * Модули ядра форм, отдаваемые исполняемому коду: `@reformer/core`, рендереры, реестр форм.
 *
 * Список лежит у плагина превью, потому что код формы исполняет ОН: сайдкары импортируют
 * `@reformer/core/validation`, `@reformer/core/behaviors` и `@reformer/renderer-json` ВСЕГДА —
 * это не выбор автора формы, а способ, которым форма вообще пишется. Без них `validation.ts`
 * любой настоящей формы падал бы на фазе `resolve`. Состав находит этот файл обходом папок
 * плагинов (`application/composer/runtime-modules`); ни оболочка, ни состав этих пакетов
 * не знают.
 *
 * Регистрация отдаёт коду формы ТОТ ЖЕ объект модуля, который держит билдер: второй экземпляр
 * ядра ломает `instanceof Signal` и поиск узла по сигналу — форма отрисовалась бы, но её
 * листья остались бы без form-node.
 *
 * Подпути перечислены поимённо: реестр резолвит точным совпадением. Кит и `@reformer/cdk` —
 * у плагина китов (`plugins/kits/registry/runtime-modules`).
 *
 * @module plugins/reformer/render/runtime-modules
 */

import * as signalsCore from '@preact/signals-core';
import * as reformerCore from '@reformer/core';
import * as reformerBehaviors from '@reformer/core/behaviors';
import * as reformerModel from '@reformer/core/model';
import * as reformerSignals from '@reformer/core/signals';
import * as reformerValidation from '@reformer/core/validation';
import * as reformerValidators from '@reformer/core/validators';
import * as rendererJson from '@reformer/renderer-json';
import * as rendererReact from '@reformer/renderer-react';

/**
 * Уже в стартовом графе билдера: регистрация бесплатна по чанкам.
 * Имя экспорта — соглашение обхода папок.
 */
export const modules: readonly (readonly [specifier: string, exports: unknown])[] = [
  ['@preact/signals-core', signalsCore],
  ['@reformer/core', reformerCore],
  ['@reformer/core/behaviors', reformerBehaviors],
  ['@reformer/core/model', reformerModel],
  ['@reformer/core/signals', reformerSignals],
  ['@reformer/core/validation', reformerValidation],
  ['@reformer/core/validators', reformerValidators],
  ['@reformer/renderer-json', rendererJson],
  ['@reformer/renderer-react', rendererReact],
];

/** Отдельные чанки: платим только когда исполняется код, который их просит. */
export const lazyModules: readonly (readonly [specifier: string, load: () => Promise<unknown>])[] =
  [
    ['@reformer/form-registry', () => import('@reformer/form-registry')],
    ['@reformer/form-registry/react', () => import('@reformer/form-registry/react')],
    ['@reformer/form-registry/storage', () => import('@reformer/form-registry/storage')],
  ];
