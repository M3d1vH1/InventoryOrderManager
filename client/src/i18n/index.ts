
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import el from './translations/el.json';
import en from './translations/en.json';

const resources = {
  en: { translation: en },
  el: { translation: el }
};

// Initialize i18next
i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'el', // Default language is Greek
    fallbackLng: 'en',
    debug: true, // Enable debug mode to see console messages
    interpolation: {
      escapeValue: false
    },
    react: {
      useSuspense: false // Disable suspense to prevent issues
    }
  });

// Force language to Greek
i18n.changeLanguage('el');

// Add language detection debugging
console.log('Current language:', i18n.language);
console.log('Languages available:', Object.keys(resources));
console.log('Greek translation sample:', i18n.t('app.title'));

export default i18n;
