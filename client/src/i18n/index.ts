
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import el from './translations/el.json';
import en from './translations/en.json';

const resources = {
  en: { translation: en },
  el: { translation: el }
};

// Try to get any saved language preference
let initialLanguage = 'en';
try {
  const savedLang = localStorage.getItem('app-language');
  if (savedLang && (savedLang === 'en' || savedLang === 'el')) {
    initialLanguage = savedLang;
  }
} catch (e) {
  console.warn('Could not access localStorage for language preference');
}

// Set up i18next instance with simple configuration
i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: initialLanguage,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false
    },
    react: {
      useSuspense: false
    }
  });

// Log debug info in development
if (import.meta.env.DEV) {
  console.log('i18n initialized with language:', i18n.language);
}

// Update App title based on language
const updateAppTitle = () => {
  document.title = i18n.language === 'en' ? 'Warehouse Management' : 'Διαχείριση Αποθήκης';
  console.log('App language set to:', i18n.language);
  console.log('App title:', document.title);
};

// Set initial title
updateAppTitle();

// Listen for language changes
i18n.on('languageChanged', (lng) => {
  localStorage.setItem('app-language', lng);
  updateAppTitle();
});

export default i18n;
