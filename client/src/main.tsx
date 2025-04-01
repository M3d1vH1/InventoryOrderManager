
// Import i18n first to ensure it's initialized before anything else
import i18n from './i18n';
import './index.css';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { I18nextProvider } from 'react-i18next';
import App from './App';

// Check if FontAwesome is loaded, if not add it again
document.addEventListener('DOMContentLoaded', () => {
  // Function to check if an element with a FontAwesome class has the expected style
  const isFontAwesomeLoaded = () => {
    const testIcon = document.createElement('i');
    testIcon.className = 'fas fa-user';
    testIcon.style.visibility = 'hidden';
    document.body.appendChild(testIcon);
    
    // Get the font-family computed style
    const fontFamily = window.getComputedStyle(testIcon).getPropertyValue('font-family');
    const result = fontFamily.includes('Font Awesome');
    
    document.body.removeChild(testIcon);
    return result;
  };

  // If FontAwesome isn't loaded, add it again
  if (!isFontAwesomeLoaded()) {
    console.log('FontAwesome not detected, loading fallback...');
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css';
    document.head.appendChild(link);
  }
});

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
