
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import el from './translations/el.json';
import en from './translations/en.json';

const resources = {
  en: { translation: en },
  el: { translation: el }
};

// Set up i18next instance with simple configuration
i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'en',
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false
    },
    react: {
      useSuspense: false
    }
  });

// Get saved language preference or use browser detection
const savedLang = localStorage.getItem('i18nextLng');
if (savedLang) {
  i18n.changeLanguage(savedLang);
}

// Log debug info in development
if (import.meta.env.DEV) {
  console.log('i18n initialized with language:', i18n.language);
}

export default i18n;
