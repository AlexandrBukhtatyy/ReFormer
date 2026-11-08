import type { ReactNode } from 'react';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import { createLocaleLoader } from '@reformer/core/i18n';
import { I18nProvider } from '@reformer/core/react';
import { loadKitLocale } from '@reformer/ui-kit/locale';

/** Словари ядра, cdk и кита. Константа модуля: новая ссылка `load` — новое хранилище локалей. */
const loadLocale = createLocaleLoader([loadKitLocale]);

/**
 * Язык демо — язык страницы сайта.
 *
 * Без провайдера библиотека и кит говорят по-английски: на русской странице поле показало бы
 * «This field is required», а Select — «Select an option...». Обёртка — часть сайта, а не
 * примера: в коде, который показывает вкладка «Код», провайдера нет.
 */
export function DemoLocale({ children }: { children: ReactNode }) {
  const { i18n } = useDocusaurusContext();
  return (
    <I18nProvider lang={i18n.currentLocale} load={loadLocale}>
      {children}
    </I18nProvider>
  );
}
