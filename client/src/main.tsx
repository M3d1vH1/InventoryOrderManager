
import React, { Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import './i18n';
import { I18nextProvider, useTranslation } from 'react-i18next';
import i18n from './i18n';

const root = document.getElementById('root');
if (root) {
  const rootElement = createRoot(root);
  rootElement.render(
    <React.StrictMode>
      <Suspense fallback="Loading...">
        <I18nextProvider i18n={i18n}>
          <App />
        </I18nextProvider>
      </Suspense>
    </React.StrictMode>
  );
}
