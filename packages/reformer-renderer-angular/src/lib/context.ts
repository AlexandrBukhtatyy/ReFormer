/**
 * Контексты рендерера Angular — токены внедрения.
 *
 * Значения кладёт `FormRenderer` (сборка, настройки, корневая область) и границы областей (строка
 * массива, подформа). Компонент реестра берёт их обычным `inject()`.
 *
 * @module renderer-angular/context
 */

import { InjectionToken, inject, type Provider } from '@angular/core';
import type { FormBundle, SchemaController, SchemaOverrideMaps } from '@reformer/core';
import { DEFAULT_LOCALE, createI18n } from '@reformer/core/i18n';
import type { I18nHandle, IssueMessages } from '@reformer/core/i18n';
import type { RendererSettings } from './types';

/** Сборка формы, внутри которой отрисован компонент. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const FORM_BUNDLE = new InjectionToken<FormBundle<any>>('reformer.form-bundle');

/** Настройки рендерера. */
export const RENDERER_SETTINGS = new InjectionToken<RendererSettings | undefined>(
  'reformer.renderer-settings'
);

/** Хранилище правил ТЕКУЩЕЙ области схемы: корня, строки массива или подформы. */
export const OVERRIDE_MAPS = new InjectionToken<SchemaOverrideMaps | null>(
  'reformer.override-maps'
);

/** Схема-контроллер сборки и хранилище корневой области. */
export interface SchemaControllerContext {
  controller: SchemaController;
  /** Хранилище корневой области: ref по абсолютному пути модели ищется в нём. */
  rootMaps: SchemaOverrideMaps;
}

export const SCHEMA_CONTROLLER = new InjectionToken<SchemaControllerContext | null>(
  'reformer.schema-controller'
);

/** Словарь формы: код замечания → текст. */
export const ISSUE_MESSAGES = new InjectionToken<IssueMessages | undefined>(
  'reformer.issue-messages'
);

/** Локаль «провайдера нет»: английский с пустым словарём — тексты из встроенных таблиц. */
export const DEFAULT_I18N: I18nHandle = createI18n(DEFAULT_LOCALE);

/** Ручка активной локали; без провайдера — {@link DEFAULT_I18N}. */
export const REFORMER_I18N = new InjectionToken<I18nHandle>('reformer.i18n', {
  providedIn: 'root',
  factory: () => DEFAULT_I18N,
});

/**
 * Локаль для приложения или поддерева компонента: тексты замечаний и описатели `msg()` в пропсах
 * узлов.
 *
 * @example
 * ```ts
 * bootstrapApplication(App, { providers: [provideReformerI18n(createI18n(ru))] });
 * ```
 */
export function provideReformerI18n(i18n: I18nHandle): Provider {
  return { provide: REFORMER_I18N, useValue: i18n };
}

/**
 * Словарь формы для приложения или поддерева компонента: записи накладываются поверх словаря
 * предка, а код, которого в словаре нет, получает текст из локали.
 *
 * @param messages - Словарь формы (`defineIssueMessages` из `@reformer/core/i18n`).
 */
export function provideIssueMessages(messages: IssueMessages): Provider {
  return {
    provide: ISSUE_MESSAGES,
    useFactory: (): IssueMessages => {
      const parent = inject(ISSUE_MESSAGES, { optional: true, skipSelf: true });
      return parent == null ? messages : { ...parent, ...messages };
    },
  };
}
