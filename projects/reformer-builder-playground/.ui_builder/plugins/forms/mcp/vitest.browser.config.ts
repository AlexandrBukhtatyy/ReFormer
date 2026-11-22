import { mergeConfig } from 'vitest/config';
import { browserTestConfig } from '../../.shared/vitest.browser';

// Браузерный прогон: отрисовка и ввод в настоящем Chromium, со стилями оболочки, и сервер-бандл
// в настоящем Web Worker. Клиент MCP — заранее: найденный посреди прогона, он перезагрузил бы
// страницу, и тест упал бы «сам».
export default mergeConfig(browserTestConfig(), {
  optimizeDeps: {
    include: [
      '@modelcontextprotocol/sdk/client/index.js',
      '@modelcontextprotocol/sdk/client/sse.js',
      '@modelcontextprotocol/sdk/client/streamableHttp.js',
      '@modelcontextprotocol/sdk/types.js',
    ],
  },
});
