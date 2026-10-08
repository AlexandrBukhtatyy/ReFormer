import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ReformerBuilder } from '@reformer/builder';
import { App } from './app/App';
import { AppProviders } from './app/AppProviders';
import './app.css';

// Всё встраивание билдера — одна обёртка вокруг приложения. Она стоит ВНУТРИ провайдеров:
// форму, которую билдер показывает в превью отдельно от страницы, рисует это же приложение,
// и провайдеры у неё должны быть те же.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProviders>
      <ReformerBuilder pluginsUrl="/builder-plugins/">
        <App />
      </ReformerBuilder>
    </AppProviders>
  </StrictMode>
);
