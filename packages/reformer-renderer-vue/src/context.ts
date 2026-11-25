/**
 * Контексты рендерера Vue — `provide` / `inject`.
 *
 * Ключи заведены через `Symbol.for`: две копии пакета в одном приложении (workspace-линк мимо
 * `dedupe`) всё равно видят контексты друг друга.
 *
 * @module renderer-vue/context
 */

import type { InjectionKey } from 'vue';
import type { FormBundle, SchemaController, SchemaOverrideMaps } from '@reformer/core';
import { DEFAULT_LOCALE, createI18n } from '@reformer/core/i18n';
import type { I18nHandle, IssueMessages } from '@reformer/core/i18n';
import type { RendererSettings } from './types';

const key = <T>(name: string): InjectionKey<T> =>
  Symbol.for(`reformer.renderer-vue.${name}`) as InjectionKey<T>;

/** Сборка формы, внутри которой отрисован компонент. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const FORM_BUNDLE = key<FormBundle<any>>('form-bundle');

/** Настройки рендерера. */
export const RENDER_SETTINGS = key<RendererSettings | undefined>('settings');

/** Хранилище правил ТЕКУЩЕЙ области схемы: корня, строки массива или подформы. */
export const OVERRIDE_MAPS = key<SchemaOverrideMaps | null>('override-maps');

/** Схема-контроллер сборки и хранилище корневой области. */
export interface SchemaControllerContext {
  controller: SchemaController;
  /** Хранилище корневой области: ref по абсолютному пути модели ищется в нём. */
  rootMaps: SchemaOverrideMaps;
}

export const SCHEMA_CONTROLLER = key<SchemaControllerContext | null>('schema-controller');

/** Словарь формы: код замечания → текст. */
export const ISSUE_MESSAGES = key<IssueMessages | undefined>('issue-messages');

/** Ручка активной локали. */
export const I18N = key<I18nHandle>('i18n');

/** Локаль «провайдера нет»: английский с пустым словарём — тексты из встроенных таблиц. */
export const DEFAULT_I18N: I18nHandle = createI18n(DEFAULT_LOCALE);
