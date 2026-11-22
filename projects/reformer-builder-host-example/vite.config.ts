import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { reformerBuilder } from '@reformer/builder/vite';
import { hexaUiStyles } from '@reformer/kit-hexa-ui/vite';
import { applicationApi } from './server/application-api';

// Конфиг запуска билдера — пресет из `.ui_builder/presets/`: какой кит билдер берёт активным.
// `npm run preset:hexa-ui` называет его переменной окружения, без неё — кит `@reformer/ui-kit`.
// Путь — от корня приложения.
const builderConfig = process.env.REFORMER_BUILDER_CONFIG || '.ui_builder/presets/ui-kit.json';

// https://vite.dev/config/
export default defineConfig({
  // `tailwindcss()` — приложения: его кит форм свёрстан утилитами. Билдеру он не нужен.
  //
  // `hexaUiStyles()` — для форм на ките HexaUI: его CSS (ресет antd на `html`, `body`, теги)
  // действует только внутри `KitProvider`, а не на всё приложение.
  //
  // `reformerBuilder()` — всё, что нужно билдеру от сборки приложения: он отдаёт билдер
  // с этого же dev-сервера, под адресом `/__reformer-builder/`. Приложение билдер
  // не компилирует — тот открывается своим документом, в рамке поверх страницы.
  plugins: [
    react(),
    tailwindcss(),
    hexaUiStyles(),
    applicationApi(),
    reformerBuilder({ config: builderConfig }),
  ],
  server: {
    // 5173 — react-playground, 5174 — билдер в своей вкладке.
    port: 5175,
    strictPort: true,
  },
});
