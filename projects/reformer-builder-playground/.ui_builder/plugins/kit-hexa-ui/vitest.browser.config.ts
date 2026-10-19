import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mergeConfig } from 'vitest/config';
import { browserTestConfig } from '../.shared/vitest.browser';

const here = path.dirname(fileURLToPath(import.meta.url));

// Браузерный прогон: обёртки полей и визард кита в настоящем Chromium под React 19 — тем же
// React, на котором работает билдер. Общий конфиг плагинов плюс то, что нужно HexaUI.
export default mergeConfig(browserTestConfig(), {
  optimizeDeps: {
    // HexaUI — CommonJS-зависимости antd/rc-*/styled-components. Найденные посреди прогона, они
    // заставили бы Vite перезагрузить страницу — тест упал бы «сам». Поэтому — заранее.
    include: [
      '@kaspersky/hexa-ui/design-system',
      // Редакторы и календари поля грузят `import()` с подпутей — Vite нашёл бы их только при
      // отрисовке.
      '@kaspersky/hexa-ui/rich-text-editor',
      '@kaspersky/hexa-ui/code-viewer',
      '@kaspersky/hexa-ui/datepicker',
      '@preact/signals-core',
      'styled-components',
      'react-is',
    ],
  },
  test: {
    // Готовый CSS дизайн-системы: в билдере его приносит манифест плагина, здесь — setup.
    setupFiles: [path.join(here, 'src/testing/browser-setup.ts')],
  },
});
