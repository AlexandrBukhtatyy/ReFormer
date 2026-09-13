/**
 * Текущая локаль как React-значение — повод перерисоваться, а не данные.
 *
 * Отдельным модулем, потому что нужен двоим: переводу плагина (`./useTranslate`) и оболочке,
 * которая рисует свои строки тем же способом. Подписка на смену языка у них одна и та же,
 * и вторая её копия разошлась бы с первой на первом же изменении контракта словаря.
 *
 * Принимает не службу целиком, а два её члена: их одинаково дают и вид словаря плагина,
 * и корневая служба оболочки, и хук не должен знать, какую из них ему дали.
 *
 * @module @reformer/builder-plugin-api/ui/useLocale
 */

import { useCallback, useSyncExternalStore } from 'react';
import type { PluginI18n } from '../services/i18n';

/**
 * Текущая локаль — как повод перерисоваться, а не как значение.
 *
 * `t()` читается прямо из сервиса, но результат меняется при смене локали, а сервис
 * не является React-состоянием. Этот хук и есть недостающая связь: он ничего не переводит,
 * он делает перевод реактивным.
 */
export function useLocale(i18n: Pick<PluginI18n, 'locale' | 'onDidChangeLocale'>): string {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const subscription = i18n.onDidChangeLocale(onStoreChange);
      return () => {
        subscription.dispose();
      };
    },
    [i18n]
  );
  const getSnapshot = useCallback(() => i18n.locale, [i18n]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
