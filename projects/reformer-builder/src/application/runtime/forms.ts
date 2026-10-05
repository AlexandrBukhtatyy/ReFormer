/**
 * Модули ядра форм, отдаваемые исполняемому коду: `@reformer/core`, рендереры, реестр форм.
 *
 * Код формы исполняется в превью, и его сайдкары импортируют `@reformer/core/validation`,
 * `@reformer/core/behaviors` и `@reformer/renderer-json` ВСЕГДА — это не выбор автора формы,
 * а способ, которым форма вообще пишется. Без них `validation.ts` любой настоящей формы падал бы
 * на фазе `resolve`.
 *
 * Список лежит в СЛОЕ ПРИЛОЖЕНИЯ: какие пакеты оно отдаёт исполняемому коду — решение самого
 * приложения «конструктор форм», а не оболочки и не плагина. Плагины — и превью-хост, и движки —
 * собраны отдельно от билдера, и привезённая плагином вторая копия ядра сломала бы ровно то,
 * что описано ниже. Поэтому эти пакеты для сборки плагина внешние (`PLUGIN_RUNTIME_MODULES`
 * контракта), а отдаёт их билдер — и коду формы, и самим плагинам. Состав находит этот файл
 * обходом каталога (`application/composer/runtime-modules`); оболочка этих пакетов не знает.
 *
 * Регистрация отдаёт коду формы ТОТ ЖЕ объект модуля, который держит билдер: второй экземпляр
 * ядра ломает `instanceof Signal` и поиск узла по сигналу — форма отрисовалась бы, но её
 * листья остались бы без form-node.
 *
 * Подпути перечислены поимённо: реестр резолвит точным совпадением. Кит и `@reformer/cdk` —
 * в соседнем списке (`./kit`).
 *
 * @module application/runtime/forms
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
 * Имя экспорта — соглашение обхода каталога.
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
    // Проверка схемы против JSON Schema тянет за собой ajv: её просят валидатор и ассистент.
    ['@reformer/renderer-json/validate', () => import('@reformer/renderer-json/validate')],
    ['@reformer/form-registry', () => import('@reformer/form-registry')],
    ['@reformer/form-registry/react', () => import('@reformer/form-registry/react')],
    ['@reformer/form-registry/storage', () => import('@reformer/form-registry/storage')],
  ];
