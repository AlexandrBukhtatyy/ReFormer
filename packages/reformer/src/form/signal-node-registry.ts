/**
 * Реестр «ручка модели → нода формы».
 *
 * По нему находят ноду state-операции behavior (`enableWhen`/`disableWhen`), подключение
 * под-схем (`apply`/`applyEach`) и разнос ошибок валидации. Заполняется в `createForm` при сборке
 * формы из модели.
 *
 * Ключ — ИДЕНТИЧНОСТЬ ручки дерева `model.$`, а не путь: сигнал листа, узел-массив или узел-группа.
 * Путь для этого не годится: он абсолютный (`items.0.phones`) и меняется при перестановке строк, а
 * форма строки массива — отдельный корень со своими относительными путями.
 *
 * Используется `WeakMap`, поэтому записи авто-собираются GC вместе с ручками.
 *
 * Кто пишет и кто читает. Пишет сборка формы (`create-form`). Читают валидация — разнос замечаний,
 * `pending`, касание полей, триггер `blur` — и поведение — state-операции и подключение под-схем.
 * Уровень формы, отправка и поток шагов реестр не импортируют (запрет в ESLint): ноды им достаются
 * через раннер валидации.
 *
 * @group Utils
 * @module form/signal-node-registry
 */

import type { FormNode } from './types/nodes';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const registry = new WeakMap<object, FormNode<any>>();

/**
 * Связать ручку модели с её нодой формы.
 *
 * Вызывается движком при сборке формы (`createForm`/{@link createFormFromModel}) для каждого поля,
 * группы и массива под-форм; у группы в реестре лежит её лицо {@link FormGroup} с нодами полей.
 * Прикладной код обычно этот реестр не заполняет напрямую.
 *
 * @param signal - Ручка из {@link FormModel}: сигнал листа, узел-массив или узел-группа дерева `model.$`
 * @param node - Нода формы, отвечающая за эту часть модели
 *
 * @example Ручка модели указывает на ноду другой сборки
 * ```typescript
 * import { registerSignalNode } from '@reformer/core';
 *
 * registerSignalNode(model.$.profile.email, profileForm.email);
 * ```
 *
 * @see {@link getNodeForSignal} - обратный поиск ноды по ручке
 * @group Utilities
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function registerSignalNode(signal: object, node: FormNode<any>): void {
  registry.set(signal, node);
}

/**
 * Найти ноду формы по ручке модели.
 *
 * Используется state-операциями behavior (`enableWhen`/`disableWhen`), подключением под-схем
 * (`apply`/`applyEach`) и роутингом ошибок валидации в ноды. Возвращает `undefined`, если форма
 * ещё не построена или эта часть модели в форме не материализована (например, массив без
 * item-схемы).
 *
 * @param signal - Ручка из {@link FormModel}: `model.$.<поле>`, `model.$.<группа>`, `model.$.<массив>`
 * @returns Нода формы — поля, группы или массива — либо `undefined`
 *
 * @example Роутинг ошибок валидации в ноду поля
 * ```typescript
 * import { getNodeForSignal } from '@reformer/core';
 *
 * const sig = model.$.email;
 * getNodeForSignal(sig)?.setIssues([{ code: 'required' }]);
 * ```
 *
 * @example Нода группы и строки массива
 * ```typescript
 * getNodeForSignal(model.$.address)?.disable(); // группа целиком
 * getNodeForSignal(model.$.phones[0])?.markAsTouched(); // форма строки массива
 * ```
 *
 * @see {@link registerSignalNode} - регистрация связи ручка→нода
 * @group Utilities
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getNodeForSignal(signal: object): FormNode<any> | undefined {
  return registry.get(signal);
}
