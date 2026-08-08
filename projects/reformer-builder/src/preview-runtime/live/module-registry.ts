/**
 * Резолв импортов кода формы на модули, УЖЕ загруженные в билдер.
 *
 * Код формы (`validation.ts`, `form-behavior.ts`, …) написан с голыми спецификаторами
 * (`@reformer/core/validation`), которые браузер сам резолвить не умеет. Дать ему второй бандл
 * reformer нельзя ни при каких условиях: `getNodeForSignal` и `instanceof Signal` работают через
 * модуль-локальный реестр и прототипы, поэтому два инстанса `@reformer/core` = форма, у листьев
 * которой «нет form-node». Отсюда правило: **каждый `@reformer/*` спецификатор указывает на тот же
 * объект модуля, что использует сам билдер**.
 *
 * `@reformer/ui-kit` (и любой его subpath) резолвится в namespace АКТИВНОГО кита — плоскую карту
 * экспортов из `kits/runtime`. Так код формы, импортирующий `InputField`, получает компонент того
 * кита, который сейчас выбран в билдере, а не жёстко вшитый пакет.
 *
 * @module reformer-builder/preview-runtime/live/module-registry
 */

import * as react from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import * as jsxDevRuntime from 'react/jsx-dev-runtime';
import * as signalsCore from '@preact/signals-core';
import * as core from '@reformer/core';
import * as coreBehaviors from '@reformer/core/behaviors';
import * as coreSignals from '@reformer/core/signals';
import * as coreState from '@reformer/core/state';
import * as coreValidation from '@reformer/core/validation';
import * as coreValidators from '@reformer/core/validators';
import * as rendererJson from '@reformer/renderer-json';
import * as rendererReact from '@reformer/renderer-react';
import { getActiveNamespace } from '../../kits/runtime';

/** Модуль как объект экспортов — то, что получает `require(...)` внутри кода формы. */
export type ModuleExports = Record<string, unknown>;

/**
 * Спецификаторы с фиксированным модулем. `@reformer/ui-kit` здесь НЕТ намеренно: он зависит от
 * активного кита и резолвится динамически ({@link resolveModule}).
 */
const STATIC_MODULES: Record<string, ModuleExports> = {
  react: react as unknown as ModuleExports,
  'react/jsx-runtime': jsxRuntime as unknown as ModuleExports,
  'react/jsx-dev-runtime': jsxDevRuntime as unknown as ModuleExports,
  '@preact/signals-core': signalsCore as unknown as ModuleExports,
  '@reformer/core': core as unknown as ModuleExports,
  '@reformer/core/behaviors': coreBehaviors as unknown as ModuleExports,
  '@reformer/core/signals': coreSignals as unknown as ModuleExports,
  '@reformer/core/state': coreState as unknown as ModuleExports,
  '@reformer/core/validation': coreValidation as unknown as ModuleExports,
  '@reformer/core/validators': coreValidators as unknown as ModuleExports,
  '@reformer/renderer-json': rendererJson as unknown as ModuleExports,
  '@reformer/renderer-react': rendererReact as unknown as ModuleExports,
};

/** Префикс кита: сам пакет и любой его subpath ведут в namespace активного кита. */
const UI_KIT = '@reformer/ui-kit';

/** Префикс поштучных валидаторов: `@reformer/core/validators/required` и т.п. */
const VALIDATOR_SUBPATH = '@reformer/core/validators/';

/**
 * Модуль по спецификатору импорта. Бросает с человекочитаемым текстом, если спецификатор не
 * поддержан — сообщение уезжает в панель «Сборка», а не в консоль.
 */
export function resolveModule(spec: string): ModuleExports {
  const known = STATIC_MODULES[spec];
  if (known) return known;

  // Поштучные валидаторы: в билдере загружен общий barrel, из него и берём символ.
  if (spec.startsWith(VALIDATOR_SUBPATH)) return coreValidators as unknown as ModuleExports;

  // Кит: namespace плоский (barrel + subpath-модули слиты воедино), поэтому и `@reformer/ui-kit`,
  // и `@reformer/ui-kit/form-wizard` отдают одну и ту же карту экспортов.
  if (spec === UI_KIT || spec.startsWith(`${UI_KIT}/`)) return getActiveNamespace();

  throw new Error(
    `Импорт «${spec}» недоступен в превью. Разрешены react, @preact/signals-core, ` +
      `@reformer/core (+ /behaviors, /validation, /validators, /signals, /state), ` +
      `@reformer/renderer-json, @reformer/renderer-react, @reformer/ui-kit и файлы каталога формы.`
  );
}

/** Поддерживается ли спецификатор (без броска) — для диагностики до исполнения. */
export function canResolveModule(spec: string): boolean {
  if (spec in STATIC_MODULES) return true;
  if (spec.startsWith(VALIDATOR_SUBPATH)) return true;
  return spec === UI_KIT || spec.startsWith(`${UI_KIT}/`);
}

/** Список поддержанных спецификаторов (кроме кита) — для тестов и сообщений. */
export function knownModuleSpecifiers(): string[] {
  return [...Object.keys(STATIC_MODULES), UI_KIT];
}
