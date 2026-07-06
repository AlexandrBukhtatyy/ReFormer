/**
 * React-контекст сервиса локализации для компонента {@link I18n} — реактивный путь i18n.
 *
 * Зеркало `ValidationMessagesProvider` из `@reformer/cdk`: сервис живёт в контексте и читается на
 * этапе рендера, поэтому смена языка = новое значение `LocaleProvider` → перерендер всех `I18n`.
 * Это в отличие от строкового пути (`$locale`), который резолвится статически при конвертации и
 * не может переключаться вживую.
 *
 * @module reformer/renderer-json/locale/locale-context
 */

import { createContext, useContext, type ReactNode } from 'react';
import type { LocaleService } from './locale-service';

/** Дефолт: fallback-to-key, если `LocaleProvider` не смонтирован. */
const FALLBACK_SERVICE: LocaleService = { resolve: (key) => key };

const LocaleContext = createContext<LocaleService>(FALLBACK_SERVICE);

/** Props {@link LocaleProvider}. */
export interface LocaleProviderProps {
  /** Текущий сервис локализации. Смена ссылки (напр. при переключении языка) перерендеривает все `I18n`. */
  service: LocaleService;
  /** Поддерево, в котором `I18n`/`useLocale` видят этот сервис. */
  children: ReactNode;
}

/**
 * Провайдер сервиса локализации для реактивного пути. Оберни форму (или её часть) и передавай
 * новый `service` при смене языка — вложенные `I18n` перерисуются без пересборки схемы.
 *
 * @example Переключение языка
 * ```tsx
 * import { LocaleProvider, createLocaleService, JsonFormRenderer } from '@reformer/renderer-json';
 *
 * const services = { ru: createLocaleService(ruTable), en: createLocaleService(enTable) };
 * function App() {
 *   const [lang, setLang] = useState<'ru' | 'en'>('ru');
 *   return (
 *     <LocaleProvider service={services[lang]}>
 *       <JsonFormRenderer schema={schema} />
 *     </LocaleProvider>
 *   );
 * }
 * ```
 */
export function LocaleProvider({ service, children }: LocaleProviderProps): ReactNode {
  return <LocaleContext.Provider value={service}>{children}</LocaleContext.Provider>;
}

/**
 * Текущий сервис локализации из {@link LocaleProvider}. Без провайдера — fallback-to-key.
 * Используется внутри {@link I18n}; вызывай напрямую для собственного localized-компонента.
 *
 * @returns Активный {@link LocaleService}.
 */
export function useLocale(): LocaleService {
  return useContext(LocaleContext);
}
