/**
 * Как приложение называет себя: имя в шапке и строка в «О программе».
 *
 * Оболочка — база для разных приложений и своего имени не имеет: в её словаре эти ключи
 * нейтральны. «ReFormer Builder» и «редактор форм» — знание ЭТОГО приложения, поэтому тексты
 * лежат в слое приложения и уходят в оболочку вместе с составом (`ApplicationComposition.messages`).
 *
 * @module application/identity
 */

import type { ApplicationMessages } from '@/shell/boot/composition';

/** Локаль → ключ оболочки → текст приложения. */
export const BUILDER_IDENTITY: ApplicationMessages = Object.freeze({
  ru: Object.freeze({
    'app.title': 'ReFormer Builder',
    'shell.help.about.description':
      'Редактор форм ReFormer: схема, превью и генерация кода в одном окне.',
  }),
  en: Object.freeze({
    'app.title': 'ReFormer Builder',
    'shell.help.about.description':
      'ReFormer form editor: schema, preview and code generation in one window.',
  }),
});
