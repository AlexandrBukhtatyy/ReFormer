/**
 * Английская локаль кита — синхронный модуль (`@reformer/ui-kit/locale/en`): словари ядра и cdk
 * плюс подписи кита. Нужен для SSR и тестов; загрузчик `loadKitLocale` импортирует его же
 * отдельным чанком.
 *
 * @module locale/en
 */

import { extendLocale, type FormLocale } from '@reformer/core/i18n';
import { en as cdkEn } from '@reformer/cdk/locale/en';
import messages from '../i18n/en.json';

export const en: FormLocale = extendLocale(cdkEn, { messages });
