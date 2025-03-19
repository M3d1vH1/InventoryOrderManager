
// Import i18n first to ensure it's initialized before anything else
import i18n from './i18n';
import './index.css';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { I18nextProvider } from 'react-i18next';
import App from './App';

const root = document.getElementById('root');
if (root) {
  const rootElement = createRoot(root);
  rootElement.render(
    <React.StrictMode>
      <I18nextProvider i18n={i18n}>
        <App />
      </I18nextProvider>
    </React.StrictMode>
  );
}
