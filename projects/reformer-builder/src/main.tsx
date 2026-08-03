import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

// Async-бут: сперва загружаем клиентский runtime-конфиг/каталог (config/boot), и ТОЛЬКО ПОТОМ
// динамически импортируем App. Это обязательно — граф `store`/`catalog` инициализируется на импорте
// модулей (editorStore = createStore(initialUi()), мемо getCatalog()), поэтому конфиг должен быть
// установлен до того, как эти модули подтянутся. При невалидном переданном файле — экран BootError.
const root = createRoot(document.getElementById('root')!);

(async () => {
  const { bootRuntime } = await import('./config/boot');
  try {
    await bootRuntime();
  } catch (err) {
    const { BootError } = await import('./config/BootError');
    root.render(<BootError error={err} />);
    return;
  }
  const { default: App } = await import('./App.tsx');
  root.render(
    <StrictMode>
      <App />
    </StrictMode>
  );
})();
