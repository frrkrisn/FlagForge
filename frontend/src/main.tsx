import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource/jetbrains-mono/700.css';
import '@fontsource/fira-code/400.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';

import './styles/globals.css';
import App from './app/App';
import { Providers } from './app/providers';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element #root not found');

createRoot(rootEl).render(
  <StrictMode>
    <Providers>
      <App />
    </Providers>
  </StrictMode>,
);
