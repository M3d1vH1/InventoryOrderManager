
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import el from './translations/el.json';
import en from './translations/en.json';

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    el: { translation: el }
  },
  lng: 'el',
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false
  }
});

export default i18n;
