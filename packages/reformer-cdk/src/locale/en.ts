/**
 * Английская локаль cdk — синхронный модуль (`@reformer/cdk/locale/en`): словарь ядра плюс строки
 * cdk. Нужен для SSR и тестов; загрузчик `loadCdkLocale` импортирует его же отдельным чанком.
 *
 * @module locale/en
 */

import { extendLocale, type FormLocale } from '@reformer/core/i18n';
import { en as coreEn } from '@reformer/core/locale/en';
import messages from '../i18n/en.json';

export const en: FormLocale = extendLocale(coreEn, { messages });
