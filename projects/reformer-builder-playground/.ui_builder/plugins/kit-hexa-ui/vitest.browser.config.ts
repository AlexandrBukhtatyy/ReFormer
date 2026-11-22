import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mergeConfig } from 'vitest/config';
import { browserTestConfig } from '../.shared/vitest.browser';
import { hexaUiStyles } from './vite/plugin.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));

// Браузерный прогон: обёртки полей и визард кита в настоящем Chromium под React 19 — тем же
// React, на котором работает билдер. Общий конфиг плагинов плюс то, что нужно HexaUI.
export default mergeConfig(browserTestConfig(), {
  // Тот же плагин, что у приложения: CSS HexaUI — только внутри `KitProvider`, а CommonJS antd,
  // styled-components и подпути полей предсобраны заранее — найденные посреди прогона, они
  // заставили бы Vite перезагрузить страницу, и тест упал бы «сам».
  plugins: [hexaUiStyles()],
  test: {
    // Готовый CSS дизайн-системы: в билдере его приносит манифест плагина, здесь — setup.
    setupFiles: [path.join(here, 'src/testing/browser-setup.ts')],
  },
});
